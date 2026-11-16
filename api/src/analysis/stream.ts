import { TextDecoder } from 'node:util'

import { createParser, type EventSourceMessage } from 'eventsource-parser'
import {
  err,
  errAsync,
  ok,
  Result,
  type Result as ResultType,
  ResultAsync,
} from 'neverthrow'
import { z } from 'zod'

import { summarizeZodIssues } from '#analysis/diagnostics'
import type { AnalysisFailure } from '#analysis/types'

const MAX_RECEIVED_BYTES = 1024 * 1024
const MAX_PARSER_BUFFER_SIZE = 128 * 1024
const MAX_CONTENT_LENGTH = 64 * 1024

const DeltaSchema = z.looseObject({
  content: z.string().nullable().optional(),
  refusal: z.string().nullable().optional(),
  tool_calls: z.array(z.unknown()).nullable().optional(),
  function_call: z.unknown().optional(),
})

const ChoiceSchema = z.looseObject({
  index: z.number().int(),
  delta: DeltaSchema.optional(),
  finish_reason: z.string().nullable().optional(),
})

const ChatChunkSchema = z.looseObject({ choices: z.array(ChoiceSchema) })

type CompletionState = {
  content: string
  finished: boolean
  done: boolean
}

const invalidResponse = (
  reason: Extract<AnalysisFailure, { kind: 'invalid-response' }>['reason'],
  details?: Extract<AnalysisFailure, { kind: 'invalid-response' }>['details'],
): AnalysisFailure => ({
  kind: 'invalid-response',
  reason,
  ...(details === undefined ? {} : { details }),
})

const parseChunk = (
  data: string,
): ResultType<z.infer<typeof ChatChunkSchema>, AnalysisFailure> => {
  const json = Result.fromThrowable(
    () => JSON.parse(data) as unknown,
    () => invalidResponse('chunk-json', { outputLength: data.length }),
  )()
  if (json.isErr()) {
    return err(json.error)
  }

  const parsed = ChatChunkSchema.safeParse(json.value)
  return parsed.success
    ? ok(parsed.data)
    : err(
        invalidResponse('chunk-schema', {
          issues: summarizeZodIssues(parsed.error.issues),
        }),
      )
}

const processEvent = (
  event: EventSourceMessage,
  state: CompletionState,
): ResultType<void, AnalysisFailure> => {
  if (state.done || (event.event !== undefined && event.event !== 'message')) {
    return err(invalidResponse('unexpected-event'))
  }

  if (event.data === '[DONE]') {
    state.done = true
    return ok(undefined)
  }

  const parsed = parseChunk(event.data)
  if (parsed.isErr()) {
    return err(parsed.error)
  }
  if (Object.hasOwn(parsed.value, 'error')) {
    return err(invalidResponse('upstream-error-field'))
  }

  const { choices } = parsed.value
  if (choices.length === 0) {
    return state.finished && !Object.hasOwn(parsed.value, 'usage')
      ? err(invalidResponse('empty-choices'))
      : ok(undefined)
  }
  if (state.finished) {
    return err(invalidResponse('unexpected-event'))
  }

  if (choices.length !== 1 || choices[0]?.index !== 0) {
    return err(
      invalidResponse('choice-shape', {
        choicesCount: choices.length,
        ...(choices[0] === undefined ? {} : { choiceIndex: choices[0].index }),
      }),
    )
  }

  const choice = choices[0]
  const delta = choice.delta
  if (
    delta?.refusal !== undefined &&
    delta.refusal !== null &&
    delta.refusal.length > 0
  ) {
    return err(invalidResponse('refusal'))
  }
  if (delta?.tool_calls !== undefined && delta.tool_calls !== null) {
    if (delta.tool_calls.length > 0) {
      return err(
        invalidResponse('tool-call', {
          toolCallCount: delta.tool_calls.length,
        }),
      )
    }
  }
  if (delta?.function_call !== undefined) {
    return err(invalidResponse('tool-call', { hasFunctionCall: true }))
  }

  const finishesNow =
    choice.finish_reason !== undefined && choice.finish_reason !== null
  if (finishesNow) {
    if (choice.finish_reason !== 'stop') {
      const finishReason = choice.finish_reason
      return err(
        invalidResponse('finish-reason', {
          finishReason:
            finishReason === 'length' ||
            finishReason === 'content_filter' ||
            finishReason === 'tool_calls' ||
            finishReason === 'function_call'
              ? finishReason
              : 'other',
        }),
      )
    }
  }

  if (
    delta?.content !== undefined &&
    delta.content !== null &&
    delta.content.length > 0
  ) {
    state.content += delta.content
    if (state.content.length > MAX_CONTENT_LENGTH) {
      return err(
        invalidResponse('content-limit', {
          contentLength: state.content.length,
          limit: MAX_CONTENT_LENGTH,
        }),
      )
    }
  }

  if (finishesNow) {
    state.finished = true
  }

  return ok(undefined)
}

const decodeChunk = (
  decoder: TextDecoder,
  value: Uint8Array,
): ResultType<string, AnalysisFailure> =>
  Result.fromThrowable(
    () => decoder.decode(value, { stream: true }),
    () => invalidResponse('invalid-utf8'),
  )()

const readError = (signal: AbortSignal): AnalysisFailure =>
  signal.aborted
    ? { kind: 'timeout', reason: 'stream-timeout' }
    : { kind: 'upstream-failure', reason: 'stream-read-failed' }

const finalizeCompletion = (
  state: CompletionState,
  signal: AbortSignal,
): ResultType<string, AnalysisFailure> =>
  state.done && state.finished
    ? signal.aborted
      ? err({ kind: 'timeout', reason: 'stream-timeout' })
      : ok(state.content)
    : err(
        invalidResponse('missing-completion', {
          receivedDone: state.done,
          receivedFinish: state.finished,
        }),
      )

export const collectCompletion = (
  response: Response,
  signal: AbortSignal,
): ResultAsync<string, AnalysisFailure> => {
  const body = response.body
  if (!body) {
    return errAsync(invalidResponse('missing-body'))
  }

  const readerResult = Result.fromThrowable(
    () => body.getReader(),
    () => invalidResponse('missing-body'),
  )()
  if (readerResult.isErr()) {
    return errAsync(readerResult.error)
  }

  const reader = readerResult.value
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const state: CompletionState = { content: '', finished: false, done: false }
  let receivedBytes = 0
  let parserFailure = false
  let eventFailure: AnalysisFailure | undefined

  const parser = createParser({
    maxBufferSize: MAX_PARSER_BUFFER_SIZE,
    onError: () => {
      parserFailure = true
    },
    onEvent: (event) => {
      if (eventFailure === undefined && !parserFailure) {
        processEvent(event, state).match(
          () => undefined,
          (failure) => {
            eventFailure = failure
          },
        )
      }
    },
  })

  const feedParser = (text: string): ResultType<void, AnalysisFailure> => {
    const feed = Result.fromThrowable(
      () => {
        parser.feed(text)
      },
      () => invalidResponse('sse-parser'),
    )()
    if (eventFailure !== undefined) {
      return err(eventFailure)
    }
    if (feed.isErr() || parserFailure) {
      return err(invalidResponse('sse-parser'))
    }
    return ok(undefined)
  }

  const cancelReader = (): void => {
    const cancellation = Result.fromThrowable(
      () => {
        return reader.cancel()
      },
      () => invalidResponse('sse-parser'),
    )()
    if (cancellation.isErr()) {
      return
    }

    void ResultAsync.fromPromise(cancellation.value, () =>
      invalidResponse('sse-parser'),
    ).match(
      () => undefined,
      () => undefined,
    )
  }

  const fail = (
    failure: AnalysisFailure,
  ): ResultType<string, AnalysisFailure> => {
    cancelReader()
    return err(failure)
  }

  const readStream = async (): Promise<ResultType<string, AnalysisFailure>> => {
    for (;;) {
      const read = await ResultAsync.fromPromise(
        Promise.resolve().then(() => reader.read()),
        () => readError(signal),
      )
      if (read.isErr()) {
        return fail(read.error)
      }
      if (read.value.done) {
        break
      }

      const bytes: unknown = read.value.value
      if (!(bytes instanceof Uint8Array)) {
        return fail(invalidResponse('sse-parser'))
      }
      receivedBytes += bytes.byteLength
      if (receivedBytes > MAX_RECEIVED_BYTES) {
        return fail(
          invalidResponse('stream-limit', {
            receivedBytes,
            limit: MAX_RECEIVED_BYTES,
          }),
        )
      }

      const decoded = decodeChunk(decoder, bytes)
      if (decoded.isErr()) {
        return fail(decoded.error)
      }

      const feed = feedParser(decoded.value)
      if (feed.isErr()) {
        return fail(feed.error)
      }
    }

    const finalText = Result.fromThrowable(
      () => decoder.decode(),
      () => invalidResponse('invalid-utf8'),
    )()
    if (finalText.isErr()) {
      return fail(finalText.error)
    }

    const finalFeed = feedParser(finalText.value)
    if (finalFeed.isErr()) {
      return fail(finalFeed.error)
    }

    const completion = finalizeCompletion(state, signal)
    return completion.isErr() ? fail(completion.error) : completion
  }

  return ResultAsync.fromPromise(readStream(), (): AnalysisFailure =>
    readError(signal),
  ).andThen((result) => result)
}
