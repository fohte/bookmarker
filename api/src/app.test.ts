import { once } from 'node:events'

import { afterEach, describe, expect, it } from 'vitest'

import { startApiServer } from '#server'

const servers: ReturnType<typeof startApiServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        }),
    ),
  )
})

describe('GET /health', () => {
  it('returns the API health status over the Node server', async () => {
    const server = startApiServer({ hostname: '127.0.0.1', port: 0 })
    servers.push(server)
    await once(server, 'listening')

    const address = server.address()
    const port =
      address !== null && typeof address !== 'string'
        ? String(address.port)
        : '0'
    const response = await fetch(`http://127.0.0.1:${port}/health`)
    const result = JSON.stringify([response.status, await response.json()])

    expect(result).toEqual('[200,{"status":"ok"}]')
  })
})

describe('POST /api/analysis/summary', () => {
  it('is registered on the Node API server', async () => {
    const server = startApiServer({ hostname: '127.0.0.1', port: 0 })
    servers.push(server)
    await once(server, 'listening')

    const address = server.address()
    const port =
      address !== null && typeof address !== 'string'
        ? String(address.port)
        : '0'
    const response = await fetch(
      `http://127.0.0.1:${port}/api/analysis/summary`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid json',
      },
    )
    expect(JSON.stringify([response.status, await response.json()])).toEqual(
      JSON.stringify([
        400,
        {
          error: {
            code: 'INVALID_ANALYSIS_REQUEST',
            message: 'The request body must be valid JSON.',
          },
        },
      ]),
    )
  })
})
