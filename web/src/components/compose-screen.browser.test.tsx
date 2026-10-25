import '#index.css'

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import {
  ComposeScreen,
  type ComposeScreenProps,
} from '#components/compose-screen'
import composeScreenStoryMeta, {
  Mini390x600,
  Mini420x600,
} from '#components/compose-screen.stories'

const destinations = [
  { name: 'Hatena Bookmark', selected: true },
  { name: 'Mastodon', selected: true },
  { name: 'Raindrop', selected: false },
  { name: 'X', selected: false },
]

let mounted: { container: HTMLDivElement; root: Root } | null = null

function captureOutput<T>(value: T): T {
  return value
}

type CompactStoryArgs = NonNullable<typeof Mini420x600.args>

function screenProps(args: CompactStoryArgs): ComposeScreenProps {
  const props: ComposeScreenProps = {
    ...composeScreenStoryMeta.args,
    ...args,
  }
  return props
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

function unmount(): void {
  const current = mounted
  if (current === null) return

  act(() => {
    current.root.unmount()
  })
  current.container.remove()
  mounted = null
}

async function waitForContent(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (document.querySelector('[data-compose-content]') !== null) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('The compose content was not rendered.')
}

function measureScreen() {
  const scrollingElement = document.scrollingElement ?? document.documentElement
  const content = document.querySelector('[data-compose-content]')
  const publish = document.querySelector('[data-compose-publish]')
  const contentRect = content?.getBoundingClientRect()
  const contentBounds =
    content instanceof HTMLElement && contentRect !== undefined
      ? {
          left: contentRect.left + content.clientLeft,
          right: contentRect.left + content.clientLeft + content.clientWidth,
          top: contentRect.top + content.clientTop,
          bottom: contentRect.top + content.clientTop + content.clientHeight,
        }
      : null

  const within = (
    element: Element | null,
    bounds: { left: number; right: number; top: number; bottom: number } | null,
  ): boolean => {
    if (element === null || bounds === null) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= bounds.left &&
      rect.right <= bounds.right &&
      rect.top >= bounds.top &&
      rect.bottom <= bounds.bottom
    )
  }

  const viewportBounds = {
    left: 0,
    right: window.innerWidth,
    top: 0,
    bottom: window.innerHeight,
  }

  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentHasVerticalScroll:
      scrollingElement.scrollHeight > scrollingElement.clientHeight,
    documentHasHorizontalScroll:
      scrollingElement.scrollWidth > scrollingElement.clientWidth,
    content: {
      hasVerticalScroll:
        content instanceof HTMLElement &&
        content.scrollHeight > content.clientHeight,
      scrollTop: content instanceof HTMLElement ? content.scrollTop : null,
      abovePublish:
        contentRect !== undefined &&
        publish !== null &&
        contentRect.bottom <= publish.getBoundingClientRect().top,
    },
    visible: {
      article: within(
        document.querySelector('[data-compose-article-header]'),
        viewportBounds,
      ),
      analysis: within(
        document.querySelector('[data-compose-section="analysis"]'),
        contentBounds,
      ),
      comment: within(document.querySelector('#common-comment'), contentBounds),
      verification: within(
        document.querySelector('[data-compose-verification-status]'),
        contentBounds,
      ),
      destinations: within(
        document.querySelector('[data-compose-section="destinations"]'),
        contentBounds,
      ),
      publish: within(publish, viewportBounds),
    },
    destinationRows: destinations.map(({ name, selected }) => {
      const checkbox = document.querySelector<HTMLInputElement>(
        `input[aria-label="Select ${name}"]`,
      )
      const row = checkbox?.closest('article') ?? null
      const settingsButton =
        row?.querySelector<HTMLButtonElement>(
          `button[aria-label="Open ${name} settings"]`,
        ) ?? null

      return {
        name,
        selected: checkbox?.checked ?? null,
        expectedSelection: selected,
        rowWithinContent: within(row, contentBounds),
        checkboxWithinContent: within(checkbox, contentBounds),
        settingsWithinContent: within(settingsButton, contentBounds),
      }
    }),
  }
}

beforeEach(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  await page.viewport(1280, 800)
})

afterEach(async () => {
  unmount()
  await page.viewport(1280, 800)
})

describe('ComposeScreen compact stories in a browser', () => {
  it('keeps every destination control inside the content boundary at mini sizes', async () => {
    const layouts = []

    for (const story of [
      { width: 420, height: 600, args: Mini420x600.args },
      { width: 390, height: 600, args: Mini390x600.args },
    ]) {
      await page.viewport(story.width, story.height)
      mount(<ComposeScreen {...screenProps(story.args)} />)
      await waitForContent()
      layouts.push(captureOutput(measureScreen()))
      unmount()
    }

    expect(layouts).toEqual([
      {
        viewport: { width: 420, height: 600 },
        documentHasVerticalScroll: false,
        documentHasHorizontalScroll: false,
        content: { hasVerticalScroll: false, scrollTop: 0, abovePublish: true },
        visible: {
          article: true,
          analysis: true,
          comment: true,
          verification: true,
          destinations: true,
          publish: true,
        },
        destinationRows: [
          {
            name: 'Hatena Bookmark',
            selected: true,
            expectedSelection: true,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'Mastodon',
            selected: true,
            expectedSelection: true,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'Raindrop',
            selected: false,
            expectedSelection: false,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'X',
            selected: false,
            expectedSelection: false,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
        ],
      },
      {
        viewport: { width: 390, height: 600 },
        documentHasVerticalScroll: false,
        documentHasHorizontalScroll: false,
        content: { hasVerticalScroll: false, scrollTop: 0, abovePublish: true },
        visible: {
          article: true,
          analysis: true,
          comment: true,
          verification: true,
          destinations: true,
          publish: true,
        },
        destinationRows: [
          {
            name: 'Hatena Bookmark',
            selected: true,
            expectedSelection: true,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'Mastodon',
            selected: true,
            expectedSelection: true,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'Raindrop',
            selected: false,
            expectedSelection: false,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
          {
            name: 'X',
            selected: false,
            expectedSelection: false,
            rowWithinContent: true,
            checkboxWithinContent: true,
            settingsWithinContent: true,
          },
        ],
      },
    ])
  })
})
