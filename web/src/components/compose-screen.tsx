import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'
import { useState } from 'react'

import {
  ComposeArticle,
  type ComposeArticleAnalysis,
} from '#components/compose-article'
import { ComposeArticleDetailsDialog } from '#components/compose-article-details-dialog'
import { ComposeCheckSheet } from '#components/compose-check-sheet'
import type { ComposeDeliveryNoticesProps } from '#components/compose-delivery-notices'
import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'
import { ComposeDraftManagerDialog } from '#components/compose-draft-manager-dialog'
import { ComposeHeader } from '#components/compose-header'
import { ComposePostBar } from '#components/compose-post-bar'
import { ComposeResults } from '#components/compose-results'
import type { ComposeState } from '#features/editor/compose-controller'
import { getPendingDeliveryComments } from '#features/editor/compose-delivery-command'
import { latestDeliverySnapshots } from '#features/editor/compose-delivery-history'
import { destinationIds } from '#features/editor/compose-destination'
import type { PrePublishReview } from '#features/editor/compose-pre-publish'

type ComposeDeliveryControls = ComposeDeliveryNoticesProps & {
  canPublish: boolean
  canOpenX: boolean
  xIntentHref: string | null
  onRequestPublishReview: () => void
  // Sends again without a new comment check; the results screen cannot edit comments.
  onRetryDelivery: () => void
}

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
  deliveryControls: ComposeDeliveryControls
  prePublishReview: PrePublishReview | null
  onCancelPrePublishReview: () => void
  onConfirmPrePublish: () => void
  defaultResultsOpen?: boolean
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
  defaultResultsOpen = false,
  destinationMetadata,
  onRetrySave,
  onRetryLock,
  onRequestDiscard,
  onCancelDiscard,
  onConfirmDiscard,
}: ComposeScreenProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [draftManagerOpen, setDraftManagerOpen] = useState(false)
  const [openDestination, setOpenDestination] = useState<DestinationId | null>(
    null,
  )
  const activeDraft = state.activeDraft
  // Keyed by draft so that switching drafts returns to the editor.
  const [resultsDraftId, setResultsDraftId] = useState(
    defaultResultsOpen ? (activeDraft?.id ?? null) : null,
  )
  const showResults = activeDraft !== null && resultsDraftId === activeDraft.id
  const deliveryBusy = state.deliveryState !== 'idle'
  const canEdit = state.canEdit && !deliveryBusy && prePublishReview === null
  const canCreate =
    state.lockState !== 'unsupported' &&
    !state.isLoading &&
    !deliveryBusy &&
    prePublishReview === null
  const pending =
    activeDraft === null ? [] : getPendingDeliveryComments(activeDraft)
  const pendingCount = pending.filter(
    (comment) => comment.destination !== 'x',
  ).length
  const xSelected = pending.some((comment) => comment.destination === 'x')
  const canPost = deliveryControls.canPublish && (pendingCount > 0 || xSelected)
  const xOnly = pendingCount === 0 && xSelected
  const shownResults =
    activeDraft === null ? [] : latestDeliverySnapshots(activeDraft.delivery)
  const postedCount = shownResults.filter(
    (snapshot) => snapshot.result?.status === 'succeeded',
  ).length

  const confirmPost = () => {
    if (activeDraft === null) return
    if (xOnly) {
      // The sheet's post link has already opened X; nothing is sent here.
      onCancelPrePublishReview()
      return
    }
    setResultsDraftId(activeDraft.id)
    onConfirmPrePublish()
  }

  const editComment = (commentTargetId: string) => {
    onCancelPrePublishReview()
    setOpenDestination(
      destinationIds.find(
        (destination) => commentTargetId === `destination:${destination}`,
      ) ?? null,
    )
  }

  return (
    <main
      data-compose-screen
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden"
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.metaKey || event.ctrlKey) &&
          // Dialogs render in portals; their key presses must not post.
          event.target instanceof Node &&
          event.currentTarget.contains(event.target) &&
          !showResults &&
          canPost
        ) {
          event.preventDefault()
          deliveryControls.onRequestPublishReview()
        }
      }}
    >
      <h1 className="sr-only">Article composer</h1>
      <ComposeHeader
        canRetrySave={canEdit}
        deliverySummary={
          showResults
            ? `${String(postedCount)} of ${String(shownResults.length)} posted`
            : null
        }
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

      {showResults ? (
        <ComposeResults
          authenticationRequired={deliveryControls.authenticationRequired}
          canOpenX={deliveryControls.canOpenX}
          canRetry={deliveryControls.canPublish}
          deliveryErrorMessage={deliveryControls.deliveryErrorMessage}
          deliveryState={deliveryControls.deliveryState}
          draft={activeDraft}
          isLoadingMetadata={deliveryControls.isLoadingMetadata}
          metadataErrorMessage={deliveryControls.metadataErrorMessage}
          onBackToEdit={() => {
            setResultsDraftId(null)
          }}
          onRetry={deliveryControls.onRetryDelivery}
          onRetryDeliverySave={deliveryControls.onRetryDeliverySave}
          onRetryMetadata={deliveryControls.onRetryMetadata}
          signInHref={deliveryControls.signInHref}
          xIntentHref={deliveryControls.xIntentHref}
          xSelected={xSelected}
        />
      ) : (
        <>
          <div data-compose-content className="min-h-0 flex-1 overflow-y-auto">
            {state.isLoading ? (
              <p className="mx-auto max-w-270 p-4 text-sm text-muted-foreground-strong md:px-6 md:py-12">
                Loading drafts…
              </p>
            ) : activeDraft === null ? (
              <div className="mx-auto flex max-w-270 flex-wrap items-center gap-x-3 p-4 text-sm md:px-6 md:py-12">
                <p className="text-muted-foreground-strong">
                  No draft is open.
                </p>
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
                    articleUrl={
                      activeDraft.article?.url ?? activeDraft.source.url
                    }
                    canEdit={canEdit}
                    commonComment={activeDraft.commonComment}
                    destinations={activeDraft.destinations}
                    {...(destinationMetadata === undefined
                      ? {}
                      : { metadata: destinationMetadata })}
                    onDestinationChange={onDestinationChange}
                    onOpenDestinationChange={setOpenDestination}
                    openDestination={openDestination}
                  />
                </section>
              </div>
            )}
          </div>

          <ComposePostBar
            authenticationRequired={deliveryControls.authenticationRequired}
            canPost={canPost}
            deliveryErrorMessage={deliveryControls.deliveryErrorMessage}
            deliveryState={deliveryControls.deliveryState}
            isLoadingMetadata={deliveryControls.isLoadingMetadata}
            metadataErrorMessage={deliveryControls.metadataErrorMessage}
            onPost={deliveryControls.onRequestPublishReview}
            onRetryDeliverySave={deliveryControls.onRetryDeliverySave}
            onRetryMetadata={deliveryControls.onRetryMetadata}
            pendingCount={pendingCount}
            signInHref={deliveryControls.signInHref}
            xSelected={xSelected}
          />
        </>
      )}

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
        <ComposeCheckSheet
          {...prePublishReview}
          onBackToEdit={onCancelPrePublishReview}
          onEditComment={editComment}
          onPost={confirmPost}
          postHref={xOnly ? deliveryControls.xIntentHref : null}
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
