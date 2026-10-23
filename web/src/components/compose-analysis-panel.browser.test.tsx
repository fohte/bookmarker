import '#index.css'

import type { Article, Summary, Verification } from 'api/contracts'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { ComposeAnalysisPanel } from '#components/compose-analysis-panel'

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

function detailButton(name: string): HTMLButtonElement {
  const button = document.querySelector(`button[aria-label="${name}"]`)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`The ${name} detail button was not rendered.`)
  }
  return button
}

function closeButton(): HTMLButtonElement {
  const button = document.querySelector('[data-slot="dialog-close"]')
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('The dialog close button was not rendered.')
  }
  return button
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
  it('opens the full summary and comment check from their detail buttons', async () => {
    mount(
      <ComposeAnalysisPanel
        article={article}
        canEdit
        extractionState="success"
        summary={summary}
        verification={verification}
        summaryState="success"
        verificationState="success"
        verificationTargets={[{ id: 'common', label: 'Common comment' }]}
        selectedVerificationTargetId="common"
        isCustomComment={false}
        canVerifyComment
        onExtractArticle={() => undefined}
        onSummarizeArticle={() => undefined}
        onVerifyComment={() => undefined}
        onVerificationTargetChange={() => undefined}
      />,
    )

    await click(detailButton('Read full summary'))
    await waitFor(() => dialogSnapshot()?.title === 'Article summary')
    const summaryDialog = dialogSnapshot()
    await click(closeButton())
    await waitFor(() => document.querySelector('[role="dialog"]') === null)
    const dialogClosedBeforeCommentCheck =
      document.querySelector('[role="dialog"]') === null

    await click(detailButton('Read comment check details'))
    await waitFor(() => dialogSnapshot()?.title === 'Comment check')
    const commentCheckDialog = dialogSnapshot()

    expect(
      captureOutput({
        summaryDialog,
        dialogClosedBeforeCommentCheck,
        commentCheckDialog,
      }),
    ).toEqual({
      summaryDialog: {
        title: 'Article summary',
        content: 'Refresh summaryA fictional article summary.',
      },
      dialogClosedBeforeCommentCheck: true,
      commentCheckDialog: {
        title: 'Comment check',
        content:
          'Check commentNot supported by the articleA claim without support.The article does not discuss it.This checks the comment against the article, not against external facts.',
      },
    })
  })
})
