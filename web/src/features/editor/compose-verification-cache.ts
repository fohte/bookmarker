import type { Article, BookmarkDraft, Verification } from 'api/contracts'

import type { ComposeAnalysisSaveCommand } from '#features/editor/compose-analysis-command'

export const verificationCacheKey = (
  draftId: string,
  article: Article,
  comment: string,
): string => JSON.stringify([draftId, article, comment])

export const rememberVerification = (
  cache: Map<string, Verification>,
  draftId: string,
  article: Article,
  comment: string,
  verification: Verification,
): void => {
  cache.set(verificationCacheKey(draftId, article, comment), verification)
}

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
