import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { err, ok, type Result as ResultType, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { readAnalysisConfig } from '#analysis/config'
import { summarizeArticle, verifyComment } from '#analysis/service'
import type { AnalysisConfig, AnalysisFailure } from '#analysis/types'
import { type Article, ArticleSchema } from '#contracts/article'
import type { ApiErrorEnvelope } from '#contracts/error'

const SummaryRequestSchema = z.object({ article: ArticleSchema }).strict()
const VerificationRequestSchema = z
  .object({
    article: ArticleSchema,
    comment: z
      .string()
      .min(1)
      .refine((comment) => comment.trim().length > 0),
  })
  .strict()

const bodyError = (code: string, message: string) =>
  ({ error: { code, message } }) satisfies ApiErrorEnvelope

const jsonError = (context: Context, failure: AnalysisFailure) => {
  const response = (() => {
    switch (failure.kind) {
      case 'unavailable':
        return {
          status: 503 as const,
          code: 'ANALYSIS_UNAVAILABLE',
          message: 'Analysis is unavailable.',
        }
      case 'insufficient':
        return {
          status: 422 as const,
          code: 'ARTICLE_INSUFFICIENT',
          message:
            'The article does not contain enough information for analysis.',
        }
      case 'timeout':
        return {
          status: 504 as const,
          code: 'ANALYSIS_TIMEOUT',
          message: 'The analysis request timed out.',
        }
      case 'invalid-response':
        return {
          status: 502 as const,
          code: 'INVALID_ANALYSIS_RESPONSE',
          message: 'The analysis service returned an invalid response.',
        }
      case 'upstream-failure':
        return {
          status: 502 as const,
          code: 'ANALYSIS_UPSTREAM_FAILURE',
          message: 'The analysis service could not complete the request.',
        }
    }
  })()

  return context.json(
    bodyError(response.code, response.message),
    response.status,
  )
}

type AnalysisRouteOptions = {
  env?: () => Readonly<Record<string, string | undefined>>
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const MAX_REQUEST_BYTES = 1024 * 1024
const DEFAULT_TIMEOUT_MS = 120_000
type InvalidRequest = 'invalid-json' | 'invalid-contract'

const readRequest = async <Schema extends z.ZodType>(
  context: Context,
  schema: Schema,
): Promise<ResultType<z.infer<Schema>, InvalidRequest>> => {
  const body = await ResultAsync.fromPromise(
    Promise.resolve().then(() => context.req.json()),
    (): InvalidRequest => 'invalid-json',
  )
  if (body.isErr()) {
    return err(body.error)
  }

  const input = schema.safeParse(body.value)
  return input.success ? ok(input.data) : err('invalid-contract')
}

const invalidRequestError = (context: Context, failure: InvalidRequest) =>
  failure === 'invalid-json'
    ? context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request body must be valid JSON.',
        ),
        400,
      )
    : context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request does not match the analysis contract.',
        ),
        400,
      )

export const createAnalysisRoute = (
  options: AnalysisRouteOptions = {},
): Hono => {
  const route = new Hono()
  const getEnv = options.env ?? (() => process.env)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const runAnalysis = <Output>(
    context: Context,
    article: Article,
    analyze: (config: AnalysisConfig) => ResultAsync<Output, AnalysisFailure>,
  ) => {
    if (article.text.trim().length === 0) {
      return jsonError(context, { kind: 'insufficient' })
    }

    const config = readAnalysisConfig(getEnv())
    if (config.isErr()) {
      return jsonError(context, config.error)
    }

    return analyze(config.value).match(
      (result) => context.json(result),
      (failure) => jsonError(context, failure),
    )
  }

  route.use(
    '*',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (context) =>
        context.json(
          bodyError(
            'REQUEST_TOO_LARGE',
            'The request body exceeds the size limit.',
          ),
          413,
        ),
    }),
  )

  route.post('/summary', async (context) => {
    const input = await readRequest(context, SummaryRequestSchema)
    if (input.isErr()) {
      return invalidRequestError(context, input.error)
    }

    return runAnalysis(context, input.value.article, (config) =>
      summarizeArticle(input.value.article, config, fetchImpl, timeoutMs),
    )
  })

  route.post('/verify', async (context) => {
    const input = await readRequest(context, VerificationRequestSchema)
    if (input.isErr()) {
      return invalidRequestError(context, input.error)
    }

    return runAnalysis(context, input.value.article, (config) =>
      verifyComment(
        input.value.article,
        input.value.comment,
        config,
        fetchImpl,
        timeoutMs,
      ),
    )
  })

  return route
}

export const analysisRoute = createAnalysisRoute()
