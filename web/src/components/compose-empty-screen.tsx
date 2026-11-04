import type { BookmarkDraft } from 'api/contracts'
import { ChevronRightIcon } from 'lucide-react'

import {
  composeDraftHost,
  composeDraftProgress,
} from '#components/compose-draft-progress'
import { getComposeDraftTitle } from '#components/compose-draft-title'

export function ComposeEmptyScreen({
  drafts,
  sourceUrl,
  canCreate,
  canSwitchDraft,
  onSourceUrlChange,
  onOpenSource,
  onSelectDraft,
}: {
  drafts: BookmarkDraft[]
  sourceUrl: string
  canCreate: boolean
  canSwitchDraft: boolean
  onSourceUrlChange: (value: string) => void
  onOpenSource: () => Promise<boolean>
  onSelectDraft: (id: string) => void
}) {
  const unfinished = drafts.filter(
    (draft) => composeDraftProgress(draft) !== 'posted',
  )

  return (
    <div data-compose-content className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-120 flex-col">
        <form
          className="flex shrink-0 flex-col gap-3 px-4 pt-30"
          onSubmit={(event) => {
            event.preventDefault()
            void onOpenSource()
          }}
        >
          <label
            className="text-2xl leading-snug font-bold"
            htmlFor="start-url"
          >
            Bookmark an article
          </label>
          <input
            autoComplete="url"
            className="h-13 border border-border bg-muted px-3.5 font-mono text-base outline-none placeholder:text-muted-foreground-strong focus-visible:border-border-strong"
            id="start-url"
            onChange={(event) => {
              onSourceUrlChange(event.currentTarget.value)
            }}
            placeholder="https://"
            type="url"
            value={sourceUrl}
          />
          <button
            className="h-13 bg-foreground text-base font-bold text-background disabled:opacity-50"
            disabled={!canCreate || sourceUrl.trim().length === 0}
            type="submit"
          >
            Start
          </button>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground-strong">
            Or share from Safari with the shortcut.{' '}
            <a
              className="text-foreground underline underline-offset-4"
              href="https://github.com/fohte/bookmarker/tree/master/docs/share"
              rel="noreferrer"
              target="_blank"
            >
              Set it up
            </a>
          </p>
        </form>

        {unfinished.length > 0 && (
          <section
            aria-labelledby="unfinished-drafts"
            className="mt-auto pt-12 pb-7"
          >
            <h2
              className="px-4 pb-2 font-mono text-xs text-muted-foreground-strong"
              id="unfinished-drafts"
            >
              unfinished drafts
            </h2>
            <ul className="border-b border-border">
              {unfinished.map((draft) => (
                <li key={draft.id} className="border-t border-border">
                  <button
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-50"
                    disabled={!canSwitchDraft}
                    onClick={() => {
                      onSelectDraft(draft.id)
                    }}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base">
                        {getComposeDraftTitle(draft, draft.source.url)}
                      </span>
                      <span className="mt-1 block font-mono text-xs text-muted-foreground-strong">
                        {composeDraftHost(draft)} ·{' '}
                        {composeDraftProgress(draft)}
                      </span>
                    </span>
                    <ChevronRightIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground-strong"
                      strokeWidth={1.5}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
