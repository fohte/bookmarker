import { Panel } from '@fohte/ui/panel'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'
import { useState } from 'react'

import { ComposeDestinationCard } from '#components/compose-destination-card'
import {
  destinationIds,
  getDestinationDraft,
} from '#features/editor/compose-destination'

export function ComposeDestinationsPanel({
  destinations,
  commonComment,
  canEdit,
  metadata,
  defaultOpenDestination = null,
  copyConfirmationDestination,
  onDestinationChange,
  onRequestCopyCommonComment,
  onCancelCopyCommonComment,
  onCopyCommonComment,
}: {
  destinations: DestinationDraft[]
  commonComment: string
  canEdit: boolean
  metadata?: DestinationMetadata
  defaultOpenDestination?: DestinationId | null
  copyConfirmationDestination: DestinationId | null
  onDestinationChange: (destination: DestinationDraft) => void
  onRequestCopyCommonComment: (destination: DestinationId) => void
  onCancelCopyCommonComment: () => void
  onCopyCommonComment: (destination: DestinationId) => void
}) {
  const [openDestination, setOpenDestination] = useState<DestinationId | null>(
    defaultOpenDestination,
  )
  const selectedCount = destinations.filter(
    (destination) => destination.selected,
  ).length

  return (
    <Panel padding="md" className="space-y-3 p-3 sm:p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Destinations</h2>
        <p className="text-xs text-muted-foreground">
          {selectedCount} selected
        </p>
      </header>

      <div className="space-y-2">
        {destinationIds.map((destinationId) => (
          <ComposeDestinationCard
            key={destinationId}
            canEdit={canEdit}
            commonComment={commonComment}
            copyConfirmationOpen={copyConfirmationDestination === destinationId}
            destination={getDestinationDraft(destinations, destinationId)}
            settingsOpen={openDestination === destinationId}
            {...(metadata === undefined ? {} : { metadata })}
            onCancelCopyCommonComment={onCancelCopyCommonComment}
            onCopyCommonComment={onCopyCommonComment}
            onDestinationChange={onDestinationChange}
            onRequestCopyCommonComment={onRequestCopyCommonComment}
            onSettingsOpenChange={(open) => {
              setOpenDestination(open ? destinationId : null)
            }}
          />
        ))}
      </div>

      <div className="border-t border-border pt-2">
        <p className="text-xs text-muted-foreground" role="status">
          Each delivery uses a saved snapshot of the article and destination
          settings.
        </p>
      </div>
    </Panel>
  )
}
