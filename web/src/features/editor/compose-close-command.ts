import { cleanupBeforeDiscard } from '#features/editor/compose-discard'
import {
  type ComposeDraftExitPort,
  finishExit,
  flushBeforeExit,
} from '#features/editor/compose-discard-command'

export async function closeComposeDraft(
  port: ComposeDraftExitPort,
): Promise<void> {
  const { draft, failedImportCleanups } = port
  if (port.isLoading || draft === null) return
  if (!(await flushBeforeExit(port))) return

  // A URL that still names the draft would reopen it on reload. The draft is
  // kept either way, so a failed URL update only shows a message.
  const cleaned = cleanupBeforeDiscard(
    failedImportCleanups.get(draft.id),
    () => {
      failedImportCleanups.delete(draft.id)
    },
  )
  await finishExit(
    port,
    cleaned.match(
      ({ errorMessage }) => errorMessage,
      (error) => error.message,
    ),
  )
}
