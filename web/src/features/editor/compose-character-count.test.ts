import type { DestinationMetadata } from 'api/contracts'
import { describe, expect, it } from 'vitest'

import { countDestinationCharacters } from '#features/editor/compose-character-count'

function metadataWithMastodon(
  mastodon: DestinationMetadata['destinations']['mastodon'],
): DestinationMetadata {
  return {
    destinations: {
      hatena: { configured: true },
      mastodon,
      raindrop: { configured: true },
      x: { configured: true },
    },
  }
}

const instance = metadataWithMastodon({
  configured: true,
  maxCharacters: 480,
  charactersReservedPerUrl: 30,
})

describe('countDestinationCharacters', () => {
  it('counts each destination the way it limits the posted text', () => {
    const cases: Parameters<typeof countDestinationCharacters>[] = [
      ['hatena', 'ab架空😀', undefined],
      ['mastodon', 'ab架空👩‍💻', instance],
      ['mastodon', '', instance],
      [
        'mastodon',
        'ab',
        metadataWithMastodon({ configured: true, maxCharacters: 480 }),
      ],
      ['mastodon', 'ab', undefined],
      ['x', 'ab架空’', undefined],
      ['x', '', undefined],
      ['raindrop', 'ab', instance],
    ]

    expect(cases.map((args) => countDestinationCharacters(...args))).toEqual([
      { length: 5, max: 100 },
      { length: 36, max: 480 },
      { length: 30, max: 480 },
      { length: 26, max: 480 },
      null,
      { length: 31, max: 280 },
      { length: 23, max: 280 },
      null,
    ])
  })
})
