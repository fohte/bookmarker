import type { Article, BookmarkDraft, Verification } from 'api/contracts'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type AnalysisClientError,
  type AnalysisOperations,
  type AnalysisState,
  type ArticleAnalysisOptions,
  createManualArticle,
  extractArticle as extractArticleRequest,
  summarizeArticle as summarizeArticleRequest,
  useArticleAnalysis,
  verifyComment as verifyCommentRequest,
} from '#features/analysis/index'
import {
  type ComposeAnalysisSaveCommand,
  sameArticle,
} from '#features/editor/compose-analysis-command'
import type { AnalysisDisplayState } from '#features/editor/compose-analysis-state'
import { commentCheckErrorMessage } from '#features/editor/compose-comment-check-error'
import type { PendingDeliveryComment } from '#features/editor/compose-delivery-command'
import {
  createInitialPublishCommentChecks,
  type PublishCommentCheck,
} from '#features/editor/compose-pre-publish'
import {
  rememberVerification,
  saveCommonVerificationResult,
  verificationCacheKey,
} from '#features/editor/compose-verification-cache'

type PendingSummary = {
  draftId: string
  previousArticle: Article
  article: Article
}

const analysisOperations = {
  extractArticle: extractArticleRequest,
  summarizeArticle: summarizeArticleRequest,
  verifyComment: verifyCommentRequest,
}
const displayState = <T>(state: AnalysisState<T>): AnalysisDisplayState => {
  switch (state.status) {
    case 'idle':
      return 'not-requested'
    case 'loading':
      return 'loading'
    case 'success':
      return 'success'
    case 'stale':
      return 'stale'
    case 'error':
      return displayErrorState(state.error)
  }
}

const displayErrorState = (
  error: AnalysisClientError,
): AnalysisDisplayState => {
  if (error.kind === 'http' && error.status === 503) return 'unavailable'
  if (error.kind === 'authentication-required') {
    return 'authentication-required'
  }
  if (error.kind === 'http') {
    if (error.code === 'ARTICLE_INSUFFICIENT') return 'insufficient'
    if (
      error.code === 'ANALYSIS_TIMEOUT' ||
      error.code === 'ARTICLE_FETCH_TIMEOUT'
    ) {
      return 'timeout'
    }
    if (
      error.code === 'INVALID_ANALYSIS_RESPONSE' ||
      error.code === 'ANALYSIS_UPSTREAM_FAILURE'
    ) {
      return 'invalid-response'
    }
  }
  return 'failed'
}

const displayStoredState = <T>(
  state: AnalysisState<T>,
  hasStoredValue: boolean,
): AnalysisDisplayState => {
  if (state.status === 'loading' || state.status === 'error') {
    return displayState(state)
  }
  return hasStoredValue ? 'success' : displayState(state)
}

const manualArticleForAnalysis = (article: Article | undefined) => {
  if (article === undefined) return null
  if (article.source !== 'manual') return article

  return createManualArticle({
    url: article.url,
    title: article.title,
    text: article.text,
  }).match(
    (manualArticle) =>
      sameArticle(manualArticle, article) ? manualArticle : null,
    () => null,
  )
}

export function useComposeAnalysis(
  {
    draft,
    canEdit,
    autoAnalyzeDraftId,
    saveAnalysisResult,
  }: {
    draft: BookmarkDraft | null
    canEdit: boolean
    autoAnalyzeDraftId: string | null
    saveAnalysisResult: (command: ComposeAnalysisSaveCommand) => boolean
  },
  operations: AnalysisOperations = analysisOperations,
) {
  const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(
    null,
  )
  const autoExtractionStarted = useRef(new Set<string>())
  const autoSummaryStarted = useRef(new Set<string>())
  const verificationCache = useRef(new Map<string, Verification>())

  const article = useMemo(
    () => manualArticleForAnalysis(draft?.article),
    [draft?.article],
  )
  const analysisOptions: ArticleAnalysisOptions = {
    draftId: draft?.id ?? '',
    shareInput: draft?.source ?? null,
    article,
    articleRevision: article === null ? '' : JSON.stringify(article),
  }
  const analysis = useArticleAnalysis(analysisOptions, operations)

  useEffect(() => {
    verificationCache.current.clear()
  }, [draft?.id])

  useEffect(() => {
    if (canEdit) return
    analysis.cancelAll()
  }, [analysis.cancelAll, canEdit])

  const extractArticle = useCallback(
    async (summarizeAfterExtract: boolean) => {
      const expectedArticle = draft?.article
      if (
        draft === null ||
        !canEdit ||
        expectedArticle === undefined ||
        article === null
      ) {
        return
      }

      const result = await analysis.extract()
      result.match(
        (extractedArticle) => {
          const accepted = saveAnalysisResult({
            kind: 'article',
            expectedDraftId: draft.id,
            expectedArticle,
            expectedSource: draft.source,
            article: extractedArticle,
          })
          if (accepted && summarizeAfterExtract) {
            setPendingSummary({
              draftId: draft.id,
              previousArticle: expectedArticle,
              article: extractedArticle,
            })
          }
        },
        () => undefined,
      )
    },
    [analysis.extract, article, canEdit, draft, saveAnalysisResult],
  )

  useEffect(() => {
    if (
      autoAnalyzeDraftId === null ||
      autoAnalyzeDraftId !== draft?.id ||
      !canEdit ||
      draft.analysis?.summary !== undefined ||
      autoExtractionStarted.current.has(autoAnalyzeDraftId)
    ) {
      return
    }

    let active = true
    queueMicrotask(() => {
      if (!active || autoExtractionStarted.current.has(autoAnalyzeDraftId)) {
        return
      }

      autoExtractionStarted.current.add(autoAnalyzeDraftId)
      void extractArticle(true)
    })

    return () => {
      active = false
    }
  }, [autoAnalyzeDraftId, canEdit, draft, extractArticle])

  useEffect(() => {
    if (pendingSummary === null) return
    if (!canEdit || draft?.id !== pendingSummary.draftId) {
      setPendingSummary(null)
      return
    }

    const currentArticle = draft.article
    if (currentArticle === undefined) {
      setPendingSummary(null)
      return
    }
    if (!sameArticle(currentArticle, pendingSummary.article)) {
      if (sameArticle(currentArticle, pendingSummary.previousArticle)) return
      setPendingSummary(null)
      return
    }

    const runKey = JSON.stringify([
      pendingSummary.draftId,
      pendingSummary.article,
    ])
    if (autoSummaryStarted.current.has(runKey)) {
      setPendingSummary(null)
      return
    }
    autoSummaryStarted.current.add(runKey)
    setPendingSummary(null)

    void analysis.summarize().then((result) => {
      result.match(
        (summary) => {
          saveAnalysisResult({
            kind: 'summary',
            expectedDraftId: pendingSummary.draftId,
            expectedArticle: pendingSummary.article,
            summary,
          })
        },
        () => undefined,
      )
    })
  }, [analysis.summarize, canEdit, draft, pendingSummary, saveAnalysisResult])

  const summarizeArticle = useCallback(async () => {
    if (draft === null || !canEdit || article === null) return
    const result = await analysis.summarize()
    result.match(
      (summary) => {
        saveAnalysisResult({
          kind: 'summary',
          expectedDraftId: draft.id,
          expectedArticle: article,
          summary,
        })
      },
      () => undefined,
    )
  }, [analysis.summarize, article, canEdit, draft, saveAnalysisResult])

  const verifyPublishComments = useCallback(
    async (
      comments: PendingDeliveryComment[],
      signal: AbortSignal,
    ): Promise<PublishCommentCheck[]> => {
      if (draft === null) return []

      const initialChecks = createInitialPublishCommentChecks(
        comments,
        ({ comment }) =>
          article === null
            ? JSON.stringify([draft.id, comment])
            : verificationCacheKey(draft.id, article, comment),
      )
      return Promise.all(
        initialChecks.map(async (item): Promise<PublishCommentCheck> => {
          if (item.status === 'skipped') return item
          if (article === null || article.text.trim().length === 0) {
            return {
              ...item,
              status: 'failed',
              verification: null,
              error: 'Article text is unavailable for comment checking.',
            }
          }

          const key = verificationCacheKey(draft.id, article, item.comment)
          const cached = verificationCache.current.get(key)
          if (cached !== undefined) {
            return {
              ...item,
              status: 'success',
              verification: cached,
              error: null,
            }
          }
          if (signal.aborted) {
            return {
              ...item,
              status: 'failed',
              verification: null,
              error: 'The comment check was cancelled.',
            }
          }

          const result = await operations.verifyComment(article, item.comment, {
            signal,
          })
          return result.match(
            (verification) => {
              rememberVerification(
                verificationCache.current,
                draft.id,
                article,
                item.comment,
                verification,
              )
              if (item.commentTargetIds.includes('common')) {
                saveCommonVerificationResult(
                  saveAnalysisResult,
                  draft,
                  article,
                  item.comment,
                  verification,
                )
              }
              return {
                ...item,
                status: 'success',
                verification,
                error: null,
              }
            },
            (error) => ({
              ...item,
              status: 'failed',
              verification: null,
              error: commentCheckErrorMessage(error),
            }),
          )
        }),
      )
    },
    [article, draft, operations, saveAnalysisResult],
  )

  const storedSummary = draft?.analysis?.summary
  const summary =
    analysis.summary.status === 'success'
      ? analysis.summary.value
      : (storedSummary ?? null)
  const summaryState = displayStoredState(
    analysis.summary,
    storedSummary !== undefined,
  )
  return {
    article,
    extractionState: displayState(analysis.extraction),
    summary,
    summaryState,
    onExtractArticle: () => extractArticle(autoAnalyzeDraftId === draft?.id),
    onSummarizeArticle: summarizeArticle,
    onVerifyPublishComments: verifyPublishComments,
  }
}
