import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft } from 'api/contracts'

import type { ComposeState } from '#features/editor/compose-controller'

export function ComposeCommonCommentPanel({
  activeDraft,
  canEdit,
  saveState,
  onCommentChange,
  onRetrySave,
}: {
  activeDraft: BookmarkDraft | null
  canEdit: boolean
  saveState: ComposeState['saveState']
  onCommentChange: (value: string) => void
  onRetrySave: () => void
}) {
  return (
    <Panel padding="md" className="space-y-4 rounded-lg p-5 sm:p-6">
      <div>
        <h2 className="font-medium">Common comment</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This comment is kept with the current draft.
        </p>
      </div>
      {activeDraft === null ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Open a draft to write a comment.
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor="common-comment">
            Common comment
          </label>
          <textarea
            className="min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            id="common-comment"
            onChange={(event) => {
              onCommentChange(event.currentTarget.value)
            }}
            placeholder="Write a comment…"
            value={activeDraft.commonComment}
          />
        </>
      )}
      {saveState === 'failed' && activeDraft !== null && canEdit && (
        <Button onClick={onRetrySave} variant="outline">
          Retry save
        </Button>
      )}
    </Panel>
  )
}
