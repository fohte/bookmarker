import type { BookmarkDraft } from 'api/contracts'
import { err, ok, type Result } from 'neverthrow'

import {
  controllerUnavailableError,
  DraftError,
} from '#features/drafts/draft-error'
import {
  acquireDraftLock,
  type DraftLockLease,
} from '#features/drafts/draft-lock'
import {
  DraftSaveQueue,
  type DraftSaveState,
} from '#features/drafts/draft-save-queue'
import type { DraftStore } from '#features/drafts/draft-store'
import { recoverPendingDeliveries } from '#features/editor/compose-draft'
import type { ComposeLockState } from '#features/editor/compose-state'

export type ComposeDraftActivation = {
  draft: BookmarkDraft
  lease: DraftLockLease | null
  queue: DraftSaveQueue | null
  lockState: ComposeLockState
  recoveredPending: boolean
}

export const activateComposeDraft = async (
  draftId: string,
  {
    store,
    isDisposed,
    isCurrentQueue,
    onQueueStateChange,
  }: {
    store: DraftStore
    isDisposed: () => boolean
    isCurrentQueue: (queue: DraftSaveQueue) => boolean
    onQueueStateChange: (
      state: DraftSaveState,
      error: DraftError | null,
    ) => void
  },
): Promise<Result<ComposeDraftActivation, DraftError>> => {
  if (isDisposed()) return err(controllerUnavailableError())

  const lockResult = await acquireDraftLock(draftId)
  const lease = lockResult.isOk() ? lockResult.value : null
  const lockState: ComposeLockState = lockResult.isErr()
    ? 'unsupported'
    : lease === null
      ? 'locked'
      : 'owned'

  if (isDisposed()) {
    if (lease !== null) await lease.release()
    return err(controllerUnavailableError())
  }

  const loaded = await store.getDraft(draftId)
  if (isDisposed()) {
    if (lease !== null) await lease.release()
    return err(controllerUnavailableError())
  }
  if (loaded.isErr()) {
    if (lease !== null) await lease.release()
    return err(loaded.error)
  }
  if (loaded.value === null) {
    if (lease !== null) await lease.release()
    return err(
      new DraftError('draft-not-found', 'This local draft could not be found.'),
    )
  }

  const draft =
    lease === null ? loaded.value : recoverPendingDeliveries(loaded.value)
  let queue: DraftSaveQueue | null = null
  if (lease !== null) {
    let queueForDraft: DraftSaveQueue | null = null
    const nextQueue = new DraftSaveQueue(store, draft, (state, error) => {
      if (
        isDisposed() ||
        queueForDraft === null ||
        !isCurrentQueue(queueForDraft)
      )
        return
      onQueueStateChange(state, error)
    })
    queueForDraft = nextQueue
    queue = nextQueue
  }

  return ok({
    draft,
    lease,
    queue,
    lockState,
    recoveredPending: draft !== loaded.value,
  })
}
