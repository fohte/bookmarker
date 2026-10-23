import { Button } from '@fohte/ui/button'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

import {
  destinationNames,
  visibilityLabels,
} from '#components/compose-destination-labels'
import { ComposeDestinationSettings } from '#components/compose-destination-settings'

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
  const settingsStatus = selectionUnavailable
    ? 'Not connected'
    : metadataError === undefined
      ? settingsSummary
      : 'Details unavailable'

  return (
    <article className="flex min-w-0 items-center gap-1.5 border border-border px-1.5 py-1">
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
        <h3 className="truncate text-xs font-medium">{name}</h3>
        <p
          className="truncate text-2xs text-muted-foreground"
          role={
            selectionUnavailable || metadataError !== undefined
              ? 'status'
              : undefined
          }
        >
          {settingsStatus}
        </p>
      </div>
      <Button
        aria-label={`Open ${name} settings`}
        onClick={() => {
          onSettingsOpenChange(true)
        }}
        size="xs"
        variant="ghost"
      >
        Edit
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
