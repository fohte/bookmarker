import { Hono } from 'hono'
import { errAsync, okAsync } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import type {
  DestinationAdapter,
  DestinationRegistry,
} from '#destinations/types'
import { registerDestinationsRoute } from '#routes/destinations'

const disabledAdapter = <D extends keyof DestinationRegistry>(
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
  body: (await response.json()) as unknown,
})

describe('GET /api/destinations', () => {
  it('returns disabled services and the browser-only X destination without secrets', async () => {
    const response = await metadataApp({
      hatena: disabledAdapter('hatena'),
      mastodon: disabledAdapter('mastodon'),
      raindrop: disabledAdapter('raindrop'),
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
      hatena: disabledAdapter('hatena'),
      mastodon,
      raindrop: disabledAdapter('raindrop'),
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

  it('returns configured Mastodon and Raindrop metadata', async () => {
    const mastodon: DestinationRegistry['mastodon'] = {
      destination: 'mastodon',
      configured: true,
      getMetadata: () =>
        okAsync({
          configured: true,
          maxCharacters: 640,
          charactersReservedPerUrl: 19,
        }),
      publish: () =>
        errAsync({ code: 'unavailable', outcome: 'failed', retryable: false }),
    }
    const raindrop: DestinationRegistry['raindrop'] = {
      destination: 'raindrop',
      configured: true,
      getMetadata: () =>
        okAsync({
          configured: true,
          collections: [
            {
              id: 37,
              title: '架空のコレクション',
              parentId: 4,
              public: false,
            },
          ],
        }),
      publish: () =>
        errAsync({ code: 'unavailable', outcome: 'failed', retryable: false }),
    }
    const response = await metadataApp({
      hatena: disabledAdapter('hatena'),
      mastodon,
      raindrop,
    }).request('/api/destinations')

    expect(await summarizeResponse(response)).toEqual({
      status: 200,
      body: {
        destinations: {
          hatena: { configured: false },
          mastodon: {
            configured: true,
            maxCharacters: 640,
            charactersReservedPerUrl: 19,
          },
          raindrop: {
            configured: true,
            collections: [
              {
                id: 37,
                title: '架空のコレクション',
                parentId: 4,
                public: false,
              },
            ],
          },
          x: { configured: true },
        },
      },
    })
  })
})
