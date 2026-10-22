import type { PublishTarget } from 'api/contracts'
import type { Result, ResultAsync } from 'neverthrow'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMastodonAdapter } from '#destinations/mastodon/index'

const article = {
  url: 'https://articles.example.test/fictional-story',
  title: '架空の記事',
}

const target: Extract<PublishTarget, { destination: 'mastodon' }> = {
  destination: 'mastodon',
  operationId: 'b6119850-c199-48f0-b62c-2859275623b2',
  comment: '架空のコメント & note',
  options: {
    visibility: 'unlisted',
    spoilerText: '架空の CW',
    sensitive: true,
  },
}

const token = 'fixture-access-token'

type RequestCall = {
  url: string
  init?: RequestInit
}

const stubFetch = (
  response: (request: RequestCall) => Response | Promise<Response>,
): RequestCall[] => {
  const requests: RequestCall[] = []
  const fakeFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const request = { url, ...(init ? { init } : {}) }
    requests.push(request)
    return response(request)
  }
  vi.stubGlobal('fetch', fakeFetch)
  return requests
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const setConfig = (baseUrl = 'https://mastodon.example.test') => {
  vi.stubEnv('MASTODON_BASE_URL', baseUrl)
  vi.stubEnv('MASTODON_ACCESS_TOKEN', token)
}

const summarizeResult = async <T, E>(
  result: Result<T, E> | ResultAsync<T, E>,
) =>
  (await result).match(
    (value) => ({ value }),
    (error) => ({ error }),
  )

const expectOutput = (actual: unknown, expected: unknown): void => {
  expect(actual).toEqual(expected)
}

const summarizeRequest = ({ url, init }: RequestCall) => {
  const headers: Record<string, string> = {}
  new Headers(init?.headers).forEach((value, key) => {
    headers[key] = value
  })

  const body =
    typeof init?.body === 'string'
      ? Object.fromEntries(new URLSearchParams(init.body))
      : null

  return {
    url,
    method: init?.method ?? 'GET',
    headers,
    body,
    redirect: init?.redirect,
    hasTimeoutSignal: init?.signal instanceof AbortSignal,
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createMastodonAdapter', () => {
  it('stays disabled when either required setting is missing', async () => {
    const requests = stubFetch(() => jsonResponse({ id: 'unused' }))
    const outcomes = []

    for (const [baseUrl, accessToken] of [
      ['', ''],
      ['https://mastodon.example.test', ''],
      ['', token],
    ]) {
      vi.stubEnv('MASTODON_BASE_URL', baseUrl)
      vi.stubEnv('MASTODON_ACCESS_TOKEN', accessToken)
      const adapter = createMastodonAdapter()
      outcomes.push({
        configured: adapter.configured,
        metadata: await summarizeResult(adapter.getMetadata()),
        publish: await summarizeResult(
          adapter.publish({ article, target: { ...target } }),
        ),
      })
    }

    expectOutput(
      { outcomes, requests: requests.map(summarizeRequest) },
      {
        outcomes: [
          {
            configured: false,
            metadata: { value: { configured: false } },
            publish: {
              error: {
                code: 'not_configured',
                outcome: 'failed',
                retryable: false,
              },
            },
          },
          {
            configured: false,
            metadata: { value: { configured: false } },
            publish: {
              error: {
                code: 'not_configured',
                outcome: 'failed',
                retryable: false,
              },
            },
          },
          {
            configured: false,
            metadata: { value: { configured: false } },
            publish: {
              error: {
                code: 'not_configured',
                outcome: 'failed',
                retryable: false,
              },
            },
          },
        ],
        requests: [],
      },
    )
  })

  it('keeps invalid operator URLs configured but never sends a request', async () => {
    const requests = stubFetch(() => jsonResponse({ id: 'unused' }))
    const outcomes = []

    for (const baseUrl of [
      'not a URL',
      'http://mastodon.example.test',
      'https://mastodon.example.test/prefix',
      'https://user:password@mastodon.example.test',
      'https://mastodon.example.test?redirect=elsewhere',
      'https://mastodon.example.test?',
      'https://mastodon.example.test#',
    ]) {
      setConfig(baseUrl)
      const adapter = createMastodonAdapter()
      outcomes.push({
        configured: adapter.configured,
        metadata: await summarizeResult(adapter.getMetadata()),
        publish: await summarizeResult(
          adapter.publish({ article, target: { ...target } }),
        ),
      })
    }

    expectOutput(
      { outcomes, requests: requests.map(summarizeRequest) },
      {
        outcomes: Array.from({ length: 7 }, () => ({
          configured: true,
          metadata: { error: { code: 'unavailable' } },
          publish: {
            error: {
              code: 'not_configured',
              outcome: 'failed',
              retryable: false,
            },
          },
        })),
        requests: [],
      },
    )
  })

  it('reads instance character limits without forwarding the access token', async () => {
    setConfig()
    const requests = stubFetch(() =>
      jsonResponse({
        configuration: {
          statuses: {
            max_characters: 640,
            characters_reserved_per_url: 19,
            max_media_attachments: 4,
          },
        },
      }),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        configured: adapter.configured,
        metadata: await summarizeResult(adapter.getMetadata()),
        requests: requests.map(summarizeRequest),
      },
      {
        configured: true,
        metadata: {
          value: {
            configured: true,
            maxCharacters: 640,
            charactersReservedPerUrl: 19,
          },
        },
        requests: [
          {
            url: 'https://mastodon.example.test/api/v2/instance',
            method: 'GET',
            headers: {},
            body: null,
            redirect: 'manual',
            hasTimeoutSignal: true,
          },
        ],
      },
    )
  })

  it('keeps configuration true when instance metadata is unavailable', async () => {
    setConfig()
    const requests = stubFetch(() =>
      jsonResponse({ error: 'private response' }, 503),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        configured: adapter.configured,
        metadata: await summarizeResult(adapter.getMetadata()),
        requests: requests.map(summarizeRequest),
      },
      {
        configured: true,
        metadata: { error: { code: 'unavailable' } },
        requests: [
          {
            url: 'https://mastodon.example.test/api/v2/instance',
            method: 'GET',
            headers: {},
            body: null,
            redirect: 'manual',
            hasTimeoutSignal: true,
          },
        ],
      },
    )
  })

  it.each([
    { status: 401, code: 'unauthorized' },
    { status: 403, code: 'unauthorized' },
    { status: 429, code: 'rate_limited' },
  ])(
    'maps instance metadata HTTP $status to a safe error',
    async ({ status, code }) => {
      setConfig()
      const requests = stubFetch(() => jsonResponse({ error: token }, status))
      const adapter = createMastodonAdapter()

      expectOutput(
        {
          configured: adapter.configured,
          metadata: await summarizeResult(adapter.getMetadata()),
          requests: requests.map(summarizeRequest),
        },
        {
          configured: true,
          metadata: { error: { code } },
          requests: [
            {
              url: 'https://mastodon.example.test/api/v2/instance',
              method: 'GET',
              headers: {},
              body: null,
              redirect: 'manual',
              hasTimeoutSignal: true,
            },
          ],
        },
      )
    },
  )

  it('posts the full comment, article URL, visibility, warning, and idempotency key once', async () => {
    setConfig()
    const requests = stubFetch(() =>
      jsonResponse({
        id: 'fictional-status-id',
        url: 'https://mastodon.example.test/@fictional-user/42',
      }),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requests: requests.map(summarizeRequest),
      },
      {
        result: {
          value: {
            destination: 'mastodon',
            operationId: target.operationId,
            status: 'succeeded',
            retryable: false,
            remoteUrl: 'https://mastodon.example.test/@fictional-user/42',
          },
        },
        requests: [
          {
            url: 'https://mastodon.example.test/api/v1/statuses',
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'idempotency-key': target.operationId,
            },
            body: {
              status: `${target.comment}\n\n${article.url}`,
              visibility: 'unlisted',
              spoiler_text: '架空の CW',
              sensitive: 'true',
            },
            redirect: 'manual',
            hasTimeoutSignal: true,
          },
        ],
      },
    )
  })

  it.each([
    {
      status: 401,
      error: { code: 'unauthorized', outcome: 'failed', retryable: false },
    },
    {
      status: 422,
      error: { code: 'rejected', outcome: 'failed', retryable: false },
    },
  ])(
    'maps a clear HTTP $status rejection to a safe failure',
    async ({ status, error }) => {
      setConfig()
      const requests = stubFetch(() => jsonResponse({ error: token }, status))
      const adapter = createMastodonAdapter()

      expectOutput(
        {
          result: await summarizeResult(adapter.publish({ article, target })),
          requestCount: requests.length,
        },
        { result: { error }, requestCount: 1 },
      )
    },
  )

  it('maps HTTP 429 to a retryable rate-limit rejection without reading its body', async () => {
    setConfig()
    const requests = stubFetch(() => jsonResponse({ error: token }, 429))
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: { code: 'rate_limited', outcome: 'failed', retryable: true },
        },
        requestCount: 1,
      },
    )
  })

  it('marks transport failures as unknown and never retries the write', async () => {
    setConfig()
    const requests = stubFetch(() => Promise.reject(new Error(token)))
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: { code: 'unavailable', outcome: 'unknown', retryable: false },
        },
        requestCount: 1,
      },
    )
  })

  it('maps an aborted write to unknown with the configured timeout', async () => {
    setConfig()
    const timeoutController = new AbortController()
    let timeoutMs: number | undefined
    vi.spyOn(AbortSignal, 'timeout').mockImplementation((milliseconds) => {
      timeoutMs = milliseconds
      return timeoutController.signal
    })

    let signalRequestStarted = () => {}
    const requestStarted = new Promise<void>((resolve) => {
      signalRequestStarted = () => {
        resolve()
      }
    })
    let requestSignal: AbortSignal | undefined
    const requests = stubFetch(({ init }) => {
      const signal = init?.signal
      if (!(signal instanceof AbortSignal)) {
        return Promise.reject(new Error('request has no abort signal'))
      }
      requestSignal = signal
      signalRequestStarted()
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('request aborted'))
          },
          { once: true },
        )
      })
    })
    const adapter = createMastodonAdapter()
    const published = adapter.publish({ article, target })
    await requestStarted
    timeoutController.abort(new DOMException('fixture timeout', 'TimeoutError'))

    expectOutput(
      {
        result: await summarizeResult(published),
        requestCount: requests.length,
        timeoutMs,
        signalAborted: requestSignal?.aborted,
      },
      {
        result: {
          error: { code: 'unavailable', outcome: 'unknown', retryable: false },
        },
        requestCount: 1,
        timeoutMs: 10_000,
        signalAborted: true,
      },
    )
  })

  it('marks a server error after the write as unknown', async () => {
    setConfig()
    const requests = stubFetch(() =>
      jsonResponse({ error: 'private response' }, 503),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: { code: 'unavailable', outcome: 'unknown', retryable: false },
        },
        requestCount: 1,
      },
    )
  })

  it('marks HTTP 408 after the write as unknown', async () => {
    setConfig()
    const requests = stubFetch(() =>
      jsonResponse({ error: 'private response' }, 408),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: { code: 'unavailable', outcome: 'unknown', retryable: false },
        },
        requestCount: 1,
      },
    )
  })

  it('does not follow a write redirect to another host', async () => {
    setConfig()
    const requests = stubFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://redirect.example.test/collect' },
        }),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requests: requests.map(summarizeRequest),
      },
      {
        result: {
          error: { code: 'unavailable', outcome: 'unknown', retryable: false },
        },
        requests: [
          {
            url: 'https://mastodon.example.test/api/v1/statuses',
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
              'idempotency-key': target.operationId,
            },
            body: {
              status: `${target.comment}\n\n${article.url}`,
              visibility: 'unlisted',
              spoiler_text: '架空の CW',
              sensitive: 'true',
            },
            redirect: 'manual',
            hasTimeoutSignal: true,
          },
        ],
      },
    )
  })

  it('marks an unreadable successful response as unknown', async () => {
    setConfig()
    const requests = stubFetch(() => jsonResponse({ url: 'not an ID' }))
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: {
            code: 'invalid_response',
            outcome: 'unknown',
            retryable: false,
          },
        },
        requestCount: 1,
      },
    )
  })

  it('marks a response over the body limit as unknown', async () => {
    setConfig()
    const requests = stubFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(64 * 1024 + 1))
              controller.close()
            },
          }),
          { status: 200 },
        ),
    )
    const adapter = createMastodonAdapter()

    expectOutput(
      {
        result: await summarizeResult(adapter.publish({ article, target })),
        requestCount: requests.length,
      },
      {
        result: {
          error: {
            code: 'invalid_response',
            outcome: 'unknown',
            retryable: false,
          },
        },
        requestCount: 1,
      },
    )
  })

  it('does not truncate a comment before sending it', async () => {
    setConfig()
    const longComment = '架空の文'.repeat(600)
    const requests = stubFetch(() =>
      jsonResponse({ id: 'fictional-status-id' }),
    )
    const adapter = createMastodonAdapter()
    const published = await adapter.publish({
      article,
      target: { ...target, comment: longComment },
    })
    const sentBody = requests[0]?.init?.body
    const sentStatus =
      typeof sentBody === 'string'
        ? new URLSearchParams(sentBody).get('status')
        : null

    expectOutput(
      { sentStatus, result: await summarizeResult(published) },
      {
        sentStatus: `${longComment}\n\n${article.url}`,
        result: {
          value: {
            destination: 'mastodon',
            operationId: target.operationId,
            status: 'succeeded',
            retryable: false,
          },
        },
      },
    )
  })
})
