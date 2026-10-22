import type { IncomingHttpHeaders } from 'node:http'

import { describe, expect, it } from 'vitest'

import { createArticleExtractor } from '#articles/index'
import type {
  ArticleDnsResolver,
  ArticleExtractorOptions,
  ArticleHttpResponse,
  ArticleRequestOptions,
} from '#articles/types'
import { ARTICLE_TEXT_LIMIT, HTML_RESPONSE_LIMIT } from '#articles/types'
import { createArticlesRouter } from '#routes/articles'

const PUBLIC_STORY_ADDRESS = '223.255.255.254'
const PUBLIC_LANDING_ADDRESS = '223.255.255.253'

const noRecordError = (): Error & { code: string } =>
  Object.assign(new Error('No record'), { code: 'ENODATA' })

const noRecord = (): Promise<string[]> => Promise.reject(noRecordError())

const createResolver = (
  resolve4: (hostname: string) => Promise<string[]> = () =>
    Promise.resolve([PUBLIC_STORY_ADDRESS]),
  resolve6: (hostname: string) => Promise<string[]> = () => noRecord(),
  cancel: () => void = () => undefined,
): ArticleDnsResolver => ({ resolve4, resolve6, cancel })

const toAsyncIterable = (
  chunks: readonly Uint8Array[],
): AsyncIterable<Uint8Array> => ({
  async *[Symbol.asyncIterator]() {
    await Promise.resolve()
    for (const chunk of chunks) yield chunk
  },
})

const makeResponse = (
  statusCode: number,
  headers: IncomingHttpHeaders,
  chunks: readonly Uint8Array[] = [],
  isComplete = true,
  onDestroy: () => void = () => undefined,
): ArticleHttpResponse => ({
  statusCode,
  headers,
  body: toAsyncIterable(chunks),
  isComplete: () => isComplete,
  destroy: onDestroy,
})

const sendExtract = async (
  options: ArticleExtractorOptions,
  input: unknown,
) => {
  const router = createArticlesRouter(createArticleExtractor(options))
  const response = await router.request('/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

  const body = JSON.parse(await response.text()) as unknown
  return { status: response.status, body }
}

const articleInput = (url: string) => ({ version: 1, url })
const observe = (...values: unknown[]) => values

const storyParagraph =
  '架空の観測所は、遠い丘の天気を記録するために毎朝青いノートを開く。'
const storyText = Array.from({ length: 30 }, () => storyParagraph).join(' ')
const storyHtml = `<!doctype html><html><head><meta charset="utf-8"><title>架空の観測所</title></head><body><article><p>${storyText}</p></article></body></html>`

describe('article extraction route', () => {
  it('pins every redirect hop and extracts UTF-8 HTML using the final URL', async () => {
    const dnsCalls: string[] = []
    const requestTrace: Record<string, unknown>[] = []
    const resolver = createResolver(
      (hostname) => {
        dnsCalls.push(`A:${hostname}`)
        return Promise.resolve([
          hostname === 'story.example.invalid'
            ? PUBLIC_STORY_ADDRESS
            : PUBLIC_LANDING_ADDRESS,
        ])
      },
      (hostname) => {
        dnsCalls.push(`AAAA:${hostname}`)
        return noRecord()
      },
    )
    const request = async (options: ArticleRequestOptions) => {
      const lookupAll = await new Promise<unknown>((resolve, reject) => {
        options.lookup(options.hostname, { all: true }, (error, address) => {
          if (error !== null) {
            reject(error)
            return
          }
          resolve(address)
        })
      })
      const lookupSingle = await new Promise<unknown>((resolve, reject) => {
        options.lookup(
          options.hostname,
          { all: false },
          (error, address, family) => {
            if (error !== null) {
              reject(error)
              return
            }
            resolve({ address, family })
          },
        )
      })
      requestTrace.push({
        protocol: options.protocol,
        hostname: options.hostname,
        port: options.port,
        path: options.path,
        method: options.method,
        headers: options.headers,
        agent: options.agent,
        servername: options.servername ?? null,
        lookupAll,
        lookupSingle,
      })

      if (options.hostname === 'story.example.invalid') {
        return makeResponse(302, {
          location: 'https://landing.example.invalid/moved',
        })
      }

      return makeResponse(
        200,
        {
          'content-type': 'text/html; charset=utf-8',
          'content-length': String(Buffer.byteLength(storyHtml)),
        },
        [Buffer.from(storyHtml)],
      )
    }

    const result = await sendExtract(
      { createResolver: () => resolver, request },
      {
        ...articleInput('https://story.example.invalid/read?chapter=2'),
        partial: true,
      },
    )

    expect(observe(result, dnsCalls, requestTrace)).toEqual([
      {
        status: 200,
        body: {
          url: 'https://story.example.invalid/read?chapter=2',
          title: '架空の観測所',
          text: storyText,
          source: 'fetched',
          partial: true,
        },
      },
      [
        'A:story.example.invalid',
        'AAAA:story.example.invalid',
        'A:landing.example.invalid',
        'AAAA:landing.example.invalid',
      ],
      [
        {
          protocol: 'https:',
          hostname: 'story.example.invalid',
          port: 443,
          path: '/read?chapter=2',
          method: 'GET',
          headers: {
            'user-agent': 'bookmarker-article-extractor/1.0',
            accept: 'text/html, application/xhtml+xml',
            'accept-encoding': 'identity',
          },
          agent: false,
          servername: 'story.example.invalid',
          lookupAll: [{ address: PUBLIC_STORY_ADDRESS, family: 4 }],
          lookupSingle: { address: PUBLIC_STORY_ADDRESS, family: 4 },
        },
        {
          protocol: 'https:',
          hostname: 'landing.example.invalid',
          port: 443,
          path: '/moved',
          method: 'GET',
          headers: {
            'user-agent': 'bookmarker-article-extractor/1.0',
            accept: 'text/html, application/xhtml+xml',
            'accept-encoding': 'identity',
          },
          agent: false,
          servername: 'landing.example.invalid',
          lookupAll: [{ address: PUBLIC_LANDING_ADDRESS, family: 4 }],
          lookupSingle: { address: PUBLIC_LANDING_ADDRESS, family: 4 },
        },
      ],
    ])
  })

  it.each([
    ['a private IPv4 literal', 'http://127.0.0.1/read'],
    ['a private IPv4-mapped IPv6 literal', 'http://[::ffff:10.0.0.2]/read'],
    ['a nonstandard port', 'http://story.example.invalid:8080/read'],
    ['URL userinfo', 'http://reader:pass@story.example.invalid/read'],
  ])('rejects %s before starting a request', async (_name, url) => {
    let resolverCreations = 0
    let requests = 0
    const result = await sendExtract(
      {
        createResolver: () => {
          resolverCreations += 1
          return createResolver()
        },
        request: () => {
          requests += 1
          return Promise.resolve(makeResponse(200, {}))
        },
      },
      articleInput(url),
    )

    expect(observe(result, resolverCreations, requests)).toEqual([
      {
        status: 400,
        body: {
          error: {
            code: 'UNSAFE_URL',
            message: 'The article URL is not allowed.',
          },
        },
      },
      0,
      0,
    ])
  })

  it('rejects all DNS results when any address is non-public', async () => {
    const dnsCalls: string[] = []
    let requests = 0
    const result = await sendExtract(
      {
        createResolver: () =>
          createResolver(
            (hostname) => {
              dnsCalls.push(`A:${hostname}`)
              return Promise.resolve([PUBLIC_STORY_ADDRESS])
            },
            (hostname) => {
              dnsCalls.push(`AAAA:${hostname}`)
              return Promise.resolve(['::ffff:10.0.0.2'])
            },
          ),
        request: () => {
          requests += 1
          return Promise.resolve(makeResponse(200, {}))
        },
      },
      articleInput('https://mixed.example.invalid/read'),
    )

    expect(observe(result, dnsCalls, requests)).toEqual([
      {
        status: 400,
        body: {
          error: {
            code: 'UNSAFE_URL',
            message: 'The article URL is not allowed.',
          },
        },
      },
      ['A:mixed.example.invalid', 'AAAA:mixed.example.invalid'],
      0,
    ])
  })

  it('fails closed when DNS returns an error other than an absent family', async () => {
    let requests = 0
    const result = await sendExtract(
      {
        createResolver: () =>
          createResolver(
            () => Promise.resolve([PUBLIC_STORY_ADDRESS]),
            () =>
              Promise.reject(
                Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }),
              ),
          ),
        request: () => {
          requests += 1
          return Promise.resolve(makeResponse(200, {}))
        },
      },
      articleInput('https://missing.example.invalid/read'),
    )

    expect(observe(result, requests)).toEqual([
      {
        status: 422,
        body: {
          error: {
            code: 'ARTICLE_UNAVAILABLE',
            message: 'The article could not be extracted.',
          },
        },
      },
      0,
    ])
  })

  it('revalidates a redirect target before opening its connection', async () => {
    const dnsCalls: string[] = []
    const requestHosts: string[] = []
    const result = await sendExtract(
      {
        createResolver: () =>
          createResolver(
            (hostname) => {
              dnsCalls.push(`A:${hostname}`)
              return Promise.resolve(
                hostname === 'start.example.invalid'
                  ? [PUBLIC_STORY_ADDRESS]
                  : ['10.0.0.2'],
              )
            },
            (hostname) => {
              dnsCalls.push(`AAAA:${hostname}`)
              return noRecord()
            },
          ),
        request: (options) => {
          requestHosts.push(options.hostname)
          return Promise.resolve(
            makeResponse(302, {
              location: 'https://internal.example.invalid/private',
            }),
          )
        },
      },
      articleInput('https://start.example.invalid/read'),
    )

    expect(observe(result, dnsCalls, requestHosts)).toEqual([
      {
        status: 400,
        body: {
          error: {
            code: 'UNSAFE_URL',
            message: 'The article URL is not allowed.',
          },
        },
      },
      [
        'A:start.example.invalid',
        'AAAA:start.example.invalid',
        'A:internal.example.invalid',
        'AAAA:internal.example.invalid',
      ],
      ['start.example.invalid'],
    ])
  })

  it('follows no more than five redirects', async () => {
    const paths: string[] = []
    const result = await sendExtract(
      {
        createResolver: () => createResolver(),
        request: (options) => {
          paths.push(options.path)
          return Promise.resolve(
            makeResponse(302, { location: `/hop-${String(paths.length + 1)}` }),
          )
        },
      },
      articleInput('https://chain.example.invalid/start'),
    )

    expect(observe(result, paths)).toEqual([
      {
        status: 422,
        body: {
          error: {
            code: 'ARTICLE_UNAVAILABLE',
            message: 'The article could not be extracted.',
          },
        },
      },
      ['/start', '/hop-2', '/hop-3', '/hop-4', '/hop-5', '/hop-6'],
    ])
  })

  it('cancels DNS work when the total fetch deadline expires', async () => {
    let cancelled = false
    let rejectDns: ((error: unknown) => void) | undefined
    let requests = 0
    const result = await sendExtract(
      {
        timeoutMs: 20,
        createResolver: () =>
          createResolver(
            () =>
              new Promise((_resolve, reject) => {
                rejectDns = reject
              }),
            () => noRecord(),
            () => {
              cancelled = true
              rejectDns?.(
                Object.assign(new Error('Cancelled'), { code: 'ECANCELLED' }),
              )
            },
          ),
        request: () => {
          requests += 1
          return Promise.resolve(makeResponse(200, {}))
        },
      },
      articleInput('https://slow.example.invalid/read'),
    )

    expect(observe(result, cancelled, requests)).toEqual([
      {
        status: 504,
        body: {
          error: {
            code: 'ARTICLE_FETCH_TIMEOUT',
            message: 'The article request timed out.',
          },
        },
      },
      true,
      0,
    ])
  })

  it('counts streamed bytes and rejects HTML above two mebibytes', async () => {
    let destroyed = false
    const result = await sendExtract(
      {
        createResolver: () => createResolver(),
        request: () =>
          Promise.resolve(
            makeResponse(
              200,
              { 'content-type': 'text/html; charset=utf-8' },
              [Buffer.alloc(HTML_RESPONSE_LIMIT + 1, 32)],
              true,
              () => {
                destroyed = true
              },
            ),
          ),
      },
      articleInput('https://large.example.invalid/read'),
    )

    expect(observe(result, destroyed)).toEqual([
      {
        status: 422,
        body: {
          error: {
            code: 'ARTICLE_UNAVAILABLE',
            message: 'The article could not be extracted.',
          },
        },
      },
      true,
    ])
  })

  it('rejects compressed and non-HTML responses', async () => {
    const cases = [
      {
        name: 'compressed',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
        },
      },
      { name: 'non-html', headers: { 'content-type': 'application/json' } },
    ]
    const results = await Promise.all(
      cases.map(async ({ headers }) =>
        sendExtract(
          {
            createResolver: () => createResolver(),
            request: () => Promise.resolve(makeResponse(200, headers)),
          },
          articleInput('https://format.example.invalid/read'),
        ),
      ),
    )

    expect(results).toEqual(
      cases.map(() => ({
        status: 422,
        body: {
          error: {
            code: 'ARTICLE_UNAVAILABLE',
            message: 'The article could not be extracted.',
          },
        },
      })),
    )
  })

  it('marks extracted text partial when it exceeds the Article limit', async () => {
    const oversizedText =
      'An imaginary survey records a blue cloud above a quiet hill. '.repeat(
        1_800,
      )
    const html = `<!doctype html><html><head><title>Imaginary survey</title></head><body><article><p>${oversizedText}</p></article></body></html>`
    const result = await sendExtract(
      {
        createResolver: () => createResolver(),
        request: () =>
          Promise.resolve(
            makeResponse(200, { 'content-type': 'text/html; charset=utf-8' }, [
              Buffer.from(html),
            ]),
          ),
      },
      articleInput('https://long.example.invalid/read'),
    )

    expect(result).toEqual({
      status: 200,
      body: {
        url: 'https://long.example.invalid/read',
        title: 'Imaginary survey',
        text: oversizedText.trim().slice(0, ARTICLE_TEXT_LIMIT),
        source: 'fetched',
        partial: true,
      },
    })
  })
})
