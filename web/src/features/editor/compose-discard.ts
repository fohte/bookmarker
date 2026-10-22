import type { BookmarkDraft } from 'api/contracts'
import { err, ok, type Result } from 'neverthrow'

import type { DraftError } from '#features/drafts/draft-error'
import {
  cleanupDraftNavigation,
  currentUrlWithoutDraft,
  type FailedImportCleanup,
} from '#features/editor/compose-history'

export function cleanupBeforeDiscard(
  draft: BookmarkDraft,
  failedImportCleanup: FailedImportCleanup | undefined,
  clearFailedImportCleanup: () => void,
): Result<
  { preserveImportReceipts: boolean; errorMessage: string | null },
  DraftError
> {
  const cleaned = cleanupDraftNavigation(
    failedImportCleanup?.cleanupUrl ?? currentUrlWithoutDraft(),
    null,
    failedImportCleanup ?? null,
  )
  if (cleaned.isErr() && failedImportCleanup === undefined) {
    return err(cleaned.error)
  }
  if (cleaned.isOk()) clearFailedImportCleanup()

  return ok({
    preserveImportReceipts: cleaned.isErr(),
    errorMessage: cleaned.isErr() ? cleaned.error.message : null,
  })
}

export function restoreDraftUrl(
  draft: BookmarkDraft,
): Result<undefined, DraftError> {
  return cleanupDraftNavigation(currentUrlWithoutDraft(), draft.id, null)
}
