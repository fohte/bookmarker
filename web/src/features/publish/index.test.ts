import type {
  DeliveryResult,
  PublishRequest,
  PublishTarget,
} from 'api/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createXIntent,
  getDestinations,
  publishTargets,
  selectRetryTargets,
} from 'web/features/publish'

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

const request: PublishRequest = {
  article: {
    url: 'https://articles.example.test/fictional-story',
    title: '架空の記事',
  },
  targets: [hatenaTarget, mastodonTarget],
}

const succeeded = (target: PublishTarget): DeliveryResult => ({
  destination: target.destination,
  operationId: target.operationId,
  status: 'succeeded',
  retryable: false,
})

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const installFetch = (
  implementation: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Response | Promise<Response>,
) => {
  const fetchMock = vi.fn(implementation)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const summarizePublishCall = (
  result: Awaited<ReturnType<typeof publishTargets>>,
  calls: readonly Parameters<typeof fetch>[],
) => {
  const call = calls[0]
  const input = call?.[0]
  const body = call?.[1]?.body

  return {
    result,
    callCount: calls.length,
    call: {
      url:
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input?.url,
      method: call?.[1]?.method,
      body: typeof body === 'string' ? body : undefined,
    },
  }
}

const summarizeIntent = (intent: URL) => ({
  origin: intent.origin,
  pathname: intent.pathname,
  text: intent.searchParams.get('text'),
  url: intent.searchParams.get('url'),
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('publish client helpers', () => {
  it('selects only retryable failed targets with matching destination and operation ID', () => {
    const retryableFailure: DeliveryResult = {
      destination: 'mastodon',
      operationId: mastodonTarget.operationId,
      status: 'failed',
      retryable: true,
      message: 'The destination rejected this article.',
    }
    const results: DeliveryResult[] = [
      succeeded(hatenaTarget),
      retryableFailure,
      {
        ...retryableFailure,
        destination: 'hatena',
        retryable: false,
      },
      {
        ...retryableFailure,
        operationId: '6a3448e4-8ec1-4bcb-af69-9c7f1ec46e04',
      },
      {
        destination: 'raindrop',
        operationId: 'c2d34d58-d795-4995-9acb-5c85a31e41c2',
        status: 'unknown',
        retryable: false,
      },
    ]

    expect(selectRetryTargets([hatenaTarget, mastodonTarget], results)).toEqual(
      [mastodonTarget],
    )
  })

  it('sends the prepared request once and restores results to request order', async () => {
    const fetchMock = installFetch(() =>
      response({
        results: [succeeded(mastodonTarget), succeeded(hatenaTarget)],
      }),
    )

    const result = await publishTargets(request)
    expect(summarizePublishCall(result, fetchMock.mock.calls)).toEqual({
      result: {
        results: [succeeded(hatenaTarget), succeeded(mastodonTarget)],
      },
      callCount: 1,
      call: {
        url: '/api/publish',
        method: 'POST',
        body: JSON.stringify(request),
      },
    })
  })

  it('returns unknown for a missing response target while retaining a matched result', async () => {
    installFetch(() => response({ results: [succeeded(hatenaTarget)] }))

    expect(await publishTargets(request)).toEqual({
      results: [
        succeeded(hatenaTarget),
        {
          destination: 'mastodon',
          operationId: mastodonTarget.operationId,
          status: 'unknown',
          retryable: false,
          message: 'Delivery could not be confirmed.',
        },
      ],
    })
  })

  it('keeps definitive validation and capacity failures retryable only when safe', async () => {
    const responses = [
      response(
        { error: { code: 'publish_busy', message: 'Fictional busy message.' } },
        503,
      ),
      response(
        {
          error: {
            code: 'invalid_request',
            message: 'Fictional validation message.',
          },
        },
        400,
      ),
      response(
        {
          error: {
            code: 'operation_conflict',
            message: 'Fictional conflict message.',
          },
        },
        409,
      ),
    ]
    installFetch(() => responses.shift() ?? new Response(null, { status: 500 }))

    const results = await Promise.all([
      publishTargets(request),
      publishTargets(request),
      publishTargets(request),
    ])

    expect(results).toEqual([
      {
        results: request.targets.map((target) => ({
          destination: target.destination,
          operationId: target.operationId,
          status: 'failed',
          retryable: true,
          message: 'Publishing is temporarily busy.',
        })),
      },
      {
        results: request.targets.map((target) => ({
          destination: target.destination,
          operationId: target.operationId,
          status: 'failed',
          retryable: false,
          message: 'The publish request was rejected.',
        })),
      },
      {
        results: request.targets.map((target) => ({
          destination: target.destination,
          operationId: target.operationId,
          status: 'unknown',
          retryable: false,
          message: 'Delivery could not be confirmed.',
        })),
      },
    ])
  })

  it('returns unknown without an authentication claim for transport failures', async () => {
    const fetchMock = vi.fn(() =>
      Promise.reject(new TypeError('network failed')),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await publishTargets(request)).toEqual({
      results: request.targets.map((target) => ({
        destination: target.destination,
        operationId: target.operationId,
        status: 'unknown',
        retryable: false,
        message: 'Delivery could not be confirmed.',
      })),
    })
  })

  it('marks a JSON unauthorized response as requiring authentication', async () => {
    installFetch(() =>
      response(
        { error: { code: 'unauthorized', message: 'Fictional auth message.' } },
        401,
      ),
    )

    expect(await publishTargets(request)).toEqual({
      results: request.targets.map((target) => ({
        destination: target.destination,
        operationId: target.operationId,
        status: 'unknown',
        retryable: false,
        message: 'Delivery could not be confirmed.',
      })),
      authenticationRequired: true,
    })
  })

  it('marks the Cloudflare Access challenge as requiring authentication', async () => {
    installFetch(
      () =>
        new Response('Access required.', {
          status: 403,
          headers: {
            'www-authenticate':
              'Bearer resource_metadata="https://access.example.test/.well-known/cloudflare-access-protected-resource/"',
          },
        }),
    )

    expect(await publishTargets(request)).toEqual({
      results: request.targets.map((target) => ({
        destination: target.destination,
        operationId: target.operationId,
        status: 'unknown',
        retryable: false,
        message: 'Delivery could not be confirmed.',
      })),
      authenticationRequired: true,
    })
  })

  it('marks a JSON unauthorized destination response as requiring authentication', async () => {
    installFetch(() =>
      response(
        { error: { code: 'unauthorized', message: 'Fictional auth message.' } },
        401,
      ),
    )

    const outcome = await getDestinations().match(
      (value) => ({ kind: 'success' as const, value }),
      (error) => ({ kind: 'error' as const, error }),
    )

    expect(outcome).toEqual({
      kind: 'error',
      error: {
        code: 'authentication_required',
        message: 'Authentication is required to use publishing.',
        authenticationRequired: true,
      },
    })
  })

  it('returns configured Mastodon and Raindrop metadata', async () => {
    const metadata = {
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
    }
    installFetch(() => response(metadata))

    const outcome = await getDestinations().match(
      (value) => ({ kind: 'success' as const, value }),
      (error) => ({ kind: 'error' as const, error }),
    )

    expect(outcome).toEqual({ kind: 'success', value: metadata })
  })

  it('returns a safe error for invalid destination metadata without claiming expired auth', async () => {
    installFetch(() => new Response('not json', { status: 200 }))

    const outcome = await getDestinations().match(
      (value) => ({ kind: 'success' as const, value }),
      (error) => ({ kind: 'error' as const, error }),
    )

    expect(outcome).toEqual({
      kind: 'error',
      error: {
        code: 'invalid_response',
        message: 'The server returned an invalid response.',
      },
    })
  })

  it('encodes and restores the X comment and article URL', () => {
    const comment = '架空の日本語\n二行目 & #tag'
    const url = 'https://articles.example.test/story?part=a&tag=#section'
    const intent = createXIntent({ url, comment })

    expect(summarizeIntent(intent)).toEqual({
      origin: 'https://x.com',
      pathname: '/intent/tweet',
      text: comment,
      url,
    })
  })
})
