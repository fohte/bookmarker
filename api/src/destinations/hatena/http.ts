import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { createOAuthAuthorizationHeader } from '#destinations/hatena/oauth'

type OAuthCredentials = {
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
}

type SendOAuthFormInput = {
  fetch: typeof fetch
  url: URL
  body: URLSearchParams
  credentials?: OAuthCredentials
  authorization?: string
  callback?: string
  verifier?: string
  nonce?: string
  timestamp?: number
  timeoutMs: number
  headers?: Record<string, string>
}

export const sendOAuthForm = ({
  fetch: fetchRequest,
  url,
  body,
  credentials,
  authorization,
  callback,
  verifier,
  nonce,
  timestamp,
  timeoutMs,
  headers = {},
}: SendOAuthFormInput): ResultAsync<Response, 'request_failed'> => {
  const requestAuthorization =
    authorization ??
    (credentials === undefined
      ? ''
      : createOAuthAuthorizationHeader({
          method: 'POST',
          url,
          bodyParameters: body,
          ...credentials,
          ...(callback === undefined ? {} : { callback }),
          ...(verifier === undefined ? {} : { verifier }),
          ...(nonce === undefined ? {} : { nonce }),
          ...(timestamp === undefined ? {} : { timestamp }),
        }))

  return ResultAsync.fromPromise(
    fetchRequest(url, {
      method: 'POST',
      headers: {
        Authorization: requestAuthorization,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        ...headers,
      },
      body: body.toString(),
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    }),
    () => 'request_failed' as const,
  )
}

export const readResponseText = (
  response: Response,
  maximumBytes: number,
): ResultAsync<string, 'too_large' | 'read_failed'> => {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    void response.body?.cancel().catch(() => undefined)
    return errAsync('too_large')
  }

  if (response.body === null) {
    return okAsync('')
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> =
    response.body.getReader()
  const readChunks = async (): Promise<
    { kind: 'read'; bytes: Uint8Array } | { kind: 'too_large' }
  > => {
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    let next = await reader.read()

    while (!next.done) {
      totalBytes += next.value.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel().catch(() => undefined)
        return { kind: 'too_large' }
      }
      chunks.push(next.value)
      next = await reader.read()
    }

    const bytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return { kind: 'read', bytes }
  }

  return ResultAsync.fromPromise(
    readChunks(),
    () => 'read_failed' as const,
  ).andThen((result) =>
    result.kind === 'too_large'
      ? errAsync<string, 'too_large' | 'read_failed'>('too_large')
      : okAsync(new TextDecoder().decode(result.bytes)),
  )
}

export const discardResponseBody = (response: Response): void => {
  void response.body?.cancel().catch(() => undefined)
}
