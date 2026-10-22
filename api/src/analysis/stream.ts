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

const invalidResponse = (): AnalysisFailure => ({ kind: 'invalid-response' })

const parseChunk = (
  data: string,
): ResultType<z.infer<typeof ChatChunkSchema>, AnalysisFailure> => {
  const json = Result.fromThrowable(
    () => JSON.parse(data) as unknown,
    invalidResponse,
  )()
  if (json.isErr()) {
    return err(json.error)
  }

  const parsed = ChatChunkSchema.safeParse(json.value)
  return parsed.success ? ok(parsed.data) : err(invalidResponse())
}

const processEvent = (
  event: EventSourceMessage,
  state: CompletionState,
): ResultType<void, AnalysisFailure> => {
  if (state.done || (event.event !== undefined && event.event !== 'message')) {
    return err(invalidResponse())
  }

  if (event.data === '[DONE]') {
    state.done = true
    return ok(undefined)
  }
  if (state.finished) {
    return err(invalidResponse())
  }

  const parsed = parseChunk(event.data)
  if (parsed.isErr()) {
    return err(parsed.error)
  }
  if (Object.hasOwn(parsed.value, 'error')) {
    return err(invalidResponse())
  }

  const { choices } = parsed.value
  if (choices.length === 0) {
    return ok(undefined)
  }

  if (choices.length !== 1 || choices[0]?.index !== 0) {
    return err(invalidResponse())
  }

  const choice = choices[0]
  const delta = choice.delta
  if (
    (delta?.refusal !== undefined &&
      delta.refusal !== null &&
      delta.refusal.length > 0) ||
    (delta?.tool_calls !== undefined &&
      delta.tool_calls !== null &&
      delta.tool_calls.length > 0) ||
    delta?.function_call !== undefined
  ) {
    return err(invalidResponse())
  }

  const finishesNow =
    choice.finish_reason !== undefined && choice.finish_reason !== null
  if (finishesNow) {
    if (choice.finish_reason !== 'stop') {
      return err(invalidResponse())
    }
  }

  if (
    delta?.content !== undefined &&
    delta.content !== null &&
    delta.content.length > 0
  ) {
    state.content += delta.content
    if (state.content.length > MAX_CONTENT_LENGTH) {
      return err(invalidResponse())
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
    invalidResponse,
  )()

const readError = (signal: AbortSignal): AnalysisFailure =>
  signal.aborted ? { kind: 'timeout' } : { kind: 'upstream-failure' }

const finalizeCompletion = (
  state: CompletionState,
  signal: AbortSignal,
): ResultType<string, AnalysisFailure> =>
  state.done && state.finished
    ? signal.aborted
      ? err({ kind: 'timeout' })
      : ok(state.content)
    : err(invalidResponse())

export const collectCompletion = (
  response: Response,
  signal: AbortSignal,
): ResultAsync<string, AnalysisFailure> => {
  const body = response.body
  if (!body) {
    return errAsync(invalidResponse())
  }

  const readerResult = Result.fromThrowable(
    () => body.getReader(),
    invalidResponse,
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
    const feed = Result.fromThrowable(() => {
      parser.feed(text)
    }, invalidResponse)()
    if (eventFailure !== undefined) {
      return err(eventFailure)
    }
    if (feed.isErr() || parserFailure) {
      return err(invalidResponse())
    }
    return ok(undefined)
  }

  const cancelReader = (): void => {
    const cancellation = Result.fromThrowable(() => {
      return reader.cancel()
    }, invalidResponse)()
    if (cancellation.isErr()) {
      return
    }

    void ResultAsync.fromPromise(cancellation.value, invalidResponse).match(
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
        return fail(invalidResponse())
      }
      receivedBytes += bytes.byteLength
      if (receivedBytes > MAX_RECEIVED_BYTES) {
        return fail(invalidResponse())
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
      invalidResponse,
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
