import { err, Result, ResultAsync } from 'neverthrow'

import type { ChatMessage } from '#analysis/prompts'
import { collectCompletion } from '#analysis/stream'
import type { AnalysisConfig, AnalysisFailure } from '#analysis/types'

const cancelResponseBody = (response: Response): void => {
  const body = response.body
  if (body === null) {
    return
  }

  const cancellation = Result.fromThrowable(
    () => body.cancel(),
    (): AnalysisFailure => ({ kind: 'upstream-failure' }),
  )()
  if (cancellation.isErr()) {
    return
  }

  void ResultAsync.fromPromise(cancellation.value, (): AnalysisFailure => ({
    kind: 'upstream-failure',
  })).match(
    () => undefined,
    () => undefined,
  )
}

export const requestCompletion = (
  config: AnalysisConfig,
  messages: ChatMessage[],
  fetchImpl: typeof fetch,
  timeoutMs: number,
): ResultAsync<string, AnalysisFailure> => {
  const signal = AbortSignal.timeout(timeoutMs)
  const endpoint = `${config.baseUrl}/chat/completions`
  const request = Promise.resolve().then(() =>
    fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({ model: config.model, stream: true, messages }),
      signal,
    }),
  )

  return ResultAsync.fromPromise(request, (): AnalysisFailure =>
    signal.aborted ? { kind: 'timeout' } : { kind: 'upstream-failure' },
  ).andThen((response) => {
    if (!response.ok) {
      cancelResponseBody(response)
      return err({ kind: 'upstream-failure' } as const)
    }

    const mediaType = response.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (mediaType !== 'text/event-stream') {
      cancelResponseBody(response)
      return err({ kind: 'invalid-response' } as const)
    }

    return collectCompletion(response, signal)
  })
}
