import { Hono } from 'hono'

import { createDestinationRegistry } from '#destinations/registry'
import { registerDestinationsRoute } from '#routes/destinations'
import { registerPublishRoute } from '#routes/publish'

export const app = new Hono()

app.get('/health', (context) => context.json({ status: 'ok' }))

const destinationRegistry = createDestinationRegistry()

registerDestinationsRoute(app, destinationRegistry)
registerPublishRoute(app, destinationRegistry)
