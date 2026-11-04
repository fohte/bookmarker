import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getPendingDeliveryComments,
  type PendingDeliveryComment,
} from '#features/editor/compose-delivery-command'
import {
  createInitialPublishCommentChecks,
  type PrePublishReview,
  type PublishCommentCheck,
} from '#features/editor/compose-pre-publish'

type UseComposePrePublishReviewOptions = {
  draft: BookmarkDraft | null
  metadata: DestinationMetadata | null
  verifyComments: (
    comments: PendingDeliveryComment[],
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
    const initialChecks = createInitialPublishCommentChecks(comments)
    setReview({
      status: 'checking',
      checks: initialChecks,
    })
    void verifyComments(comments, operation.signal).then(
      (checks) => {
        if (operation.signal.aborted) return
        setReview({ status: 'complete', checks })
      },
      (error: unknown) => {
        if (operation.signal.aborted) return
        const message =
          error instanceof Error && error.message.length > 0
            ? error.message
            : 'The comment check could not be completed.'
        setReview({
          status: 'complete',
          checks: initialChecks.map((check) =>
            check.status === 'skipped'
              ? check
              : {
                  ...check,
                  status: 'failed',
                  verification: null,
                  error: message,
                },
          ),
        })
      },
    )
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
