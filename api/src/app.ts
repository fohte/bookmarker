import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { createDestinationRegistry } from '#destinations/registry'
import {
  type AccessEnvironment,
  type AccessKeyResolver,
  createAccessConfiguration,
  createAccessMiddleware,
} from '#middleware/access'
import { createCsrfMiddleware } from '#middleware/csrf'
import { respondWithApiError } from '#middleware/error-response'
import { createArticlesRouter } from '#routes/articles'
import { registerDestinationsRoute } from '#routes/destinations'
import { registerPublishRoute } from '#routes/publish'

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
  const configuration = createAccessConfiguration(env, jwks)

  app.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (context) =>
        respondWithApiError(context, 413, {
          code: 'payload_too_large',
          message: 'Request body exceeds the maximum size.',
        }),
    }),
  )
  app.use(
    '*',
    createAccessMiddleware({
      env,
      configuration,
      isLoopbackListenerBound,
    }),
  )
  app.use('*', createCsrfMiddleware({ configuration }))

  app.route('/api/articles', createArticlesRouter())
  app.get('/health', (context) => context.json({ status: 'ok' }))
  app.on('HEAD', '/health', (context) => context.body(null))

  const destinationRegistry = createDestinationRegistry()
  registerDestinationsRoute(app, destinationRegistry)
  registerPublishRoute(app, destinationRegistry)

  return app
}
