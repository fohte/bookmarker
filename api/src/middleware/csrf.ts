import { createMiddleware } from 'hono/factory'

import {
  type AccessEnvironment,
  parseAccessConfiguration,
} from '#middleware/access'

type CsrfMiddlewareOptions = {
  env: AccessEnvironment
}

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export const createCsrfMiddleware = ({ env }: CsrfMiddlewareOptions) => {
  const configuration = parseAccessConfiguration(env)

  return createMiddleware(async (context, next) => {
    if (safeMethods.has(context.req.method)) {
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

    const contentType = context.req
      .header('Content-Type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()

    if (contentType !== 'application/json') {
      return context.json(
        {
          error: {
            code: 'unsupported_media_type',
            message: 'Content-Type must be application/json.',
          },
        },
        415,
      )
    }

    if (context.req.header('Origin') !== accessConfiguration.appOrigin) {
      return context.json(
        {
          error: {
            code: 'origin_not_allowed',
            message: 'Origin is not allowed.',
          },
        },
        403,
      )
    }

    return next()
  })
}
