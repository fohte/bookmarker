import type { Article, ShareInput, Summary, Verification } from 'api/contracts'
import type { Result, ResultAsync } from 'neverthrow'
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
  invalidInputAsync,
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

type AnalysisOperations = {
  extractArticle: typeof extractArticle
  summarizeArticle: typeof summarizeArticle
  verifyComment: typeof verifyComment
}

const defaultOperations: AnalysisOperations = {
  extractArticle,
  summarizeArticle,
  verifyComment,
}

const idleState: AnalysisState<never> = { status: 'idle' }
const staleState: AnalysisState<never> = { status: 'stale' }

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

const useAnalysisOperation = <T>(key: string) => {
  const [stored, setStored] = useState<StoredState<T> | null>(null)
  const operation = useRef<Operation>({ generation: 0, controller: undefined })

  useEffect(() => {
    carryStateToKey(setStored, key)
    return () => {
      invalidate(operation.current)
    }
  }, [key])

  const run = useCallback(
    (execute: (signal: AbortSignal) => ResultAsync<T, AnalysisClientError>) =>
      runOperation(operation.current, key, setStored, execute),
    [key],
  )
  const cancel = useCallback(() => {
    cancelOperation(operation.current, setStored)
  }, [])

  return { state: stateForKey(stored, key), run, cancel }
}

export const useArticleAnalysis = (
  {
    draftId,
    shareInput,
    article,
    articleRevision,
    comment,
  }: ArticleAnalysisOptions,
  operations: AnalysisOperations = defaultOperations,
) => {
  const extractionKey = JSON.stringify([draftId, shareInput])
  const summaryKey = JSON.stringify([draftId, articleRevision, article])
  const verificationKey = JSON.stringify([
    draftId,
    articleRevision,
    article,
    comment?.id ?? null,
    comment?.value ?? null,
  ])

  const extraction = useAnalysisOperation<Article>(extractionKey)
  const summary = useAnalysisOperation<Summary>(summaryKey)
  const verification = useAnalysisOperation<Verification>(verificationKey)

  const extract = useCallback(
    () =>
      extraction.run((signal) =>
        shareInput === null
          ? invalidInputAsync<Article>()
          : operations.extractArticle(shareInput, { signal }),
      ),
    [extraction.run, operations, shareInput],
  )

  const summarize = useCallback(
    () =>
      summary.run((signal) =>
        article === null
          ? invalidInputAsync<Summary>()
          : operations.summarizeArticle(article, { signal }),
      ),
    [article, operations, summary.run],
  )

  const verify = useCallback(
    () =>
      verification.run((signal) =>
        article === null || comment === null
          ? invalidInputAsync<Verification>()
          : operations.verifyComment(article, comment.value, { signal }),
      ),
    [article, comment, operations, verification.run],
  )

  const cancelAll = useCallback(() => {
    extraction.cancel()
    summary.cancel()
    verification.cancel()
  }, [extraction.cancel, summary.cancel, verification.cancel])

  return {
    extraction: extraction.state,
    summary: summary.state,
    verification: verification.state,
    extract,
    summarize,
    verify,
    cancelExtraction: extraction.cancel,
    cancelSummary: summary.cancel,
    cancelVerification: verification.cancel,
    cancelAll,
  }
}
