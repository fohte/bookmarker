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
  onOpenSource: () => Promise<boolean>
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
    <main
      data-compose-screen
      className="mx-auto flex h-dvh min-h-0 w-full max-w-5xl flex-col gap-2 overflow-hidden px-3 py-2 sm:px-4"
    >
      <h1 className="sr-only">Article composer</h1>
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

      {(state.errorMessage !== null ||
        state.intakeError !== null ||
        state.unreadableDraftCount > 0 ||
        state.lockState === 'unsupported' ||
        (state.lockState === 'locked' && activeDraft !== null)) && (
        <section
          aria-label="Editor status"
          className="shrink-0 space-y-1 text-xs"
        >
          {state.errorMessage !== null && (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-destructive"
              role="alert"
            >
              {state.errorMessage}
            </p>
          )}
          {state.intakeError !== null && (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-destructive"
              role="alert"
            >
              {state.intakeError}
            </p>
          )}
          {state.unreadableDraftCount > 0 && (
            <p
              className="rounded-md border border-border px-2 py-1 text-muted-foreground"
              role="status"
            >
              {state.unreadableDraftCount} saved draft(s) could not be opened
              and were left unchanged.
            </p>
          )}
          {state.lockState === 'unsupported' && (
            <p
              className="rounded-md border border-border px-2 py-1"
              role="alert"
            >
              This browser does not support safe editing. Saved drafts are
              read-only.
            </p>
          )}
          {state.lockState === 'locked' && activeDraft !== null && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
              <p role="status">
                This draft is being edited in another tab. This view is
                read-only.
              </p>
              <Button onClick={onRetryLock} size="xs" variant="outline">
                Try again
              </Button>
            </div>
          )}
        </section>
      )}

      {state.isLoading ? (
        <Panel
          padding="sm"
          className="min-h-0 flex-1 rounded-lg p-3 text-sm text-muted-foreground"
        >
          Loading drafts…
        </Panel>
      ) : (
        <div
          data-compose-content
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto md:overflow-y-hidden"
        >
          <section className="grid min-h-0 min-w-0 flex-1 grid-rows-2 grid-cols-1 gap-2 md:grid-rows-1 md:grid-cols-2">
            <ComposeAnalysisPanel
              {...analysis}
              canEdit={canEdit && !state.isLoading}
            />
            <ComposeCommonCommentPanel
              activeDraft={activeDraft}
              canEdit={canEdit}
              onCommentChange={onCommonCommentChange}
              onRetrySave={onRetrySave}
              saveState={state.saveState}
            />
          </section>
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
      )}

      <ComposeDeliveryPanel
        delivery={activeDraft?.delivery ?? []}
        {...deliveryControls}
        xSelected={
          activeDraft?.destinations.some(
            (destination) =>
              destination.destination === 'x' && destination.selected,
          ) ?? false
        }
      />

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
