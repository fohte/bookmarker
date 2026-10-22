import { Panel } from '@fohte/ui/panel'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

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
  copyConfirmationDestination: DestinationId | null
  onDestinationChange: (destination: DestinationDraft) => void
  onRequestCopyCommonComment: (destination: DestinationId) => void
  onCancelCopyCommonComment: () => void
  onCopyCommonComment: (destination: DestinationId) => void
}) {
  return (
    <Panel padding="md" className="space-y-5 rounded-lg p-5 sm:p-6">
      <div>
        <h2 className="font-medium">Destinations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which services to prepare and edit their local settings.
        </p>
      </div>

      <div className="space-y-3">
        {destinationIds.map((destinationId) => (
          <ComposeDestinationCard
            key={destinationId}
            canEdit={canEdit}
            commonComment={commonComment}
            copyConfirmationOpen={copyConfirmationDestination === destinationId}
            destination={getDestinationDraft(destinations, destinationId)}
            {...(metadata === undefined ? {} : { metadata })}
            onCancelCopyCommonComment={onCancelCopyCommonComment}
            onCopyCommonComment={onCopyCommonComment}
            onDestinationChange={onDestinationChange}
            onRequestCopyCommonComment={onRequestCopyCommonComment}
          />
        ))}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-sm text-muted-foreground" role="status">
          Each delivery uses a saved snapshot of the article and destination
          settings.
        </p>
      </div>
    </Panel>
  )
}
