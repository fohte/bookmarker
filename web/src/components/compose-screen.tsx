import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'
import { useState } from 'react'

import {
  ComposeArticle,
  type ComposeArticleAnalysis,
} from '#components/compose-article'
import { ComposeArticleDetailsDialog } from '#components/compose-article-details-dialog'
import {
  ComposeDeliveryPanel,
  type ComposeDeliveryPanelProps,
} from '#components/compose-delivery-panel'
import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'
import { ComposeDraftManagerDialog } from '#components/compose-draft-manager-dialog'
import { ComposeHeader } from '#components/compose-header'
import { ComposePrePublishReview } from '#components/compose-pre-publish-review'
import type { ComposeState } from '#features/editor/compose-controller'
import type { PrePublishReview } from '#features/editor/compose-pre-publish'

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
  analysis: ComposeArticleAnalysis
  deliveryControls: Omit<ComposeDeliveryPanelProps, 'delivery'>
  prePublishReview: PrePublishReview | null
  onCancelPrePublishReview: () => void
  onConfirmPrePublish: () => void
  destinationMetadata?: DestinationMetadata
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
  prePublishReview,
  onCancelPrePublishReview,
  onConfirmPrePublish,
  destinationMetadata,
  onRetrySave,
  onRetryLock,
  onRequestDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: ComposeScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draftManagerOpen, setDraftManagerOpen] = useState(false)
  const activeDraft = state.activeDraft
  const deliveryBusy = state.deliveryState !== 'idle'
  const canEdit = state.canEdit && !deliveryBusy && prePublishReview === null
  const canCreate =
    state.lockState !== 'unsupported' &&
    !state.isLoading &&
    !deliveryBusy &&
    prePublishReview === null

  return (
    <main
      data-compose-screen
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden"
    >
      <h1 className="sr-only">Article composer</h1>
      <ComposeHeader
        canRetrySave={canEdit}
        draftCount={state.drafts.length}
        onOpenDrafts={() => {
          setDraftManagerOpen(true)
        }}
        onRetrySave={onRetrySave}
        saveState={activeDraft === null ? null : state.saveState}
      />

      {(state.errorMessage !== null ||
        state.intakeError !== null ||
        state.unreadableDraftCount > 0 ||
        state.lockState === 'unsupported' ||
        (state.lockState === 'locked' && activeDraft !== null)) && (
        <section
          aria-label="Editor status"
          className="mx-auto w-full max-w-270 shrink-0 space-y-1 px-4 pt-2 text-xs md:px-6"
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

      <div data-compose-content className="min-h-0 flex-1 overflow-y-auto">
        {state.isLoading ? (
          <p className="mx-auto max-w-270 p-4 text-sm text-muted-foreground-strong md:px-6 md:py-12">
            Loading drafts…
          </p>
        ) : activeDraft === null ? (
          <div className="mx-auto flex max-w-270 flex-wrap items-center gap-x-3 p-4 text-sm md:px-6 md:py-12">
            <p className="text-muted-foreground-strong">No draft is open.</p>
            <button
              className="min-h-11 text-primary"
              onClick={() => {
                setDraftManagerOpen(true)
              }}
              type="button"
            >
              Open a draft
            </button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-270 flex-col md:flex-row md:flex-wrap md:items-start md:gap-14 md:px-6 md:py-12">
            <ComposeArticle
              {...analysis}
              canEdit={canEdit}
              draft={activeDraft}
              onEditArticle={() => {
                setDetailsOpen(true)
              }}
            />
            <section
              aria-label="Compose"
              className="flex min-w-0 flex-col md:grow-999 md:basis-120 md:border md:border-border"
            >
              <div className="flex flex-col px-4 pt-3.5 pb-2.5 md:px-5 md:pt-5 md:pb-3">
                <label
                  className="font-mono text-xs text-muted-foreground-strong"
                  htmlFor="main-comment"
                >
                  comment
                </label>
                <textarea
                  className="mt-2 h-26 resize-none bg-transparent text-lg leading-relaxed outline-none placeholder:text-muted-foreground-strong disabled:cursor-not-allowed disabled:opacity-50 md:mt-2.5 md:h-30"
                  disabled={!canEdit}
                  id="main-comment"
                  onChange={(event) => {
                    onCommonCommentChange(event.currentTarget.value)
                  }}
                  placeholder="What is worth remembering?"
                  value={activeDraft.commonComment}
                />
              </div>
              <ComposeDestinationsPanel
                articleUrl={activeDraft.article?.url ?? activeDraft.source.url}
                canEdit={canEdit}
                commonComment={activeDraft.commonComment}
                destinations={activeDraft.destinations}
                {...(destinationMetadata === undefined
                  ? {}
                  : { metadata: destinationMetadata })}
                onDestinationChange={onDestinationChange}
              />
            </section>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border">
        <div className="mx-auto max-w-270 px-4 py-2 md:px-6">
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
        </div>
      </div>

      {activeDraft !== null && (
        <ComposeArticleDetailsDialog
          activeDraft={activeDraft}
          articleTextError={articleTextError}
          canEdit={canEdit}
          onArticleTextChange={onArticleTextChange}
          onOpenChange={setDetailsOpen}
          onTitleChange={onTitleChange}
          open={detailsOpen}
        />
      )}
      <ComposeDraftManagerDialog
        activeDraft={activeDraft}
        canCreate={canCreate}
        canDiscard={canEdit}
        canSwitchDraft={!deliveryBusy && prePublishReview === null}
        drafts={state.drafts}
        intakeError={state.intakeError}
        onOpenChange={setDraftManagerOpen}
        onOpenSource={onOpenSource}
        onRequestDiscard={() => {
          setDraftManagerOpen(false)
          onRequestDiscard()
        }}
        onSelectDraft={onSelectDraft}
        onSourceUrlChange={onSourceUrlChange}
        open={draftManagerOpen}
        sourceUrl={sourceUrl}
      />

      {prePublishReview !== null && (
        <ComposePrePublishReview
          {...prePublishReview}
          onCancel={onCancelPrePublishReview}
          onPublish={onConfirmPrePublish}
        />
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
