import '#index.css'

import type { Article, Summary, Verification } from 'api/contracts'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import {
  ComposeAnalysisPanel,
  type ComposeAnalysisPanelProps,
} from '#components/compose-analysis-panel'

const article: Article = {
  url: 'https://example.test/article',
  title: 'A fictional article title',
  text: 'A fictional article passage.',
  source: 'manual',
  partial: false,
}

const summary: Summary = {
  summary: 'A fictional article summary.',
  partial: false,
}

const verification: Verification = {
  issues: [
    {
      kind: 'unsupported',
      quote: 'A claim without support.',
      reason: 'The article does not discuss it.',
    },
  ],
  partial: false,
}

const defaultProps: ComposeAnalysisPanelProps = {
  article,
  canEdit: true,
  extractionState: 'success',
  summary,
  verification,
  summaryState: 'success',
  verificationState: 'success',
  verificationTargets: [{ id: 'common', label: 'Common comment' }],
  selectedVerificationTargetId: 'common',
  isCustomComment: false,
  canVerifyComment: true,
  onExtractArticle: () => undefined,
  onSummarizeArticle: () => undefined,
  onVerifyComment: () => undefined,
  onVerificationTargetChange: () => undefined,
}

let mounted: { container: HTMLDivElement; root: Root } | null = null

function captureOutput<T>(value: T): T {
  return value
}

function mount(component: ReactNode): void {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(component)
  })
  mounted = { container, root }
}

function mountPanel(overrides: Partial<ComposeAnalysisPanelProps> = {}): void {
  mount(<ComposeAnalysisPanel {...defaultProps} {...overrides} />)
}

function detailButton(name: string): HTMLButtonElement {
  const button = document.querySelector(`button[aria-label="${name}"]`)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`The ${name} detail button was not rendered.`)
  }
  return button
}

function commentTargetSelect(): HTMLSelectElement {
  const select = document.querySelector('#analysis-comment-target')
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('The comment target select was not rendered.')
  }
  return select
}

function dialogSnapshot() {
  const dialog = document.querySelector('[role="dialog"]')
  if (!(dialog instanceof HTMLElement)) return null

  const title = dialog.querySelector('[data-slot="dialog-title"]')
  const section = dialog.querySelector('section')
  return {
    title: title?.textContent.trim() ?? null,
    content: section?.textContent.replace(/\s+/g, ' ').trim() ?? null,
  }
}

function dialogStatusMessages(): string[] {
  const dialog = document.querySelector('[role="dialog"]')
  if (!(dialog instanceof HTMLElement)) return []

  return Array.from(dialog.querySelectorAll('[role="status"]'), (status) =>
    status.textContent.trim(),
  )
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('The requested analysis detail dialog was not displayed.')
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    await userEvent.click(button)
  })
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(() => {
  const current = mounted
  if (current !== null) {
    act(() => {
      current.root.unmount()
    })
    current.container.remove()
    mounted = null
  }
})

describe('ComposeAnalysisPanel in a browser', () => {
  it('opens the full summary from its detail button', async () => {
    mountPanel()
    await click(detailButton('Read full summary'))
    await waitFor(() => dialogSnapshot()?.title === 'Article summary')
    expect(captureOutput(dialogSnapshot())).toEqual({
      title: 'Article summary',
      content: 'Refresh summaryA fictional article summary.',
    })
  })

  it('opens the comment check from its detail button', async () => {
    mountPanel()
    await click(detailButton('Read comment check details'))
    await waitFor(() => dialogSnapshot()?.title === 'Comment check')
    expect(captureOutput(dialogSnapshot())).toEqual({
      title: 'Comment check',
      content:
        'Check commentNot supported by the articleA claim without support.The article does not discuss it.This checks the comment against the article, not against external facts.',
    })
  })

  it('changes the comment target from the comment check details', async () => {
    const changedTargetIds: string[] = []
    mountPanel({
      verificationTargets: [
        { id: 'common', label: 'Common comment' },
        { id: 'destination:hatena', label: 'Hatena custom comment' },
      ],
      onVerificationTargetChange: (id) => changedTargetIds.push(id),
    })

    await click(detailButton('Read comment check details'))
    await waitFor(() => dialogSnapshot()?.title === 'Comment check')
    const select = commentTargetSelect()
    await act(async () => {
      await userEvent.selectOptions(select, 'destination:hatena')
    })

    expect(
      captureOutput({
        options: Array.from(select.options, (option) => ({
          id: option.value,
          label: option.textContent.trim(),
        })),
        changedTargetIds,
      }),
    ).toEqual({
      options: [
        { id: 'common', label: 'Common comment' },
        { id: 'destination:hatena', label: 'Hatena custom comment' },
      ],
      changedTargetIds: ['destination:hatena'],
    })
  })

  it('shows the not-requested summary status once in its details', async () => {
    mountPanel({
      summary: null,
      summaryState: 'not-requested',
      defaultOpenDetail: 'summary',
    })
    await waitFor(() => dialogSnapshot()?.title === 'Article summary')

    expect(captureOutput(dialogStatusMessages())).toEqual([
      'Summary has not been requested.',
    ])
  })

  it('shows the unchecked custom comment status once in its details', async () => {
    mountPanel({
      verification: null,
      verificationState: 'not-requested',
      isCustomComment: true,
      defaultOpenDetail: 'verification',
    })
    await waitFor(() => dialogSnapshot()?.title === 'Comment check')

    expect(captureOutput(dialogStatusMessages())).toEqual([
      'This custom comment has not been checked in this session.',
    ])
  })
})
