import type { PublishTarget } from 'api/contracts'
import { describe, expect, it } from 'vitest'

import { createHatenaAdapter } from '#destinations/hatena/index'
import { createOAuthAuthorizationHeader } from '#destinations/hatena/oauth'

const credentials = {
  HATENA_CONSUMER_KEY: 'fictional-consumer',
  HATENA_CONSUMER_SECRET: 'fictional-consumer-secret',
  HATENA_ACCESS_TOKEN: 'fictional-access-token',
  HATENA_ACCESS_TOKEN_SECRET: 'fictional-access-token-secret',
}

const article = { url: 'https://articles.example.test/fictional-story' }
const target: Extract<PublishTarget, { destination: 'hatena' }> = {
  destination: 'hatena',
  operationId: 'a813a5ad-d795-42fb-a2a0-c08b305d7684',
  comment: '読む & 記録',
  options: { tags: ['日本語', 'shared'], private: true },
}

type CapturedRequest = {
  url: string
  method: string
  authorization: string
  contentType: string
  userAgent: string
  body: string
  redirect: NonNullable<RequestInit['redirect']>
}

const captureRequest = (
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
): CapturedRequest => {
  const headers = new Headers(init?.headers)
  return {
    url:
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
    method: init?.method ?? '',
    authorization: headers.get('authorization') ?? '',
    contentType: headers.get('content-type') ?? '',
    userAgent: headers.get('user-agent') ?? '',
    body: typeof init?.body === 'string' ? init.body : '',
    redirect: init?.redirect ?? 'follow',
  }
}

const summarize = async (
  adapter: ReturnType<typeof createHatenaAdapter>,
  calls: CapturedRequest[],
  targetValue: Extract<PublishTarget, { destination: 'hatena' }> = target,
) => {
  const result = await adapter
    .publish({
      article,
      target: targetValue,
    })
    .match(
      (value) => ({ kind: 'success' as const, value }),
      (error) => ({ kind: 'error' as const, error }),
    )
  return { result, calls }
}

describe('createHatenaAdapter', () => {
  it('sends signed UTF-8 form data with repeated tags and private=1', async () => {
    const calls: CapturedRequest[] = []
    const adapter = createHatenaAdapter({
      env: credentials,
      nonce: () => 'fixed-nonce',
      now: () => 1_700_000_000_000,
      fetch: (input, init) => {
        calls.push(captureRequest(input, init))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              permalink:
                'https://b.hatena.ne.jp/fictional-user/20261022#bookmark-1',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          ),
        )
      },
    })
    const signedRequest = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL('https://bookmark.hatenaapis.com/rest/1/my/bookmark'),
      bodyParameters: new URLSearchParams([
        ['url', article.url],
        ['comment', target.comment],
        ['tags', '日本語'],
        ['tags', 'shared'],
        ['private', '1'],
      ]),
      consumerKey: credentials.HATENA_CONSUMER_KEY,
      consumerSecret: credentials.HATENA_CONSUMER_SECRET,
      token: credentials.HATENA_ACCESS_TOKEN,
      tokenSecret: credentials.HATENA_ACCESS_TOKEN_SECRET,
      nonce: 'fixed-nonce',
      timestamp: 1_700_000_000,
    })

    expect(await summarize(adapter, calls)).toEqual({
      result: {
        kind: 'success',
        value: {
          destination: 'hatena',
          operationId: target.operationId,
          status: 'succeeded',
          retryable: false,
          remoteUrl:
            'https://b.hatena.ne.jp/fictional-user/20261022#bookmark-1',
        },
      },
      calls: [
        {
          url: 'https://bookmark.hatenaapis.com/rest/1/my/bookmark',
          method: 'POST',
          authorization: signedRequest,
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          userAgent: 'bookmarker (https://github.com/fohte/bookmarker)',
          body: 'url=https%3A%2F%2Farticles.example.test%2Ffictional-story&comment=%E8%AA%AD%E3%82%80+%26+%E8%A8%98%E9%8C%B2&tags=%E6%97%A5%E6%9C%AC%E8%AA%9E&tags=shared&private=1',
          redirect: 'error',
        },
      ],
    })
  })

  it('sends private=0 for a public bookmark', async () => {
    const calls: CapturedRequest[] = []
    const publicTarget: Extract<PublishTarget, { destination: 'hatena' }> = {
      ...target,
      options: { ...target.options, private: false },
    }
    const adapter = createHatenaAdapter({
      env: credentials,
      nonce: () => 'fixed-nonce',
      now: () => 1_700_000_000_000,
      fetch: (input, init) => {
        calls.push(captureRequest(input, init))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              permalink:
                'https://b.hatena.ne.jp/fictional-user/20261022#bookmark-2',
            }),
            { status: 201 },
          ),
        )
      },
    })
    const result = await adapter
      .publish({
        article,
        target: publicTarget,
      })
      .match(
        (value) => ({ kind: 'success' as const, value }),
        (error) => ({ kind: 'error' as const, error }),
      )
    const summarizePublicResult = () => ({
      result,
      body: calls.map((call) => call.body),
    })
    expect(summarizePublicResult()).toEqual({
      result: {
        kind: 'success',
        value: {
          destination: 'hatena',
          operationId: target.operationId,
          status: 'succeeded',
          retryable: false,
          remoteUrl:
            'https://b.hatena.ne.jp/fictional-user/20261022#bookmark-2',
        },
      },
      body: [
        'url=https%3A%2F%2Farticles.example.test%2Ffictional-story&comment=%E8%AA%AD%E3%82%80+%26+%E8%A8%98%E9%8C%B2&tags=%E6%97%A5%E6%9C%AC%E8%AA%9E&tags=shared&private=0',
      ],
    })
  })

  it.each([
    'HATENA_CONSUMER_KEY',
    'HATENA_CONSUMER_SECRET',
    'HATENA_ACCESS_TOKEN',
    'HATENA_ACCESS_TOKEN_SECRET',
  ] as const)(
    'stays disabled when %s is missing',
    async (missingCredential) => {
      const env = {
        ...(missingCredential !== 'HATENA_CONSUMER_KEY'
          ? { HATENA_CONSUMER_KEY: credentials.HATENA_CONSUMER_KEY }
          : {}),
        ...(missingCredential !== 'HATENA_CONSUMER_SECRET'
          ? { HATENA_CONSUMER_SECRET: credentials.HATENA_CONSUMER_SECRET }
          : {}),
        ...(missingCredential !== 'HATENA_ACCESS_TOKEN'
          ? { HATENA_ACCESS_TOKEN: credentials.HATENA_ACCESS_TOKEN }
          : {}),
        ...(missingCredential !== 'HATENA_ACCESS_TOKEN_SECRET'
          ? {
              HATENA_ACCESS_TOKEN_SECRET:
                credentials.HATENA_ACCESS_TOKEN_SECRET,
            }
          : {}),
      }
      const calls: CapturedRequest[] = []
      const adapter = createHatenaAdapter({
        env,
        fetch: (input, init) => {
          calls.push(captureRequest(input, init))
          return Promise.resolve(new Response(null, { status: 201 }))
        },
      })
      const result = await adapter.publish({ article, target }).match(
        (value) => ({ kind: 'success' as const, value }),
        (error) => ({ kind: 'error' as const, error }),
      )

      const summarizeConfiguration = async () => ({
        configured: adapter.configured,
        metadata: await adapter.getMetadata().match(
          (value) => value,
          (error) => error,
        ),
        result,
        calls,
      })
      expect(await summarizeConfiguration()).toEqual({
        configured: false,
        metadata: { configured: false },
        result: {
          kind: 'error',
          error: {
            code: 'not_configured',
            outcome: 'failed',
            retryable: false,
          },
        },
        calls: [],
      })
    },
  )

  it('rejects more than ten tags before sending a request', async () => {
    const calls: CapturedRequest[] = []
    const adapter = createHatenaAdapter({
      env: credentials,
      fetch: (input, init) => {
        calls.push(captureRequest(input, init))
        return Promise.resolve(new Response(null, { status: 201 }))
      },
    })
    const tooManyTags: Extract<PublishTarget, { destination: 'hatena' }> = {
      ...target,
      options: {
        tags: Array.from(
          { length: 11 },
          (_, index) => `fictional-${String(index)}`,
        ),
        private: false,
      },
    }

    expect(await summarize(adapter, calls, tooManyTags)).toEqual({
      result: {
        kind: 'error',
        error: { code: 'rejected', outcome: 'failed', retryable: false },
      },
      calls: [],
    })
  })

  it.each([
    {
      name: 'provider rejection',
      status: 422,
      responseBody: 'fictional rejection',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: { code: 'rejected', outcome: 'failed', retryable: false },
    },
    {
      name: 'authorization rejection',
      status: 401,
      responseBody: 'fictional rejection',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: { code: 'unauthorized', outcome: 'failed', retryable: false },
    },
    {
      name: 'rate limiting',
      status: 429,
      responseBody: 'fictional rejection',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: { code: 'rate_limited', outcome: 'failed', retryable: true },
    },
    {
      name: 'server failure',
      status: 503,
      responseBody: 'fictional failure',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: { code: 'unavailable', outcome: 'unknown', retryable: false },
    },
    {
      name: 'redirect',
      status: 302,
      responseBody: '',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: {
        code: 'invalid_response',
        outcome: 'unknown',
        retryable: false,
      },
    },
    {
      name: 'unreadable success response',
      status: 200,
      responseBody: '{',
      networkFailure: false,
      timeout: false,
      oversized: false,
      expected: {
        code: 'invalid_response',
        outcome: 'unknown',
        retryable: false,
      },
    },
    {
      name: 'oversized success response',
      status: 200,
      responseBody: '',
      networkFailure: false,
      timeout: false,
      oversized: true,
      expected: {
        code: 'invalid_response',
        outcome: 'unknown',
        retryable: false,
      },
    },
    {
      name: 'network failure',
      status: 0,
      responseBody: '',
      networkFailure: true,
      timeout: false,
      oversized: false,
      expected: { code: 'unavailable', outcome: 'unknown', retryable: false },
    },
    {
      name: 'request timeout',
      status: 0,
      responseBody: '',
      networkFailure: false,
      timeout: true,
      oversized: false,
      expected: { code: 'unavailable', outcome: 'unknown', retryable: false },
    },
  ])('$name maps to a safe outcome', async (scenario) => {
    const calls: CapturedRequest[] = []
    const adapter = createHatenaAdapter({
      env: credentials,
      fetch: (input, init) => {
        calls.push(captureRequest(input, init))
        if (scenario.networkFailure) {
          return Promise.reject(new Error('fictional transport detail'))
        }
        if (scenario.timeout) {
          return new Promise<Response>((_, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => {
                reject(new Error('fictional timeout detail'))
              },
              { once: true },
            )
          })
        }
        return Promise.resolve(
          new Response(
            scenario.oversized ? 'x'.repeat(65_537) : scenario.responseBody,
            { status: scenario.status },
          ),
        )
      },
      ...(scenario.timeout ? { timeoutMs: 1 } : {}),
    })

    const summarized = await summarize(adapter, calls)

    const summarizeOutcome = () => ({
      result: summarized.result,
      requestCount: calls.length,
    })
    expect(summarizeOutcome()).toEqual({
      result: { kind: 'error', error: scenario.expected },
      requestCount: 1,
    })
  })
})
