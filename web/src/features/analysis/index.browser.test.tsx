import type { Article, ShareInput, Summary, Verification } from 'api/contracts'
import { type Result, ResultAsync } from 'neverthrow'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type AnalysisClientError,
  type AnalysisOperations,
  type ArticleAnalysisOptions,
  createManualArticle,
  extractArticle as requestExtractArticle,
  useArticleAnalysis,
  verifyComment as requestVerifyComment,
} from '#features/analysis/index'

const article: Article = {
  url: 'https://fictional.example.invalid/paper-lantern',
  title: 'An invented note',
  text: 'A fictional note says a paper lantern is green.',
  source: 'shared',
  partial: false,
}

const shareInput: ShareInput = {
  version: 1,
  url: article.url,
  title: article.title,
  sharedText: article.text,
  partial: false,
}

const summary: Summary = {
  summary: 'The fictional note describes a green paper lantern.',
  partial: false,
}

const verification: Verification = { issues: [], partial: false }

const options: ArticleAnalysisOptions = {
  draftId: 'fictional-draft-one',
  shareInput,
  article,
  articleRevision: 1,
  comment: { id: 'fictional-comment-one', value: 'The lantern is green.' },
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const resultKind = <T,>(result: Result<T, AnalysisClientError>) =>
  result.match(
    () => 'success',
    (error) => error.kind,
  )

const observe = <T,>(value: T): T => value

const deferred = <T,>() => {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: (value: T) => resolvePromise?.(value),
  }
}

let root: Root | undefined
let current!: ReturnType<typeof useArticleAnalysis>
let container: HTMLDivElement | undefined

const Harness = ({
  value,
  operations,
}: {
  value: ArticleAnalysisOptions
  operations: AnalysisOperations | undefined
}) => {
  current = useArticleAnalysis(value, operations)
  return null
}

const render = (
  value: ArticleAnalysisOptions,
  operations?: AnalysisOperations,
) => {
  act(() => {
    root?.render(<Harness value={value} operations={operations} />)
  })
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  render(options)
})

afterEach(() => {
  if (root !== undefined) {
    act(() => {
      root?.unmount()
    })
  }
  root = undefined
  container?.remove()
  container = undefined
  vi.unstubAllGlobals()
})

describe('useArticleAnalysis', () => {
  it('aborts draft-scoped requests and hides their late success or failure', async () => {
    const pending = [
      deferred<Response>(),
      deferred<Response>(),
      deferred<Response>(),
    ]
    const signals: AbortSignal[] = []
    let requestIndex = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
        if (signal !== undefined && signal !== null) signals.push(signal)
        const request = pending[requestIndex]
        requestIndex += 1
        return request?.promise ?? Promise.resolve(jsonResponse(null, 500))
      }),
    )

    let extractionRequest!: Promise<Result<Article, AnalysisClientError>>
    let summaryRequest!: Promise<Result<Summary, AnalysisClientError>>
    let verificationRequest!: Promise<Result<Verification, AnalysisClientError>>
    await act(async () => {
      extractionRequest = current.extract()
      summaryRequest = current.summarize()
      verificationRequest = current.verify()
      await Promise.resolve()
    })

    render({ ...options, draftId: 'fictional-draft-two' })

    let results!: [
      Result<Article, AnalysisClientError>,
      Result<Summary, AnalysisClientError>,
      Result<Verification, AnalysisClientError>,
    ]
    await act(async () => {
      pending[0]?.resolve(jsonResponse(article))
      pending[1]?.resolve(jsonResponse(summary))
      pending[2]?.resolve(
        jsonResponse(
          { error: { code: 'busy', message: 'Fixture error.' } },
          503,
        ),
      )
      results = await Promise.all([
        extractionRequest,
        summaryRequest,
        verificationRequest,
      ])
    })

    expect(
      observe({
        states: {
          extraction: current.extraction,
          summary: current.summary,
          verification: current.verification,
        },
        results: [
          resultKind(results[0]),
          resultKind(results[1]),
          resultKind(results[2]),
        ],
        aborted: signals.map((signal) => signal.aborted),
      }),
    ).toEqual({
      states: {
        extraction: { status: 'stale' },
        summary: { status: 'stale' },
        verification: { status: 'stale' },
      },
      results: ['cancelled', 'cancelled', 'cancelled'],
      aborted: [true, true, true],
    })
  })

  it('suppresses verification results when the comment value or identifier changes', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const pending = [first, second]
    const signals: AbortSignal[] = []
    let requestIndex = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal
        if (signal !== undefined && signal !== null) signals.push(signal)
        const request = pending[requestIndex]
        requestIndex += 1
        return request?.promise ?? Promise.resolve(jsonResponse(null, 500))
      }),
    )

    let firstRequest!: Promise<Result<Verification, AnalysisClientError>>
    await act(async () => {
      firstRequest = current.verify()
      await Promise.resolve()
    })
    render({
      ...options,
      comment: {
        id: options.comment?.id ?? '',
        value: 'A changed fictional claim.',
      },
    })

    let firstResult!: Result<Verification, AnalysisClientError>
    await act(async () => {
      first.resolve(jsonResponse(verification))
      firstResult = await firstRequest
    })

    let secondRequest!: Promise<Result<Verification, AnalysisClientError>>
    await act(async () => {
      secondRequest = current.verify()
      await Promise.resolve()
    })
    render({
      ...options,
      comment: {
        id: 'fictional-comment-two',
        value: 'A changed fictional claim.',
      },
    })

    let secondResult!: Result<Verification, AnalysisClientError>
    await act(async () => {
      second.resolve(jsonResponse(verification))
      secondResult = await secondRequest
    })

    expect(
      observe({
        state: current.verification,
        results: [resultKind(firstResult), resultKind(secondResult)],
        aborted: signals.map((signal) => signal.aborted),
      }),
    ).toEqual({
      state: { status: 'stale' },
      results: ['cancelled', 'cancelled'],
      aborted: [true, true],
    })
  })

  it('does not restore a completed result after returning to its old article revision', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(summary))),
    )

    let result!: Result<Summary, AnalysisClientError>
    await act(async () => {
      result = await current.summarize()
    })

    render({ ...options, articleRevision: 2 })
    render(options)

    expect(
      observe({ result: resultKind(result), state: current.summary }),
    ).toEqual({
      result: 'success',
      state: { status: 'stale' },
    })
  })

  it('cancels an unabortable result after an article revision changes from A to B to A', async () => {
    const pending = deferred<Summary>()
    const signals: AbortSignal[] = []
    const operations: AnalysisOperations = {
      extractArticle: requestExtractArticle,
      summarizeArticle: (_article, requestOptions) => {
        if (requestOptions?.signal !== undefined) {
          signals.push(requestOptions.signal)
        }
        return ResultAsync.fromSafePromise(pending.promise)
      },
      verifyComment: requestVerifyComment,
    }

    render(options, operations)

    let request!: Promise<Result<Summary, AnalysisClientError>>
    await act(async () => {
      request = current.summarize()
      await Promise.resolve()
    })
    render({ ...options, articleRevision: 2 }, operations)
    render(options, operations)

    let result!: Result<Summary, AnalysisClientError>
    await act(async () => {
      pending.resolve(summary)
      result = await request
    })

    expect(
      observe({
        result: resultKind(result),
        state: current.summary,
        aborted: signals.map((signal) => signal.aborted),
      }),
    ).toEqual({
      result: 'cancelled',
      state: { status: 'stale' },
      aborted: [true],
    })
  })

  it('cancels and retries a summary without accepting the old response', async () => {
    const pending = [deferred<Summary>(), deferred<Summary>()]
    const signals: AbortSignal[] = []
    let requestIndex = 0
    const operations: AnalysisOperations = {
      extractArticle: requestExtractArticle,
      summarizeArticle: (_article, requestOptions) => {
        if (requestOptions?.signal !== undefined) {
          signals.push(requestOptions.signal)
        }
        const request = pending[requestIndex]
        requestIndex += 1
        return ResultAsync.fromSafePromise(
          request?.promise ?? Promise.resolve(summary),
        )
      },
      verifyComment: requestVerifyComment,
    }
    render(options, operations)

    let cancelledRequest!: Promise<Result<Summary, AnalysisClientError>>
    await act(async () => {
      cancelledRequest = current.summarize()
      await Promise.resolve()
    })
    act(() => {
      current.cancelSummary()
    })

    let retryRequest!: Promise<Result<Summary, AnalysisClientError>>
    await act(async () => {
      retryRequest = current.summarize()
      await Promise.resolve()
    })

    let cancelledResult!: Result<Summary, AnalysisClientError>
    await act(async () => {
      pending[0]?.resolve(summary)
      cancelledResult = await cancelledRequest
    })
    const stateAfterOldSuccess = current.summary

    let retryResult!: Result<Summary, AnalysisClientError>
    await act(async () => {
      pending[1]?.resolve(summary)
      retryResult = await retryRequest
    })

    expect(
      observe({
        cancelled: resultKind(cancelledResult),
        retry: resultKind(retryResult),
        stateAfterOldSuccess,
        state: current.summary,
        aborted: signals.map((signal) => signal.aborted),
        requestCount: requestIndex,
      }),
    ).toEqual({
      cancelled: 'cancelled',
      retry: 'success',
      stateAfterOldSuccess: { status: 'loading' },
      state: { status: 'success', value: summary },
      aborted: [true, false],
      requestCount: 2,
    })
  })

  it('creates manual articles at the contract limit as partial values', () => {
    const text = 'x'.repeat(100_000)
    const result = createManualArticle({
      url: 'https://fictional.example.invalid/manual-note',
      title: 'An invented manual note',
      text,
    })

    expect(
      result.match(
        (value) => value,
        (error) => error,
      ),
    ).toEqual({
      url: 'https://fictional.example.invalid/manual-note',
      title: 'An invented manual note',
      text,
      source: 'manual',
      partial: true,
    })
  })

  it('rejects over-limit manual article text without truncating it', () => {
    const result = createManualArticle({
      url: 'https://fictional.example.invalid/manual-note',
      title: 'An invented manual note',
      text: 'x'.repeat(100_001),
    })

    expect(
      result.match(
        (value) => value,
        (error) => error,
      ),
    ).toEqual({
      kind: 'invalid-input',
      message: 'The request does not match the article analysis contract.',
    })
  })
})
