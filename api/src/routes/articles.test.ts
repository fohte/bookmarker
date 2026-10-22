import { describe, expect, it } from 'vitest'

import { createApp } from '#app'
import { createArticleExtractor } from '#articles/index'
import type { ArticleDnsResolver } from '#articles/types'
import { createArticlesRouter } from '#routes/articles'

const appOrigin = 'http://127.0.0.1:5173'
const app = createApp({
  env: {
    NODE_ENV: 'development',
    APP_ORIGIN: appOrigin,
    CF_ACCESS_ISSUER: 'https://access.example.invalid',
    CF_ACCESS_AUD: 'example-access-audience',
    DEV_AUTH_BYPASS: 'true',
  },
  isLoopbackListenerBound: () => true,
})

const noRecordError = (): Error & { code: string } =>
  Object.assign(new Error('No record'), { code: 'ENODATA' })

const createResolver = (): ArticleDnsResolver => ({
  resolve4: () => Promise.resolve(['223.255.255.254']),
  resolve6: () => Promise.reject(noRecordError()),
  cancel: () => undefined,
})

const postJson = (input: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', Origin: appOrigin },
  body: JSON.stringify(input),
})
const observe = (...values: unknown[]) => values

describe('POST /api/articles/extract', () => {
  it('uses the route registered on the application for shared text', async () => {
    const response = await app.request(
      '/api/articles/extract',
      postJson({
        version: 1,
        url: 'https://notes.example.invalid/shared',
        title: 'An invented note',
        sharedText: 'A fictional passage was shared.',
        partial: true,
      }),
    )

    const body = JSON.parse(await response.text()) as unknown
    expect(observe(response.status, body)).toEqual([
      200,
      {
        url: 'https://notes.example.invalid/shared',
        title: 'An invented note',
        text: 'A fictional passage was shared.',
        source: 'shared',
        partial: true,
      },
    ])
  })

  it('rejects blank shared text without resolving the URL', async () => {
    let resolverCreations = 0
    const router = createArticlesRouter(
      createArticleExtractor({
        createResolver: () => {
          resolverCreations += 1
          return createResolver()
        },
      }),
    )
    const response = await router.request(
      '/extract',
      postJson({
        version: 1,
        url: 'https://notes.example.invalid/shared',
        sharedText: ' \n\t ',
      }),
    )

    const body = JSON.parse(await response.text()) as unknown
    expect(observe(response.status, body, resolverCreations)).toEqual([
      400,
      {
        error: { code: 'INVALID_INPUT', message: 'The request is invalid.' },
      },
      0,
    ])
  })

  it('rejects shared text beyond the contract limit before extraction', async () => {
    let resolverCreations = 0
    const router = createArticlesRouter(
      createArticleExtractor({
        createResolver: () => {
          resolverCreations += 1
          return createResolver()
        },
      }),
    )
    const response = await router.request(
      '/extract',
      postJson({
        version: 1,
        url: 'https://notes.example.invalid/shared',
        sharedText: 'x'.repeat(100_001),
      }),
    )

    const body = JSON.parse(await response.text()) as unknown
    expect(observe(response.status, body, resolverCreations)).toEqual([
      400,
      {
        error: { code: 'INVALID_INPUT', message: 'The request is invalid.' },
      },
      0,
    ])
  })

  it('rejects an API body larger than one mebibyte', async () => {
    let extractorCalls = 0
    const router = createArticlesRouter((input, signal) => {
      extractorCalls += 1
      return createArticleExtractor()(input, signal)
    })
    const response = await router.request(
      '/extract',
      postJson({
        version: 1,
        url: 'https://notes.example.invalid/shared',
        title: 'x'.repeat(1_050_000),
      }),
    )

    const body = JSON.parse(await response.text()) as unknown
    expect(observe(response.status, body, extractorCalls)).toEqual([
      413,
      {
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: 'The request body is too large.',
        },
      },
      0,
    ])
  })

  it('rejects malformed JSON with the complete error envelope', async () => {
    const response = await app.request('/api/articles/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: appOrigin },
      body: '{',
    })

    const body = JSON.parse(await response.text()) as unknown
    expect(observe(response.status, body)).toEqual([
      400,
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'The request body is invalid.',
        },
      },
    ])
  })
})
