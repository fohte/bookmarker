import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft } from 'api/contracts'

function draftTitle(draft: BookmarkDraft): string {
  const articleTitle = draft.article?.title
  if (articleTitle !== undefined && articleTitle.length > 0) return articleTitle

  const sourceTitle = draft.source.title
  return sourceTitle !== undefined && sourceTitle.length > 0
    ? sourceTitle
    : draft.source.url
}

export function ComposeDraftPanel({
  activeDraft,
  drafts,
  canEdit,
  canSwitchDraft,
  articleTextError,
  onSelectDraft,
  onTitleChange,
  onArticleTextChange,
  onRequestDiscard,
}: {
  activeDraft: BookmarkDraft | null
  drafts: BookmarkDraft[]
  canEdit: boolean
  canSwitchDraft: boolean
  articleTextError: string | null
  onSelectDraft: (id: string) => void
  onTitleChange: (value: string) => void
  onArticleTextChange: (value: string) => void
  onRequestDiscard: () => void
}) {
  const title = activeDraft?.article?.title ?? ''
  const articleText = activeDraft?.article?.text ?? ''

  return (
    <Panel padding="md" className="space-y-5 rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Draft editor</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeDraft === null
              ? 'Choose a draft or paste a URL above.'
              : 'Changes are saved as you type.'}
          </p>
        </div>
        {activeDraft !== null && (
          <Button
            disabled={!canEdit}
            onClick={onRequestDiscard}
            variant="destructive"
            size="sm"
          >
            Discard
          </Button>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="draft-selection">
            Saved drafts
          </label>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            disabled={!canSwitchDraft}
            id="draft-selection"
            onChange={(event) => {
              onSelectDraft(event.currentTarget.value)
            }}
            value={activeDraft?.id ?? ''}
          >
            <option disabled value="">
              Select a draft
            </option>
            {drafts.map((draft) => (
              <option key={draft.id} value={draft.id}>
                {draftTitle(draft)}
              </option>
            ))}
          </select>
        </div>
      )}

      {activeDraft === null ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
          <p className="font-medium">No draft is open</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {drafts.length === 0
              ? 'A pasted URL creates your first local draft.'
              : 'Select a saved draft or create another one.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Article URL
            </p>
            <p className="break-all text-sm">{activeDraft.source.url}</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="article-title">
              Title
            </label>
            <Input
              disabled={!canEdit}
              id="article-title"
              onChange={(event) => {
                onTitleChange(event.currentTarget.value)
              }}
              value={title}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="article-text">
              Manual article text
            </label>
            <textarea
              aria-describedby={
                articleTextError === null ? undefined : 'article-text-error'
              }
              className="min-h-36 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit}
              id="article-text"
              onChange={(event) => {
                onArticleTextChange(event.currentTarget.value)
              }}
              placeholder="Paste or write article text here."
              value={articleText}
            />
            {articleTextError !== null && (
              <p
                className="text-sm text-destructive"
                id="article-text-error"
                role="alert"
              >
                {articleTextError}
              </p>
            )}
          </div>
        </div>
      )}
    </Panel>
  )
}
