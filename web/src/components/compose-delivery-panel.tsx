import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type {
  BookmarkDraft,
  DestinationMetadata,
  PublishDestinationId,
} from 'api/contracts'

import type { ComposeDeliveryState } from '#features/editor/compose-state'

const destinationNames: Record<PublishDestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
}

function deliveryStatus(
  snapshot: BookmarkDraft['delivery'][number],
  deliveryState: ComposeDeliveryState,
): {
  label: string
  details: string[]
} {
  const result = snapshot.result
  if (result === undefined) {
    if (deliveryState === 'saving-pending') {
      return {
        label: 'Saving attempt',
        details: ['The attempt must be saved before contacting the service.'],
      }
    }
    if (deliveryState === 'sending') {
      return {
        label: 'Sending',
        details: ['The outcome has not been recorded yet.'],
      }
    }
    if (deliveryState === 'saving-results') {
      return {
        label: 'Saving result',
        details: ['The result must be saved before it is shown.'],
      }
    }
    if (deliveryState === 'result-save-failed') {
      return {
        label: 'Result not saved',
        details: [
          'The response is held in memory. Save it before deciding whether to retry.',
        ],
      }
    }
    return {
      label: 'Outcome not recorded',
      details: ['Check the service before retrying.'],
    }
  }
  if (result.status === 'succeeded') {
    return {
      label: 'Succeeded',
      details: result.message === undefined ? [] : [result.message],
    }
  }
  if (result.status === 'unknown') {
    return {
      label: 'Outcome unknown',
      details: [
        ...(result.message === undefined ? [] : [result.message]),
        'Check the service before retrying. Automatic retry is disabled.',
      ],
    }
  }
  return {
    label: 'Failed',
    details: [
      ...(result.message === undefined ? [] : [result.message]),
      result.retryable
        ? 'This failure can be retried when the destination is connected.'
        : 'This result cannot be retried.',
    ],
  }
}

export type ComposeDeliveryPanelProps = {
  delivery: BookmarkDraft['delivery']
  isLoadingMetadata: boolean
  metadata: DestinationMetadata | null
  metadataErrorMessage: string | null
  canPublish: boolean
  canRetryFailed: boolean
  hasRetryableTargets: boolean
  canOpenX: boolean
  xIntentHref: string | null
  deliveryState: ComposeDeliveryState
  deliveryErrorMessage: string | null
  authenticationRequired: boolean
  signInHref: string | null
  onPublish: () => void
  onRetryFailed: () => void
  onRetryDeliverySave: () => void
  onRetryMetadata: () => void
}

const publishButtonLabels: Record<ComposeDeliveryState, string> = {
  idle: 'Publish selected destinations',
  'saving-input': 'Saving latest edits…',
  'saving-pending': 'Saving send attempt…',
  sending: 'Publishing…',
  'saving-results': 'Saving results…',
  'result-save-failed': 'Publish selected destinations',
}

export function ComposeDeliveryPanel({
  delivery,
  isLoadingMetadata,
  metadata,
  metadataErrorMessage,
  canPublish,
  canRetryFailed,
  hasRetryableTargets,
  canOpenX,
  xIntentHref,
  deliveryState,
  deliveryErrorMessage,
  authenticationRequired,
  signInHref,
  onPublish,
  onRetryFailed,
  onRetryDeliverySave,
  onRetryMetadata,
}: ComposeDeliveryPanelProps) {
  return (
    <Panel padding="md" className="space-y-4 rounded-lg p-5 sm:p-6">
      <div>
        <h2 className="font-medium">Delivery results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Results are shown for each saved delivery attempt.
        </p>
      </div>

      <Button disabled={!canPublish} onClick={onPublish}>
        {publishButtonLabels[deliveryState]}
      </Button>
      {isLoadingMetadata && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          Checking connected destinations…
        </p>
      )}
      {metadataErrorMessage !== null && (
        <div className="-mt-2 space-y-2 text-sm text-muted-foreground">
          <p role="alert">
            Destination details could not be loaded: {metadataErrorMessage}
          </p>
          <Button onClick={onRetryMetadata} size="sm" variant="outline">
            Retry destination details
          </Button>
        </div>
      )}
      {metadata !== null && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          Destination details are loaded.
        </p>
      )}
      {deliveryState === 'saving-input' && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          The latest draft must be saved before a request is sent.
        </p>
      )}
      {deliveryState === 'saving-pending' && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          The send attempt is being saved before contacting the services.
        </p>
      )}
      {deliveryState === 'sending' && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          The services are processing the saved delivery snapshot.
        </p>
      )}
      {deliveryState === 'saving-results' && (
        <p className="-mt-2 text-sm text-muted-foreground" role="status">
          Delivery results are being saved before they are shown.
        </p>
      )}
      {deliveryErrorMessage !== null && (
        <p className="-mt-2 text-sm text-destructive" role="alert">
          {deliveryErrorMessage}
        </p>
      )}
      {deliveryState === 'result-save-failed' && (
        <Button onClick={onRetryDeliverySave} variant="outline">
          Retry saving results
        </Button>
      )}
      {hasRetryableTargets && (
        <div className="space-y-2">
          <Button
            disabled={!canRetryFailed}
            onClick={onRetryFailed}
            variant="outline"
          >
            Retry failed destinations
          </Button>
          {!canRetryFailed && (
            <p className="text-sm text-muted-foreground" role="status">
              Retry is available when the draft is editable and the failed
              destination is connected.
            </p>
          )}
        </div>
      )}
      {authenticationRequired && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm" role="alert">
            Sign in again to continue. Check any unknown delivery result at the
            service before retrying.
          </p>
          {signInHref === null ? (
            <p className="text-sm text-muted-foreground" role="status">
              Save the latest draft before signing in again.
            </p>
          ) : (
            <a
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              href={signInHref}
            >
              Sign in again
            </a>
          )}
        </div>
      )}

      <ul aria-label="Delivery results by destination" className="space-y-3">
        {(['hatena', 'mastodon', 'raindrop'] as const).map((destination) => {
          const snapshots = delivery.filter(
            (item) => item.target.destination === destination,
          )
          return (
            <li key={destination} className="border-t border-border pt-3">
              <h3 className="text-sm font-medium">
                {destinationNames[destination]}
              </h3>
              {snapshots.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Not sent</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {snapshots.map((snapshot) => {
                    const status = deliveryStatus(snapshot, deliveryState)
                    return (
                      <li key={snapshot.target.operationId} className="text-sm">
                        <p className="font-medium" role="status">
                          {status.label}
                        </p>
                        {status.details.map((detail) => (
                          <p key={detail} className="text-muted-foreground">
                            {detail}
                          </p>
                        ))}
                        {snapshot.result?.remoteUrl !== undefined && (
                          <a
                            className="break-all text-primary underline underline-offset-4"
                            href={snapshot.result.remoteUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open published item
                          </a>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-border pt-3">
        <h3 className="text-sm font-medium">X</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          X opens a separate composer. Opening it never counts as a successful
          delivery.
        </p>
        {canOpenX && xIntentHref !== null ? (
          <a
            className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            href={xIntentHref}
            rel="noreferrer"
            target="_blank"
          >
            Open X composer
          </a>
        ) : (
          <Button className="mt-2" disabled variant="outline">
            Open X composer
          </Button>
        )}
        {!canOpenX && (
          <p className="text-sm text-muted-foreground" role="status">
            Select X and save the current draft to open its composer.
          </p>
        )}
      </div>
    </Panel>
  )
}
