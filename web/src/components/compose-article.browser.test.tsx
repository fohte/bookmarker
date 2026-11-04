import '#index.css'

import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { ComposeArticle } from '#components/compose-article'
import composeArticleStoryMeta, {
  ExtractionTimedOut,
  NotSummarized,
} from '#components/compose-article.stories'

let mounted: { container: HTMLDivElement; root: Root } | null = null

function mount(props: Partial<ComponentProps<typeof ComposeArticle>>): void {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<ComposeArticle {...composeArticleStoryMeta.args} {...props} />)
  })
  mounted = { container, root }
}

function buttonByText(text: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find(
    (button) => button.textContent.trim() === text,
  )
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`The ${text} button was not rendered.`)
  }
  return match
}

async function click(text: string): Promise<void> {
  await act(async () => {
    await userEvent.click(buttonByText(text))
  })
}

function summaryToggle() {
  const toggle = document.querySelector('button[aria-expanded]')
  return {
    label: toggle?.textContent ?? null,
    expanded: toggle?.getAttribute('aria-expanded') ?? null,
  }
}

beforeEach(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  await page.viewport(390, 844)
})

afterEach(() => {
  const current = mounted
  if (current === null) return
  act(() => {
    current.root.unmount()
  })
  current.container.remove()
  mounted = null
})

describe('ComposeArticle in a browser', () => {
  it('runs the analysis step that the article is missing', async () => {
    const calls: string[] = []
    const handlers = {
      onExtractArticle: () => calls.push('extract'),
      onSummarizeArticle: () => calls.push('summarize'),
    }
    mount({ ...ExtractionTimedOut.args, ...handlers })
    await click('Retry extract')
    act(() => {
      mounted?.root.render(
        <ComposeArticle
          {...composeArticleStoryMeta.args}
          {...NotSummarized.args}
          {...handlers}
        />,
      )
    })
    await click('Summarize')

    expect(calls).toEqual(['extract', 'summarize'])
  })

  it('toggles the full summary on a phone', async () => {
    mount({})
    const toggles = [summaryToggle()]
    await click('Read summary')
    toggles.push(summaryToggle())
    await click('Show less')
    toggles.push(summaryToggle())

    expect(toggles).toEqual([
      { label: 'Read summary', expanded: 'false' },
      { label: 'Show less', expanded: 'true' },
      { label: 'Read summary', expanded: 'false' },
    ])
  })
})
