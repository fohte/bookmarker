import { Hono } from 'hono'

import { analysisRoute } from '#routes/analysis'

export const app = new Hono()

app.get('/health', (context) => context.json({ status: 'ok' }))
app.route('/api/analysis', analysisRoute)
