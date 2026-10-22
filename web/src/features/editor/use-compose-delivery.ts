import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'
import { useCallback, useEffect, useState } from 'react'

import {
  createRetryDeliveryPlans,
  getRetryDeliveryTargets,
} from '#features/editor/compose-delivery-command'
import {
  effectiveDestinationComment,
  getDestinationDraft,
} from '#features/editor/compose-destination'
import type { ComposeState } from '#features/editor/compose-state'
import { createXIntent, getDestinations } from '#features/publish/index'

type MetadataError = {
  message: string
  authenticationRequired: boolean
}

export function useComposeDelivery({
  draft,
  state,
  canEdit,
}: {
  draft: BookmarkDraft | null
  state: ComposeState
  canEdit: boolean
}) {
  const [metadata, setMetadata] = useState<DestinationMetadata | null>(null)
  const [metadataError, setMetadataError] = useState<MetadataError | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)

  const loadMetadata = useCallback(() => {
    setIsLoadingMetadata(true)
    void getDestinations().match(
      (destinations) => {
        setMetadata(destinations)
        setMetadataError(null)
        setIsLoadingMetadata(false)
      },
      (error) => {
        setMetadata(null)
        setMetadataError({
          message: error.message,
          authenticationRequired: error.authenticationRequired === true,
        })
        setIsLoadingMetadata(false)
      },
    )
  }, [])

  useEffect(() => {
    loadMetadata()
  }, [loadMetadata])

  const xDestination = getDestinationDraft(draft?.destinations ?? [], 'x')
  const xArticleUrl = draft?.article?.url ?? draft?.source.url ?? null
  const xComment =
    draft === null
      ? ''
      : effectiveDestinationComment(draft.commonComment, xDestination)
  const xIntentHref =
    xArticleUrl === null
      ? null
      : createXIntent({ url: xArticleUrl, comment: xComment }).href
  const canOpenX =
    xDestination.selected &&
    xIntentHref !== null &&
    canEdit &&
    state.saveState === 'saved' &&
    state.deliveryState === 'idle'

  const retryableTargets = draft === null ? [] : getRetryDeliveryTargets(draft)
  const retryPlan =
    draft === null || metadata === null
      ? null
      : createRetryDeliveryPlans(draft, metadata, retryableTargets)
  const canRetryFailed =
    retryPlan !== null &&
    retryPlan.isOk() &&
    canEdit &&
    state.deliveryState === 'idle' &&
    !state.discardOpen
  const authenticationRequired =
    metadataError?.authenticationRequired === true ||
    state.deliveryAuthenticationRequired
  const signInHref =
    authenticationRequired &&
    state.saveState === 'saved' &&
    state.deliveryState === 'idle'
      ? window.location.href
      : null

  return {
    metadata,
    metadataErrorMessage: metadataError?.message ?? null,
    isLoadingMetadata,
    canPublish:
      metadata !== null &&
      canEdit &&
      state.saveState !== 'failed' &&
      state.deliveryState === 'idle' &&
      !state.discardOpen,
    hasRetryableTargets: retryableTargets.length > 0,
    canRetryFailed,
    canOpenX,
    xIntentHref,
    authenticationRequired,
    signInHref,
    deliveryState: state.deliveryState,
    deliveryErrorMessage: state.deliveryErrorMessage,
    onLoadMetadata: loadMetadata,
  }
}
