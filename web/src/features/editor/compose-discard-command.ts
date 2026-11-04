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

export type ComposeDraftExitPort = {
  isLoading: boolean
  draft: BookmarkDraft | null
  lease: DraftLockLease | null
  failedImportCleanups: Map<string, FailedImportCleanup>
  pauseCurrentDraft: () => void
  resumeCurrentDraft: () => void
  flushCurrentDraft: () => Promise<Result<void, DraftError>>
  clearActiveDraft: () => void
  refreshDraftList: () => Promise<void>
  getLockState: () => ComposeState['lockState']
  showError: (error: DraftError) => void
  setState: (patch: Partial<ComposeState>) => void
}

// Returns false when the draft stays open because its latest input could not
// be saved.
export async function flushBeforeExit(
  port: ComposeDraftExitPort,
): Promise<boolean> {
  port.pauseCurrentDraft()
  const flushed = await port.flushCurrentDraft()
  if (flushed.isErr()) {
    port.resumeCurrentDraft()
    port.showError(flushed.error)
    return false
  }
  return true
}

export async function finishExit(
  port: ComposeDraftExitPort,
  errorMessage: ComposeState['errorMessage'],
): Promise<void> {
  port.clearActiveDraft()
  await port.lease?.release()
  port.setState({
    activeDraft: null,
    canEdit: false,
    lockState: port.getLockState(),
    saveState: 'saved',
    errorMessage,
    discardOpen: false,
    isLoading: false,
  })
  await port.refreshDraftList()
}

export async function discardComposeDraft(
  port: ComposeDraftExitPort & { store: DraftStore },
): Promise<void> {
  const {
    draft,
    lease,
    store,
    failedImportCleanups,
    resumeCurrentDraft,
    showError,
  } = port
  if (port.isLoading) return
  if (draft === null || lease === null) return
  if (!(await flushBeforeExit(port))) return

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
  await finishExit(port, cleanup.value.errorMessage)
}
