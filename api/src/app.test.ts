import { once } from 'node:events'

import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '#app'
import { startApiServer } from '#server'

const appOrigin = 'http://127.0.0.1:5173'
const issuer = 'https://access.example.invalid'
const audience = 'example-access-audience'
const testEnvironment = {
  NODE_ENV: 'test',
  APP_ORIGIN: appOrigin,
  CF_ACCESS_ISSUER: issuer,
  CF_ACCESS_AUD: audience,
}
const developmentEnvironment = {
  NODE_ENV: 'development',
  APP_ORIGIN: appOrigin,
  CF_ACCESS_ISSUER: issuer,
  CF_ACCESS_AUD: audience,
  DEV_AUTH_BYPASS: 'true',
}

const servers: ReturnType<typeof startApiServer>[] = []
type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
let privateKey!: SigningKey
let roguePrivateKey!: SigningKey
let jwks!: ReturnType<typeof createLocalJWKSet>

beforeAll(async () => {
  const trustedKeyPair = await generateKeyPair('RS256')
  const rogueKeyPair = await generateKeyPair('RS256')
  const publicJwk = await exportJWK(trustedKeyPair.publicKey)
  publicJwk.alg = 'RS256'
  publicJwk.kid = 'test-signing-key'
  publicJwk.use = 'sig'

  privateKey = trustedKeyPair.privateKey
  roguePrivateKey = rogueKeyPair.privateKey
  jwks = createLocalJWKSet({ keys: [publicJwk] })
})

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        }),
    ),
  )
})

const signToken = async ({
  signingKey = privateKey,
  tokenIssuer = issuer,
  tokenAudience = audience,
  expiration = Math.floor(Date.now() / 1000) + 300,
}: {
  signingKey?: SigningKey
  tokenIssuer?: string
  tokenAudience?: string
  expiration?: number | null
} = {}) => {
  let token = new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-signing-key' })
    .setIssuer(tokenIssuer)
    .setAudience(tokenAudience)

  if (expiration !== null) {
    token = token.setExpirationTime(expiration)
  }

  return token.sign(signingKey)
}

const createTestApp = (
  options: {
    env?: Record<string, string | undefined>
    isLoopbackListenerBound?: () => boolean
  } = {},
) =>
  createApp({
    env: options.env ?? testEnvironment,
    jwks,
    ...(options.isLoopbackListenerBound === undefined
      ? {}
      : { isLoopbackListenerBound: options.isLoopbackListenerBound }),
  })

const summarizeResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type')

  return {
    status: response.status,
    body:
      response.body === null
        ? ''
        : contentType !== null && contentType.includes('application/json')
          ? ((await response.json()) as unknown)
          : await response.text(),
  }
}

const summarizeListenerResponse = (
  response: Awaited<ReturnType<typeof summarizeResponse>>,
  boundAddress: string | null,
) => ({ ...response, boundAddress })

const unauthorizedResponse = {
  status: 401,
  body: {
    error: {
      code: 'unauthorized',
      message: 'Authentication is required.',
    },
  },
}

const authenticatedHeaders = async (
  extraHeaders: Record<string, string> = {},
): Promise<Record<string, string>> => ({
  'Cf-Access-Jwt-Assertion': await signToken(),
  ...extraHeaders,
})

describe('Access JWT middleware', () => {
  it('allows a valid signed token to reach the route dispatcher', async () => {
    const response = await createTestApp().request('/protected', {
      headers: await authenticatedHeaders(),
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 404,
      body: '404 Not Found',
    })
  })

  it('rejects an unauthenticated article extraction request', async () => {
    const response = await createTestApp().request('/api/articles/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(await summarizeResponse(response)).toEqual(unauthorizedResponse)
  })

  it('rejects missing, forged, expired, wrong-issuer, wrong-audience, and exp-less tokens', async () => {
    const tokens = await Promise.all([
      Promise.resolve(undefined),
      signToken({ signingKey: roguePrivateKey }),
      signToken({ expiration: Math.floor(Date.now() / 1000) - 60 }),
      signToken({ tokenIssuer: 'https://other.example.invalid' }),
      signToken({ tokenAudience: 'other-audience' }),
      signToken({ expiration: null }),
    ])
    const responses = await Promise.all(
      tokens.map((token) =>
        Promise.resolve(
          createTestApp().request(
            '/protected',
            token === undefined
              ? {}
              : { headers: { 'Cf-Access-Jwt-Assertion': token } },
          ),
        ).then(summarizeResponse),
      ),
    )

    expect(responses).toEqual([
      unauthorizedResponse,
      unauthorizedResponse,
      unauthorizedResponse,
      unauthorizedResponse,
      unauthorizedResponse,
      unauthorizedResponse,
    ])
  })

  it('rejects a token when the configured JWKS resolver fails', async () => {
    const app = createApp({
      env: testEnvironment,
      jwks: async () => Promise.reject(new Error('synthetic JWKS failure')),
    })
    const response = await app.request('/protected', {
      headers: await authenticatedHeaders(),
    })

    expect(await summarizeResponse(response)).toEqual({
      ...unauthorizedResponse,
    })
  })
})

describe('CSRF middleware', () => {
  it.each([
    ['without Origin', undefined],
    ['with a null Origin', 'null'],
    ['with a different Origin', 'https://other.example.invalid'],
  ] as const)('rejects an unsafe request %s', async (_description, origin) => {
    const headers = await authenticatedHeaders({
      'Content-Type': 'application/json',
    })

    if (origin !== undefined) {
      headers['Origin'] = origin
    }

    const response = await createTestApp().request('/protected', {
      method: 'POST',
      headers,
      body: '{}',
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 403,
      body: {
        error: {
          code: 'origin_not_allowed',
          message: 'Origin is not allowed.',
        },
      },
    })
  })

  it('rejects an unsafe request without application/json', async () => {
    const response = await createTestApp().request('/protected', {
      method: 'POST',
      headers: await authenticatedHeaders({
        Origin: appOrigin,
        'Content-Type': 'application/x-www-form-urlencoded',
      }),
      body: 'value=example',
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 415,
      body: {
        error: {
          code: 'unsupported_media_type',
          message: 'Content-Type must be application/json.',
        },
      },
    })
  })

  it('rejects an unsafe request with no Content-Type', async () => {
    const response = await createTestApp().request('/protected', {
      method: 'POST',
      headers: await authenticatedHeaders({ Origin: appOrigin }),
      body: '{}',
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 415,
      body: {
        error: {
          code: 'unsupported_media_type',
          message: 'Content-Type must be application/json.',
        },
      },
    })
  })

  it('allows an unsafe request with the configured origin and JSON content type', async () => {
    const response = await createTestApp().request('/protected', {
      method: 'POST',
      headers: await authenticatedHeaders({
        Origin: appOrigin,
        'Content-Type': 'application/json; charset=utf-8',
      }),
      body: '{}',
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 404,
      body: '404 Not Found',
    })
  })

  it('rejects a body larger than one mebibyte', async () => {
    const response = await createTestApp().request('/protected', {
      method: 'POST',
      headers: await authenticatedHeaders({
        Origin: appOrigin,
        'Content-Type': 'application/json',
      }),
      body: 'x'.repeat(1024 * 1024 + 1),
    })

    expect(await summarizeResponse(response)).toEqual({
      status: 413,
      body: {
        error: {
          code: 'payload_too_large',
          message: 'Request body exceeds the maximum size.',
        },
      },
    })
  })
})

describe('Health probe exception', () => {
  it('allows only GET and HEAD on the exact /health path without authentication', async () => {
    const app = createTestApp()
    const responses = await Promise.all([
      Promise.resolve(app.request('/health')).then(summarizeResponse),
      Promise.resolve(app.request('/health', { method: 'HEAD' })).then(
        summarizeResponse,
      ),
      Promise.resolve(app.request('/health/', { headers: {} })).then(
        summarizeResponse,
      ),
      Promise.resolve(
        app.request('/health', { method: 'POST', headers: {} }),
      ).then(summarizeResponse),
    ])

    expect(responses).toEqual([
      { status: 200, body: { status: 'ok' } },
      { status: 200, body: '' },
      {
        status: 401,
        body: {
          error: {
            code: 'unauthorized',
            message: 'Authentication is required.',
          },
        },
      },
      {
        status: 401,
        body: {
          error: {
            code: 'unauthorized',
            message: 'Authentication is required.',
          },
        },
      },
    ])
  })
})

describe('Fail-closed configuration and development bypass', () => {
  it('keeps health available while invalid authentication configuration rejects app requests', async () => {
    const app = createApp({ env: { NODE_ENV: 'production' }, jwks })
    const responses = await Promise.all([
      Promise.resolve(app.request('/health')).then(summarizeResponse),
      Promise.resolve(app.request('/protected')).then(summarizeResponse),
    ])

    expect(responses).toEqual([
      { status: 200, body: { status: 'ok' } },
      {
        status: 503,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
      },
    ])
  })

  it('rejects missing and invalid authentication settings without failing app creation', async () => {
    const invalidEnvironments = [
      {
        NODE_ENV: 'production',
        CF_ACCESS_ISSUER: issuer,
        CF_ACCESS_AUD: audience,
      },
      { ...testEnvironment, APP_ORIGIN: 'http://app.example.invalid' },
      { ...testEnvironment, CF_ACCESS_ISSUER: 'http://access.example.invalid' },
      { ...testEnvironment, CF_ACCESS_AUD: '' },
    ]
    const responses = await Promise.all(
      invalidEnvironments.map((env) =>
        Promise.resolve(createApp({ env, jwks }).request('/protected')).then(
          summarizeResponse,
        ),
      ),
    )

    expect(responses).toEqual([
      {
        status: 503,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
      },
      {
        status: 503,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
      },
      {
        status: 503,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
      },
      {
        status: 503,
        body: {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
      },
    ])
  })

  it.each([
    ['production', { ...developmentEnvironment, NODE_ENV: 'production' }, true],
    ['test', { ...developmentEnvironment, NODE_ENV: 'test' }, true],
    [
      'without DEV_AUTH_BYPASS',
      { ...developmentEnvironment, DEV_AUTH_BYPASS: 'false' },
      true,
    ],
    [
      'with a non-loopback APP_ORIGIN',
      { ...developmentEnvironment, APP_ORIGIN: 'https://app.example.invalid' },
      true,
    ],
    [
      'unset NODE_ENV',
      {
        APP_ORIGIN: appOrigin,
        CF_ACCESS_ISSUER: issuer,
        CF_ACCESS_AUD: audience,
        DEV_AUTH_BYPASS: 'true',
      },
      true,
    ],
    ['without an actual loopback listener', developmentEnvironment, false],
  ] as const)(
    'rejects the development bypass in %s',
    async (_description, env, listenerIsLoopback) => {
      const app = createTestApp({
        env,
        isLoopbackListenerBound: () => listenerIsLoopback,
      })
      const response = await app.request('/protected', {
        headers: {
          Host: '127.0.0.1:8080',
          'X-Forwarded-For': '127.0.0.1',
        },
      })

      expect(await summarizeResponse(response)).toEqual(unauthorizedResponse)
    },
  )

  it('enables the bypass only when the Node listener is bound to loopback', async () => {
    const server = startApiServer({
      port: 0,
      env: developmentEnvironment,
    })
    servers.push(server)
    await once(server, 'listening')

    const address = server.address()
    const port =
      address !== null && typeof address !== 'string'
        ? String(address.port)
        : '0'
    const response = await fetch(`http://127.0.0.1:${port}/protected`)
    expect(
      summarizeListenerResponse(
        await summarizeResponse(response),
        address !== null && typeof address !== 'string'
          ? address.address
          : null,
      ),
    ).toEqual({
      status: 404,
      body: '404 Not Found',
      boundAddress: '127.0.0.1',
    })
  })
})

describe('GET /health', () => {
  it('returns the API health status over the Node server', async () => {
    const server = startApiServer({ hostname: '127.0.0.1', port: 0 })
    servers.push(server)
    await once(server, 'listening')

    const address = server.address()
    const port =
      address !== null && typeof address !== 'string'
        ? String(address.port)
        : '0'
    const response = await fetch(`http://127.0.0.1:${port}/health`)

    expect(await summarizeResponse(response)).toEqual({
      status: 200,
      body: { status: 'ok' },
    })
  })
})
describe('POST /api/analysis/summary', () => {
  it('is registered on the Node API server', async () => {
    const server = startApiServer({
      hostname: '127.0.0.1',
      port: 0,
      env: testEnvironment,
      jwks,
    })
    servers.push(server)
    await once(server, 'listening')

    const address = server.address()
    const port =
      address !== null && typeof address !== 'string'
        ? String(address.port)
        : '0'
    const response = await fetch(
      `http://127.0.0.1:${port}/api/analysis/summary`,
      {
        method: 'POST',
        headers: await authenticatedHeaders({
          Origin: appOrigin,
          'Content-Type': 'application/json',
        }),
        body: '{invalid json',
      },
    )
    expect(await summarizeResponse(response)).toEqual({
      status: 400,
      body: {
        error: {
          code: 'INVALID_ANALYSIS_REQUEST',
          message: 'The request body must be valid JSON.',
        },
      },
    })
  })
})

describe('GET /api/destinations', () => {
  it('registers the route behind the shared authentication middleware', async () => {
    const app = createTestApp()
    const responses = await Promise.all([
      Promise.resolve(app.request('/api/destinations')).then(summarizeResponse),
      Promise.resolve(
        app.request('/api/destinations', {
          headers: await authenticatedHeaders(),
        }),
      ).then(summarizeResponse),
    ])

    expect(responses).toEqual([
      unauthorizedResponse,
      {
        status: 200,
        body: {
          destinations: {
            hatena: { configured: false },
            mastodon: { configured: false },
            raindrop: { configured: false },
            x: { configured: true },
          },
        },
      },
    ])
  })
})
