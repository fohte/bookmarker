import {
  ComposeDeliveryNotices,
  type ComposeDeliveryNoticesProps,
} from '#components/compose-delivery-notices'
import type { ComposeDeliveryState } from '#features/editor/compose-state'

const busyLabels: Partial<Record<ComposeDeliveryState, string>> = {
  'saving-input': 'Saving latest edits…',
  'saving-pending': 'Saving send attempt…',
  sending: 'Posting…',
  'saving-results': 'Saving results…',
}

function postLabel(pendingCount: number, xSelected: boolean): string {
  if (pendingCount > 0) {
    return `Check and post to ${String(pendingCount)}${xSelected ? ' · then X' : ''}`
  }
  if (xSelected) return 'Check and open X'
  return 'Choose where to post'
}

export function ComposePostBar({
  pendingCount,
  xSelected,
  canPost,
  onPost,
  ...notices
}: ComposeDeliveryNoticesProps & {
  pendingCount: number
  xSelected: boolean
  canPost: boolean
  onPost: () => void
}) {
  return (
    <footer className="shrink-0 border-t border-border">
      <div className="mx-auto flex max-w-270 flex-col gap-2 px-4 pt-2 pb-7 md:flex-row md:items-center md:gap-4 md:px-6 md:py-4">
        <div className="min-w-0 md:flex-1">
          <ComposeDeliveryNotices {...notices} />
        </div>
        <span
          aria-hidden="true"
          className="hidden shrink-0 gap-1 text-xs text-muted-foreground-strong md:flex"
        >
          <kbd className="rounded-xs border border-border-strong px-1.5 font-mono">
            ⌘
          </kbd>
          <kbd className="rounded-xs border border-border-strong px-1.5 font-mono">
            Enter
          </kbd>
        </span>
        <button
          aria-keyshortcuts="Meta+Enter"
          className="flex h-13 w-full shrink-0 items-center justify-center bg-foreground px-6 text-base font-bold text-background disabled:opacity-50 md:h-11 md:w-auto md:text-sm"
          data-compose-publish
          disabled={!canPost}
          onClick={onPost}
          type="button"
        >
          {busyLabels[notices.deliveryState] ??
            postLabel(pendingCount, xSelected)}
        </button>
      </div>
    </footer>
  )
}
