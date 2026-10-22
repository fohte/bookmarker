import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import type { BookmarkDraft } from 'api/contracts'

import { getComposeDraftTitle } from '#components/compose-draft-title'

export function ComposeDraftManagerDialog({
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
      <DialogContent className="max-h-dvh overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Drafts</DialogTitle>
          <DialogDescription>
            Switch drafts or create a separate draft from a URL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
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
                  onOpenChange(false)
                }}
                value={activeDraft?.id ?? ''}
              >
                <option disabled value="">
                  Select a draft
                </option>
                {drafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>
                    {getComposeDraftTitle(draft, draft.source.url)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault()
              void onOpenSource().then((opened) => {
                if (opened) onOpenChange(false)
              })
            }}
          >
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="source-url">
                New article URL
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
            </div>
            {intakeError !== null && (
              <p className="text-sm text-destructive" role="alert">
                {intakeError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A new URL starts a separate draft.
            </p>
            <Button
              disabled={!canCreate || sourceUrl.trim().length === 0}
              type="submit"
            >
              Create draft
            </Button>
          </form>

          {activeDraft !== null && (
            <div className="border-t border-border pt-4">
              <Button
                disabled={!canDiscard}
                onClick={onRequestDiscard}
                variant="destructive"
                size="sm"
              >
                Discard current draft
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
