import type { DestinationId, DestinationMetadata } from 'api/contracts'

export type CharacterCount = { length: number; max: number }

const HATENA_MAX_CHARACTERS = 100
const X_MAX_CHARACTERS = 280
// X and Mastodon count the appended article URL as a fixed-length shortened URL.
const X_URL_CHARACTERS = 23
const MASTODON_DEFAULT_URL_CHARACTERS = 23

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// Mastodon counts grapheme clusters, so a joined emoji is one character.
function graphemeLength(text: string): number {
  return [...graphemes.segment(text)].length
}

// shortcut: follows twitter-text's default weights per code point, so joined emoji count more than X does; switch to twitter-text if that drift matters.
function xWeightedLength(text: string): number {
  let length = 0
  for (const character of text) {
    const codePoint = character.codePointAt(0) ?? 0
    const light =
      codePoint <= 0x10ff ||
      (codePoint >= 0x2000 && codePoint <= 0x200d) ||
      (codePoint >= 0x2010 && codePoint <= 0x201f) ||
      (codePoint >= 0x2032 && codePoint <= 0x2037)
    length += light ? 1 : 2
  }
  return length
}

export function countDestinationCharacters(
  destination: DestinationId,
  comment: string,
  metadata: DestinationMetadata | undefined,
): CharacterCount | null {
  switch (destination) {
    case 'hatena':
      return { length: Array.from(comment).length, max: HATENA_MAX_CHARACTERS }
    case 'mastodon': {
      const mastodon = metadata?.destinations.mastodon
      if (mastodon?.maxCharacters === undefined) return null
      const urlLength =
        mastodon.charactersReservedPerUrl ?? MASTODON_DEFAULT_URL_CHARACTERS
      // The status puts the article URL on its own line after the comment.
      const commentLength = comment.length > 0 ? graphemeLength(comment) + 1 : 0
      return { length: commentLength + urlLength, max: mastodon.maxCharacters }
    }
    case 'x': {
      // The X composer joins the comment and the article URL with a space.
      const commentLength =
        comment.length > 0 ? xWeightedLength(comment) + 1 : 0
      return {
        length: commentLength + X_URL_CHARACTERS,
        max: X_MAX_CHARACTERS,
      }
    }
    case 'raindrop':
      return null
  }
}
