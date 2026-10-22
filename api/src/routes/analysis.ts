import { type Context, Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { readAnalysisConfig } from '#analysis/config'
import { summarizeArticle, verifyComment } from '#analysis/service'
import type { AnalysisFailure } from '#analysis/types'
import { ArticleSchema } from '#contracts/article'
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

export const createAnalysisRoute = (
  options: AnalysisRouteOptions = {},
): Hono => {
  const route = new Hono()
  const getEnv = options.env ?? (() => process.env)
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

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
    const body = await ResultAsync.fromPromise(
      Promise.resolve().then(() => context.req.json()),
      () => 'invalid-request' as const,
    )
    if (body.isErr()) {
      return context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request body must be valid JSON.',
        ),
        400,
      )
    }

    const input = SummaryRequestSchema.safeParse(body.value)
    if (!input.success) {
      return context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request does not match the analysis contract.',
        ),
        400,
      )
    }
    if (input.data.article.text.trim().length === 0) {
      return jsonError(context, { kind: 'insufficient' })
    }

    const config = readAnalysisConfig(getEnv())
    if (config.isErr()) {
      return jsonError(context, config.error)
    }

    return summarizeArticle(
      input.data.article,
      config.value,
      fetchImpl,
      timeoutMs,
    ).match(
      (summary) => context.json(summary),
      (failure) => jsonError(context, failure),
    )
  })

  route.post('/verify', async (context) => {
    const body = await ResultAsync.fromPromise(
      Promise.resolve().then(() => context.req.json()),
      () => 'invalid-request' as const,
    )
    if (body.isErr()) {
      return context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request body must be valid JSON.',
        ),
        400,
      )
    }

    const input = VerificationRequestSchema.safeParse(body.value)
    if (!input.success) {
      return context.json(
        bodyError(
          'INVALID_ANALYSIS_REQUEST',
          'The request does not match the analysis contract.',
        ),
        400,
      )
    }
    if (input.data.article.text.trim().length === 0) {
      return jsonError(context, { kind: 'insufficient' })
    }

    const config = readAnalysisConfig(getEnv())
    if (config.isErr()) {
      return jsonError(context, config.error)
    }

    return verifyComment(
      input.data.article,
      input.data.comment,
      config.value,
      fetchImpl,
      timeoutMs,
    ).match(
      (verification) => context.json(verification),
      (failure) => jsonError(context, failure),
    )
  })

  return route
}

export const analysisRoute = createAnalysisRoute()
