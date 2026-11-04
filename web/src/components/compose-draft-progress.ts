import type { BookmarkDraft } from 'api/contracts'

import { latestDeliverySnapshots } from '#features/editor/compose-delivery-history'

export function composeDraftHost(draft: BookmarkDraft): string {
  const url = draft.article?.url ?? draft.source.url
  return URL.parse(url)?.hostname.replace(/^www\./, '') ?? url
}

export function isComposeDraftPosted(draft: BookmarkDraft): boolean {
  const snapshots = latestDeliverySnapshots(draft.delivery)
  return (
    snapshots.length > 0 &&
    snapshots.every((snapshot) => snapshot.result?.status === 'succeeded')
  )
}

export function composeDraftProgress(draft: BookmarkDraft): string {
  if (isComposeDraftPosted(draft)) return 'posted'
  const snapshots = latestDeliverySnapshots(draft.delivery)
  if (snapshots.length === 0) return 'not posted'
  const failed = snapshots.filter(
    (snapshot) => snapshot.result?.status === 'failed',
  ).length
  const unrecorded = snapshots.filter(
    (snapshot) => snapshot.result === undefined,
  ).length
  return [
    ...(failed > 0 ? [`${String(failed)} failed`] : []),
    ...(unrecorded > 0 ? [`${String(unrecorded)} not recorded`] : []),
  ].join(', ')
}
