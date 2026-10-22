import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { createArticleExtractor } from '#articles/index'
import type { ArticleDnsResolver, ArticleHttpRequest } from '#articles/types'
import { createAnalysisRoute } from '#routes/analysis'
import { createArticlesRouter } from '#routes/articles'

const articleUrl = 'https://fictional.example.invalid/field-guide'
const sharedArticleText =
  'The invented guide records that a blue kite rests beside a copper bench.'
const fictionalComment =
  'The blue kite rests beside a silver door, and the guide says there are five kites.'

const environment = {
  LITELLM_BASE_URL: 'https://gateway.example.invalid/v1',
  LITELLM_API_KEY: 'fictional-test-token',
  LITELLM_MODEL: 'fictional-test-model',
}

const ProviderRequestSchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })),
})

const noIpv6Record = (): Error & { code: string } =>
  Object.assign(new Error('No record'), { code: 'ENODATA' })

const createResolver = (): ArticleDnsResolver => ({
  resolve4: () => Promise.resolve(['93.184.216.100']),
  resolve6: () => Promise.reject(noIpv6Record()),
  cancel: () => undefined,
})

const dataEvent = (data: unknown): string => `data: ${JSON.stringify(data)}\n\n`

const completionResponse = (content: string): Response =>
  new Response(
    [
      dataEvent({ choices: [{ index: 0, delta: { content } }] }),
      dataEvent({
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }),
      'data: [DONE]\n\n',
    ].join(''),
    { headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
  )

const postJson = (input: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(input),
})

const observe = <T>(value: T): T => value

describe('article sharing and analysis acceptance', () => {
  it('summarizes shared text after the URL request boundary fails', async () => {
    let resolverCreations = 0
    let networkAttempts = 0
    const request: ArticleHttpRequest = async () => {
      networkAttempts += 1
      return Promise.reject(new Error('The fixture network is unavailable.'))
    }
    const providerBodies: string[] = []
    const app = new Hono()
      .route(
        '/api/articles',
        createArticlesRouter(
          createArticleExtractor({
            createResolver: () => {
              resolverCreations += 1
              return createResolver()
            },
            request,
          }),
        ),
      )
      .route(
        '/api/analysis',
        createAnalysisRoute({
          env: () => environment,
          fetchImpl: (_input, init) => {
            if (typeof init?.body === 'string') providerBodies.push(init.body)
            return Promise.resolve(
              completionResponse(
                '{"status":"ok","summary":"The guide places the kite beside the bench."}',
              ),
            )
          },
        }),
      )

    const unavailableResponse = await app.request(
      '/api/articles/extract',
      postJson({ version: 1, url: articleUrl }),
    )
    const unavailableBody: unknown = await unavailableResponse.json()

    const extractedResponse = await app.request(
      '/api/articles/extract',
      postJson({
        version: 1,
        url: articleUrl,
        title: 'An invented field guide',
        sharedText: sharedArticleText,
        partial: true,
      }),
    )
    const extractedBody: unknown = await extractedResponse.json()

    const summaryResponse = await app.request(
      '/api/analysis/summary',
      postJson({ article: extractedBody }),
    )
    const summaryBody: unknown = await summaryResponse.json()
    const providerBody: unknown = JSON.parse(providerBodies[0] ?? '{}')
    const providerRequest = ProviderRequestSchema.safeParse(providerBody)
    const providerInput = providerRequest.success
      ? providerRequest.data.messages.find((message) => message.role === 'user')
          ?.content
      : undefined

    expect(
      observe({
        unavailable: [unavailableResponse.status, unavailableBody],
        extracted: [extractedResponse.status, extractedBody],
        summary: [summaryResponse.status, summaryBody],
        providerInput,
        resolverCreations,
        networkAttempts,
      }),
    ).toEqual({
      unavailable: [
        422,
        {
          error: {
            code: 'ARTICLE_UNAVAILABLE',
            message: 'The article could not be extracted.',
          },
        },
      ],
      extracted: [
        200,
        {
          url: articleUrl,
          title: 'An invented field guide',
          text: sharedArticleText,
          source: 'shared',
          partial: true,
        },
      ],
      summary: [
        200,
        {
          summary: 'The guide places the kite beside the bench.',
          partial: true,
        },
      ],
      providerInput: `Article partial: true\nArticle body as a JSON string: ${JSON.stringify(sharedArticleText)}`,
      resolverCreations: 1,
      networkAttempts: 1,
    })
  })

  it('returns all three comment verification categories', async () => {
    const app = new Hono().route(
      '/api/analysis',
      createAnalysisRoute({
        env: () => environment,
        fetchImpl: () =>
          Promise.resolve(
            completionResponse(
              JSON.stringify({
                status: 'ok',
                issues: [
                  {
                    kind: 'error',
                    quote: 'The blue kite rests beside a silver door',
                    reason: 'The guide places it beside the copper bench.',
                    evidence: 'blue kite rests beside a copper bench',
                  },
                  {
                    kind: 'unsupported',
                    quote: 'there are five kites',
                    reason: 'The guide gives no count of the kites.',
                  },
                  {
                    kind: 'uncertain',
                    quote: 'the guide says there are five kites',
                    reason: 'The guide does not establish that quantity.',
                  },
                ],
              }),
            ),
          ),
      }),
    )
    const article = {
      url: articleUrl,
      title: 'An invented field guide',
      text: sharedArticleText,
      source: 'shared',
      partial: false,
    }

    const response = await app.request(
      '/api/analysis/verify',
      postJson({ article, comment: fictionalComment }),
    )

    expect(observe([response.status, await response.json()])).toEqual([
      200,
      {
        issues: [
          {
            kind: 'error',
            quote: 'The blue kite rests beside a silver door',
            reason: 'The guide places it beside the copper bench.',
            evidence: 'blue kite rests beside a copper bench',
          },
          {
            kind: 'unsupported',
            quote: 'there are five kites',
            reason: 'The guide gives no count of the kites.',
          },
          {
            kind: 'uncertain',
            quote: 'the guide says there are five kites',
            reason: 'The guide does not establish that quantity.',
          },
        ],
        partial: false,
      },
    ])
  })
})
