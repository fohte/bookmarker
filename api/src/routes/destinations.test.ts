import { Hono } from 'hono'
import { errAsync, okAsync } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import type {
  DestinationAdapter,
  DestinationRegistry,
} from '#destinations/types'
import { registerDestinationsRoute } from '#routes/destinations'

const configured = <D extends keyof DestinationRegistry>(
  destination: D,
): DestinationAdapter<D> => ({
  destination,
  configured: false,
  getMetadata: () => okAsync({ configured: false }),
  publish: () =>
    errAsync({ code: 'not_configured', outcome: 'failed', retryable: false }),
})

const metadataApp = (registry: DestinationRegistry) => {
  const app = new Hono()
  registerDestinationsRoute(app, registry)
  return app
}

const summarizeResponse = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
})

describe('GET /api/destinations', () => {
  it('returns disabled services and the browser-only X destination without secrets', async () => {
    const response = await metadataApp({
      hatena: configured('hatena'),
      mastodon: configured('mastodon'),
      raindrop: configured('raindrop'),
    }).request('/api/destinations')

    expect(await summarizeResponse(response)).toEqual({
      status: 200,
      body: {
        destinations: {
          hatena: { configured: false },
          mastodon: { configured: false },
          raindrop: { configured: false },
          x: { configured: true },
        },
      },
    })
  })

  it('keeps configuration true when metadata retrieval fails with a safe error', async () => {
    const mastodon: DestinationRegistry['mastodon'] = {
      destination: 'mastodon',
      configured: true,
      getMetadata: () => errAsync({ code: 'unavailable' }),
      publish: () =>
        errAsync({ code: 'unavailable', outcome: 'failed', retryable: false }),
    }
    const response = await metadataApp({
      hatena: configured('hatena'),
      mastodon,
      raindrop: configured('raindrop'),
    }).request('/api/destinations')

    expect(await summarizeResponse(response)).toEqual({
      status: 200,
      body: {
        destinations: {
          hatena: { configured: false },
          mastodon: {
            configured: true,
            metadataError: {
              code: 'unavailable',
              message: 'Destination metadata is unavailable.',
            },
          },
          raindrop: { configured: false },
          x: { configured: true },
        },
      },
    })
  })
})
