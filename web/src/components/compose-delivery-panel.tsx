import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft, PublishDestinationId } from 'api/contracts'

const destinationNames: Record<PublishDestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
}

function deliveryStatus(snapshot: BookmarkDraft['delivery'][number]): {
  label: string
  details: string[]
} {
  const result = snapshot.result
  if (result === undefined) {
    return {
      label: 'Sending',
      details: ['The outcome has not been recorded yet.'],
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
        ? 'This result can be retried after publishing is connected.'
        : 'This result cannot be retried.',
    ],
  }
}

export function ComposeDeliveryPanel({
  delivery,
}: {
  delivery: BookmarkDraft['delivery']
}) {
  return (
    <Panel padding="md" className="space-y-4 rounded-lg p-5 sm:p-6">
      <div>
        <h2 className="font-medium">Delivery results</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Results are shown for each saved delivery attempt.
        </p>
      </div>

      <Button disabled>Publish selected destinations</Button>
      <p className="-mt-2 text-sm text-muted-foreground" role="status">
        Publishing is unavailable until the backend client is connected.
      </p>

      <ul className="space-y-3">
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
                    const status = deliveryStatus(snapshot)
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
          X uses an external composer. Opening it is not connected yet and is
          never reported as a successful post.
        </p>
        <Button className="mt-2" disabled variant="outline">
          Open X composer
        </Button>
      </div>
    </Panel>
  )
}
