import type { Article, ShareInput, Summary, Verification } from 'api/contracts'
import type { Result } from 'neverthrow'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  type AnalysisClientError,
  extractArticle,
  summarizeArticle,
  verifyComment,
} from '#features/analysis/index'

const article: Article = {
  url: 'https://fictional.example.invalid/paper-lantern',
  title: 'An invented note',
  text: 'A fictional note says a paper lantern is green.',
  source: 'shared',
  partial: true,
}

const shareInput: ShareInput = {
  version: 1,
  url: article.url,
  title: article.title,
  sharedText: article.text,
  partial: true,
}

const summary: Summary = {
  summary: 'The fictional note describes a green paper lantern.',
  partial: true,
}

const verification: Verification = {
  issues: [
    {
      kind: 'uncertain',
      quote: 'The lantern is green',
      reason: 'The note does not describe its color directly.',
    },
  ],
  partial: true,
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const observeResult = <T, E>(result: Result<T, E>) =>
  result.match(
    (value) => ({ value }),
    (error) => ({ error }),
  )

const observe = <T>(value: T): T => value

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

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

const describeRequest = ([input, init]: Parameters<typeof fetch>) => ({
  url:
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  method: init?.method,
  credentials: init?.credentials,
  headers: Object.fromEntries(new Headers(init?.headers).entries()),
  body:
    typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('article analysis client', () => {
  it('sends same-origin JSON requests and validates each success contract', async () => {
    const responses = [
      jsonResponse(article),
      jsonResponse(summary),
      jsonResponse(verification),
    ]
    const fetchMock = installFetch(() =>
      Promise.resolve(responses.shift() ?? jsonResponse(null, 500)),
    )

    const [extracted, summarized, verified] = await Promise.all([
      extractArticle(shareInput),
      summarizeArticle(article),
      verifyComment(article, 'The lantern is green.'),
    ])

    expect(
      observe({
        results: [
          observeResult(extracted),
          observeResult(summarized),
          observeResult(verified),
        ],
        requests: fetchMock.mock.calls.map(describeRequest),
      }),
    ).toEqual({
      results: [
        { value: article },
        { value: summary },
        { value: verification },
      ],
      requests: [
        {
          url: '/api/articles/extract',
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: shareInput,
        },
        {
          url: '/api/analysis/summary',
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: { article },
        },
        {
          url: '/api/analysis/verify',
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: { article, comment: 'The lantern is green.' },
        },
      ],
    })
  })

  it('returns validated HTTP and authentication failures as values', async () => {
    const responses = [
      jsonResponse(
        {
          error: {
            code: 'ARTICLE_INSUFFICIENT',
            message: 'Fictional server detail.',
          },
        },
        422,
      ),
      jsonResponse(
        {
          error: {
            code: 'unauthorized',
            message: 'Fictional authentication detail.',
          },
        },
        401,
      ),
    ]
    installFetch(() =>
      Promise.resolve(responses.shift() ?? jsonResponse(null, 500)),
    )

    const [summaryResult, extractionResult] = await Promise.all([
      summarizeArticle(article),
      extractArticle(shareInput),
    ])

    expect(
      observe([observeResult(summaryResult), observeResult(extractionResult)]),
    ).toEqual([
      {
        error: {
          kind: 'http',
          status: 422,
          code: 'ARTICLE_INSUFFICIENT',
          message: 'The server rejected the request.',
        },
      },
      {
        error: {
          kind: 'authentication-required',
          message: 'Authentication is required to use article analysis.',
        },
      },
    ])
  })

  it('maps network failures to a value', async () => {
    const fetchMock = installFetch(() =>
      Promise.reject(new Error('Fictional network failure.')),
    )
    const result = await extractArticle(shareInput)

    expect(
      observe({
        result: observeResult(result),
        requests: fetchMock.mock.calls.map(describeRequest),
      }),
    ).toEqual({
      result: {
        error: {
          kind: 'network',
          message: 'The request could not reach the server.',
        },
      },
      requests: [
        {
          url: '/api/articles/extract',
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: shareInput,
        },
      ],
    })
  })

  it('maps an access challenge response to an authentication value', async () => {
    installFetch(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'access_required',
              message: 'Fictional access challenge.',
            },
          }),
          {
            status: 403,
            headers: {
              'content-type': 'application/json',
              'www-authenticate':
                'Bearer realm="https://fictional.example.invalid/.well-known/cloudflare-access-protected-resource/api"',
            },
          },
        ),
      ),
    )

    const result = await extractArticle(shareInput)

    expect(observeResult(result)).toEqual({
      error: {
        kind: 'authentication-required',
        message: 'Authentication is required to use article analysis.',
      },
    })
  })

  it('maps an abort while reading a successful response body to cancelled', async () => {
    const body = deferred<unknown>()
    let markBodyReadStarted!: () => void
    const bodyReadStarted = new Promise<void>((resolve) => {
      markBodyReadStarted = resolve
    })
    const response = new Response()
    vi.spyOn(response, 'json').mockImplementation(() => {
      markBodyReadStarted()
      return body.promise
    })
    installFetch(() => Promise.resolve(response))

    const controller = new AbortController()
    const request = summarizeArticle(article, { signal: controller.signal })
    await bodyReadStarted
    controller.abort()
    body.reject(new DOMException('Fictional body read abort.', 'AbortError'))

    const result = await request

    expect(observeResult(result)).toEqual({
      error: {
        kind: 'cancelled',
        message: 'The request was cancelled.',
      },
    })
  })

  it('returns malformed success responses and cancelled requests as values', async () => {
    const fetchMock = installFetch(() =>
      Promise.resolve(jsonResponse({ summary: 'Missing the partial field.' })),
    )
    const controller = new AbortController()
    controller.abort()

    const [invalidResult, cancelledResult] = await Promise.all([
      summarizeArticle(article),
      summarizeArticle(article, { signal: controller.signal }),
    ])

    expect(
      observe({
        invalid: observeResult(invalidResult),
        cancelled: observeResult(cancelledResult),
        calls: fetchMock.mock.calls.length,
      }),
    ).toEqual({
      invalid: {
        error: {
          kind: 'invalid-response',
          message: 'The server returned an invalid response.',
        },
      },
      cancelled: {
        error: {
          kind: 'cancelled',
          message: 'The request was cancelled.',
        },
      },
      calls: 1,
    })
  })

  it('rejects invalid inputs before making a request', async () => {
    const fetchMock = installFetch(() => Promise.resolve(jsonResponse(article)))
    const result = await verifyComment(article, '   ')

    expect(
      observe({
        result: observeResult(result),
        calls: fetchMock.mock.calls.length,
      }),
    ).toEqual({
      result: {
        error: {
          kind: 'invalid-input',
          message: 'The request does not match the article analysis contract.',
        } satisfies AnalysisClientError,
      },
      calls: 0,
    })
  })
})
