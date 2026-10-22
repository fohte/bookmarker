import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import type { BookmarkDraft } from 'api/contracts'

export function ComposeArticleDetailsDialog({
  open,
  activeDraft,
  canEdit,
  articleTextError,
  onOpenChange,
  onTitleChange,
  onArticleTextChange,
}: {
  open: boolean
  activeDraft: BookmarkDraft
  canEdit: boolean
  articleTextError: string | null
  onOpenChange: (open: boolean) => void
  onTitleChange: (value: string) => void
  onArticleTextChange: (value: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Article details</DialogTitle>
          <DialogDescription>
            Review the source and edit the title or article text.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="article-url">
              Article URL
            </label>
            <Input id="article-url" readOnly value={activeDraft.source.url} />
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
              value={activeDraft.article?.title ?? ''}
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
              className="max-h-60 min-h-36 w-full resize-y overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canEdit}
              id="article-text"
              onChange={(event) => {
                onArticleTextChange(event.currentTarget.value)
              }}
              placeholder="Paste or write article text here."
              value={activeDraft.article?.text ?? ''}
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
      </DialogContent>
    </Dialog>
  )
}
