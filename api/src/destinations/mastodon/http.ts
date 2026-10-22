import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import type { MastodonConfig } from '#destinations/mastodon/config'

const requestTimeoutMs = 10_000
const maxResponseBytes = 64 * 1024

export type MastodonHttpError = {
  code: 'unavailable' | 'invalid_response'
}

const unavailable = (): MastodonHttpError => ({ code: 'unavailable' })
const invalidResponse = (): MastodonHttpError => ({
  code: 'invalid_response',
})

export const requestMastodon = (
  url: URL,
  init: RequestInit,
): ResultAsync<Response, MastodonHttpError> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() =>
      fetch(url, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.timeout(requestTimeoutMs),
      }),
    ),
    unavailable,
  )

const cancelResponseBody = (response: Response): void => {
  const cancellation = response.body?.cancel()
  if (cancellation) {
    void cancellation.catch(() => undefined)
  }
}

export const discardMastodonResponse = (response: Response): void => {
  cancelResponseBody(response)
}

const joinChunks = (
  chunks: readonly Uint8Array[],
  length: number,
): Uint8Array => {
  const body = new Uint8Array(length)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body
}

const readBoundedBody = (
  response: Response,
): ResultAsync<Uint8Array, MastodonHttpError> => {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    cancelResponseBody(response)
    return errAsync(invalidResponse())
  }

  if (!response.body) {
    return errAsync(invalidResponse())
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0

  const readNext = (): ResultAsync<Uint8Array, MastodonHttpError> =>
    ResultAsync.fromPromise(reader.read(), invalidResponse).andThen(
      ({ done, value }) => {
        if (done) {
          return okAsync(joinChunks(chunks, length))
        }

        if (length + value.byteLength > maxResponseBytes) {
          void reader.cancel().catch(() => undefined)
          return errAsync(invalidResponse())
        }

        chunks.push(value)
        length += value.byteLength
        return readNext()
      },
    )

  return readNext()
}

export const readMastodonJson = (
  response: Response,
): ResultAsync<unknown, MastodonHttpError> =>
  readBoundedBody(response).andThen((body) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(
        () =>
          JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(body),
          ) as unknown,
      ),
      invalidResponse,
    ),
  )

export const mastodonApiUrl = (
  config: MastodonConfig,
  path: string,
): URL | undefined =>
  config.baseUrl ? new URL(path, config.baseUrl) : undefined
