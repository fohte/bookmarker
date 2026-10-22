import { captureWithFingerprint } from '@fohte/service-kit/observability'
import {
  type DestinationMetadata,
  type DestinationMetadataError,
  DestinationMetadataSchema,
} from 'api/contracts'
import { Hono } from 'hono'
import { ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { metadataAdapterError } from '#destinations/http'
import type {
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

type MetadataDestination = keyof DestinationRegistry
type MetadataEntry<D extends MetadataDestination> =
  DestinationMetadata['destinations'][D]

const readMetadata = <D extends MetadataDestination>(
  adapter: DestinationRegistry[D],
  schema: z.ZodType<MetadataEntry<D>>,
  unconfigured: MetadataEntry<D>,
  fallback: (error: MetadataAdapterError) => MetadataEntry<D>,
): Promise<MetadataEntry<D>> => {
  if (!adapter.configured) {
    return Promise.resolve(unconfigured)
  }

  return ResultAsync.fromPromise(
    Promise.resolve().then(() =>
      adapter.getMetadata().match((entry) => {
        const parsed = schema.safeParse({
          ...entry,
          configured: adapter.configured,
        })
        return parsed.success
          ? parsed.data
          : fallback({ code: 'invalid_response' })
      }, fallback),
    ),
    (error) => {
      captureWithFingerprint(error, 'destination-metadata-unexpected-error', {
        tags: { destination: adapter.destination },
      })
      return fallback({ code: 'unavailable' })
    },
  ).unwrapOr(fallback({ code: 'unavailable' }))
}

export const registerDestinationsRoute = (
  app: Hono,
  registry: DestinationRegistry,
): void => {
  app.get('/api/destinations', async (context) => {
    const [hatena, mastodon, raindrop] = await Promise.all([
      readMetadata(
        registry.hatena,
        DestinationMetadataSchema.shape.destinations.shape.hatena,
        { configured: false },
        () => ({ configured: true }),
      ),
      readMetadata(
        registry.mastodon,
        DestinationMetadataSchema.shape.destinations.shape.mastodon,
        { configured: false },
        (error) => metadataFailure(registry.mastodon.configured, error),
      ),
      readMetadata(
        registry.raindrop,
        DestinationMetadataSchema.shape.destinations.shape.raindrop,
        { configured: false },
        (error) => metadataFailure(registry.raindrop.configured, error),
      ),
    ])

    const parsed = DestinationMetadataSchema.safeParse({
      destinations: {
        hatena,
        mastodon,
        raindrop,
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
