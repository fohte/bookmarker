import type { BookmarkDraft } from 'api/contracts'
import { okAsync, ResultAsync } from 'neverthrow'

import { DraftError } from '#features/drafts/draft-error'
import type { DraftStore } from '#features/drafts/draft-store'

export type DraftSaveState = 'saving' | 'saved' | 'failed'

export class DraftSaveQueue {
  #tail: Promise<void> = Promise.resolve()
  #latestSnapshot: BookmarkDraft
  #latestResult: ResultAsync<undefined, DraftError> | null = null
  #revision = 0

  constructor(
    private readonly store: DraftStore,
    initialDraft: BookmarkDraft,
    private readonly onStateChange: (
      state: DraftSaveState,
      error: DraftError | null,
    ) => void,
  ) {
    this.#latestSnapshot = structuredClone(initialDraft)
  }

  enqueue(draft: BookmarkDraft): void {
    const snapshot = structuredClone(draft)
    const revision = ++this.#revision
    this.#latestSnapshot = snapshot
    this.onStateChange('saving', null)

    const write = ResultAsync.fromSafePromise(this.#tail).andThen(() =>
      this.store.saveDraft(snapshot).map(() => undefined),
    )

    this.#latestResult = write
    this.#tail = write.match(
      () => {
        if (revision === this.#revision) this.onStateChange('saved', null)
      },
      (error) => {
        if (revision === this.#revision) this.onStateChange('failed', error)
      },
    )
  }

  flush(): ResultAsync<undefined, DraftError> {
    return this.#latestResult ?? okAsync(undefined)
  }

  retry(): ResultAsync<undefined, DraftError> {
    this.enqueue(this.#latestSnapshot)
    return this.flush()
  }
}
