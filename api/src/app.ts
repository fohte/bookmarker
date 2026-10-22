import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import {
  type AccessEnvironment,
  type AccessKeyResolver,
  createAccessMiddleware,
  createDefaultAccessKeyResolver,
} from '#middleware/access'
import { createCsrfMiddleware } from '#middleware/csrf'

type CreateAppOptions = {
  env?: AccessEnvironment
  jwks?: AccessKeyResolver
  isLoopbackListenerBound?: () => boolean
}

export const createApp = ({
  env = process.env,
  jwks,
  isLoopbackListenerBound = () => false,
}: CreateAppOptions = {}) => {
  const app = new Hono()

  app.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (context) =>
        context.json(
          {
            error: {
              code: 'payload_too_large',
              message: 'Request body exceeds the maximum size.',
            },
          },
          413,
        ),
    }),
  )
  app.use(
    '*',
    createAccessMiddleware({
      env,
      keyResolver: jwks ?? createDefaultAccessKeyResolver(env),
      isLoopbackListenerBound,
    }),
  )
  app.use('*', createCsrfMiddleware({ env }))

  app.get('/health', (context) => context.json({ status: 'ok' }))
  app.on('HEAD', '/health', (context) => context.body(null))

  return app
}
