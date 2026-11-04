import type { BookmarkDraft, PublishTarget } from 'api/contracts'

export function destinationHasSucceeded(
  delivery: BookmarkDraft['delivery'],
  destination: PublishTarget['destination'],
): boolean {
  return delivery.some(
    (snapshot) =>
      snapshot.target.destination === destination &&
      snapshot.result?.status === 'succeeded',
  )
}

const resultDestinations = ['hatena', 'mastodon', 'raindrop'] as const

export function latestDeliverySnapshots(
  delivery: BookmarkDraft['delivery'],
): BookmarkDraft['delivery'] {
  return resultDestinations.flatMap((destination) => {
    const latest = delivery
      .filter((snapshot) => snapshot.target.destination === destination)
      .at(-1)
    return latest === undefined ? [] : [latest]
  })
}
