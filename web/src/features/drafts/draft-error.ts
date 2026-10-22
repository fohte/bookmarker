export type DraftErrorCode =
  | 'controller-unavailable'
  | 'draft-locked'
  | 'draft-not-found'
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
  ) {
    super(message)
    this.name = 'DraftError'
  }
}

export function asStorageError(): DraftError {
  return new DraftError(
    'storage-failed',
    'The draft could not be saved on this device. Your input is still available to retry.',
  )
}
