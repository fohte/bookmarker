import { createAdaptorServer } from '@hono/node-server'

import { createApp } from '#app'
import {
  type AccessEnvironment,
  type AccessKeyResolver,
  isLoopbackListenerAddress,
  shouldBindLoopbackForDevelopment,
} from '#middleware/access'

export const startApiServer = ({
  port,
  hostname,
  env = process.env,
  jwks,
}: {
  port?: number
  hostname?: string
  env?: AccessEnvironment
  jwks?: AccessKeyResolver
} = {}) => {
  let listeningAddress: string | undefined
  const app = createApp({
    env,
    ...(jwks === undefined ? {} : { jwks }),
    isLoopbackListenerBound: () =>
      listeningAddress !== undefined &&
      isLoopbackListenerAddress(listeningAddress),
  })
  const server = createAdaptorServer(app)
  server.once('listening', () => {
    const address = server.address()
    listeningAddress =
      address !== null && typeof address !== 'string'
        ? address.address
        : undefined
  })
  const defaultHostname = shouldBindLoopbackForDevelopment(env)
    ? '127.0.0.1'
    : '0.0.0.0'
  server.listen(port ?? 8080, hostname ?? defaultHostname)
  return server
}
