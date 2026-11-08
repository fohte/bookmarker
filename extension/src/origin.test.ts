import { describe, expect, it } from 'vitest'

import { parseBookmarkerOrigin } from '#origin'

describe('parseBookmarkerOrigin', () => {
  it.each([
    {
      name: 'reduces an https URL to its origin',
      value: 'https://bookmark-app.example.invalid/compose?draft=1',
      expected: 'https://bookmark-app.example.invalid',
    },
    {
      name: 'accepts http on localhost',
      value: 'http://localhost:5173',
      expected: 'http://localhost:5173',
    },
    {
      name: 'rejects http on any other host',
      value: 'http://bookmark-app.example.invalid',
      expected: undefined,
    },
    {
      name: 'rejects other protocols on localhost',
      value: 'ftp://localhost',
      expected: undefined,
    },
    {
      name: 'rejects a value without a protocol',
      value: 'bookmark-app.example.invalid',
      expected: undefined,
    },
  ])('$name', ({ value, expected }) => {
    expect(parseBookmarkerOrigin(value)).toEqual(expected)
  })
})
