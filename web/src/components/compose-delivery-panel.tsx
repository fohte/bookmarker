import { Button } from '@fohte/ui/button'
import { Chip } from '@fohte/ui/chip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft } from 'api/contracts'
import { useState } from 'react'

import { deliveryStatus } from '#components/compose-delivery-status'
import { destinationNames } from '#components/compose-destination-labels'
import { getRetryDeliveryTargetsFromHistory } from '#features/editor/compose-delivery-command'
import type { ComposeDeliveryState } from '#features/editor/compose-state'

export type ComposeDeliveryPanelProps = {
  delivery: BookmarkDraft['delivery']
  isLoadingMetadata: boolean
  metadataErrorMessage: string | null
  canPublish: boolean
  canRetryFailed: boolean
  hasRetryableTargets: boolean
  canOpenX: boolean
  xSelected?: boolean
  xIntentHref: string | null
  deliveryState: ComposeDeliveryState
  deliveryErrorMessage: string | null
  authenticationRequired: boolean
  signInHref: string | null
  defaultResultsOpen?: boolean
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
  metadataErrorMessage,
  canPublish,
  canRetryFailed,
  hasRetryableTargets,
  canOpenX,
  xSelected = false,
  xIntentHref,
  deliveryState,
  deliveryErrorMessage,
  authenticationRequired,
  signInHref,
  defaultResultsOpen,
  onPublish,
  onRetryFailed,
  onRetryDeliverySave,
  onRetryMetadata,
}: ComposeDeliveryPanelProps) {
  const [resultsOpen, setResultsOpen] = useState(defaultResultsOpen ?? false)
  const retryableOperationKeys = new Set(
    getRetryDeliveryTargetsFromHistory(delivery).map(
      (target) => `${target.destination}:${target.operationId}`,
    ),
  )
  const unknownSnapshots = delivery.filter(
    (snapshot) =>
      snapshot.result?.status === 'unknown' ||
      (snapshot.result === undefined && deliveryState === 'idle'),
  )
  const unknownDestinationNames = [
    ...new Set(
      unknownSnapshots.map(
        (snapshot) => destinationNames[snapshot.target.destination],
      ),
    ),
  ]
  const outcomeCounts = {
    succeeded: delivery.filter(
      (snapshot) => snapshot.result?.status === 'succeeded',
    ).length,
    failed: delivery.filter((snapshot) => snapshot.result?.status === 'failed')
      .length,
    unknown: unknownSnapshots.length,
  }
  const outcomeSummary = [
    outcomeCounts.succeeded > 0
      ? `${String(outcomeCounts.succeeded)} succeeded`
      : null,
    outcomeCounts.failed > 0 ? `${String(outcomeCounts.failed)} failed` : null,
    outcomeCounts.unknown > 0
      ? `${String(outcomeCounts.unknown)} outcome unknown`
      : null,
  ]
    .filter((value) => value !== null)
    .join(' · ')
  const showXComposer = xSelected || canOpenX

  return (
    <Panel
      data-compose-section="delivery"
      padding="sm"
      className="shrink-0 space-y-1.5 rounded-lg p-2"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Publish</h2>
        {delivery.length > 0 && (
          <Button
            aria-label="Open delivery details"
            aria-expanded={resultsOpen}
            onClick={() => {
              setResultsOpen(true)
            }}
            size="xs"
            variant="ghost"
          >
            Delivery details
          </Button>
        )}
      </div>

      <div className="max-h-24 space-y-1 overflow-y-auto text-xs">
        {isLoadingMetadata && (
          <p className="text-muted-foreground" role="status">
            Checking connected destinations…
          </p>
        )}
        {metadataErrorMessage !== null && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-muted-foreground" role="alert">
              Destination details could not be loaded: {metadataErrorMessage}
            </p>
            <Button onClick={onRetryMetadata} size="xs" variant="outline">
              Retry details
            </Button>
          </div>
        )}
        {deliveryState === 'saving-input' && (
          <p className="text-muted-foreground" role="status">
            The latest draft must be saved before a request is sent.
          </p>
        )}
        {deliveryState === 'saving-pending' && (
          <p className="text-muted-foreground" role="status">
            The send attempt is being saved before contacting the services.
          </p>
        )}
        {deliveryState === 'sending' && (
          <p className="text-muted-foreground" role="status">
            The services are processing the saved delivery snapshot.
          </p>
        )}
        {deliveryState === 'saving-results' && (
          <p className="text-muted-foreground" role="status">
            Delivery results are being saved before they are shown.
          </p>
        )}
        {deliveryErrorMessage !== null && (
          <p className="text-destructive" role="alert">
            {deliveryErrorMessage}
          </p>
        )}
        {deliveryState === 'result-save-failed' && (
          <Button onClick={onRetryDeliverySave} size="xs" variant="outline">
            Retry saving results
          </Button>
        )}
        {authenticationRequired && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-muted-foreground" role="alert">
              Sign in again to continue. Unknown outcomes cannot be resent.
            </p>
            {signInHref === null ? (
              <p role="status">Save the latest draft before signing in.</p>
            ) : (
              <a
                className="inline-flex h-6 items-center justify-center border border-border px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                href={signInHref}
              >
                Sign in again
              </a>
            )}
          </div>
        )}
        {outcomeSummary.length > 0 && (
          <p className="text-muted-foreground" role="status">
            Results: {outcomeSummary}
          </p>
        )}
        {unknownSnapshots.length > 0 && (
          <p className="font-medium text-foreground" role="alert">
            Outcome unknown for {unknownDestinationNames.join(', ')}. Check at
            the service; this editor cannot resend it.
          </p>
        )}
      </div>

      {hasRetryableTargets && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={!canRetryFailed}
            onClick={onRetryFailed}
            size="xs"
            variant="outline"
          >
            Retry failed destinations
          </Button>
          {!canRetryFailed && (
            <p className="text-2xs text-muted-foreground" role="status">
              Retry is available when the draft is editable and the failed
              destination is connected.
            </p>
          )}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-2">
        <Button
          data-compose-publish
          className="min-w-0 flex-1"
          disabled={!canPublish}
          onClick={onPublish}
          size="sm"
        >
          {publishButtonLabels[deliveryState]}
        </Button>
        {showXComposer && (
          <>
            {canOpenX && xIntentHref !== null ? (
              <a
                className="inline-flex h-7 shrink-0 items-center justify-center gap-1 border border-border px-2 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                href={xIntentHref}
                rel="noreferrer"
                target="_blank"
              >
                Open X composer
              </a>
            ) : (
              <Button disabled size="xs" variant="outline">
                Open X composer
              </Button>
            )}
            <Chip tone="muted">Separate action</Chip>
          </>
        )}
      </div>

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-h-dvh w-full flex flex-col overflow-visible sm:max-w-lg">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>Delivery results</DialogTitle>
            <DialogDescription>
              Each delivery uses a saved snapshot of the article and destination
              settings.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {isLoadingMetadata && (
              <p className="text-sm text-muted-foreground" role="status">
                Checking connected destinations…
              </p>
            )}
            {metadataErrorMessage !== null && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p role="alert">
                  Destination details could not be loaded:{' '}
                  {metadataErrorMessage}
                </p>
                <Button onClick={onRetryMetadata} size="sm" variant="outline">
                  Retry destination details
                </Button>
              </div>
            )}
            {deliveryState === 'saving-input' && (
              <p className="text-sm text-muted-foreground" role="status">
                The latest draft must be saved before a request is sent.
              </p>
            )}
            {deliveryState === 'saving-pending' && (
              <p className="text-sm text-muted-foreground" role="status">
                The send attempt is being saved before contacting the services.
              </p>
            )}
            {deliveryState === 'sending' && (
              <p className="text-sm text-muted-foreground" role="status">
                The services are processing the saved delivery snapshot.
              </p>
            )}
            {deliveryState === 'saving-results' && (
              <p className="text-sm text-muted-foreground" role="status">
                Delivery results are being saved before they are shown.
              </p>
            )}
            {deliveryErrorMessage !== null && (
              <p className="text-sm text-destructive" role="alert">
                {deliveryErrorMessage}
              </p>
            )}
            {deliveryState === 'result-save-failed' && (
              <Button onClick={onRetryDeliverySave} variant="outline">
                Retry saving results
              </Button>
            )}
            {authenticationRequired && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm" role="alert">
                  Sign in again to continue. Unknown outcomes can only be
                  checked at the service and cannot be resent from this editor.
                </p>
                {signInHref === null ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    Save the latest draft before signing in again.
                  </p>
                ) : (
                  <a
                    className="inline-flex h-9 items-center justify-center border border-border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    href={signInHref}
                  >
                    Sign in again
                  </a>
                )}
              </div>
            )}

            <ul
              aria-label="Delivery results by destination"
              className="space-y-3"
            >
              {(['hatena', 'mastodon', 'raindrop'] as const).map(
                (destination) => {
                  const snapshots = delivery.filter(
                    (item) => item.target.destination === destination,
                  )
                  return (
                    <li
                      key={destination}
                      className="border-t border-border pt-3"
                    >
                      <h3 className="text-sm font-medium">
                        {destinationNames[destination]}
                      </h3>
                      {snapshots.length === 0 ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Not sent
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-2">
                          {snapshots.map((snapshot) => {
                            const status = deliveryStatus(
                              snapshot,
                              deliveryState,
                              retryableOperationKeys.has(
                                `${snapshot.target.destination}:${snapshot.target.operationId}`,
                              ),
                            )
                            return (
                              <li
                                key={snapshot.target.operationId}
                                className="text-sm"
                              >
                                <p className="font-medium" role="status">
                                  {status.label}
                                </p>
                                {status.details.map((detail) => (
                                  <p
                                    key={detail}
                                    className="text-muted-foreground"
                                  >
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
                },
              )}
            </ul>

            <div className="border-t border-border pt-3">
              <h3 className="text-sm font-medium">X</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                X opens a separate composer. Opening it never counts as a
                successful delivery.
              </p>
              {canOpenX && xIntentHref !== null ? (
                <a
                  className="mt-2 inline-flex h-9 items-center justify-center border border-border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  href={xIntentHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open X composer
                </a>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground" role="status">
                  Select X and save the current draft to open its composer.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
