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
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

import {
  type AnalysisDisplayState,
  ComposeAnalysisPanel,
} from '#components/compose-analysis-panel'
import { ComposeCommonCommentPanel } from '#components/compose-common-comment-panel'
import { ComposeDeliveryPanel } from '#components/compose-delivery-panel'
import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'
import { ComposeDraftPanel } from '#components/compose-draft-panel'
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
  onDestinationChange: (destination: DestinationDraft) => void
  analysisSummaryState: AnalysisDisplayState
  analysisVerificationState: AnalysisDisplayState
  destinationMetadata?: DestinationMetadata
  copyConfirmationDestination: DestinationId | null
  onRequestCopyCommonComment: (destination: DestinationId) => void
  onCancelCopyCommonComment: () => void
  onCopyCommonComment: (destination: DestinationId) => void
  onRetrySave: () => void
  onRetryLock: () => void
  onRequestDiscard: () => void
  onCancelDiscard: () => void
  onConfirmDiscard: () => void
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
  onDestinationChange,
  analysisSummaryState,
  analysisVerificationState,
  destinationMetadata,
  copyConfirmationDestination,
  onRequestCopyCommonComment,
  onCancelCopyCommonComment,
  onCopyCommonComment,
  onRetrySave,
  onRetryLock,
  onRequestDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: ComposeScreenProps) {
  const activeDraft = state.activeDraft
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
        <section className="grid items-start gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <ComposeDraftPanel
              activeDraft={activeDraft}
              canEdit={state.canEdit}
              drafts={state.drafts}
              onArticleTextChange={onArticleTextChange}
              onRequestDiscard={onRequestDiscard}
              onSelectDraft={onSelectDraft}
              onTitleChange={onTitleChange}
            />
            <ComposeAnalysisPanel
              article={activeDraft?.article ?? null}
              summary={activeDraft?.analysis?.summary ?? null}
              summaryState={analysisSummaryState}
              verification={activeDraft?.analysis?.verification ?? null}
              verificationState={analysisVerificationState}
            />
            <ComposeDeliveryPanel delivery={activeDraft?.delivery ?? []} />
          </div>
          <div className="space-y-6">
            <ComposeCommonCommentPanel
              activeDraft={activeDraft}
              canEdit={state.canEdit}
              onCommentChange={onCommonCommentChange}
              onRetrySave={onRetrySave}
              saveState={state.saveState}
            />
            <ComposeDestinationsPanel
              canEdit={state.canEdit}
              commonComment={activeDraft?.commonComment ?? ''}
              copyConfirmationDestination={copyConfirmationDestination}
              destinations={activeDraft?.destinations ?? []}
              {...(destinationMetadata === undefined
                ? {}
                : { metadata: destinationMetadata })}
              onCancelCopyCommonComment={onCancelCopyCommonComment}
              onCopyCommonComment={onCopyCommonComment}
              onDestinationChange={onDestinationChange}
              onRequestCopyCommonComment={onRequestCopyCommonComment}
            />
          </div>
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
