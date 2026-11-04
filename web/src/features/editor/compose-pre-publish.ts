import type { Verification } from 'api/contracts'

import type { PendingDeliveryComment } from '#features/editor/compose-delivery-command'

export type PublishCommentCheck = PendingDeliveryComment & {
  status: 'checking' | 'success' | 'failed' | 'skipped'
  verification: Verification | null
  error: string | null
}

export type PrePublishReview = {
  status: 'checking' | 'complete'
  checks: PublishCommentCheck[]
}

export const createInitialPublishCommentChecks = (
  comments: PendingDeliveryComment[],
): PublishCommentCheck[] =>
  comments.map((comment) => ({
    ...comment,
    status: comment.comment.trim().length === 0 ? 'skipped' : 'checking',
    verification: null,
    error: null,
  }))
