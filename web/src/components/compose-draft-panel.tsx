import type { BookmarkDraft } from 'api/contracts'
import { useState } from 'react'

import { ComposeArticleDetailsDialog } from '#components/compose-article-details-dialog'
import { ComposeArticleHeader } from '#components/compose-article-header'
import { ComposeDraftManagerDialog } from '#components/compose-draft-manager-dialog'

export function ComposeDraftPanel({
  activeDraft,
  drafts,
  canEdit,
  canCreate,
  canSwitchDraft,
  saveState,
  sourceUrl,
  intakeError,
  articleTextError,
  onSourceUrlChange,
  onOpenSource,
  onSelectDraft,
  onTitleChange,
  onArticleTextChange,
  onRequestDiscard,
}: {
  activeDraft: BookmarkDraft | null
  drafts: BookmarkDraft[]
  canEdit: boolean
  canCreate: boolean
  canSwitchDraft: boolean
  saveState: 'saving' | 'saved' | 'failed'
  sourceUrl: string
  intakeError: string | null
  articleTextError: string | null
  onSourceUrlChange: (value: string) => void
  onOpenSource: () => void
  onSelectDraft: (id: string) => void
  onTitleChange: (value: string) => void
  onArticleTextChange: (value: string) => void
  onRequestDiscard: () => void
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draftManagerOpen, setDraftManagerOpen] = useState(false)

  return (
    <>
      <ComposeArticleHeader
        activeDraft={activeDraft}
        draftCount={drafts.length}
        onOpenDetails={() => {
          setDetailsOpen(true)
        }}
        onOpenDrafts={() => {
          setDraftManagerOpen(true)
        }}
        saveState={saveState}
      />
      {activeDraft !== null && (
        <ComposeArticleDetailsDialog
          activeDraft={activeDraft}
          articleTextError={articleTextError}
          canEdit={canEdit}
          onArticleTextChange={onArticleTextChange}
          onOpenChange={setDetailsOpen}
          onTitleChange={onTitleChange}
          open={detailsOpen}
        />
      )}
      <ComposeDraftManagerDialog
        activeDraft={activeDraft}
        canCreate={canCreate}
        canDiscard={canEdit}
        canSwitchDraft={canSwitchDraft}
        drafts={drafts}
        intakeError={intakeError}
        onOpenChange={setDraftManagerOpen}
        onOpenSource={onOpenSource}
        onRequestDiscard={() => {
          setDraftManagerOpen(false)
          onRequestDiscard()
        }}
        onSelectDraft={onSelectDraft}
        onSourceUrlChange={onSourceUrlChange}
        open={draftManagerOpen}
        sourceUrl={sourceUrl}
      />
    </>
  )
}
