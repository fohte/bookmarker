export type DraftErrorCode =
  | 'controller-unavailable'
  | 'draft-discarded'
  | 'draft-not-found'
  | 'delivery-in-progress'
  | 'history-update-failed'
  | 'invalid-draft'
  | 'invalid-source'
  | 'lock-unavailable'
  | 'save-failed'
  | 'storage-failed'

export class DraftError extends Error {
  constructor(
    readonly code: DraftErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'DraftError'
  }
}

export function controllerUnavailableError(): DraftError {
  return new DraftError(
    'controller-unavailable',
    'The editor is not ready yet.',
  )
}

export function lockUnavailableError(): DraftError {
  return new DraftError(
    'lock-unavailable',
    'This browser cannot safely edit local drafts.',
  )
}

export function asStorageError(): DraftError {
  return new DraftError(
    'storage-failed',
    'The draft could not be saved on this device. Your input is still available to retry.',
  )
}
