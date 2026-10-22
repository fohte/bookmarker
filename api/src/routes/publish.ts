import { PublishRequestSchema } from 'api/contracts'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'

import {
  createPublishOperations,
  InflightPublishGuard,
} from '#destinations/publish'
import type { DestinationRegistry } from '#destinations/types'

const errorResponse = (
  code: string,
  message: string,
  status: 400 | 409 | 503,
) => ({
  error: { code, message },
  status,
})

export const registerPublishRoute = (
  app: Hono,
  registry: DestinationRegistry,
  guard = new InflightPublishGuard(),
): void => {
  app.post('/api/publish', async (context) => {
    const body = await ResultAsync.fromThrowable(
      () => context.req.json<unknown>(),
      () => 'invalid_json' as const,
    )().match(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    )

    if (!body.ok) {
      const response = errorResponse(
        'invalid_json',
        'The request body must be valid JSON.',
        400,
      )
      return context.json({ error: response.error }, response.status)
    }

    const parsed = PublishRequestSchema.safeParse(body.value)
    if (!parsed.success) {
      const response = errorResponse(
        'invalid_request',
        'The publish request is invalid.',
        400,
      )
      return context.json({ error: response.error }, response.status)
    }

    const { article, targets } = parsed.data
    const results = await guard
      .publish(createPublishOperations(registry, article, targets))
      .match(
        (value) => ({ ok: true as const, value }),
        (error) => ({ ok: false as const, error }),
      )

    if (!results.ok) {
      const conflict = results.error.code === 'operation_conflict'
      const response = errorResponse(
        conflict ? 'operation_conflict' : 'publish_busy',
        conflict
          ? 'An operation ID is already in flight with a different payload.'
          : 'Publishing is temporarily busy.',
        conflict ? 409 : 503,
      )
      return context.json({ error: response.error }, response.status)
    }

    return context.json({ results: results.value })
  })
}
