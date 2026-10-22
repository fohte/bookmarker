import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import type { PublishAdapterError } from '#destinations/types'

type RequestMode = 'read' | 'write'
type RequestMethod = 'GET' | 'POST' | 'PUT'

const apiOrigin = 'https://api.raindrop.io'
const timeoutMilliseconds = 10_000
const maximumResponseBytes = 1_000_000

export const raindropFailed = (
  code: PublishAdapterError['code'],
  retryable = false,
): PublishAdapterError => ({
  code,
  outcome: 'failed',
  retryable,
})

export const raindropUnknown = (
  code: PublishAdapterError['code'],
): PublishAdapterError => ({
  code,
  outcome: 'unknown',
  retryable: false,
})

const unavailableFailure = (mode: RequestMode): PublishAdapterError =>
  mode === 'write'
    ? raindropUnknown('unavailable')
    : raindropFailed('unavailable', true)

export const raindropInvalidResponse = (
  mode: RequestMode,
): PublishAdapterError =>
  mode === 'write'
    ? raindropUnknown('invalid_response')
    : raindropFailed('invalid_response')

const cancelAndFail = (
  cancel: () => Promise<unknown> | undefined,
  error: PublishAdapterError,
): ResultAsync<never, PublishAdapterError> =>
  ResultAsync.fromPromise(Promise.resolve().then(cancel), () => error).andThen(
    () => errAsync(error),
  )

const statusFailure = (
  status: number,
  mode: RequestMode,
): PublishAdapterError => {
  if (status === 429) {
    return raindropFailed('rate_limited', true)
  }

  if (status === 401 || status === 403) {
    return raindropFailed('unauthorized')
  }

  if (status === 408 || status >= 500) {
    return mode === 'write'
      ? raindropUnknown('unavailable')
      : raindropFailed('unavailable', true)
  }

  return raindropFailed('rejected')
}

const discardResponse = (
  response: Response,
  error: PublishAdapterError,
): ResultAsync<never, PublishAdapterError> => {
  if (response.body === null) {
    return errAsync(error)
  }

  return cancelAndFail(() => response.body?.cancel(), error)
}

const readResponseBody = (
  response: Response,
  mode: RequestMode,
): ResultAsync<string, PublishAdapterError> => {
  if (response.body === null) {
    return okAsync('')
  }

  const readerResult = ResultAsync.fromPromise(
    Promise.resolve().then(() => response.body?.getReader()),
    () => unavailableFailure(mode),
  )

  return readerResult.andThen((reader) => {
    if (reader === undefined) {
      return okAsync('')
    }

    const chunks: Uint8Array[] = []
    const readNext = (
      totalBytes: number,
    ): ResultAsync<string, PublishAdapterError> =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() => reader.read()),
        () => unavailableFailure(mode),
      ).andThen(({ done, value }) => {
        if (done) {
          const bytes = new Uint8Array(totalBytes)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
          }
          return okAsync(new TextDecoder().decode(bytes))
        }

        const rawChunk: unknown = value
        if (!(rawChunk instanceof Uint8Array)) {
          return errAsync(raindropInvalidResponse(mode))
        }

        const nextTotalBytes = totalBytes + rawChunk.byteLength

        if (nextTotalBytes > maximumResponseBytes) {
          const error = raindropInvalidResponse(mode)
          return cancelAndFail(() => reader.cancel(), error)
        }

        chunks.push(rawChunk)
        return readNext(nextTotalBytes)
      })

    return readNext(0)
  })
}

export const requestRaindropJson = (
  token: string,
  path: string,
  method: RequestMethod,
  mode: RequestMode,
  body?: unknown,
): ResultAsync<unknown, PublishAdapterError> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: 'Bearer ' + token,
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const init: RequestInit = {
    method,
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMilliseconds),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }

  return ResultAsync.fromPromise(
    Promise.resolve().then(() => fetch(apiOrigin + path, init)),
    () => unavailableFailure(mode),
  ).andThen((response) => {
    if (!response.ok) {
      return discardResponse(response, statusFailure(response.status, mode))
    }

    return readResponseBody(response, mode).andThen((text) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() => JSON.parse(text) as unknown),
        () => raindropInvalidResponse(mode),
      ),
    )
  })
}
