import {
  type DestinationMetadataError,
  DestinationMetadataSchema,
} from 'api/contracts'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { metadataAdapterError } from '#destinations/http'
import type {
  DestinationAdapter,
  DestinationRegistry,
  MetadataAdapterError,
} from '#destinations/types'

const metadataFailure = (
  configured: boolean,
  error: MetadataAdapterError,
): { configured: boolean; metadataError: DestinationMetadataError } => ({
  configured,
  metadataError: metadataAdapterError(error),
})

export const registerDestinationsRoute = (
  app: Hono,
  registry: DestinationRegistry,
): void => {
  app.get('/api/destinations', async (context) => {
    const read = <D extends keyof DestinationRegistry>(
      adapter: DestinationAdapter<D>,
      schema: z.ZodType,
      fallback: (error: MetadataAdapterError) => unknown,
    ) => {
      if (!adapter.configured) {
        const parsed = schema.safeParse({ configured: false })
        return Promise.resolve(
          parsed.success ? parsed.data : fallback({ code: 'invalid_response' }),
        )
      }

      return ResultAsync.fromThrowable(
        async () =>
          adapter.getMetadata().match((entry) => {
            const parsed = schema.safeParse({
              ...entry,
              configured: adapter.configured,
            })
            return parsed.success
              ? parsed.data
              : fallback({ code: 'invalid_response' })
          }, fallback),
        () => fallback({ code: 'unavailable' }),
      )().unwrapOr(fallback({ code: 'unavailable' }))
    }

    const destinations = await Promise.all([
      read(
        registry.hatena,
        DestinationMetadataSchema.shape.destinations.shape.hatena,
        () => ({ configured: registry.hatena.configured }),
      ),
      read(
        registry.mastodon,
        DestinationMetadataSchema.shape.destinations.shape.mastodon,
        (error) => metadataFailure(registry.mastodon.configured, error),
      ),
      read(
        registry.raindrop,
        DestinationMetadataSchema.shape.destinations.shape.raindrop,
        (error) => metadataFailure(registry.raindrop.configured, error),
      ),
    ])

    const parsed = DestinationMetadataSchema.safeParse({
      destinations: {
        hatena: destinations[0],
        mastodon: destinations[1],
        raindrop: destinations[2],
        x: { configured: true },
      },
    })

    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: 'invalid_metadata',
            message: 'Destination metadata is invalid.',
          },
        },
        500,
      )
    }

    return context.json(parsed.data)
  })
}
