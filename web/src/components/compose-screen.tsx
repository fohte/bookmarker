import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Panel } from '@fohte/ui/panel'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

import {
  ComposeAnalysisPanel,
  type ComposeAnalysisPanelProps,
} from '#components/compose-analysis-panel'
import { ComposeCommonCommentPanel } from '#components/compose-common-comment-panel'
import {
  ComposeDeliveryPanel,
  type ComposeDeliveryPanelProps,
} from '#components/compose-delivery-panel'
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
  articleTextError: string | null
  onCommonCommentChange: (value: string) => void
  onDestinationChange: (destination: DestinationDraft) => void
  analysis: Omit<ComposeAnalysisPanelProps, 'canEdit'>
  deliveryControls: Omit<ComposeDeliveryPanelProps, 'delivery'>
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
  articleTextError,
  onCommonCommentChange,
  onDestinationChange,
  analysis,
  deliveryControls,
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
  const deliveryBusy = state.deliveryState !== 'idle'
  const canEdit = state.canEdit && !deliveryBusy
  const canCreate =
    state.lockState !== 'unsupported' && !state.isLoading && !deliveryBusy

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            BOOKMARKER
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Article drafts</h1>
        </div>
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

      <ComposeDraftPanel
        activeDraft={activeDraft}
        articleTextError={articleTextError}
        canCreate={canCreate}
        canEdit={canEdit}
        canSwitchDraft={!deliveryBusy}
        drafts={state.drafts}
        intakeError={state.intakeError}
        onArticleTextChange={onArticleTextChange}
        onOpenSource={onOpenSource}
        onRequestDiscard={onRequestDiscard}
        onSelectDraft={onSelectDraft}
        onSourceUrlChange={onSourceUrlChange}
        onTitleChange={onTitleChange}
        saveState={state.saveState}
        sourceUrl={sourceUrl}
      />

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
            <ComposeAnalysisPanel
              {...analysis}
              canEdit={canEdit && !state.isLoading}
            />
            <ComposeDeliveryPanel
              delivery={activeDraft?.delivery ?? []}
              {...deliveryControls}
            />
          </div>
          <div className="space-y-6">
            <ComposeCommonCommentPanel
              activeDraft={activeDraft}
              canEdit={canEdit}
              onCommentChange={onCommonCommentChange}
              onRetrySave={onRetrySave}
              saveState={state.saveState}
            />
            <ComposeDestinationsPanel
              canEdit={canEdit}
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
