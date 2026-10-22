import type { Article, ShareInput, Summary, Verification } from 'api/contracts'
import {
  ApiErrorEnvelopeSchema,
  ArticleSchema,
  ShareInputSchema,
  SummarySchema,
  VerificationSchema,
} from 'api/contracts'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'

type ResponseSchema<T> = {
  safeParse: (value: unknown) => { success: true; data: T } | { success: false }
}

export type AnalysisClientError =
  | { kind: 'network'; message: string }
  | { kind: 'authentication-required'; message: string }
  | { kind: 'http'; status: number; code?: string; message: string }
  | { kind: 'invalid-response'; message: string }
  | { kind: 'invalid-input'; message: string }
  | { kind: 'cancelled'; message: string }

export type AnalysisRequestOptions = {
  signal?: AbortSignal
}

const networkError = (): AnalysisClientError => ({
  kind: 'network',
  message: 'The request could not reach the server.',
})

const authenticationError = (): AnalysisClientError => ({
  kind: 'authentication-required',
  message: 'Authentication is required to use article analysis.',
})

const invalidResponseError = (): AnalysisClientError => ({
  kind: 'invalid-response',
  message: 'The server returned an invalid response.',
})

const invalidInputError = (): AnalysisClientError => ({
  kind: 'invalid-input',
  message: 'The request does not match the article analysis contract.',
})

const cancelledError = (): AnalysisClientError => ({
  kind: 'cancelled',
  message: 'The request was cancelled.',
})

const errorAsync = <T>(
  error: AnalysisClientError,
): ResultAsync<T, AnalysisClientError> =>
  errAsync<T, AnalysisClientError>(error)

export const invalidInputAsync = <T>(): ResultAsync<T, AnalysisClientError> =>
  errorAsync(invalidInputError())

const isAbortError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  error.name === 'AbortError'

const isAccessLoginResponse = (response: Response): boolean => {
  const accessChallenge =
    response.headers
      .get('www-authenticate')
      ?.includes('.well-known/cloudflare-access-protected-resource/') ?? false
  const accessLoginRedirect =
    response.redirected &&
    /^https:\/\/[^/]+\.cloudflareaccess\.com\/cdn-cgi\/access\/login\//i.test(
      response.url,
    )

  return accessChallenge || accessLoginRedirect
}

const apiErrorCode = (value: unknown): string | undefined => {
  const parsed = ApiErrorEnvelopeSchema.safeParse(value)
  return parsed.success ? parsed.data.error.code : undefined
}

const isAuthenticationFailure = (
  response: Response,
  body: unknown,
): boolean => {
  if (isAccessLoginResponse(response) || response.status === 401) return true

  const code = apiErrorCode(body)
  return (
    response.status === 403 &&
    (code === 'authentication_required' || code === 'unauthorized')
  )
}

const httpError = (response: Response, body: unknown): AnalysisClientError => {
  if (isAuthenticationFailure(response, body)) return authenticationError()

  const code = apiErrorCode(body)
  return {
    kind: 'http',
    status: response.status,
    ...(code === undefined ? {} : { code }),
    message: 'The server rejected the request.',
  }
}

const errorFromResponse = <T>(
  response: Response,
  signal: AbortSignal | undefined,
): ResultAsync<T, AnalysisClientError> => {
  if (signal?.aborted === true) return errorAsync(cancelledError())

  const body = Promise.resolve()
    .then(() => response.json() as Promise<unknown>)
    .then(
      (value) => ({ success: true as const, value }),
      (error: unknown) => ({ success: false as const, error }),
    )

  return ResultAsync.fromSafePromise(body).andThen((parsedBody) =>
    errorAsync<T>(
      signal?.aborted === true ||
        (!parsedBody.success && isAbortError(parsedBody.error))
        ? cancelledError()
        : httpError(
            response,
            parsedBody.success ? parsedBody.value : undefined,
          ),
    ),
  )
}

const postJson = <T>(
  path: string,
  body: unknown,
  schema: ResponseSchema<T>,
  signal?: AbortSignal,
): ResultAsync<T, AnalysisClientError> => {
  if (signal?.aborted === true) return errorAsync(cancelledError())

  const encodedBody = Result.fromThrowable(
    (value: unknown) => JSON.stringify(value),
    invalidInputError,
  )(body)
  if (encodedBody.isErr()) return errorAsync(encodedBody.error)
  return ResultAsync.fromPromise(
    Promise.resolve().then(() =>
      fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: encodedBody.value,
        ...(signal === undefined ? {} : { signal }),
      }),
    ),
    (error) =>
      signal?.aborted === true || isAbortError(error)
        ? cancelledError()
        : networkError(),
  ).andThen((response) => {
    if (isAccessLoginResponse(response)) {
      return errorAsync<T>(authenticationError())
    }
    if (!response.ok) return errorFromResponse<T>(response, signal)

    return ResultAsync.fromPromise(
      Promise.resolve().then(() => response.json() as Promise<unknown>),
      (error) =>
        signal?.aborted === true || isAbortError(error)
          ? cancelledError()
          : invalidResponseError(),
    ).andThen((value) => {
      if (signal?.aborted === true) return errorAsync<T>(cancelledError())

      const parsed = schema.safeParse(value)
      return parsed.success
        ? okAsync<T, AnalysisClientError>(parsed.data)
        : errorAsync<T>(invalidResponseError())
    })
  })
}

export const extractArticle = (
  input: ShareInput,
  options: AnalysisRequestOptions = {},
): ResultAsync<Article, AnalysisClientError> => {
  const parsed = ShareInputSchema.safeParse(input)
  if (!parsed.success) return errorAsync(invalidInputError())

  return postJson(
    '/api/articles/extract',
    parsed.data,
    ArticleSchema,
    options.signal,
  )
}

export const summarizeArticle = (
  article: Article,
  options: AnalysisRequestOptions = {},
): ResultAsync<Summary, AnalysisClientError> => {
  const parsed = ArticleSchema.safeParse(article)
  if (!parsed.success) return errorAsync(invalidInputError())

  return postJson(
    '/api/analysis/summary',
    { article: parsed.data },
    SummarySchema,
    options.signal,
  )
}

export const verifyComment = (
  article: Article,
  comment: string,
  options: AnalysisRequestOptions = {},
): ResultAsync<Verification, AnalysisClientError> => {
  const parsedArticle = ArticleSchema.safeParse(article)
  if (!parsedArticle.success || comment.trim().length === 0) {
    return errorAsync(invalidInputError())
  }

  return postJson(
    '/api/analysis/verify',
    { article: parsedArticle.data, comment },
    VerificationSchema,
    options.signal,
  )
}

export const createManualArticle = (input: {
  url: string
  title: string
  text: string
}): Result<Article, AnalysisClientError> => {
  const parsed = ArticleSchema.safeParse({
    ...input,
    source: 'manual',
    partial: true,
  })

  return parsed.success ? ok(parsed.data) : err(invalidInputError())
}
