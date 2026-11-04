import type { Article, BookmarkDraft, Verification } from 'api/contracts'

import type { ComposeAnalysisSaveCommand } from '#features/editor/compose-analysis-command'
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

export const verificationCacheKey = (
  draftId: string,
  article: Article,
  comment: string,
): string => JSON.stringify([draftId, article, comment])

export const saveCommonVerificationResult = (
  saveAnalysisResult: (command: ComposeAnalysisSaveCommand) => boolean,
  draft: BookmarkDraft,
  article: Article,
  comment: string,
  verification: Verification,
): void => {
  if (draft.commonComment !== comment) return

  saveAnalysisResult({
    kind: 'verification',
    expectedDraftId: draft.id,
    expectedArticle: article,
    expectedComment: { id: 'common', value: comment },
    verification,
  })
}
