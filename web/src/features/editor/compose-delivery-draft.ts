import type { BookmarkDraft } from 'api/contracts'

import type { DraftSaveQueue } from '#features/drafts/draft-save-queue'
import type { ComposeState } from '#features/editor/compose-state'

type ComposeDeliveryDraftAccess = {
  isDisposed: () => boolean
  getDraft: () => BookmarkDraft | null
  setDraft: (draft: BookmarkDraft) => void
  getQueue: () => DraftSaveQueue | null
  hasLease: () => boolean
  getDrafts: () => BookmarkDraft[]
  setState: (patch: Partial<ComposeState>) => void
}

export function createComposeDeliveryDraftPort(
  access: ComposeDeliveryDraftAccess,
) {
  const applySnapshot = (
    draft: BookmarkDraft,
    patch: Partial<ComposeState> = {},
  ): BookmarkDraft | null => {
    if (access.getDraft()?.id !== draft.id) return null
    const snapshot = structuredClone(draft)
    access.setDraft(snapshot)
    access.setState({
      activeDraft: snapshot,
      drafts: [
        snapshot,
        ...access.getDrafts().filter((item) => item.id !== snapshot.id),
      ],
      ...patch,
    })
    return snapshot
  }

  return {
    getDraft: access.getDraft,
    stageDraft(draft: BookmarkDraft): boolean {
      const queue = access.getQueue()
      if (
        access.isDisposed() ||
        access.getDraft()?.id !== draft.id ||
        queue === null ||
        !access.hasLease()
      ) {
        return false
      }

      const snapshot = applySnapshot(draft, {
        saveState: 'saving',
        errorMessage: null,
      })
      if (snapshot === null) return false
      queue.enqueue(snapshot)
      return true
    },
    enqueueSnapshot(draft: BookmarkDraft): boolean {
      const queue = access.getQueue()
      if (access.getDraft()?.id !== draft.id || queue === null) return false
      queue.enqueue(structuredClone(draft))
      return true
    },
    restoreDraft: (draft: BookmarkDraft) => {
      applySnapshot(draft)
    },
    showCommittedDraft: (draft: BookmarkDraft) => {
      applySnapshot(draft)
    },
  }
}
