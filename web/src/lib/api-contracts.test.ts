import type { ShareInput } from 'api/contracts'
import { ShareInputSchema } from 'api/contracts'
import { expect, it } from 'vitest'

it('imports the shared contract from the browser workspace', () => {
  const input: ShareInput = {
    version: 1,
    url: 'https://example.com/story',
    partial: false,
  }

  expect(ShareInputSchema.safeParse(input)).toEqual({
    success: true,
    data: input,
  })
})
