import type { DestinationId } from 'api/contracts'

export const destinationNames: Record<DestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
  x: 'X',
}

export const visibilityLabels = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Followers only',
  direct: 'Mentioned people only',
} as const
