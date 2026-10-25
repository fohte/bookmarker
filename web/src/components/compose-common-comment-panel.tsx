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
    <Panel
      data-compose-section="common-comment"
      padding="sm"
      className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg p-2"
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Common comment</h2>
        {saveState === 'failed' && activeDraft !== null && canEdit && (
          <Button onClick={onRetrySave} size="xs" variant="outline">
            Retry save
          </Button>
        )}
      </div>
      {activeDraft === null ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Open a draft to write a comment.
        </p>
      ) : (
        <>
          <label className="sr-only" htmlFor="common-comment">
            Common comment
          </label>
          <textarea
            className="h-14 min-h-14 w-full resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:h-20 md:min-h-20"
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
    </Panel>
  )
}
