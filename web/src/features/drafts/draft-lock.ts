import { ResultAsync } from 'neverthrow'

import { DraftError } from '#features/drafts/draft-error'

export interface DraftLockLease {
  release(): Promise<void>
}

type Deferred = {
  promise: Promise<void>
  resolve: () => void
}

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: () => resolvePromise?.(),
  }
}

export function hasDraftLockSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.locks.request === 'function'
  )
}

export function acquireDraftLock(
  draftId: string,
): ResultAsync<DraftLockLease | null, DraftError> {
  if (!hasDraftLockSupport()) {
    return ResultAsync.fromPromise(
      Promise.reject(new Error('Web Locks is unavailable.')),
      () =>
        new DraftError(
          'lock-unavailable',
          'This browser cannot safely edit local drafts.',
        ),
    )
  }

  const acquisition = new Promise<DraftLockLease | null>((resolve, reject) => {
    let settled = false
    const releaseSignal = createDeferred()
    const completion = createDeferred()
    const request = navigator.locks.request(
      `bookmarker:draft:${draftId}`,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (lock === null) {
          settled = true
          resolve(null)
          return
        }

        settled = true
        resolve({
          release: () => {
            releaseSignal.resolve()
            return completion.promise
          },
        })
        await releaseSignal.promise
      },
    )

    void request.then(
      () => {
        if (!settled) {
          resolve(null)
        }
        completion.resolve()
      },
      (error: unknown) => {
        if (!settled) {
          reject(
            error instanceof Error
              ? error
              : new Error('The draft lock request failed.'),
          )
        }
        completion.resolve()
      },
    )
  })

  return ResultAsync.fromPromise(
    acquisition,
    () =>
      new DraftError(
        'lock-unavailable',
        'This browser cannot safely edit local drafts.',
      ),
  )
}
