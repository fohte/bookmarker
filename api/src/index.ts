import '#bootstrap'

import { createAdaptorServer } from '@hono/node-server'

import { app } from '#app'

export { app } from '#app'

const server = createAdaptorServer(app)
server.listen(8080, '0.0.0.0')
