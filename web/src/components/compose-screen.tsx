import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import type { BookmarkDraft } from 'api/contracts'

import type { ComposeState } from '#features/editor/compose-controller'

export type ComposeScreenProps = {
  state: ComposeState
  sourceUrl: string
  onSourceUrlChange: (value: string) => void
  onOpenSource: () => void
  onSelectDraft: (id: string) => void
  onTitleChange: (value: string) => void
  onArticleTextChange: (value: string) => void
  onCommonCommentChange: (value: string) => void
  onRetrySave: () => void
  onRetryLock: () => void
  onRequestDiscard: () => void
  onCancelDiscard: () => void
  onConfirmDiscard: () => void
}

function draftTitle(draft: BookmarkDraft): string {
  const articleTitle = draft.article?.title
  if (articleTitle !== undefined && articleTitle.length > 0) return articleTitle

  const sourceTitle = draft.source.title
  return sourceTitle !== undefined && sourceTitle.length > 0
    ? sourceTitle
    : draft.source.url
}

export function ComposeScreen({
  state,
  sourceUrl,
  onSourceUrlChange,
  onOpenSource,
  onSelectDraft,
  onTitleChange,
  onArticleTextChange,
  onCommonCommentChange,
  onRetrySave,
  onRetryLock,
  onRequestDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: ComposeScreenProps) {
  const activeDraft = state.activeDraft
  const title = activeDraft?.article?.title ?? ''
  const articleText = activeDraft?.article?.text ?? ''
  const canCreate = state.lockState !== 'unsupported' && !state.isLoading

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            BOOKMARKER
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Article drafts</h1>
        </div>
        <p className="text-sm text-muted-foreground" role="status">
          {state.saveState === 'saving'
            ? 'Saving…'
            : state.saveState === 'failed'
              ? 'Save failed'
              : activeDraft === null
                ? 'On this device'
                : 'Saved on this device'}
        </p>
      </header>

      {state.errorMessage !== null && (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.errorMessage}
        </p>
      )}
      {state.intakeError !== null && (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.intakeError}
        </p>
      )}
      {state.unreadableDraftCount > 0 && (
        <p
          className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          {state.unreadableDraftCount} saved draft(s) could not be opened and
          were left unchanged.
        </p>
      )}
      {state.lockState === 'unsupported' && (
        <p
          className="rounded-md border border-border px-3 py-2 text-sm"
          role="alert"
        >
          This browser does not support the locking required to edit drafts
          safely. You can view saved drafts, but editing is unavailable.
        </p>
      )}
      {state.lockState === 'locked' && activeDraft !== null && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
          <p>
            This draft is being edited in another tab. This view is read-only.
          </p>
          <Button onClick={onRetryLock} variant="outline" size="sm">
            Try again
          </Button>
        </div>
      )}

      <Panel padding="md" className="space-y-3 rounded-lg p-5 sm:p-6">
        <div>
          <h2 className="font-medium">New draft</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste an article URL to start a separate draft.
          </p>
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            onOpenSource()
          }}
        >
          <label className="sr-only" htmlFor="source-url">
            Article URL
          </label>
          <Input
            autoComplete="url"
            id="source-url"
            onChange={(event) => {
              onSourceUrlChange(event.currentTarget.value)
            }}
            placeholder="https://example.test/article"
            value={sourceUrl}
          />
          <Button
            disabled={!canCreate || sourceUrl.trim().length === 0}
            type="submit"
          >
            Create draft
          </Button>
        </form>
      </Panel>

      {state.isLoading ? (
        <Panel
          padding="md"
          className="rounded-lg p-5 text-sm text-muted-foreground"
        >
          Loading drafts…
        </Panel>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
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
                  disabled={!state.canEdit}
                  onClick={onRequestDiscard}
                  variant="destructive"
                  size="sm"
                >
                  Discard
                </Button>
              )}
            </div>

            {state.drafts.length > 0 && (
              <div className="space-y-1.5">
                <label
                  className="text-sm font-medium"
                  htmlFor="draft-selection"
                >
                  Saved drafts
                </label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                  disabled={state.isLoading}
                  id="draft-selection"
                  onChange={(event) => {
                    onSelectDraft(event.currentTarget.value)
                  }}
                  value={activeDraft?.id ?? ''}
                >
                  <option disabled value="">
                    Select a draft
                  </option>
                  {state.drafts.map((draft) => (
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
                  {state.drafts.length === 0
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
                  <label
                    className="text-sm font-medium"
                    htmlFor="article-title"
                  >
                    Title
                  </label>
                  <Input
                    disabled={!state.canEdit}
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
                    className="min-h-36 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!state.canEdit}
                    id="article-text"
                    onChange={(event) => {
                      onArticleTextChange(event.currentTarget.value)
                    }}
                    placeholder="Paste or write article text here."
                    value={articleText}
                  />
                </div>
              </div>
            )}
          </Panel>

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
                  disabled={!state.canEdit}
                  id="common-comment"
                  onChange={(event) => {
                    onCommonCommentChange(event.currentTarget.value)
                  }}
                  placeholder="Write a comment…"
                  value={activeDraft.commonComment}
                />
              </>
            )}
            {state.saveState === 'failed' &&
              activeDraft !== null &&
              state.canEdit && (
                <Button onClick={onRetrySave} variant="outline">
                  Retry save
                </Button>
              )}
          </Panel>
        </section>
      )}

      <Dialog
        open={state.discardOpen}
        onOpenChange={(open) => {
          if (!open) onCancelDiscard()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard this draft?</DialogTitle>
            <DialogDescription>
              This removes the saved draft from this device. The current input
              is saved before it is discarded.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onCancelDiscard} variant="outline">
              Keep draft
            </Button>
            <Button onClick={onConfirmDiscard} variant="destructive">
              Discard draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
