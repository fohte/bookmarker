import { createAdaptorServer } from '@hono/node-server'

import { app } from '#app'

export const startApiServer = ({
  port,
  hostname,
}: { port?: number; hostname?: string } = {}) => {
  const server = createAdaptorServer(app)
  server.listen(port ?? 8080, hostname ?? '0.0.0.0')
  return server
}
