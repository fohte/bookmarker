import { isIP } from 'node:net'

import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { err, ok, Result, ResultAsync } from 'neverthrow'

export type AccessEnvironment = Record<string, string | undefined>
export type AccessKeyResolver = JWTVerifyGetKey
type AccessConfigurationError = 'invalid_configuration'

type AccessConfiguration = {
  appOrigin: string
  issuer: string
  audience: string
  jwksUrl: URL
}

type AccessConfigurationResult = Result<
  AccessConfiguration,
  AccessConfigurationError
>

type AccessMiddlewareOptions = {
  env: AccessEnvironment
  keyResolver: AccessKeyResolver | undefined
  isLoopbackListenerBound: () => boolean
}

const isLoopbackHostname = (hostname: string) => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (normalizedHostname === 'localhost') {
    return true
  }

  if (isIP(normalizedHostname) === 4) {
    return normalizedHostname.startsWith('127.')
  }

  return isIP(normalizedHostname) === 6 && normalizedHostname === '::1'
}

export const isLoopbackOrigin = (value: string) => {
  if (!URL.canParse(value)) {
    return false
  }

  const url = new URL(value)
  return url.origin === value && isLoopbackHostname(url.hostname)
}

export const shouldBindLoopbackForDevelopment = (env: AccessEnvironment) =>
  env['NODE_ENV'] === 'development' &&
  env['DEV_AUTH_BYPASS'] === 'true' &&
  env['APP_ORIGIN'] !== undefined &&
  isLoopbackOrigin(env['APP_ORIGIN'])

export const parseAccessConfiguration = (
  env: AccessEnvironment,
): AccessConfigurationResult => {
  const { APP_ORIGIN, CF_ACCESS_ISSUER, CF_ACCESS_AUD } = env

  if (
    APP_ORIGIN === undefined ||
    CF_ACCESS_ISSUER === undefined ||
    CF_ACCESS_AUD === undefined ||
    CF_ACCESS_AUD.length === 0 ||
    CF_ACCESS_AUD.trim() !== CF_ACCESS_AUD ||
    !URL.canParse(APP_ORIGIN) ||
    !URL.canParse(CF_ACCESS_ISSUER)
  ) {
    return err('invalid_configuration')
  }

  const appOriginUrl = new URL(APP_ORIGIN)
  const issuerUrl = new URL(CF_ACCESS_ISSUER)
  const validAppOrigin =
    appOriginUrl.origin === APP_ORIGIN &&
    (appOriginUrl.protocol === 'https:' ||
      (appOriginUrl.protocol === 'http:' &&
        isLoopbackHostname(appOriginUrl.hostname)))
  const validIssuer =
    issuerUrl.origin === CF_ACCESS_ISSUER && issuerUrl.protocol === 'https:'

  if (!validAppOrigin || !validIssuer) {
    return err('invalid_configuration')
  }

  return ok({
    appOrigin: APP_ORIGIN,
    issuer: CF_ACCESS_ISSUER,
    audience: CF_ACCESS_AUD,
    jwksUrl: new URL('/cdn-cgi/access/certs', issuerUrl),
  })
}

const isInternalHealthProbe = (method: string, path: string) =>
  path === '/health' && (method === 'GET' || method === 'HEAD')

export const createAccessMiddleware = ({
  env,
  keyResolver,
  isLoopbackListenerBound,
}: AccessMiddlewareOptions) => {
  const configuration = parseAccessConfiguration(env)

  return createMiddleware(async (context, next) => {
    if (isInternalHealthProbe(context.req.method, context.req.path)) {
      return next()
    }

    const accessConfiguration = configuration.match(
      (value) => value,
      () => undefined,
    )

    if (accessConfiguration === undefined) {
      return context.json(
        {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
        503,
      )
    }

    if (
      env['NODE_ENV'] === 'development' &&
      env['DEV_AUTH_BYPASS'] === 'true' &&
      isLoopbackOrigin(accessConfiguration.appOrigin) &&
      isLoopbackListenerBound()
    ) {
      return next()
    }

    const token = context.req.header('Cf-Access-Jwt-Assertion')

    if (token === undefined) {
      return context.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Authentication is required.',
          },
        },
        401,
      )
    }

    if (keyResolver === undefined) {
      return context.json(
        {
          error: {
            code: 'service_unavailable',
            message: 'API authentication is not configured.',
          },
        },
        503,
      )
    }

    const verification = await ResultAsync.fromPromise(
      jwtVerify(token, keyResolver, {
        issuer: accessConfiguration.issuer,
        audience: accessConfiguration.audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp'],
      }),
      () => 'invalid_token' as const,
    ).match(
      () => true,
      () => false,
    )

    if (!verification) {
      return context.json(
        {
          error: {
            code: 'unauthorized',
            message: 'Authentication is required.',
          },
        },
        401,
      )
    }

    return next()
  })
}

export const createDefaultAccessKeyResolver = (env: AccessEnvironment) =>
  parseAccessConfiguration(env).match(
    (value) => createRemoteJWKSet(value.jwksUrl),
    () => undefined,
  )

export const isLoopbackListenerAddress = (address: string) =>
  isLoopbackHostname(address)
