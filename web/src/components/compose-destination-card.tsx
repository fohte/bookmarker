import { Button } from '@fohte/ui/button'
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

const visibilityLabels = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Followers only',
  direct: 'Mentioned people only',
} as const

function getDestinationSettingsSummary(destination: DestinationDraft): string {
  const summary =
    destination.commentMode === 'custom'
      ? ['Individual comment']
      : destination.customComment.length > 0
        ? ['Saved individual comment']
        : ['Common comment']

  switch (destination.destination) {
    case 'hatena':
      if (destination.options.private) summary.push('Private')
      if (destination.options.tags.length > 0) {
        summary.push(`${String(destination.options.tags.length)} tags`)
      }
      break
    case 'mastodon':
      if (destination.options.visibility !== 'public') {
        summary.push(visibilityLabels[destination.options.visibility])
      }
      if (destination.options.spoilerText.length > 0) {
        summary.push('Content warning')
      }
      if (destination.options.sensitive) summary.push('Sensitive')
      break
    case 'raindrop':
      if (destination.options.collectionId !== -1) {
        summary.push('Custom collection')
      }
      if (destination.options.tags.length > 0) {
        summary.push(`${String(destination.options.tags.length)} tags`)
      }
      break
    case 'x':
      break
  }

  return summary.join(' · ')
}

export function ComposeDestinationCard({
  destination,
  commonComment,
  canEdit,
  metadata,
  copyConfirmationOpen,
  settingsOpen,
  onDestinationChange,
  onSettingsOpenChange,
  onRequestCopyCommonComment,
  onCancelCopyCommonComment,
  onCopyCommonComment,
}: {
  destination: DestinationDraft
  commonComment: string
  canEdit: boolean
  metadata?: DestinationMetadata
  copyConfirmationOpen: boolean
  settingsOpen: boolean
  onDestinationChange: (destination: DestinationDraft) => void
  onSettingsOpenChange: (open: boolean) => void
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
  const settingsSummary = getDestinationSettingsSummary(destination)

  return (
    <article className="flex min-w-0 items-center gap-3 border border-border px-3 py-2">
      <label className="flex shrink-0 items-center">
        <input
          aria-label={`Select ${name}`}
          checked={destination.selected}
          className="size-4 accent-primary disabled:opacity-50"
          disabled={!canEdit || (selectionUnavailable && !destination.selected)}
          onChange={(event) => {
            onDestinationChange({
              ...destination,
              selected: event.currentTarget.checked,
            })
          }}
          type="checkbox"
        />
      </label>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h3 className="font-medium">{name}</h3>
          {destination.selected && (
            <span className="text-xs text-primary">Selected</span>
          )}
          {selectionUnavailable && (
            <span className="text-xs text-muted-foreground" role="status">
              Not connected
            </span>
          )}
          {metadataError !== undefined && (
            <span className="text-xs text-muted-foreground" role="status">
              Details unavailable
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {settingsSummary}
        </p>
      </div>
      <Button
        aria-label={`Open ${name} settings`}
        onClick={() => {
          onSettingsOpenChange(true)
        }}
        size="sm"
        variant="outline"
      >
        Settings
      </Button>
      <ComposeDestinationSettings
        canEdit={canEdit}
        commonComment={commonComment}
        copyConfirmationOpen={copyConfirmationOpen}
        destination={destination}
        settingsOpen={settingsOpen}
        {...(metadata === undefined ? {} : { metadata })}
        onSettingsOpenChange={onSettingsOpenChange}
        onCancelCopyCommonComment={onCancelCopyCommonComment}
        onCopyCommonComment={onCopyCommonComment}
        onDestinationChange={onDestinationChange}
        onRequestCopyCommonComment={onRequestCopyCommonComment}
      />
    </article>
  )
}
