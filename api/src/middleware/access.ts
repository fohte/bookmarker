import { isIP } from 'node:net'

import { metrics } from '@opentelemetry/api'
import { createMiddleware } from 'hono/factory'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { err, ok, Result, ResultAsync } from 'neverthrow'

import { respondWithApiError } from '#middleware/error-response'

export type AccessEnvironment = Record<string, string | undefined>
export type AccessKeyResolver = JWTVerifyGetKey
type AccessConfigurationError = 'invalid_configuration'
type AccessConfigurationResult = Result<
  AccessConfiguration,
  AccessConfigurationError
>

export type AccessConfiguration = {
  appOrigin: string
  issuer: string
  audience: string
  jwksUrl: URL
  keyResolver: AccessKeyResolver
}

export type AccessConfigurationState =
  { status: 'configured'; value: AccessConfiguration } | { status: 'invalid' }

type AccessMiddlewareOptions = {
  env: AccessEnvironment
  configuration: AccessConfigurationState
  isLoopbackListenerBound: () => boolean
}

export const isLoopbackHostname = (hostname: string) => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (normalizedHostname === 'localhost') {
    return true
  }

  if (isIP(normalizedHostname) === 4) {
    return normalizedHostname.startsWith('127.')
  }

  return isIP(normalizedHostname) === 6 && normalizedHostname === '::1'
}

const isLoopbackOrigin = (value: string) => {
  if (!URL.canParse(value)) {
    return false
  }

  const url = new URL(value)
  return url.origin === value && isLoopbackHostname(url.hostname)
}

const isDevelopmentBypassEnabled = (env: AccessEnvironment) =>
  env['NODE_ENV'] === 'development' &&
  env['DEV_AUTH_BYPASS'] === 'true' &&
  env['APP_ORIGIN'] !== undefined &&
  isLoopbackOrigin(env['APP_ORIGIN'])

export const shouldBindLoopbackForDevelopment = (env: AccessEnvironment) =>
  isDevelopmentBypassEnabled(env)

const parseAccessConfiguration = (
  env: AccessEnvironment,
  keyResolver?: AccessKeyResolver,
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

  const jwksUrl = new URL('/cdn-cgi/access/certs', issuerUrl)

  return ok({
    appOrigin: APP_ORIGIN,
    issuer: CF_ACCESS_ISSUER,
    audience: CF_ACCESS_AUD,
    jwksUrl,
    keyResolver: keyResolver ?? createRemoteJWKSet(jwksUrl),
  })
}

export const createAccessConfiguration = (
  env: AccessEnvironment,
  keyResolver?: AccessKeyResolver,
) =>
  parseAccessConfiguration(env, keyResolver).match(
    (value) => ({ status: 'configured', value }) as const,
    () => ({ status: 'invalid' }) as const,
  )

const isInternalHealthProbe = (method: string, path: string) =>
  path === '/health' && (method === 'GET' || method === 'HEAD')

const jwksResolutionFailures = metrics
  .getMeter('bookmarker-api')
  .createCounter('cloudflare_access_jwks_resolution_failures', {
    description: 'Failed Cloudflare Access JWKS key resolutions',
  })

export const createAccessMiddleware = ({
  env,
  configuration,
  isLoopbackListenerBound,
}: AccessMiddlewareOptions) => {
  return createMiddleware(async (context, next) => {
    if (isInternalHealthProbe(context.req.method, context.req.path)) {
      return next()
    }

    if (configuration.status === 'invalid') {
      return respondWithApiError(context, 503, {
        code: 'service_unavailable',
        message: 'API authentication is not configured.',
      })
    }

    const accessConfiguration = configuration.value

    if (isDevelopmentBypassEnabled(env) && isLoopbackListenerBound()) {
      return next()
    }

    const token = context.req.header('Cf-Access-Jwt-Assertion')

    if (token === undefined) {
      return respondWithApiError(context, 401, {
        code: 'unauthorized',
        message: 'Authentication is required.',
      })
    }

    const verification = await ResultAsync.fromPromise(
      jwtVerify(
        token,
        async (protectedHeader, token) =>
          ResultAsync.fromPromise(
            Promise.resolve().then(() =>
              accessConfiguration.keyResolver(protectedHeader, token),
            ),
            () => 'jwks_resolution_failed' as const,
          ).match(
            (key) => key,
            () => {
              jwksResolutionFailures.add(1)
              return Promise.reject(new Error('JWKS key resolution failed.'))
            },
          ),
        {
          issuer: accessConfiguration.issuer,
          audience: accessConfiguration.audience,
          algorithms: ['RS256'],
          requiredClaims: ['exp'],
        },
      ),
      () => 'invalid_token' as const,
    ).match(
      () => true,
      () => false,
    )

    if (!verification) {
      return respondWithApiError(context, 401, {
        code: 'unauthorized',
        message: 'Authentication is required.',
      })
    }

    return next()
  })
}
