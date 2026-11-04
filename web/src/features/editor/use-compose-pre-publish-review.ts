import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getPendingDeliveryComments } from '#features/editor/compose-delivery-command'
import {
  createInitialPublishCommentChecks,
  type PrePublishReview,
  type PublishCommentCheck,
} from '#features/editor/compose-pre-publish'

type UseComposePrePublishReviewOptions = {
  draft: BookmarkDraft | null
  metadata: DestinationMetadata | null
  verifyComments: (
    comments: ReturnType<typeof getPendingDeliveryComments>,
    signal: AbortSignal,
  ) => Promise<PublishCommentCheck[]>
  publish: (metadata: DestinationMetadata) => void
}

export function useComposePrePublishReview({
  draft,
  metadata,
  verifyComments,
  publish,
}: UseComposePrePublishReviewOptions) {
  const [review, setReview] = useState<PrePublishReview | null>(null)
  const controller = useRef<AbortController | null>(null)
  const started = useRef(false)

  const requestReview = useCallback(() => {
    if (draft === null || metadata === null || started.current) return

    started.current = true
    const operation = new AbortController()
    controller.current = operation
    const comments = getPendingDeliveryComments(draft)
    setReview({
      status: 'checking',
      checks: createInitialPublishCommentChecks(comments),
    })
    void verifyComments(comments, operation.signal).then((checks) => {
      if (operation.signal.aborted) return
      setReview({ status: 'complete', checks })
    })
  }, [draft, metadata, verifyComments])

  const cancelReview = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    started.current = false
    setReview(null)
  }, [])

  const publishAfterReview = useCallback(() => {
    if (review?.status !== 'complete' || metadata === null) return

    controller.current = null
    started.current = false
    setReview(null)
    publish(metadata)
  }, [metadata, publish, review])

  useEffect(
    () => () => {
      controller.current?.abort()
    },
    [],
  )

  return {
    review,
    requestReview,
    cancelReview,
    publishAfterReview,
  }
}
