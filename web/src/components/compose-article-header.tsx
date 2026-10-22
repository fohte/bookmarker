import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft } from 'api/contracts'

function displayTitle(draft: BookmarkDraft): string {
  const articleTitle = draft.article?.title
  if (articleTitle !== undefined && articleTitle.length > 0) return articleTitle

  const sourceTitle = draft.source.title
  return sourceTitle !== undefined && sourceTitle.length > 0
    ? sourceTitle
    : 'Untitled article'
}

export function ComposeArticleHeader({
  activeDraft,
  draftCount,
  saveState,
  onOpenDetails,
  onOpenDrafts,
}: {
  activeDraft: BookmarkDraft | null
  draftCount: number
  saveState: 'saving' | 'saved' | 'failed'
  onOpenDetails: () => void
  onOpenDrafts: () => void
}) {
  const saveStatus =
    activeDraft === null
      ? 'On this device'
      : saveState === 'saving'
        ? 'Saving…'
        : saveState === 'failed'
          ? 'Save failed'
          : 'Saved on this device'

  return (
    <Panel padding="sm" className="rounded-lg p-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium"
            title={
              activeDraft === null
                ? 'No article selected'
                : displayTitle(activeDraft)
            }
          >
            {activeDraft === null
              ? 'No article selected'
              : displayTitle(activeDraft)}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={activeDraft?.source.url}
          >
            {activeDraft?.source.url ?? 'Create a draft to begin'}
          </p>
          <p className="text-xs text-muted-foreground" role="status">
            {saveStatus}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            aria-label="Open article details"
            disabled={activeDraft === null}
            onClick={onOpenDetails}
            size="sm"
            variant="outline"
          >
            Article details
          </Button>
          <Button onClick={onOpenDrafts} size="sm" variant="ghost">
            Drafts ({draftCount})
          </Button>
        </div>
      </div>
    </Panel>
  )
}
