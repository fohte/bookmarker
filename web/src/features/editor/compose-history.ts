import { err, ok, Result } from 'neverthrow'

import { DraftError } from '#features/drafts/draft-error'

const importStateKey = '__bookmarkerDraftImportId'
const previousStateKey = '__bookmarkerPreviousHistoryState'
const wrappedStateKey = '__bookmarkerWrappedHistoryState'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withImportId(state: unknown, importId: string): unknown {
  if (isRecord(state) && !(importStateKey in state)) {
    return { ...state, [importStateKey]: importId }
  }

  return {
    [importStateKey]: importId,
    [wrappedStateKey]: true,
    [previousStateKey]: state,
  }
}

function withoutImportId(state: unknown, importId: string | null): unknown {
  if (!isRecord(state) || state[importStateKey] !== importId) {
    return state
  }

  if (state[wrappedStateKey] === true) {
    return state[previousStateKey]
  }

  return Object.fromEntries(
    Object.entries(state).filter(([key]) => key !== importStateKey),
  )
}

export function prepareImportNavigation(): Result<string, DraftError> {
  if (
    typeof window === 'undefined' ||
    typeof crypto.randomUUID !== 'function'
  ) {
    return err(
      new DraftError(
        'lock-unavailable',
        'This browser cannot safely create a local draft.',
      ),
    )
  }

  const currentState: unknown = window.history.state
  if (isRecord(currentState)) {
    const existingId = currentState[importStateKey]
    if (typeof existingId === 'string' && existingId.length > 0) {
      return ok(existingId)
    }
  }

  const importId = crypto.randomUUID()
  const result = Result.fromThrowable(
    () => {
      window.history.replaceState(
        withImportId(currentState, importId),
        '',
        window.location.href,
      )
    },
    () =>
      new DraftError(
        'history-update-failed',
        'The shared URL could not be prepared for saving.',
      ),
  )()

  return result.map(() => importId)
}

export function cleanupDraftNavigation(
  cleanupUrl: string,
  draftId: string | null,
  importId: string | null,
): Result<undefined, DraftError> {
  if (typeof window === 'undefined') {
    return err(
      new DraftError(
        'history-update-failed',
        'The draft URL could not be updated.',
      ),
    )
  }

  const parsedUrl = Result.fromThrowable(
    () => new URL(cleanupUrl, window.location.href),
    () =>
      new DraftError(
        'history-update-failed',
        'The draft URL could not be updated.',
      ),
  )()
  if (parsedUrl.isErr() || parsedUrl.value.origin !== window.location.origin) {
    return err(
      new DraftError(
        'history-update-failed',
        'The draft URL could not be updated.',
      ),
    )
  }

  parsedUrl.value.searchParams.delete('draft')
  if (draftId !== null) {
    parsedUrl.value.searchParams.set('draft', draftId)
  }

  const nextState = withoutImportId(window.history.state, importId)
  const url = `${parsedUrl.value.pathname}${parsedUrl.value.search}${parsedUrl.value.hash}`
  const result = Result.fromThrowable(
    () => {
      window.history.replaceState(nextState, '', url)
    },
    () =>
      new DraftError(
        'history-update-failed',
        'The draft URL could not be updated.',
      ),
  )()

  return result.map(() => undefined)
}
