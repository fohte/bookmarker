import { type Context, Hono } from 'hono'
import { okAsync, Result, ResultAsync } from 'neverthrow'

import type { ArticleExtractionError } from '#articles/errors'
import { createArticleExtractor } from '#articles/index'
import type { ArticleExtractor } from '#articles/types'
import { type ApiErrorEnvelope, ShareInputSchema } from '#contracts/index'

const REQUEST_BODY_LIMIT = 1024 * 1024
const REQUEST_BODY_TOO_LARGE = { kind: 'too-large' } as const
const INVALID_REQUEST_BODY = { kind: 'invalid-body' } as const

type RequestBodyError =
  typeof REQUEST_BODY_TOO_LARGE | typeof INVALID_REQUEST_BODY

const readRequestBody = (
  request: Request,
): ResultAsync<string, RequestBodyError> => {
  if (request.body === null) return okAsync('')

  let byteLength = 0
  let tooLarge = false
  const boundedBody = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        byteLength += chunk.byteLength
        if (byteLength > REQUEST_BODY_LIMIT) {
          tooLarge = true
          controller.error(new Error('Request body limit exceeded'))
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )

  return ResultAsync.fromPromise(new Response(boundedBody).text(), () =>
    tooLarge ? REQUEST_BODY_TOO_LARGE : INVALID_REQUEST_BODY,
  )
}
const errorResponse = (
  context: Context,
  code: string,
  message: string,
  status: 400 | 413 | 422 | 504,
) => {
  const envelope = { error: { code, message } } satisfies ApiErrorEnvelope
  return context.json(envelope, status)
}

const extractionErrorResponse = (
  context: Context,
  error: ArticleExtractionError,
) => {
  switch (error.kind) {
    case 'invalid-input':
      return errorResponse(
        context,
        'INVALID_INPUT',
        'The request is invalid.',
        400,
      )
    case 'unsafe-url':
      return errorResponse(
        context,
        'UNSAFE_URL',
        'The article URL is not allowed.',
        400,
      )
    case 'fetch-failed':
      return errorResponse(
        context,
        'ARTICLE_UNAVAILABLE',
        'The article could not be extracted.',
        422,
      )
    case 'timeout':
      return errorResponse(
        context,
        'ARTICLE_FETCH_TIMEOUT',
        'The article request timed out.',
        504,
      )
  }
}

export const createArticlesRouter = (
  extractor: ArticleExtractor = createArticleExtractor(),
) => {
  const router = new Hono()

  router.post('/extract', async (context) => {
    const body = await readRequestBody(context.req.raw)
    if (body.isErr()) {
      return body.error.kind === 'too-large'
        ? errorResponse(
            context,
            'REQUEST_TOO_LARGE',
            'The request body is too large.',
            413,
          )
        : errorResponse(
            context,
            'INVALID_INPUT',
            'The request body is invalid.',
            400,
          )
    }

    const json = Result.fromThrowable(
      JSON.parse,
      () => INVALID_REQUEST_BODY,
    )(body.value)
    if (json.isErr()) {
      return errorResponse(
        context,
        'INVALID_INPUT',
        'The request body is invalid.',
        400,
      )
    }

    const input = ShareInputSchema.safeParse(json.value)
    if (!input.success) {
      return errorResponse(
        context,
        'INVALID_INPUT',
        'The request is invalid.',
        400,
      )
    }

    const article = await extractor(input.data, context.req.raw.signal)
    if (article.isErr()) return extractionErrorResponse(context, article.error)

    return context.json(article.value, 200)
  })

  return router
}
