import { createHatenaAdapter } from '#destinations/hatena/index'
import { createMastodonAdapter } from '#destinations/mastodon/index'
import { createRaindropAdapter } from '#destinations/raindrop/index'
import type { DestinationRegistry } from '#destinations/types'

export const createDestinationRegistry = (): DestinationRegistry => ({
  hatena: createHatenaAdapter(),
  mastodon: createMastodonAdapter(),
  raindrop: createRaindropAdapter(),
})
