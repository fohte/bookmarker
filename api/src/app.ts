import { Hono } from 'hono'

import { articlesRouter } from '#routes/articles'

export const app = new Hono()

app.get('/health', (context) => context.json({ status: 'ok' }))
app.route('/api/articles', articlesRouter)
