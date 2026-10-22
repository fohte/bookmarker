import { describe, expect, it } from 'vitest'

import { app } from '#app'

describe('GET /health', () => {
  it('returns the API health status', async () => {
    const response = await app.request('/health')

    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
