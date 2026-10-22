import {
  type BookmarkDraft,
  type ShareInput,
  ShareInputSchema,
} from 'api/contracts'
import { err, ok, type Result } from 'neverthrow'

import { DraftError } from '#features/drafts/draft-error'
import { hasDraftLockSupport } from '#features/drafts/draft-lock'
import type { DraftStore } from '#features/drafts/draft-store'
import { createNewDraft } from '#features/editor/compose-draft'
import {
  cleanupDraftNavigation,
  prepareImportNavigation,
} from '#features/editor/compose-history'
import type { ComposeState } from '#features/editor/compose-state'

type ComposeIntakePort = {
  store: DraftStore
  pauseCurrentDraft: () => void
  resumeCurrentDraft: () => void
  flushCurrentDraft: () => Promise<Result<void, DraftError>>
  isDisposed: () => boolean
  activateDraft: (draftId: string) => Promise<Result<BookmarkDraft, DraftError>>
  showError: (error: DraftError) => void
  setState: (patch: Partial<ComposeState>) => void
  refreshDraftList: () => Promise<void>
}

export class ComposeIntake {
  #importsInFlight = new Map<
    string,
    Promise<Result<BookmarkDraft, DraftError>>
  >()

  constructor(private readonly port: ComposeIntakePort) {}

  openSource(
    input: ShareInput,
    options: { cleanupUrl: string; intake: 'manual' | 'share' },
  ): Promise<Result<BookmarkDraft, DraftError>> {
    if (this.port.isDisposed()) {
      return Promise.resolve(
        err<BookmarkDraft, DraftError>(
          new DraftError(
            'controller-unavailable',
            'The editor is not ready yet.',
          ),
        ),
      )
    }
    if (!hasDraftLockSupport()) {
      return Promise.resolve(
        err<BookmarkDraft, DraftError>(
          new DraftError(
            'lock-unavailable',
            'This browser cannot safely edit local drafts.',
          ),
        ),
      )
    }

    const parsedInput = ShareInputSchema.safeParse(input)
    if (!parsedInput.success) {
      return Promise.resolve(
        err<BookmarkDraft, DraftError>(
          new DraftError(
            'invalid-source',
            'Enter a valid article URL to create a draft.',
          ),
        ),
      )
    }

    let importId: string | null = null
    if (options.intake === 'share') {
      const navigation = prepareImportNavigation()
      if (navigation.isErr()) {
        return Promise.resolve(err<BookmarkDraft, DraftError>(navigation.error))
      }
      importId = navigation.value

      const inFlight = this.#importsInFlight.get(importId)
      if (inFlight !== undefined) return inFlight
    }

    const operation = this.#openPreparedSource(
      parsedInput.data,
      options,
      importId,
    ).catch(() =>
      err<BookmarkDraft, DraftError>(
        new DraftError(
          'save-failed',
          'The draft could not be opened. Your current input was kept.',
        ),
      ),
    )
    if (importId === null) return operation

    const trackedOperation = operation.finally(() =>
      this.#importsInFlight.delete(importId),
    )
    this.#importsInFlight.set(importId, trackedOperation)
    return trackedOperation
  }

  async #openPreparedSource(
    input: ShareInput,
    options: { cleanupUrl: string; intake: 'manual' | 'share' },
    importId: string | null,
  ): Promise<Result<BookmarkDraft, DraftError>> {
    this.port.pauseCurrentDraft()
    const currentFlush = await this.port.flushCurrentDraft()
    if (currentFlush.isErr()) {
      this.port.resumeCurrentDraft()
      return err(currentFlush.error)
    }
    if (this.port.isDisposed()) {
      return err(
        new DraftError(
          'controller-unavailable',
          'The editor is not ready yet.',
        ),
      )
    }
    if (options.intake === 'share' && importId === null) {
      this.port.resumeCurrentDraft()
      return err(
        new DraftError(
          'history-update-failed',
          'The shared URL could not be prepared.',
        ),
      )
    }

    const candidate = createNewDraft(input, options.intake)
    if (candidate.isErr()) {
      this.port.resumeCurrentDraft()
      return err(candidate.error)
    }

    const saved =
      importId === null
        ? await this.port.store
            .addDraft(candidate.value)
            .map(() => candidate.value)
        : await this.port.store.commitImport(importId, candidate.value)
    if (saved.isErr()) {
      this.port.resumeCurrentDraft()
      return err(saved.error)
    }

    const activated = await this.port.activateDraft(saved.value.id)
    if (activated.isErr()) return err(activated.error)

    const cleaned = cleanupDraftNavigation(
      options.cleanupUrl,
      activated.value.id,
      importId,
    )
    if (cleaned.isErr()) {
      this.port.showError(cleaned.error)
      return err(cleaned.error)
    }

    this.port.setState({ intakeError: null, errorMessage: null })
    await this.port.refreshDraftList()
    return ok(activated.value)
  }
}
