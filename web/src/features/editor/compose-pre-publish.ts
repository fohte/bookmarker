import type { DestinationId, Verification } from 'api/contracts'

import type { PendingDeliveryComment } from '#features/editor/compose-delivery-command'

export type PendingDeliveryCommentGroup = {
  destinations: DestinationId[]
  commentTargetIds: string[]
  comment: string
}

export type PublishCommentCheck = PendingDeliveryCommentGroup & {
  status: 'checking' | 'success' | 'failed' | 'skipped'
  verification: Verification | null
  error: string | null
}

export type PrePublishReview = {
  status: 'checking' | 'complete'
  checks: PublishCommentCheck[]
}

const groupPendingDeliveryComments = (
  comments: PendingDeliveryComment[],
  keyForComment: (comment: PendingDeliveryComment) => string = ({ comment }) =>
    comment,
): PendingDeliveryCommentGroup[] => {
  const groups = new Map<string, PendingDeliveryCommentGroup>()

  for (const comment of comments) {
    const key = keyForComment(comment)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, {
        destinations: [comment.destination],
        commentTargetIds: [comment.commentTargetId],
        comment: comment.comment,
      })
      continue
    }
    if (!group.destinations.includes(comment.destination)) {
      group.destinations.push(comment.destination)
    }
    if (!group.commentTargetIds.includes(comment.commentTargetId)) {
      group.commentTargetIds.push(comment.commentTargetId)
    }
  }

  return [...groups.values()]
}

export const createInitialPublishCommentChecks = (
  comments: PendingDeliveryComment[],
  keyForComment?: (comment: PendingDeliveryComment) => string,
): PublishCommentCheck[] =>
  groupPendingDeliveryComments(comments, keyForComment).map((comment) => ({
    ...comment,
    status: comment.comment.trim().length === 0 ? 'skipped' : 'checking',
    verification: null,
    error: null,
  }))
