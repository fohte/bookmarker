import type { BookmarkDraft } from 'api/contracts'
import { err } from 'neverthrow'
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComposeScreenProps } from '#components/compose-screen'
import { DraftError } from '#features/drafts/draft-error'
import type { ComposeState } from '#features/editor/compose-controller'
import { initialComposeState } from '#features/editor/compose-state'
import { ComposeRoute } from '#routes/compose'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const controllerMocks = vi.hoisted(() => ({
  screenProps: { current: null as ComposeScreenProps | null },
  state: { current: null as ComposeState | null },
  openSource: vi.fn(),
  reportIntakeError: vi.fn(),
  noop: vi.fn(),
  updateArticleText: vi.fn(),
  saveAnalysisResult: vi.fn(() => true),
}))

vi.mock('#components/compose-screen', () => ({
  ComposeScreen: (props: ComposeScreenProps) => {
    controllerMocks.screenProps.current = props
    return null
  },
}))

vi.mock('#features/editor/use-compose-controller', () => ({
  useComposeController: () => ({
    state: controllerMocks.state.current,
    openSource: controllerMocks.openSource,
    reportIntakeError: controllerMocks.reportIntakeError,
    updateTitle: controllerMocks.noop,
    updateArticleText: controllerMocks.updateArticleText,
    updateCommonComment: controllerMocks.noop,
    updateDestination: controllerMocks.noop,
    saveAnalysisResult: controllerMocks.saveAnalysisResult,
    selectDraft: controllerMocks.noop,
    retryLock: controllerMocks.noop,
    retrySave: controllerMocks.noop,
    requestDiscard: controllerMocks.noop,
    cancelDiscard: controllerMocks.noop,
    discardDraft: controllerMocks.noop,
  }),
}))

let mountedRoot: Root | undefined

const flushLocationEffects = () =>
  act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })

const routeIntakeOutput = () => ({
  openSourceCalls: controllerMocks.openSource.mock.calls,
  reportedErrors: controllerMocks.reportIntakeError.mock.calls,
})

const captureOutput = <T,>(value: T): T => value

const mountComposeRoute = async () => {
  const container = document.createElement('div')
  mountedRoot = createRoot(container)

  await act(async () => {
    mountedRoot?.render(
      <StrictMode>
        <ComposeRoute />
      </StrictMode>,
    )
    await Promise.resolve()
  })
}

const manualDraft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000121',
  source: {
    version: 1,
    url: 'https://fictional.example.invalid/manual-note',
    partial: true,
  },
  article: {
    url: 'https://fictional.example.invalid/manual-note',
    title: 'An invented manual note',
    text: 'A short fictional passage.',
    source: 'manual',
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-10-22T00:00:00.000Z',
}

describe('ComposeRoute share intake', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/compose')
    vi.clearAllMocks()
    controllerMocks.state.current = initialComposeState
    controllerMocks.screenProps.current = null
    controllerMocks.openSource.mockResolvedValue(
      err(
        new DraftError(
          'storage-failed',
          'The shared draft could not be saved.',
        ),
      ),
    )
  })

  afterEach(() => {
    const root = mountedRoot
    mountedRoot = undefined
    if (root !== undefined) {
      act(() => {
        root.unmount()
      })
    }
    window.history.replaceState(null, '', '/compose')
  })

  it('opens a fragment link once in strict mode and reports a failed import', async () => {
    const input = {
      version: 1,
      url: 'https://articles.example.invalid/story',
      title: '共有タイトル',
      sharedText: '本文 😀',
      partial: true,
    }
    window.history.replaceState(
      null,
      '',
      `/compose?campaign=weekly&url=${encodeURIComponent(input.url)}&draft=legacy#section=top&share=${encodeURIComponent(JSON.stringify(input))}&tab=related`,
    )

    await mountComposeRoute()
    await flushLocationEffects()

    expect(routeIntakeOutput()).toEqual({
      openSourceCalls: [
        [
          {
            version: 1,
            url: 'https://articles.example.invalid/story',
            title: '共有タイトル',
            sharedText: '本文 😀',
            partial: true,
          },
          {
            cleanupUrl: '/compose?campaign=weekly#section=top&tab=related',
            intake: 'share',
          },
        ],
      ],
      reportedErrors: [['The shared draft could not be saved.']],
    })
  })

  it('reports malformed share data without passing it to the controller', async () => {
    window.history.replaceState(null, '', '/compose#share=%7B')

    await mountComposeRoute()
    await flushLocationEffects()

    expect(routeIntakeOutput()).toEqual({
      openSourceCalls: [],
      reportedErrors: [
        [
          'This shared link is invalid or too large. Copy the article URL and try again.',
        ],
      ],
    })
  })

  it('parses a share URL after a browser location transition', async () => {
    await mountComposeRoute()
    await flushLocationEffects()

    await act(async () => {
      window.history.pushState(
        null,
        '',
        '/compose?url=https%3A%2F%2Farticles.example.invalid%2Fnext',
      )
      window.dispatchEvent(new PopStateEvent('popstate'))
      await Promise.resolve()
    })
    await flushLocationEffects()

    expect(routeIntakeOutput()).toEqual({
      openSourceCalls: [
        [
          {
            version: 1,
            url: 'https://articles.example.invalid/next',
            partial: false,
          },
          { cleanupUrl: '/compose', intake: 'share' },
        ],
      ],
      reportedErrors: [['The shared draft could not be saved.']],
    })
  })

  it('reports oversized manual text without sending it to the controller', async () => {
    controllerMocks.state.current = {
      ...initialComposeState,
      drafts: [manualDraft],
      activeDraft: manualDraft,
      isLoading: false,
      canEdit: true,
      lockState: 'owned',
    }
    await mountComposeRoute()

    const props = controllerMocks.screenProps.current
    if (props === null) {
      throw new Error('ComposeRoute did not render the compose screen.')
    }
    act(() => {
      props.onArticleTextChange('x'.repeat(100_001))
    })

    const updatedProps = controllerMocks.screenProps.current
    if (updatedProps === null) {
      throw new Error('ComposeRoute did not render the compose screen.')
    }
    expect(
      captureOutput({
        error: updatedProps.articleTextError,
        updateCalls: controllerMocks.updateArticleText.mock.calls,
      }),
    ).toEqual({
      error: 'Article text must be 100,000 UTF-16 code units or fewer.',
      updateCalls: [],
    })
  })
})
