import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@fohte/ui/dialog'
import type { BookmarkDraft } from 'api/contracts'
import { CheckIcon, XIcon } from 'lucide-react'

import {
  composeDraftHost,
  composeDraftProgress,
} from '#components/compose-draft-progress'
import { getComposeDraftTitle } from '#components/compose-draft-title'

export function ComposeDraftsSheet({
  open,
  activeDraft,
  drafts,
  sourceUrl,
  canCreate,
  canSwitchDraft,
  canDiscard,
  intakeError,
  onOpenChange,
  onSourceUrlChange,
  onOpenSource,
  onSelectDraft,
  onRequestDiscard,
}: {
  open: boolean
  activeDraft: BookmarkDraft | null
  drafts: BookmarkDraft[]
  sourceUrl: string
  canCreate: boolean
  canSwitchDraft: boolean
  canDiscard: boolean
  intakeError: string | null
  onOpenChange: (open: boolean) => void
  onSourceUrlChange: (value: string) => void
  onOpenSource: () => Promise<boolean>
  onSelectDraft: (id: string) => void
  onRequestDiscard: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-0 left-0 flex max-h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-b border-border bg-muted p-0 ring-0 sm:max-w-none md:top-1/2 md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:border"
        showCloseButton={false}
      >
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border pr-2 pl-3">
          <DialogTitle className="flex items-center gap-2 px-1 font-mono text-sm leading-normal font-bold">
            <span aria-hidden="true" className="text-primary">
              &gt;
            </span>
            drafts
            <span className="font-normal text-muted-foreground-strong">
              {drafts.length}
            </span>
          </DialogTitle>
          <DialogClose
            aria-label="Close drafts"
            className="flex size-11 items-center justify-center"
          >
            <XIcon aria-hidden="true" className="size-4.5" strokeWidth={1.5} />
          </DialogClose>
        </header>

        <form
          className="flex shrink-0 flex-col gap-2 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onOpenSource().then((opened) => {
              if (opened) onOpenChange(false)
            })
          }}
        >
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="source-url">
              New article URL
            </label>
            <input
              autoComplete="url"
              className="h-11 min-w-0 flex-1 border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground-strong focus-visible:border-border-strong"
              id="source-url"
              onChange={(event) => {
                onSourceUrlChange(event.currentTarget.value)
              }}
              placeholder="Paste a URL to start a new draft"
              type="url"
              value={sourceUrl}
            />
            <button
              className="h-11 bg-foreground px-4 text-sm font-bold text-background disabled:opacity-50"
              disabled={!canCreate || sourceUrl.trim().length === 0}
              type="submit"
            >
              Open
            </button>
          </div>
          {intakeError !== null && (
            <p className="text-sm text-destructive" role="alert">
              {intakeError}
            </p>
          )}
        </form>

        {drafts.length > 0 && (
          <ul
            aria-label="Saved drafts"
            className="min-h-0 overflow-y-auto pb-2"
          >
            {drafts.map((draft) => {
              const active = draft.id === activeDraft?.id
              const title = getComposeDraftTitle(draft, draft.source.url)
              const text = (status: string) => (
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-base ${active ? 'font-medium' : ''}`}
                  >
                    {title}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground-strong">
                    {composeDraftHost(draft)} · {status}
                  </p>
                </div>
              )
              return active ? (
                <li
                  key={draft.id}
                  aria-current="true"
                  className="flex items-center gap-3 border-t border-border bg-accent px-4 py-3"
                >
                  <CheckIcon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                    strokeWidth={2}
                  />
                  {text('editing')}
                  <button
                    className="min-h-11 px-1 text-sm text-muted-foreground-strong disabled:opacity-50"
                    disabled={!canDiscard}
                    onClick={onRequestDiscard}
                    type="button"
                  >
                    Discard
                  </button>
                </li>
              ) : (
                <li key={draft.id} className="border-t border-border">
                  <button
                    className="flex w-full items-center gap-3 py-3 pr-4 pl-11 text-left disabled:opacity-50"
                    disabled={!canSwitchDraft}
                    onClick={() => {
                      onSelectDraft(draft.id)
                      onOpenChange(false)
                    }}
                    type="button"
                  >
                    {text(composeDraftProgress(draft))}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
