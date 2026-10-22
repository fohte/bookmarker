import type {
  BookmarkDraft,
  DestinationDraft,
  DestinationId,
} from 'api/contracts'

export const destinationIds: DestinationId[] = [
  'hatena',
  'mastodon',
  'raindrop',
  'x',
]

function createDestinationDraft(destination: DestinationId): DestinationDraft {
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

function replaceDestinationDraft(
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

export function effectiveDestinationComment(
  commonComment: string,
  destination: DestinationDraft,
): string {
  return destination.commentMode === 'common'
    ? commonComment
    : destination.customComment
}

export function isRaindropCollectionAvailable(
  collectionId: number,
  collections: readonly { id: number }[] | undefined,
): boolean {
  return (
    collectionId === -1 ||
    collections?.some((collection) => collection.id === collectionId) === true
  )
}

export function updateDestinationDraft(
  draft: BookmarkDraft,
  destination: DestinationDraft,
): BookmarkDraft {
  return {
    ...draft,
    destinations: replaceDestinationDraft(draft.destinations, destination),
  }
}

export function copyCommonCommentDraft(
  draft: BookmarkDraft,
  destinationId: DestinationId,
): BookmarkDraft {
  const destination = getDestinationDraft(draft.destinations, destinationId)
  const copiedDestination = {
    ...destination,
    commentMode: 'custom' as const,
    customComment: draft.commonComment,
  }
  return {
    ...draft,
    destinations: replaceDestinationDraft(
      draft.destinations,
      copiedDestination,
    ),
  }
}
