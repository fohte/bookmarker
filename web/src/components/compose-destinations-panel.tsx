import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'
import { useState } from 'react'

import { ComposeDestinationRow } from '#components/compose-destination-row'
import {
  destinationIds,
  getDestinationDraft,
} from '#features/editor/compose-destination'

export function ComposeDestinationsPanel({
  destinations,
  commonComment,
  articleUrl,
  canEdit,
  metadata,
  defaultOpenDestination = null,
  onDestinationChange,
}: {
  destinations: DestinationDraft[]
  commonComment: string
  articleUrl: string
  canEdit: boolean
  metadata?: DestinationMetadata
  defaultOpenDestination?: DestinationId | null
  onDestinationChange: (destination: DestinationDraft) => void
}) {
  const [openDestination, setOpenDestination] = useState<DestinationId | null>(
    defaultOpenDestination,
  )

  return (
    <section aria-labelledby="post-to" className="border-t border-border">
      <h2
        className="px-4 pt-3 pb-0.5 font-mono text-xs font-normal text-muted-foreground-strong md:px-5"
        id="post-to"
      >
        post to
      </h2>
      <ul>
        {destinationIds.map((destinationId) => (
          <ComposeDestinationRow
            key={destinationId}
            articleUrl={articleUrl}
            canEdit={canEdit}
            commonComment={commonComment}
            destination={getDestinationDraft(destinations, destinationId)}
            {...(metadata === undefined ? {} : { metadata })}
            onDestinationChange={onDestinationChange}
            onOpenChange={(open) => {
              setOpenDestination(open ? destinationId : null)
            }}
            open={openDestination === destinationId}
          />
        ))}
      </ul>
    </section>
  )
}
