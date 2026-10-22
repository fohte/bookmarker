import { PublishRequestSchema } from 'api/contracts'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'

import {
  createPublishOperations,
  InflightPublishGuard,
} from '#destinations/publish'
import type { DestinationRegistry } from '#destinations/types'

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
      return context.json(
        {
          error: {
            code: 'invalid_json',
            message: 'The request body must be valid JSON.',
          },
        },
        400,
      )
    }

    const parsed = PublishRequestSchema.safeParse(body.value)
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: 'invalid_request',
            message: 'The publish request is invalid.',
          },
        },
        400,
      )
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
      return context.json(
        {
          error: {
            code: conflict ? 'operation_conflict' : 'publish_busy',
            message: conflict
              ? 'An operation ID is already in flight with a different payload.'
              : 'Publishing is temporarily busy.',
          },
        },
        conflict ? 409 : 503,
      )
    }

    return context.json({ results: results.value })
  })
}
