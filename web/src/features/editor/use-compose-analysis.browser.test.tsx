import type {
  Article,
  BookmarkDraft,
  ShareInput,
  Summary,
  Verification,
} from 'api/contracts'
import { act, StrictMode, useCallback, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComposeAnalysisSaveCommand } from '#features/editor/compose-analysis-command'
import { useComposeAnalysis } from '#features/editor/use-compose-analysis'

const article: Article = {
  url: 'https://fictional.example.invalid/paper-kite',
  title: 'The invented kite note',
  text: 'A fictional note describes a paper kite with a violet tail.',
  source: 'shared',
  partial: true,
}

const extractedArticle: Article = {
  ...article,
  title: 'The violet paper kite',
}

const shareInput: ShareInput = {
  version: 1,
  url: article.url,
  title: article.title,
  sharedText: article.text,
  partial: true,
}

const summary: Summary = {
  summary: 'The fictional note describes a violet-tailed paper kite.',
  partial: true,
}

const savedCommonVerification: Verification = {
  issues: [
    {
      kind: 'uncertain',
      quote: 'The paper kite is blue.',
      reason: 'The fictional note does not describe a blue tail.',
    },
  ],
  partial: true,
}

const freshCommonVerification: Verification = {
  issues: [
    {
      kind: 'error',
      quote: 'The paper kite is blue.',
      reason: 'The fictional note describes a violet tail.',
      evidence: 'A paper kite with a violet tail.',
    },
  ],
  partial: true,
}

const customVerification: Verification = {
  issues: [
    {
      kind: 'unsupported',
      quote: 'The paper kite has a golden tail.',
      reason: 'The fictional note does not support that color.',
    },
  ],
  partial: true,
}

const draft = (
  analysis = { verification: savedCommonVerification },
): BookmarkDraft => ({
  version: 1,
  id: '00000000-0000-4000-8000-000000000101',
  source: shareInput,
  article,
  commonComment: 'The paper kite is blue.',
  destinations: [
    {
      destination: 'hatena',
      selected: true,
      commentMode: 'custom',
      customComment: 'The paper kite has a golden tail.',
      options: { tags: [], private: false },
    },
  ],
  delivery: [],
  analysis,
  updatedAt: '2026-10-22T00:00:00.000Z',
})

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const captureOutput = <T,>(value: T): T => value

type HookProps = Parameters<typeof useComposeAnalysis>[0]

let root: Root | undefined
let current!: ReturnType<typeof useComposeAnalysis>
let container: HTMLDivElement | undefined

const Harness = (props: HookProps) => {
  current = useComposeAnalysis(props)
  return null
}

const mount = async (props: HookProps) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<Harness {...props} />)
    await Promise.resolve()
  })
}

const unmount = () => {
  const mountedRoot = root
  root = undefined
  if (mountedRoot !== undefined) {
    act(() => {
      mountedRoot.unmount()
    })
  }
  container?.remove()
  container = undefined
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => {
  unmount()
  vi.unstubAllGlobals()
})

describe('useComposeAnalysis', () => {
  it('keeps custom verification session-only and restores only common verification', async () => {
    const savedCommands: ComposeAnalysisSaveCommand[] = []
    const saveAnalysisResult = vi.fn((command: ComposeAnalysisSaveCommand) => {
      savedCommands.push(command)
      return true
    })
    const responses = [freshCommonVerification, customVerification]
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(responses.shift()))),
    )

    const props: HookProps = {
      draft: draft(),
      canEdit: true,
      autoAnalyzeDraftId: null,
      saveAnalysisResult,
    }
    await mount(props)

    await act(async () => {
      await current.onVerifyComment()
    })
    const commonResult = {
      verification: current.verification,
      verificationState: current.verificationState,
    }

    act(() => {
      current.onVerificationTargetChange('destination:hatena')
    })
    await act(async () => {
      await current.onVerifyComment()
    })
    const customResult = {
      isCustomComment: current.isCustomComment,
      verification: current.verification,
      verificationState: current.verificationState,
    }

    act(() => {
      current.onVerificationTargetChange('common')
    })
    const commonAfterCustom = {
      verification: current.verification,
      verificationState: current.verificationState,
    }

    unmount()
    await mount(props)
    act(() => {
      current.onVerificationTargetChange('destination:hatena')
    })
    const customAfterReload = {
      isCustomComment: current.isCustomComment,
      verification: current.verification,
      verificationState: current.verificationState,
    }

    expect(
      captureOutput({
        customResult,
        commonResult,
        commonAfterCustom,
        customAfterReload,
        savedCommands,
      }),
    ).toEqual({
      customResult: {
        isCustomComment: true,
        verification: customVerification,
        verificationState: 'success',
      },
      commonResult: {
        verification: freshCommonVerification,
        verificationState: 'success',
      },
      commonAfterCustom: {
        verification: savedCommonVerification,
        verificationState: 'success',
      },
      customAfterReload: {
        isCustomComment: true,
        verification: null,
        verificationState: 'not-requested',
      },
      savedCommands: [
        {
          kind: 'verification',
          expectedDraftId: '00000000-0000-4000-8000-000000000101',
          expectedArticle: article,
          expectedComment: {
            id: 'common',
            value: 'The paper kite is blue.',
          },
          verification: freshCommonVerification,
        },
      ],
    })
  })

  it('automatically extracts and summarizes a newly shared article once', async () => {
    const requests: Array<{ path: string; body: unknown }> = []
    const savedCommands: ComposeAnalysisSaveCommand[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path =
          typeof input === 'string'
            ? new URL(input, window.location.origin).pathname
            : input instanceof URL
              ? input.pathname
              : new URL(input.url, window.location.origin).pathname
        const body: unknown =
          typeof init?.body === 'string' ? JSON.parse(init.body) : null
        requests.push({ path, body })
        return Promise.resolve(
          jsonResponse(
            path === '/api/articles/extract' ? extractedArticle : summary,
          ),
        )
      }),
    )

    const AutoHarness = () => {
      const [activeDraft, setActiveDraft] = useState(draft(undefined))
      const saveAnalysisResult = useCallback(
        (command: ComposeAnalysisSaveCommand) => {
          savedCommands.push(command)
          setActiveDraft((currentDraft) => {
            if (command.kind === 'article') {
              return { ...currentDraft, article: command.article }
            }
            if (command.kind === 'summary') {
              return {
                ...currentDraft,
                analysis: {
                  ...currentDraft.analysis,
                  summary: command.summary,
                },
              }
            }
            return {
              ...currentDraft,
              analysis: {
                ...currentDraft.analysis,
                verification: command.verification,
              },
            }
          })
          return true
        },
        [],
      )

      current = useComposeAnalysis({
        draft: activeDraft,
        canEdit: true,
        autoAnalyzeDraftId: activeDraft.id,
        saveAnalysisResult,
      })
      return null
    }

    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <StrictMode>
          <AutoHarness />
        </StrictMode>,
      )
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    expect(
      captureOutput({
        requests,
        savedCommands,
        article: current.article,
        extractionState: current.extractionState,
        summary: current.summary,
        summaryState: current.summaryState,
      }),
    ).toEqual({
      requests: [
        { path: '/api/articles/extract', body: shareInput },
        { path: '/api/analysis/summary', body: { article: extractedArticle } },
      ],
      savedCommands: [
        {
          kind: 'article',
          expectedDraftId: '00000000-0000-4000-8000-000000000101',
          expectedArticle: article,
          expectedSource: shareInput,
          article: extractedArticle,
        },
        {
          kind: 'summary',
          expectedDraftId: '00000000-0000-4000-8000-000000000101',
          expectedArticle: extractedArticle,
          summary,
        },
      ],
      summary,
      article: extractedArticle,
      extractionState: 'success',
      summaryState: 'success',
    })
  })
})
