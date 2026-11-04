import type { ComposeState } from '#features/editor/compose-controller'

const saveStatusLabels: Record<ComposeState['saveState'], string> = {
  saving: 'saving…',
  saved: 'saved',
  failed: 'save failed',
}

export function ComposeHeader({
  draftCount,
  saveState,
  deliverySummary = null,
  canRetrySave,
  onOpenDrafts,
  onRetrySave,
}: {
  draftCount: number
  saveState: ComposeState['saveState'] | null
  // Replaces the save state on the results screen, where nothing is edited.
  deliverySummary?: string | null
  canRetrySave: boolean
  onOpenDrafts: () => void
  onRetrySave: () => void
}) {
  return (
    <header className="shrink-0 border-b border-border">
      <div className="mx-auto flex h-13 max-w-270 items-center justify-between gap-4 pr-2 pl-3 md:h-14 md:px-6">
        <button
          aria-label={`Switch draft, ${String(draftCount)} drafts`}
          className="flex min-h-11 items-center gap-2 px-1 font-mono text-sm font-bold md:px-0"
          onClick={onOpenDrafts}
          type="button"
        >
          <span className="text-primary">&gt;</span>
          <span>drafts</span>
          <span className="font-normal text-muted-foreground-strong">
            {draftCount}
          </span>
          <svg
            aria-hidden="true"
            className="size-3.5 stroke-muted-foreground-strong"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {deliverySummary !== null && (
          <span
            className="px-2 font-mono text-xs text-muted-foreground-strong md:px-0"
            role="status"
          >
            {deliverySummary}
          </span>
        )}
        {deliverySummary === null && saveState !== null && (
          <div className="flex items-center gap-3 px-2 font-mono text-xs md:px-0">
            <span
              className={
                saveState === 'failed'
                  ? 'text-primary'
                  : 'text-muted-foreground-strong'
              }
              role="status"
            >
              {saveStatusLabels[saveState]}
            </span>
            {saveState === 'failed' && canRetrySave && (
              <button
                className="min-h-11 text-foreground underline underline-offset-4"
                onClick={onRetrySave}
                type="button"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
