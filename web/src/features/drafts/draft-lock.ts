import { errAsync, ResultAsync } from 'neverthrow'

import {
  type DraftError,
  lockUnavailableError,
} from '#features/drafts/draft-error'

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
  return getLockManager() !== null
}

function getLockManager(): LockManager | null {
  if (typeof navigator === 'undefined') return null

  const lockManager: unknown = Reflect.get(navigator, 'locks')
  if (
    typeof lockManager !== 'object' ||
    lockManager === null ||
    !('request' in lockManager) ||
    typeof lockManager.request !== 'function'
  ) {
    return null
  }

  return navigator.locks
}

export function acquireDraftLock(
  draftId: string,
): ResultAsync<DraftLockLease | null, DraftError> {
  const lockManager = getLockManager()
  if (lockManager === null) return errAsync(lockUnavailableError())

  const acquisition = new Promise<DraftLockLease | null>((resolve, reject) => {
    let settled = false
    const releaseSignal = createDeferred()
    const completion = createDeferred()
    const request = lockManager.request(
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

  return ResultAsync.fromPromise(acquisition, lockUnavailableError)
}
