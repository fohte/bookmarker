import type { PublishArticle, PublishTarget } from 'api/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createRaindropAdapter } from '#destinations/raindrop/index'

const article: PublishArticle = {
  url: 'https://example.invalid/reading',
  title: 'A fictional reading item',
}

const target: PublishTarget = {
  destination: 'raindrop',
  operationId: '00000000-0000-4000-8000-000000000001',
  comment: 'A fictional note',
  options: {
    collectionId: 42,
    tags: ['sample', 'reading'],
  },
}

const apiUrl = 'https://api.raindrop.io'
const fictionalToken = 'fictional-access-token'

type FetchFixture = Response | Error

type RecordedCall = {
  url: string
  init: RequestInit | undefined
}

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const installFetch = (...fixtures: FetchFixture[]) => {
  const calls: RecordedCall[] = []
  const pending = [...fixtures]
  const fetchMock = vi.fn(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      calls.push({ url, init })
      const fixture = pending.shift()
      if (fixture instanceof Error) {
        return Promise.reject(fixture)
      }
      return Promise.resolve(fixture ?? jsonResponse({}))
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const summarizeCalls = (calls: RecordedCall[]) =>
  calls.map(({ url, init }) => {
    const headers = new Headers(init?.headers)
    return {
      url,
      method: init?.method,
      authorization: headers.get('authorization'),
      contentType: headers.get('content-type'),
      body: init?.body ?? null,
      redirect: init?.redirect,
      hasTimeout: init?.signal instanceof AbortSignal,
    }
  })

const expectedCall = (path: string, method: string, body?: unknown) => ({
  url: apiUrl + path,
  method,
  authorization: 'Bearer ' + fictionalToken,
  contentType: body === undefined ? null : 'application/json',
  body: body === undefined ? null : JSON.stringify(body),
  redirect: 'error',
  hasTimeout: true,
})

const existsCall = (url = article.url) =>
  expectedCall('/rest/v1/import/url/exists', 'POST', { urls: [url] })

const createCall = (articleToPublish: PublishArticle = article) =>
  expectedCall('/rest/v1/raindrop', 'POST', {
    link: articleToPublish.url,
    ...(articleToPublish.title === undefined
      ? {}
      : { title: articleToPublish.title }),
    note: target.comment,
    tags: target.options.tags,
    collection: { $id: target.options.collectionId },
  })

const getCall = (id: number) =>
  expectedCall('/rest/v1/raindrop/' + String(id), 'GET')

const updateCall = (id: number, articleToPublish: PublishArticle = article) =>
  expectedCall('/rest/v1/raindrop/' + String(id), 'PUT', {
    ...(articleToPublish.title === undefined
      ? {}
      : { title: articleToPublish.title }),
    note: target.comment,
    tags: target.options.tags,
    collection: { $id: target.options.collectionId },
  })

const collectionsCall = (children = false) =>
  expectedCall(
    children ? '/rest/v1/collections/childrens' : '/rest/v1/collections',
    'GET',
  )

const publishResult = async (
  adapter: ReturnType<typeof createRaindropAdapter>,
) =>
  adapter.publish({ article, target }).match(
    (value) => ({ value }),
    (error) => ({ error }),
  )

const publishSnapshot = <T>(result: T, calls: RecordedCall[]) => ({
  result,
  calls: summarizeCalls(calls),
})

const metadataSnapshot = <T>(
  adapter: ReturnType<typeof createRaindropAdapter>,
  metadata: T,
  calls: RecordedCall[],
) => ({
  configured: adapter.configured,
  metadata,
  calls: summarizeCalls(calls),
})

const timeoutSnapshot = (timeoutDurations: number[], requestCount: number) => ({
  timeoutDurations,
  requestCount,
})

const disabledSnapshot = <M, P>(
  adapter: ReturnType<typeof createRaindropAdapter>,
  metadata: M,
  publish: P,
  calls: RecordedCall[],
) => ({
  configured: adapter.configured,
  metadata,
  publish,
  calls: summarizeCalls(calls),
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createRaindropAdapter', () => {
  it('stays disabled without an access token', async () => {
    const calls = installFetch()
    const adapter = createRaindropAdapter({})
    const metadata = await adapter.getMetadata().match(
      (value) => ({ value }),
      (error) => ({ error }),
    )
    const publish = await publishResult(adapter)

    const actual = disabledSnapshot(adapter, metadata, publish, calls)
    expect(actual).toEqual({
      configured: false,
      metadata: { value: { configured: false } },
      publish: {
        error: {
          code: 'not_configured',
          outcome: 'failed',
          retryable: false,
        },
      },
      calls: [],
    })
  })

  it('creates one new raindrop with its note, tags, collection, and title', async () => {
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      jsonResponse({
        result: true,
        item: { _id: 101, link: article.url },
      }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        value: {
          destination: 'raindrop',
          operationId: target.operationId,
          status: 'succeeded',
          retryable: false,
        },
      },
      calls: [existsCall(), createCall()],
    })
  })

  it('sets a ten-second timeout for every API request', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      jsonResponse({ result: true, item: { _id: 101, link: article.url } }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    await publishResult(adapter)

    const actual = timeoutSnapshot(
      timeout.mock.calls.map(([duration]) => duration),
      calls.length,
    )
    expect(actual).toEqual({
      timeoutDurations: [10_000, 10_000],
      requestCount: 2,
    })
  })

  it('checks the existing URL and updates only the requested fields', async () => {
    const calls = installFetch(
      jsonResponse({ result: true, ids: [101] }),
      jsonResponse({
        result: true,
        item: { _id: 101, link: article.url },
      }),
      jsonResponse({
        result: true,
        item: { _id: 101, link: article.url },
      }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await adapter
      .publish({
        article,
        target,
      })
      .match(
        (value) => ({ value }),
        (error) => ({ error }),
      )

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        value: {
          destination: 'raindrop',
          operationId: target.operationId,
          status: 'succeeded',
          retryable: false,
        },
      },
      calls: [existsCall(), getCall(101), updateCall(101)],
    })
  })

  it('does not choose among multiple existing raindrops', async () => {
    const calls = installFetch(jsonResponse({ result: true, ids: [101, 102] }))
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'rejected',
          outcome: 'failed',
          retryable: false,
        },
      },
      calls: [existsCall()],
    })
  })

  it('does not update an existing ID whose URL does not match', async () => {
    const calls = installFetch(
      jsonResponse({ result: true, ids: [101] }),
      jsonResponse({
        result: true,
        item: { _id: 101, link: 'https://example.invalid/other' },
      }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'rejected',
          outcome: 'failed',
          retryable: false,
        },
      },
      calls: [existsCall(), getCall(101)],
    })
  })

  it('returns a failed result when the existence read fails before writing', async () => {
    const calls = installFetch(jsonResponse({ error: 'unavailable' }, 503))
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'unavailable',
          outcome: 'failed',
          retryable: true,
        },
      },
      calls: [existsCall()],
    })
  })

  it('returns a retryable rate limit rejection without retrying the write', async () => {
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      jsonResponse({ error: 'rate_limited' }, 429),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'rate_limited',
          outcome: 'failed',
          retryable: true,
        },
      },
      calls: [existsCall(), createCall()],
    })
  })

  it('does not recreate after a create request has an unknown outcome', async () => {
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      new Error('fictional transport failure'),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'unavailable',
          outcome: 'unknown',
          retryable: false,
        },
      },
      calls: [existsCall(), createCall()],
    })
  })

  it('marks a server error after create as an unknown outcome', async () => {
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      jsonResponse({ error: 'temporary failure' }, 503),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'unavailable',
          outcome: 'unknown',
          retryable: false,
        },
      },
      calls: [existsCall(), createCall()],
    })
  })

  it('marks an unparseable create response as an unknown outcome', async () => {
    const calls = installFetch(
      jsonResponse({ result: false, ids: [] }),
      new Response('{unreadable', { status: 200 }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const result = await publishResult(adapter)

    const actual = publishSnapshot(result, calls)
    expect(actual).toEqual({
      result: {
        error: {
          code: 'invalid_response',
          outcome: 'unknown',
          retryable: false,
        },
      },
      calls: [existsCall(), createCall()],
    })
  })

  it('normalizes root, child, and unsorted collections without changing public flags', async () => {
    const calls = installFetch(
      jsonResponse({
        result: true,
        items: [{ _id: 10, title: 'Fictional root', public: true }],
      }),
      jsonResponse({
        result: true,
        items: [
          {
            _id: 11,
            title: 'Fictional child',
            parent: { $id: 10 },
            public: false,
          },
        ],
      }),
    )
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const metadata = await adapter.getMetadata().match(
      (value) => ({ value }),
      (error) => ({ error }),
    )

    const actual = metadataSnapshot(adapter, metadata, calls)
    expect(actual).toEqual({
      configured: true,
      metadata: {
        value: {
          configured: true,
          collections: [
            { id: -1, title: 'Unsorted', public: false },
            { id: 10, title: 'Fictional root', public: true },
            {
              id: 11,
              title: 'Fictional child',
              parentId: 10,
              public: false,
            },
          ],
        },
      },
      calls: [collectionsCall(), collectionsCall(true)],
    })
  })

  it('keeps configured true when metadata authentication fails', async () => {
    const calls = installFetch(jsonResponse({ error: 'unauthorized' }, 401))
    const adapter = createRaindropAdapter({
      RAINDROP_ACCESS_TOKEN: fictionalToken,
    })
    const metadata = await adapter.getMetadata().match(
      (value) => ({ value }),
      (error) => ({ error }),
    )

    const actual = metadataSnapshot(adapter, metadata, calls)
    expect(actual).toEqual({
      configured: true,
      metadata: { error: { code: 'unauthorized' } },
      calls: [collectionsCall(), collectionsCall(true)],
    })
  })
})
