import type { BookmarkDraft } from 'api/contracts'

import type { DraftListing, DraftStore } from '#features/drafts/draft-store'
import type { ComposeState } from '#features/editor/compose-state'

function withActiveDraft(
  listing: DraftListing,
  activeDraft: BookmarkDraft | null,
): Pick<ComposeState, 'drafts' | 'unreadableDraftCount'> {
  const drafts =
    activeDraft === null
      ? listing.drafts
      : [
          activeDraft,
          ...listing.drafts.filter((draft) => draft.id !== activeDraft.id),
        ]

  return { drafts, unreadableDraftCount: listing.unreadableCount }
}

export async function loadComposeDraftList(
  store: DraftStore,
  activeDraft: BookmarkDraft | null,
) {
  const listing = await store.listDrafts()
  return listing.map((value) => withActiveDraft(value, activeDraft))
}
