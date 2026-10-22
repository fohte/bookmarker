import type { DestinationDraft, DestinationId } from 'api/contracts'

export const destinationIds: DestinationId[] = [
  'hatena',
  'mastodon',
  'raindrop',
  'x',
]

export function createDestinationDraft(
  destination: DestinationId,
): DestinationDraft {
  const common = {
    selected: false,
    commentMode: 'common' as const,
    customComment: '',
  }

  switch (destination) {
    case 'hatena':
      return {
        ...common,
        destination,
        options: { tags: [], private: false },
      }
    case 'mastodon':
      return {
        ...common,
        destination,
        options: {
          visibility: 'public',
          spoilerText: '',
          sensitive: false,
        },
      }
    case 'raindrop':
      return {
        ...common,
        destination,
        options: { collectionId: -1, tags: [] },
      }
    case 'x':
      return { ...common, destination }
  }
}

export function getDestinationDraft(
  destinations: DestinationDraft[],
  destination: DestinationId,
): DestinationDraft {
  return (
    destinations.find((item) => item.destination === destination) ??
    createDestinationDraft(destination)
  )
}

export function replaceDestinationDraft(
  destinations: DestinationDraft[],
  updated: DestinationDraft,
): DestinationDraft[] {
  const index = destinations.findIndex(
    (item) => item.destination === updated.destination,
  )
  if (index === -1) return [...destinations, updated]

  return destinations.map((item, itemIndex) =>
    itemIndex === index ? updated : item,
  )
}
