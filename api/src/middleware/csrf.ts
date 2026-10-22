import { createMiddleware } from 'hono/factory'

import type { AccessConfigurationState } from '#middleware/access'
import { respondWithApiError } from '#middleware/error-response'

type CsrfMiddlewareOptions = {
  configuration: AccessConfigurationState
}

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

export const createCsrfMiddleware = ({
  configuration,
}: CsrfMiddlewareOptions) => {
  return createMiddleware(async (context, next) => {
    if (safeMethods.has(context.req.method)) {
      return next()
    }

    if (configuration.status === 'invalid') {
      return respondWithApiError(context, 503, {
        code: 'service_unavailable',
        message: 'API authentication is not configured.',
      })
    }

    const accessConfiguration = configuration.value

    const contentType = context.req
      .header('Content-Type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()

    if (contentType !== 'application/json') {
      return respondWithApiError(context, 415, {
        code: 'unsupported_media_type',
        message: 'Content-Type must be application/json.',
      })
    }

    if (context.req.header('Origin') !== accessConfiguration.appOrigin) {
      return respondWithApiError(context, 403, {
        code: 'origin_not_allowed',
        message: 'Origin is not allowed.',
      })
    }

    return next()
  })
}
