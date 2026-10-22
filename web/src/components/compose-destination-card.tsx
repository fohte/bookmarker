import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

import { ComposeDestinationSettings } from '#components/compose-destination-settings'

const destinationNames: Record<DestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
  x: 'X',
}

export function ComposeDestinationCard({
  destination,
  commonComment,
  canEdit,
  metadata,
  copyConfirmationOpen,
  onDestinationChange,
  onRequestCopyCommonComment,
  onCancelCopyCommonComment,
  onCopyCommonComment,
}: {
  destination: DestinationDraft
  commonComment: string
  canEdit: boolean
  metadata?: DestinationMetadata
  copyConfirmationOpen: boolean
  onDestinationChange: (destination: DestinationDraft) => void
  onRequestCopyCommonComment: (destination: DestinationId) => void
  onCancelCopyCommonComment: () => void
  onCopyCommonComment: (destination: DestinationId) => void
}) {
  const destinationMetadata = metadata?.destinations[destination.destination]
  const selectionUnavailable = destinationMetadata?.configured === false
  const metadataError =
    destinationMetadata !== undefined && 'metadataError' in destinationMetadata
      ? destinationMetadata.metadataError
      : undefined
  const name = destinationNames[destination.destination]

  return (
    <article className="space-y-4 border border-border p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">{name}</h3>
          {selectionUnavailable && (
            <p className="mt-1 text-sm text-muted-foreground">
              This destination is not connected. Its saved settings are kept.
            </p>
          )}
          {metadataError !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              Destination details are unavailable: {metadataError.message}
            </p>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            aria-label={`Select ${name}`}
            checked={destination.selected}
            className="size-4 accent-primary disabled:opacity-50"
            disabled={
              !canEdit || (selectionUnavailable && !destination.selected)
            }
            onChange={(event) => {
              onDestinationChange({
                ...destination,
                selected: event.currentTarget.checked,
              })
            }}
            type="checkbox"
          />
          Select
        </label>
      </header>

      <ComposeDestinationSettings
        canEdit={canEdit}
        commonComment={commonComment}
        copyConfirmationOpen={copyConfirmationOpen}
        destination={destination}
        {...(metadata === undefined ? {} : { metadata })}
        onCancelCopyCommonComment={onCancelCopyCommonComment}
        onCopyCommonComment={onCopyCommonComment}
        onDestinationChange={onDestinationChange}
        onRequestCopyCommonComment={onRequestCopyCommonComment}
      />
    </article>
  )
}
