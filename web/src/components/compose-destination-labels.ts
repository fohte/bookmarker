import type { DestinationId } from 'api/contracts'

export const destinationNames: Record<DestinationId, string> = {
  hatena: 'Hatena',
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

export function raindropCollectionLabel(
  collectionId: number,
  collections: readonly { id: number; title: string }[] | undefined,
): string {
  if (collectionId === -1) return 'Unsorted'
  return (
    collections?.find((collection) => collection.id === collectionId)?.title ??
    `Collection ${String(collectionId)}`
  )
}
