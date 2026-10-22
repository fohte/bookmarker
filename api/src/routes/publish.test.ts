import type {
  DeliveryResult,
  PublishArticle,
  PublishTarget,
} from 'api/contracts'
import { Hono } from 'hono'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'

import { InflightPublishGuard } from '#destinations/publish'
import type {
  DestinationAdapter,
  DestinationRegistry,
  PublishAdapterError,
} from '#destinations/types'
import { registerPublishRoute } from '#routes/publish'

const article = {
  url: 'https://articles.example.test/fictional-story',
  title: '架空の記事',
}

const hatenaTarget: PublishTarget = {
  destination: 'hatena',
  operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
  comment: '架空のコメント',
  options: { tags: ['架空タグ'], private: false },
}

const mastodonTarget: PublishTarget = {
  destination: 'mastodon',
  operationId: 'b6119850-c199-48f0-b62c-2859275623b2',
  comment: '架空のコメント',
  options: { visibility: 'unlisted', spoilerText: '', sensitive: false },
}

const success = (target: PublishTarget): DeliveryResult => ({
  destination: target.destination,
  operationId: target.operationId,
  status: 'succeeded',
  retryable: false,
  remoteUrl: `https://results.example.test/${target.destination}`,
})

type AdapterInput<D extends keyof DestinationRegistry> = {
  article: PublishArticle
  target: Extract<PublishTarget, { destination: D }>
}

const adapter = <D extends keyof DestinationRegistry>(
  destination: D,
  publish: (
    input: AdapterInput<D>,
  ) => ResultAsync<DeliveryResult, PublishAdapterError>,
  configured = true,
): DestinationAdapter<D> => ({
  destination,
  configured,
  getMetadata: () => okAsync({ configured: true }),
  publish: (input) => publish(input),
})

const registry = (
  overrides: Partial<{
    hatena: DestinationRegistry['hatena']
    mastodon: DestinationRegistry['mastodon']
    raindrop: DestinationRegistry['raindrop']
  }> = {},
): DestinationRegistry => ({
  hatena:
    overrides.hatena ??
    adapter('hatena', (input) => okAsync(success(input.target))),
  mastodon:
    overrides.mastodon ??
    adapter('mastodon', (input) => okAsync(success(input.target))),
  raindrop:
    overrides.raindrop ??
    adapter('raindrop', (input) => okAsync(success(input.target))),
})

const appWith = (
  destinations: DestinationRegistry,
  guard?: InflightPublishGuard,
) => {
  const app = new Hono()
  registerPublishRoute(app, destinations, guard)
  return app
}

const send = (
  app: Hono,
  targets: readonly PublishTarget[],
  articleValue = article,
) =>
  app.request('/api/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ article: articleValue, targets }),
  })

const summarizeResponse = async (response: Response) => ({
  status: response.status,
  body: (await response.json()) as unknown,
})

const summarizePublication = async (response: Response, calls: unknown) => ({
  ...(await summarizeResponse(response)),
  calls,
})

const summarizePublications = async (
  responses: readonly Response[],
  calls: number,
) => ({
  statuses: responses.map((response) => response.status),
  bodies: await Promise.all(responses.map((response) => response.json())),
  calls,
})

describe('POST /api/publish', () => {
  it('sends only selected targets and preserves an individual partial failure', async () => {
    const publishHatena = vi.fn((input: AdapterInput<'hatena'>) =>
      okAsync(success(input.target)),
    )
    const publishMastodon = vi.fn(() =>
      errAsync<DeliveryResult, PublishAdapterError>({
        code: 'rejected',
        outcome: 'failed',
        retryable: true,
      }),
    )
    const publishRaindrop = vi.fn((input: AdapterInput<'raindrop'>) =>
      okAsync(success(input.target)),
    )
    const app = appWith(
      registry({
        hatena: adapter('hatena', publishHatena),
        mastodon: adapter('mastodon', publishMastodon),
        raindrop: adapter('raindrop', publishRaindrop),
      }),
    )

    const response = await send(app, [hatenaTarget, mastodonTarget])

    expect(
      await summarizePublication(response, {
        counts: {
          hatena: publishHatena.mock.calls.length,
          mastodon: publishMastodon.mock.calls.length,
          raindrop: publishRaindrop.mock.calls.length,
        },
        hatenaInputs: publishHatena.mock.calls.map(([input]) => input),
      }),
    ).toEqual({
      status: 200,
      body: {
        results: [
          success(hatenaTarget),
          {
            destination: 'mastodon',
            operationId: mastodonTarget.operationId,
            status: 'failed',
            retryable: true,
            message: 'The destination rejected this article.',
          },
        ],
      },
      calls: {
        counts: { hatena: 1, mastodon: 1, raindrop: 0 },
        hatenaInputs: [{ article, target: hatenaTarget }],
      },
    })
  })

  it('coalesces the same operation and rejects a different payload before sending', async () => {
    let markStarted: () => void = () => {}
    let resolveDelivery: (result: DeliveryResult) => void = () => {}
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    const delivery = new Promise<DeliveryResult>((resolve) => {
      resolveDelivery = resolve
    })
    const publishHatena = vi.fn(() => {
      markStarted()
      return ResultAsync.fromSafePromise(delivery)
    })
    const app = appWith(registry({ hatena: adapter('hatena', publishHatena) }))

    const firstRequest = send(app, [hatenaTarget])
    await started
    const sameRequest = send(app, [hatenaTarget])
    const changedTarget = { ...hatenaTarget, comment: '別の架空コメント' }
    const conflictResponse = await send(app, [changedTarget])
    resolveDelivery(success(hatenaTarget))
    const [firstResponse, sameResponse] = await Promise.all([
      firstRequest,
      sameRequest,
    ])

    expect(
      await summarizePublications(
        [firstResponse, sameResponse, conflictResponse],
        publishHatena.mock.calls.length,
      ),
    ).toEqual({
      statuses: [200, 200, 409],
      bodies: [
        { results: [success(hatenaTarget)] },
        { results: [success(hatenaTarget)] },
        {
          error: {
            code: 'operation_conflict',
            message:
              'An operation ID is already in flight with a different payload.',
          },
        },
      ],
      calls: 1,
    })
  })

  it('rejects an over-capacity request before any adapter is called', async () => {
    const publishHatena = vi.fn((input: AdapterInput<'hatena'>) =>
      okAsync(success(input.target)),
    )
    const publishMastodon = vi.fn((input: AdapterInput<'mastodon'>) =>
      okAsync(success(input.target)),
    )
    const app = appWith(
      registry({
        hatena: adapter('hatena', publishHatena),
        mastodon: adapter('mastodon', publishMastodon),
      }),
      new InflightPublishGuard(1),
    )

    const response = await send(app, [hatenaTarget, mastodonTarget])

    expect(
      await summarizePublication(response, [
        publishHatena.mock.calls.length,
        publishMastodon.mock.calls.length,
      ]),
    ).toEqual({
      status: 503,
      body: {
        error: {
          code: 'publish_busy',
          message: 'Publishing is temporarily busy.',
        },
      },
      calls: [0, 0],
    })
  })

  it('turns an adapter result for another operation into unknown', async () => {
    const wrongResult: DeliveryResult = {
      ...success(hatenaTarget),
      operationId: '6a3448e4-8ec1-4bcb-af69-9c7f1ec46e04',
    }
    const app = appWith(
      registry({
        hatena: adapter('hatena', () => okAsync(wrongResult)),
      }),
    )

    const response = await send(app, [hatenaTarget])

    expect(await summarizeResponse(response)).toEqual({
      status: 200,
      body: {
        results: [
          {
            destination: 'hatena',
            operationId: hatenaTarget.operationId,
            status: 'unknown',
            retryable: false,
            message: 'Delivery could not be confirmed.',
          },
        ],
      },
    })
  })
})
