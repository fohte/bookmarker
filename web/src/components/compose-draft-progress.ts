import type { BookmarkDraft } from 'api/contracts'

import { latestDeliverySnapshots } from '#features/editor/compose-delivery-history'

export function composeDraftHost(draft: BookmarkDraft): string {
  const url = draft.article?.url ?? draft.source.url
  return URL.parse(url)?.hostname.replace(/^www\./, '') ?? url
}

// 'posted' is the only label of a finished draft.
export function composeDraftProgress(draft: BookmarkDraft): string {
  const snapshots = latestDeliverySnapshots(draft.delivery)
  if (snapshots.length === 0) return 'not posted'
  const failed = snapshots.filter(
    (snapshot) => snapshot.result?.status === 'failed',
  ).length
  const unrecorded = snapshots.filter(
    (snapshot) => snapshot.result === undefined,
  ).length
  const problems = [
    ...(failed > 0 ? [`${String(failed)} failed`] : []),
    ...(unrecorded > 0 ? [`${String(unrecorded)} not recorded`] : []),
  ]
  return problems.length === 0 ? 'posted' : problems.join(', ')
}
