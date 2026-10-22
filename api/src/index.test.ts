import { err, ok } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { greet } from '#greet'

describe('greet', () => {
  it('returns greeting message', () => {
    expect(greet('World')).toEqual(ok('Hello, World!'))
  })

  it('returns an error for empty string', () => {
    expect(greet('')).toEqual(err(new Error('name must not be empty')))
  })
})
