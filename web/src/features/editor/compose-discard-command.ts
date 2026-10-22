import type { BookmarkDraft } from 'api/contracts'
import type { Result } from 'neverthrow'

import type { DraftError } from '#features/drafts/draft-error'
import type { DraftLockLease } from '#features/drafts/draft-lock'
import type { DraftStore } from '#features/drafts/draft-store'
import {
  cleanupBeforeDiscard,
  restoreDraftUrl,
} from '#features/editor/compose-discard'
import type { FailedImportCleanup } from '#features/editor/compose-history'
import type { ComposeState } from '#features/editor/compose-state'

export async function discardComposeDraft({
  isLoading,
  draft,
  lease,
  store,
  failedImportCleanups,
  pauseCurrentDraft,
  resumeCurrentDraft,
  flushCurrentDraft,
  clearActiveDraft,
  refreshDraftList,
  lockState,
  showError,
  setState,
}: {
  isLoading: boolean
  draft: BookmarkDraft | null
  lease: DraftLockLease | null
  store: DraftStore
  failedImportCleanups: Map<string, FailedImportCleanup>
  pauseCurrentDraft: () => void
  resumeCurrentDraft: () => void
  flushCurrentDraft: () => Promise<Result<void, DraftError>>
  clearActiveDraft: () => void
  refreshDraftList: () => Promise<void>
  lockState: ComposeState['lockState']
  showError: (error: DraftError) => void
  setState: (patch: Partial<ComposeState>) => void
}): Promise<void> {
  if (isLoading) return
  if (draft === null || lease === null) return

  pauseCurrentDraft()
  const flushed = await flushCurrentDraft()
  if (flushed.isErr()) {
    resumeCurrentDraft()
    showError(flushed.error)
    return
  }

  const cleanup = cleanupBeforeDiscard(
    failedImportCleanups.get(draft.id),
    () => {
      failedImportCleanups.delete(draft.id)
    },
  )
  if (cleanup.isErr()) {
    resumeCurrentDraft()
    showError(cleanup.error)
    return
  }

  const deleted = await store.deleteDraft(draft.id, {
    preserveImportReceipts: cleanup.value.preserveImportReceipts,
  })
  if (deleted.isErr()) {
    if (!cleanup.value.preserveImportReceipts) {
      restoreDraftUrl(draft).match(
        () => undefined,
        (error) => {
          showError(error)
        },
      )
    }
    resumeCurrentDraft()
    showError(deleted.error)
    return
  }

  failedImportCleanups.delete(draft.id)
  clearActiveDraft()
  await lease.release()
  setState({
    activeDraft: null,
    canEdit: false,
    lockState,
    saveState: 'saved',
    errorMessage: cleanup.value.errorMessage,
    discardOpen: false,
    isLoading: false,
  })
  await refreshDraftList()
}
