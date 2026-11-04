import type { ComposeDeliveryState } from '#features/editor/compose-state'

export type ComposeDeliveryNoticesProps = {
  isLoadingMetadata: boolean
  metadataErrorMessage: string | null
  deliveryState: ComposeDeliveryState
  deliveryErrorMessage: string | null
  authenticationRequired: boolean
  signInHref: string | null
  onRetryDeliverySave: () => void
  onRetryMetadata: () => void
}

const progressMessages: Partial<Record<ComposeDeliveryState, string>> = {
  'saving-input': 'Saving the latest edits before posting…',
  'saving-pending': 'Saving the send attempt before contacting the services…',
  sending: 'The services are processing the saved post.',
  'saving-results': 'Saving the results before showing them…',
}

const actionClassName =
  'min-h-11 shrink-0 text-foreground underline underline-offset-4'

export function ComposeDeliveryNotices({
  isLoadingMetadata,
  metadataErrorMessage,
  deliveryState,
  deliveryErrorMessage,
  authenticationRequired,
  signInHref,
  onRetryDeliverySave,
  onRetryMetadata,
}: ComposeDeliveryNoticesProps) {
  const progressMessage = progressMessages[deliveryState]
  if (
    !isLoadingMetadata &&
    metadataErrorMessage === null &&
    progressMessage === undefined &&
    deliveryErrorMessage === null &&
    deliveryState !== 'result-save-failed' &&
    !authenticationRequired
  ) {
    return null
  }

  return (
    <div className="flex flex-col text-sm text-muted-foreground-strong">
      {isLoadingMetadata && (
        <p className="py-1" role="status">
          Checking connected destinations…
        </p>
      )}
      {metadataErrorMessage !== null && (
        <div className="flex items-center justify-between gap-3">
          <p role="alert">
            Destination details could not be loaded: {metadataErrorMessage}
          </p>
          <button
            className={actionClassName}
            onClick={onRetryMetadata}
            type="button"
          >
            Retry details
          </button>
        </div>
      )}
      {progressMessage !== undefined && (
        <p className="py-1" role="status">
          {progressMessage}
        </p>
      )}
      {deliveryErrorMessage !== null && (
        <p className="py-1 text-destructive" role="alert">
          {deliveryErrorMessage}
        </p>
      )}
      {deliveryState === 'result-save-failed' && (
        <button
          className={`${actionClassName} self-start`}
          onClick={onRetryDeliverySave}
          type="button"
        >
          Retry saving results
        </button>
      )}
      {authenticationRequired && (
        <div className="flex items-center justify-between gap-3">
          <p role="alert">Sign in again to continue.</p>
          {signInHref === null ? (
            <p role="status">Save the latest draft before signing in.</p>
          ) : (
            <a
              className={`${actionClassName} flex items-center`}
              href={signInHref}
            >
              Sign in again
            </a>
          )}
        </div>
      )}
    </div>
  )
}
