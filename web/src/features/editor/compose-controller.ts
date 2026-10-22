import { type BookmarkDraft, type ShareInput } from 'api/contracts'
import { err, ok, type Result } from 'neverthrow'

import {
  controllerUnavailableError,
  DraftError,
} from '#features/drafts/draft-error'
import {
  acquireDraftLock,
  type DraftLockLease,
  hasDraftLockSupport,
} from '#features/drafts/draft-lock'
import { DraftSaveQueue } from '#features/drafts/draft-save-queue'
import {
  createIndexedDbDraftStore,
  type DraftStore,
} from '#features/drafts/draft-store'
import {
  recoverPendingDeliveries,
  updateDraftArticle,
} from '#features/editor/compose-draft'
import {
  cleanupDraftNavigation,
  currentUrlWithoutDraft,
  type FailedImportCleanup,
} from '#features/editor/compose-history'
import { ComposeIntake } from '#features/editor/compose-intake'
import { loadComposeDraftList } from '#features/editor/compose-list'
import {
  type ComposeLockState,
  type ComposeState,
} from '#features/editor/compose-state'
import { ComposeStateStore } from '#features/editor/compose-state-store'

export type { ComposeState } from '#features/editor/compose-state'

export class ComposeController {
  #view = new ComposeStateStore()
  #draft: BookmarkDraft | null = null
  #lease: DraftLockLease | null = null
  #queue: DraftSaveQueue | null = null
  #intake: ComposeIntake
  #failedImportCleanups = new Map<string, FailedImportCleanup>()
  #activationPromise: Promise<Result<BookmarkDraft, DraftError>> | null = null
  #disposed = false
  #disposePromise: Promise<void> | null = null

  constructor(
    private readonly store: DraftStore = createIndexedDbDraftStore(),
  ) {
    this.#intake = new ComposeIntake({
      store,
      pauseCurrentDraft: () => {
        this.#pauseCurrentDraft()
      },
      resumeCurrentDraft: () => {
        this.#resumeCurrentDraft()
      },
      flushCurrentDraft: () => this.#flushCurrentDraft(),
      isDisposed: () => this.#isDisposed(),
      activateDraft: (draftId) => this.#activateDraft(draftId),
      showError: (error) => {
        this.#showError(error)
      },
      setState: (patch) => {
        this.#setState(patch)
      },
      refreshDraftList: () => this.#refreshDraftList(),
      markFailedImportCleanup: (draftId, cleanup) => {
        this.#failedImportCleanups.set(draftId, cleanup)
      },
      clearFailedImportCleanup: (draftId) => {
        this.#failedImportCleanups.delete(draftId)
      },
    })
  }

  get state(): ComposeState {
    return this.#view.state
  }

  subscribe(listener: (state: ComposeState) => void): () => void {
    return this.#view.subscribe(listener)
  }

  async start(draftId: string | null): Promise<void> {
    const lockState: ComposeLockState = hasDraftLockSupport()
      ? 'available'
      : 'unsupported'
    const listing = await this.store.listDrafts()
    if (this.#isDisposed()) return

    if (listing.isErr()) {
      this.#setState({
        isLoading: false,
        lockState,
        errorMessage: listing.error.message,
      })
      return
    }

    this.#setState({
      drafts: listing.value.drafts,
      unreadableDraftCount: listing.value.unreadableCount,
      isLoading: false,
      lockState,
    })

    if (draftId === null) return

    const activated = await this.#activateDraft(draftId)
    if (activated.isErr()) {
      this.#showError(activated.error)
    }
  }

  openSource(
    input: ShareInput,
    options: { cleanupUrl: string; intake: 'manual' | 'share' },
  ): Promise<Result<BookmarkDraft, DraftError>> {
    return this.#intake.openSource(input, options)
  }

  reportIntakeError(message: string): void {
    this.#setState({ intakeError: message.slice(0, 300) })
  }

  updateTitle(title: string): void {
    this.#updateDraft((draft) => updateDraftArticle(draft, { title }))
  }

  updateArticleText(text: string): void {
    this.#updateDraft((draft) => updateDraftArticle(draft, { text }))
  }

  updateCommonComment(commonComment: string): void {
    this.#updateDraft((draft) => ({ ...draft, commonComment }))
  }

  async selectDraft(draftId: string): Promise<void> {
    const result = await this.#activateDraft(draftId)
    if (result.isErr()) this.#showError(result.error)
  }

  async retryLock(): Promise<void> {
    if (this.#draft === null) return
    const result = await this.#activateDraft(this.#draft.id)
    if (result.isErr()) this.#showError(result.error)
  }

  async retrySave(): Promise<void> {
    if (this.#queue === null) return
    const result = await this.#queue.retry()
    if (result.isErr()) this.#showError(result.error)
  }

  requestDiscard(): void {
    if (this.#lease !== null) this.#setState({ discardOpen: true })
  }

  cancelDiscard(): void {
    this.#setState({ discardOpen: false })
  }

  async discardDraft(): Promise<void> {
    if (this.state.isLoading) return
    const draft = this.#draft
    const lease = this.#lease
    if (draft === null || lease === null) return

    this.#pauseCurrentDraft()
    const flushed = await this.#flushCurrentDraft()
    if (flushed.isErr()) {
      this.#resumeCurrentDraft()
      this.#showError(flushed.error)
      return
    }

    const cleanup = this.#cleanupBeforeDiscard(draft)
    if (cleanup.isErr()) {
      this.#resumeCurrentDraft()
      this.#showError(cleanup.error)
      return
    }

    const deleted = await this.store.deleteDraft(draft.id, {
      preserveImportReceipts: cleanup.value.preserveImportReceipts,
    })
    if (deleted.isErr()) {
      if (!cleanup.value.preserveImportReceipts) {
        this.#restoreDraftUrl(draft).match(
          () => undefined,
          (error) => {
            this.#showError(error)
          },
        )
      }
      this.#resumeCurrentDraft()
      this.#showError(deleted.error)
      return
    }

    this.#failedImportCleanups.delete(draft.id)
    this.#draft = null
    this.#queue = null
    this.#lease = null
    await lease.release()
    this.#setState({
      activeDraft: null,
      canEdit: false,
      lockState: hasDraftLockSupport() ? 'available' : 'unsupported',
      saveState: 'saved',
      errorMessage: cleanup.value.errorMessage,
      discardOpen: false,
      isLoading: false,
    })
    await this.#refreshDraftList()
  }

  #cleanupBeforeDiscard(
    draft: BookmarkDraft,
  ): Result<
    { preserveImportReceipts: boolean; errorMessage: string | null },
    DraftError
  > {
    const failedImportCleanup = this.#failedImportCleanups.get(draft.id)
    const cleaned = cleanupDraftNavigation(
      failedImportCleanup?.cleanupUrl ?? currentUrlWithoutDraft(),
      null,
      failedImportCleanup ?? null,
    )
    if (cleaned.isErr() && failedImportCleanup === undefined) {
      return err(cleaned.error)
    }
    if (cleaned.isOk()) this.#failedImportCleanups.delete(draft.id)

    return ok({
      preserveImportReceipts: cleaned.isErr(),
      errorMessage: cleaned.isErr() ? cleaned.error.message : null,
    })
  }

  #restoreDraftUrl(draft: BookmarkDraft): Result<undefined, DraftError> {
    return cleanupDraftNavigation(currentUrlWithoutDraft(), draft.id, null)
  }

  dispose(): Promise<void> {
    if (this.#disposePromise !== null) return this.#disposePromise
    this.#disposed = true

    const queue = this.#queue
    const lease = this.#lease
    this.#queue = null
    this.#lease = null
    this.#disposePromise = (async () => {
      if (queue !== null) {
        const result = await queue.flush()
        result.match(
          () => undefined,
          () => undefined,
        )
      }
      if (lease !== null) await lease.release()
      this.#view.clearListeners()
    })()

    return this.#disposePromise
  }

  #updateDraft(update: (draft: BookmarkDraft) => BookmarkDraft): void {
    if (
      this.#draft === null ||
      this.#queue === null ||
      this.#lease === null ||
      !this.state.canEdit ||
      this.state.isLoading
    )
      return

    const nextDraft = update(this.#draft)
    const snapshot = structuredClone({
      ...nextDraft,
      updatedAt: new Date().toISOString(),
    })
    this.#draft = snapshot
    this.#setState({
      activeDraft: snapshot,
      drafts: [
        snapshot,
        ...this.state.drafts.filter((item) => item.id !== snapshot.id),
      ],
      saveState: 'saving',
      errorMessage: null,
    })
    this.#queue.enqueue(snapshot)
  }

  async #activateDraft(
    draftId: string,
  ): Promise<Result<BookmarkDraft, DraftError>> {
    const activeActivation = this.#activationPromise
    if (activeActivation !== null) {
      return activeActivation.then(() => this.#activateDraft(draftId))
    }

    const activation = this.#activateDraftNow(draftId)
    this.#activationPromise = activation
    void activation.then(
      () => {
        if (this.#activationPromise === activation)
          this.#activationPromise = null
      },
      () => {
        if (this.#activationPromise === activation)
          this.#activationPromise = null
      },
    )
    return activation
  }

  async #activateDraftNow(
    draftId: string,
  ): Promise<Result<BookmarkDraft, DraftError>> {
    if (this.#isDisposed()) return err(controllerUnavailableError())
    if (this.#draft?.id === draftId && this.#lease !== null) {
      return ok(this.#draft)
    }

    const previousQueue = this.#queue
    const previousLease = this.#lease
    this.#pauseCurrentDraft()
    const flushed =
      previousQueue === null ? ok(undefined) : await previousQueue.flush()
    if (flushed.isErr()) {
      this.#resumeCurrentDraft()
      return err(flushed.error)
    }
    if (this.#isDisposed()) return err(controllerUnavailableError())

    const lockResult = await acquireDraftLock(draftId)
    const nextLease = lockResult.isOk() ? lockResult.value : null
    const nextLockState: ComposeLockState = lockResult.isErr()
      ? 'unsupported'
      : nextLease === null
        ? 'locked'
        : 'owned'

    if (this.#isDisposed()) {
      if (nextLease !== null) await nextLease.release()
      return err(controllerUnavailableError())
    }

    const loaded = await this.store.getDraft(draftId)
    if (this.#isDisposed()) {
      if (nextLease !== null) await nextLease.release()
      return err(controllerUnavailableError())
    }
    if (loaded.isErr()) {
      if (nextLease !== null) await nextLease.release()
      this.#resumeCurrentDraft()
      return err(loaded.error)
    }
    if (loaded.value === null) {
      if (nextLease !== null) await nextLease.release()
      this.#resumeCurrentDraft()
      return err(
        new DraftError(
          'draft-not-found',
          'This local draft could not be found.',
        ),
      )
    }

    const recovered =
      nextLease === null ? loaded.value : recoverPendingDeliveries(loaded.value)
    let nextQueue: DraftSaveQueue | null = null
    if (nextLease !== null) {
      nextQueue = new DraftSaveQueue(
        this.store,
        recovered,
        (saveState, error) => {
          if (this.#isDisposed() || this.#queue !== nextQueue) return
          this.#setState({
            saveState,
            errorMessage: error?.message ?? null,
          })
        },
      )
    }

    this.#draft = recovered
    this.#lease = nextLease
    this.#queue = nextQueue
    this.#setState({
      activeDraft: recovered,
      drafts: [
        recovered,
        ...this.state.drafts.filter((item) => item.id !== recovered.id),
      ],
      canEdit: nextLease !== null,
      lockState: nextLockState,
      saveState: recovered === loaded.value ? 'saved' : 'saving',
      errorMessage: null,
      intakeError: null,
      discardOpen: false,
      isLoading: false,
    })

    if (nextQueue !== null && recovered !== loaded.value) {
      nextQueue.enqueue(recovered)
      const recoverySave = await nextQueue.flush()
      if (recoverySave.isErr()) this.#showError(recoverySave.error)
    }

    if (previousLease !== null && previousLease !== nextLease) {
      await previousLease.release()
    }

    return ok(recovered)
  }

  async #flushCurrentDraft(): Promise<Result<void, DraftError>> {
    if (this.#queue === null) return ok(undefined)
    return this.#queue.flush()
  }

  #pauseCurrentDraft(): void {
    this.#setState({ canEdit: false, isLoading: true })
  }

  #resumeCurrentDraft(): void {
    this.#setState({ canEdit: this.#lease !== null, isLoading: false })
  }

  async #refreshDraftList(): Promise<void> {
    const listing = await loadComposeDraftList(this.store, this.#draft)
    if (this.#isDisposed()) return
    if (listing.isErr()) {
      this.#showError(listing.error)
      return
    }

    this.#setState(listing.value)
  }

  #showError(error: DraftError): void {
    this.#setState({ errorMessage: error.message })
  }

  #isDisposed(): boolean {
    return this.#disposed
  }

  #setState(patch: Partial<ComposeState>): void {
    if (this.#disposed) return
    this.#view.update(patch)
  }
}
