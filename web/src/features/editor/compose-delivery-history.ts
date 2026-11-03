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
