import { cleanupBeforeDiscard } from '#features/editor/compose-discard'
import type { ComposeDraftExitPort } from '#features/editor/compose-discard-command'

export async function closeComposeDraft({
  isLoading,
  draft,
  lease,
  failedImportCleanups,
  pauseCurrentDraft,
  resumeCurrentDraft,
  flushCurrentDraft,
  clearActiveDraft,
  refreshDraftList,
  getLockState,
  showError,
  setState,
}: ComposeDraftExitPort): Promise<void> {
  if (isLoading || draft === null) return

  pauseCurrentDraft()
  const flushed = await flushCurrentDraft()
  if (flushed.isErr()) {
    resumeCurrentDraft()
    showError(flushed.error)
    return
  }

  // A URL that still names the draft would reopen it on reload. The draft is
  // kept either way, so a failed URL update only shows a message.
  const cleaned = cleanupBeforeDiscard(
    failedImportCleanups.get(draft.id),
    () => {
      failedImportCleanups.delete(draft.id)
    },
  )
  clearActiveDraft()
  await lease?.release()
  setState({
    activeDraft: null,
    canEdit: false,
    lockState: getLockState(),
    saveState: 'saved',
    errorMessage: cleaned.match(
      ({ errorMessage }) => errorMessage,
      (error) => error.message,
    ),
    discardOpen: false,
    isLoading: false,
  })
  await refreshDraftList()
}
