import type { Article, ShareInput, Summary, Verification } from 'api/contracts'
import { errAsync, type Result, type ResultAsync } from 'neverthrow'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  type AnalysisClientError,
  extractArticle,
  summarizeArticle,
  verifyComment,
} from '#features/analysis/client'

export type AnalysisState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; value: T }
  | { status: 'error'; error: AnalysisClientError }
  | { status: 'stale' }

export type ArticleAnalysisOptions = {
  draftId: string
  shareInput: ShareInput | null
  article: Article | null
  articleRevision: string | number
  comment: { id: string; value: string } | null
}

type StoredState<T> = {
  key: string
  state: AnalysisState<T>
}

type Operation = {
  generation: number
  controller: AbortController | undefined
}

type StateSetter<T> = Dispatch<SetStateAction<StoredState<T> | null>>

const idleState: AnalysisState<never> = { status: 'idle' }
const staleState: AnalysisState<never> = { status: 'stale' }

const invalidInputError: AnalysisClientError = {
  kind: 'invalid-input',
  message: 'The request does not match the article analysis contract.',
}

const errorAsync = <T>(): ResultAsync<T, AnalysisClientError> =>
  errAsync<T, AnalysisClientError>(invalidInputError)

const invalidate = (operation: Operation): boolean => {
  const wasRunning = operation.controller !== undefined
  operation.generation += 1
  operation.controller?.abort()
  operation.controller = undefined
  return wasRunning
}

const stateForKey = <T>(
  stored: StoredState<T> | null,
  key: string,
): AnalysisState<T> => {
  if (stored === null) return idleState
  return stored.key === key ? stored.state : staleState
}

const carryStateToKey = <T>(setState: StateSetter<T>, key: string): void => {
  setState((stored) =>
    stored === null || stored.key === key ? stored : { key, state: staleState },
  )
}

const cancelOperation = <T>(
  operation: Operation,
  setState: StateSetter<T>,
): void => {
  if (!invalidate(operation)) return

  setState((stored) =>
    stored === null || stored.state.status !== 'loading'
      ? stored
      : { key: stored.key, state: staleState },
  )
}

const runOperation = async <T>(
  operation: Operation,
  key: string,
  setState: StateSetter<T>,
  execute: (signal: AbortSignal) => ResultAsync<T, AnalysisClientError>,
): Promise<Result<T, AnalysisClientError>> => {
  operation.generation += 1
  operation.controller?.abort()

  const generation = operation.generation
  const controller = new AbortController()
  operation.controller = controller
  setState({ key, state: { status: 'loading' } })

  const result = await execute(controller.signal)
  if (operation.generation === generation) {
    operation.controller = undefined
    const state = result.match<AnalysisState<T>>(
      (value) => ({ status: 'success', value }),
      (error) =>
        error.kind === 'cancelled' ? staleState : { status: 'error', error },
    )
    setState({ key, state })
  }

  return result
}

export const useArticleAnalysis = ({
  draftId,
  shareInput,
  article,
  articleRevision,
  comment,
}: ArticleAnalysisOptions) => {
  const [extractionStored, setExtractionStored] =
    useState<StoredState<Article> | null>(null)
  const [summaryStored, setSummaryStored] =
    useState<StoredState<Summary> | null>(null)
  const [verificationStored, setVerificationStored] =
    useState<StoredState<Verification> | null>(null)

  const extractionOperation = useRef<Operation>({
    generation: 0,
    controller: undefined,
  })
  const summaryOperation = useRef<Operation>({
    generation: 0,
    controller: undefined,
  })
  const verificationOperation = useRef<Operation>({
    generation: 0,
    controller: undefined,
  })

  const extractionKey = JSON.stringify([draftId, shareInput])
  const summaryKey = JSON.stringify([draftId, articleRevision, article])
  const verificationKey = JSON.stringify([
    draftId,
    articleRevision,
    article,
    comment?.id ?? null,
    comment?.value ?? null,
  ])

  useEffect(() => {
    carryStateToKey(setExtractionStored, extractionKey)
    return () => {
      invalidate(extractionOperation.current)
    }
  }, [extractionKey])
  useEffect(() => {
    carryStateToKey(setSummaryStored, summaryKey)
    return () => {
      invalidate(summaryOperation.current)
    }
  }, [summaryKey])
  useEffect(() => {
    carryStateToKey(setVerificationStored, verificationKey)
    return () => {
      invalidate(verificationOperation.current)
    }
  }, [verificationKey])

  const extract = useCallback(
    () =>
      runOperation(
        extractionOperation.current,
        extractionKey,
        setExtractionStored,
        (signal) =>
          shareInput === null
            ? errorAsync<Article>()
            : extractArticle(shareInput, { signal }),
      ),
    [extractionKey, shareInput],
  )

  const summarize = useCallback(
    () =>
      runOperation(
        summaryOperation.current,
        summaryKey,
        setSummaryStored,
        (signal) =>
          article === null
            ? errorAsync<Summary>()
            : summarizeArticle(article, { signal }),
      ),
    [article, summaryKey],
  )

  const verify = useCallback(
    () =>
      runOperation(
        verificationOperation.current,
        verificationKey,
        setVerificationStored,
        (signal) =>
          article === null || comment === null
            ? errorAsync<Verification>()
            : verifyComment(article, comment.value, { signal }),
      ),
    [article, comment, verificationKey],
  )

  const cancelExtraction = useCallback(() => {
    cancelOperation(extractionOperation.current, setExtractionStored)
  }, [])
  const cancelSummary = useCallback(() => {
    cancelOperation(summaryOperation.current, setSummaryStored)
  }, [])
  const cancelVerification = useCallback(() => {
    cancelOperation(verificationOperation.current, setVerificationStored)
  }, [])
  const cancelAll = useCallback(() => {
    cancelExtraction()
    cancelSummary()
    cancelVerification()
  }, [cancelExtraction, cancelSummary, cancelVerification])

  return {
    extraction: stateForKey(extractionStored, extractionKey),
    summary: stateForKey(summaryStored, summaryKey),
    verification: stateForKey(verificationStored, verificationKey),
    extract,
    summarize,
    verify,
    cancelExtraction,
    cancelSummary,
    cancelVerification,
    cancelAll,
  }
}
