import { describe, expect, it } from 'vitest'

import { markQuotes } from '#features/editor/compose-quote-marks'

describe('markQuotes', () => {
  it('marks each quoted passage once and leaves missing quotes unmarked', () => {
    const cases: Parameters<typeof markQuotes>[] = [
      ['A lantern glows over the quiet canal.', ['glows', 'quiet canal']],
      ['A lantern glows.', ['A lantern', 'lantern glows']],
      ['A lantern glows.', ['A paper boat', '']],
      ['A lantern glows.', []],
    ]

    expect(cases.map((args) => markQuotes(...args))).toEqual([
      [
        { text: 'A lantern ', marked: false },
        { text: 'glows', marked: true },
        { text: ' over the ', marked: false },
        { text: 'quiet canal', marked: true },
        { text: '.', marked: false },
      ],
      [
        { text: 'A lantern', marked: true },
        { text: ' glows', marked: true },
        { text: '.', marked: false },
      ],
      [{ text: 'A lantern glows.', marked: false }],
      [{ text: 'A lantern glows.', marked: false }],
    ])
  })
})
