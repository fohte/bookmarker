import type { Article, BookmarkDraft, DestinationId } from 'api/contracts'
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
import { effectiveDestinationComment } from '#features/editor/compose-destination'

type VerificationTarget =
  | { id: 'common'; kind: 'common'; label: string; value: string }
  | {
      id: `destination:${DestinationId}`
      kind: 'custom'
      label: string
      value: string
    }

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
  const [selectedTargetId, setSelectedTargetId] = useState('common')
  const [pendingSummary, setPendingSummary] = useState<PendingSummary | null>(
    null,
  )
  const autoExtractionStarted = useRef(new Set<string>())
  const autoSummaryStarted = useRef(new Set<string>())

  const article = useMemo(
    () => manualArticleForAnalysis(draft?.article),
    [draft?.article],
  )
  const targets = useMemo<VerificationTarget[]>(() => {
    if (draft === null) return []

    return [
      {
        id: 'common',
        kind: 'common',
        label: 'Common comment',
        value: draft.commonComment,
      },
      ...draft.destinations.flatMap((destination) =>
        destination.commentMode === 'custom'
          ? [
              {
                id: `destination:${destination.destination}` as const,
                kind: 'custom' as const,
                label: `${destination.destination} custom comment`,
                value: effectiveDestinationComment(
                  draft.commonComment,
                  destination,
                ),
              },
            ]
          : [],
      ),
    ]
  }, [draft])
  const target =
    targets.find((item) => item.id === selectedTargetId) ?? targets[0] ?? null
  const analysisOptions: ArticleAnalysisOptions = {
    draftId: draft?.id ?? '',
    shareInput: draft?.source ?? null,
    article,
    articleRevision: article === null ? '' : JSON.stringify(article),
    comment: target === null ? null : { id: target.id, value: target.value },
  }
  const analysis = useArticleAnalysis(analysisOptions, operations)

  useEffect(() => {
    setSelectedTargetId('common')
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

  const verifyComment = useCallback(async () => {
    if (draft === null || !canEdit || article === null || target === null) {
      return
    }
    const result = await analysis.verify()
    if (target.kind !== 'common') return

    result.match(
      (verification) => {
        saveAnalysisResult({
          kind: 'verification',
          expectedDraftId: draft.id,
          expectedArticle: article,
          expectedComment: { id: 'common', value: target.value },
          verification,
        })
      },
      () => undefined,
    )
  }, [analysis.verify, article, canEdit, draft, saveAnalysisResult, target])

  const storedSummary = draft?.analysis?.summary
  const summary =
    analysis.summary.status === 'success'
      ? analysis.summary.value
      : (storedSummary ?? null)
  const summaryState = displayStoredState(
    analysis.summary,
    storedSummary !== undefined,
  )
  const storedVerification =
    target?.kind === 'common' ? draft?.analysis?.verification : undefined
  const verification =
    analysis.verification.status === 'success'
      ? analysis.verification.value
      : (storedVerification ?? null)
  const verificationState = displayStoredState(
    analysis.verification,
    storedVerification !== undefined,
  )

  return {
    article,
    extractionState: displayState(analysis.extraction),
    summary,
    summaryState,
    verification,
    verificationState,
    isCustomComment: target?.kind === 'custom',
    canVerifyComment: (target?.value.trim().length ?? 0) > 0,
    verificationTargets: targets.map(({ id, label }) => ({ id, label })),
    selectedVerificationTargetId: target?.id ?? 'common',
    onVerificationTargetChange: setSelectedTargetId,
    onExtractArticle: () => extractArticle(autoAnalyzeDraftId === draft?.id),
    onSummarizeArticle: summarizeArticle,
    onVerifyComment: verifyComment,
  }
}
