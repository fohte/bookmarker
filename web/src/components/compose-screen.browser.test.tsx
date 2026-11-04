import '#index.css'

import type { BookmarkDraft } from 'api/contracts'
import { act, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import {
  ComposeScreen,
  type ComposeScreenProps,
} from '#components/compose-screen'
import composeScreenStoryMeta, {
  Phone390x844,
} from '#components/compose-screen.stories'
import type { ComposeState } from '#features/editor/compose-controller'

const firstDraftId = '00000000-0000-4000-8000-000000000201'
const secondDraftId = '00000000-0000-4000-8000-000000000202'

function draft(id: string, title: string): BookmarkDraft {
  return {
    version: 1,
    id,
    source: {
      version: 1,
      url: `https://stories.example.test/${id}`,
      title,
      partial: true,
    },
    article: {
      url: `https://stories.example.test/${id}`,
      title,
      text: 'A fictional passage.',
      source: 'manual',
      partial: true,
    },
    commonComment: '',
    destinations: [],
    delivery: [],
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
}

const firstDraft = draft(firstDraftId, 'A fictional first article')
const secondDraft = draft(secondDraftId, 'A fictional second article')

const editingState: ComposeState = {
  drafts: [firstDraft, secondDraft],
  unreadableDraftCount: 0,
  activeDraft: firstDraft,
  isLoading: false,
  canEdit: true,
  lockState: 'owned',
  saveState: 'saved',
  errorMessage: null,
  intakeError: null,
  discardOpen: false,
  deliveryState: 'idle',
  deliveryErrorMessage: null,
  deliveryAuthenticationRequired: false,
}

const noDraftState: ComposeState = {
  ...editingState,
  activeDraft: null,
  canEdit: false,
  lockState: 'available',
}

function screenProps(
  overrides: Partial<ComposeScreenProps> = {},
): ComposeScreenProps {
  return {
    ...composeScreenStoryMeta.args,
    state: editingState,
    ...overrides,
  }
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

function unmount(): void {
  const current = mounted
  if (current === null) return

  act(() => {
    current.root.unmount()
  })
  current.container.remove()
  mounted = null
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

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    await userEvent.click(button)
  })
}

async function openDrafts(count: number): Promise<void> {
  const match = document.querySelector(
    `button[aria-label="Switch draft, ${String(count)} drafts"]`,
  )
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error('The drafts button was not rendered.')
  }
  await click(match)
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  throw new Error('The expected compose screen state was not reached.')
}

function closeDialogButton(): HTMLButtonElement {
  const match = document.querySelector('[data-slot="dialog-close"]')
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error('The dialog close button was not rendered.')
  }
  return match
}

function draftSelector(): HTMLSelectElement {
  const match = document.querySelector('#draft-selection')
  if (!(match instanceof HTMLSelectElement)) {
    throw new Error('The saved draft selector was not rendered.')
  }
  return match
}

function EditableScreen() {
  const [activeDraft, setActiveDraft] = useState(firstDraft)
  const updateArticle = (
    update: Partial<NonNullable<BookmarkDraft['article']>>,
  ) => {
    setActiveDraft((current) => {
      const article = current.article
      return article === undefined
        ? current
        : { ...current, article: { ...article, ...update } }
    })
  }

  return (
    <ComposeScreen
      {...screenProps({
        state: { ...editingState, activeDraft },
        articleTextError:
          'The fictional article text exceeds the allowed length.',
        onArticleTextChange: (text) => {
          updateArticle({ text })
        },
        onTitleChange: (title) => {
          updateArticle({ title })
        },
      })}
    />
  )
}

function NoDraftScreen({
  onCreate,
}: {
  onCreate: (url: string) => Promise<boolean>
}) {
  const [sourceUrl, setSourceUrl] = useState('')

  return (
    <ComposeScreen
      {...screenProps({
        state: { ...noDraftState, drafts: [] },
        sourceUrl,
        onSourceUrlChange: setSourceUrl,
        onOpenSource: () => onCreate(sourceUrl),
      })}
    />
  )
}

beforeEach(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  await page.viewport(1280, 800)
})

afterEach(() => {
  unmount()
})

function measurePhoneLayout() {
  const scrollingElement = document.scrollingElement ?? document.documentElement
  const content = document.querySelector('[data-compose-content]')
  const withinViewport = (selector: string): boolean => {
    const element = document.querySelector(selector)
    if (element === null) return false
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= 0 &&
      rect.right <= window.innerWidth &&
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight
    )
  }

  return {
    documentHasVerticalScroll:
      scrollingElement.scrollHeight > scrollingElement.clientHeight,
    documentHasHorizontalScroll:
      scrollingElement.scrollWidth > scrollingElement.clientWidth,
    contentHasHorizontalScroll:
      content instanceof HTMLElement &&
      content.scrollWidth > content.clientWidth,
    visible: {
      article: withinViewport('section[aria-label="Article"] h2'),
      comment: withinViewport('#main-comment'),
      publish: withinViewport('[data-compose-publish]'),
    },
  }
}

describe('ComposeScreen in a browser', () => {
  it('scrolls only the content on a phone and keeps the article, comment, and publish button in view', async () => {
    await page.viewport(390, 844)
    mount(<ComposeScreen {...screenProps(Phone390x844.args)} />)
    await waitFor(
      () => document.querySelector('[data-compose-content]') !== null,
    )

    expect(captureOutput(measurePhoneLayout())).toEqual({
      documentHasVerticalScroll: false,
      documentHasHorizontalScroll: false,
      contentHasHorizontalScroll: false,
      visible: { article: true, comment: true, publish: true },
    })
  })

  it('keeps article edits and validation errors after the details dialog closes', async () => {
    mount(<EditableScreen />)
    await click(buttonByText('Edit title and text'))
    await waitFor(() => document.querySelector('#article-title') !== null)

    await act(async () => {
      const title = document.querySelector<HTMLInputElement>('#article-title')
      const articleText =
        document.querySelector<HTMLTextAreaElement>('#article-text')
      if (title === null || articleText === null) {
        throw new Error('The article fields were not rendered.')
      }
      await userEvent.fill(title, 'A fictional edited title')
      await userEvent.fill(articleText, 'A fictional edited passage.')
      await userEvent.click(closeDialogButton())
    })
    await waitFor(() => document.querySelector('#article-title') === null)

    await click(buttonByText('Edit title and text'))
    await waitFor(() => document.querySelector('#article-title') !== null)
    const title = document.querySelector<HTMLInputElement>('#article-title')
    const articleText =
      document.querySelector<HTMLTextAreaElement>('#article-text')

    expect(
      captureOutput({
        title: title?.value ?? null,
        articleText: articleText?.value ?? null,
        validationError:
          document.querySelector('#article-text-error')?.textContent ?? null,
        errorDescription: articleText?.getAttribute('aria-describedby') ?? null,
      }),
    ).toEqual({
      title: 'A fictional edited title',
      articleText: 'A fictional edited passage.',
      validationError: 'The fictional article text exceeds the allowed length.',
      errorDescription: 'article-text-error',
    })
  })

  it('opens the article details from the title on a phone', async () => {
    await page.viewport(390, 844)
    mount(<ComposeScreen {...screenProps()} />)
    const titleButton = document.querySelector(
      'button[aria-label="Edit article title and text"]',
    )
    if (!(titleButton instanceof HTMLButtonElement)) {
      throw new Error('The article title button was not rendered.')
    }
    await click(titleButton)
    await waitFor(() => document.querySelector('#article-title') !== null)

    expect(
      captureOutput(
        document.querySelector<HTMLInputElement>('#article-title')?.value,
      ),
    ).toBe('A fictional first article')
  })

  it('keeps saved drafts selectable after discard or while a draft is read-only', async () => {
    const selectedAfterDiscard: string[] = []
    mount(
      <ComposeScreen
        {...screenProps({
          state: noDraftState,
          onSelectDraft: (id) => selectedAfterDiscard.push(id),
        })}
      />,
    )
    await openDrafts(2)
    const afterDiscardDisabled = draftSelector().disabled
    await act(async () => {
      await userEvent.selectOptions(draftSelector(), secondDraftId)
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)
    unmount()

    const selectedWhileReadOnly: string[] = []
    mount(
      <ComposeScreen
        {...screenProps({
          state: { ...editingState, canEdit: false, lockState: 'locked' },
          onSelectDraft: (id) => selectedWhileReadOnly.push(id),
        })}
      />,
    )
    await openDrafts(2)
    const readOnlyDisabled = draftSelector().disabled
    await act(async () => {
      await userEvent.selectOptions(draftSelector(), secondDraftId)
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)

    expect(
      captureOutput({
        afterDiscard: {
          selectorDisabled: afterDiscardDisabled,
          selectedDraftIds: selectedAfterDiscard,
        },
        whileReadOnly: {
          selectorDisabled: readOnlyDisabled,
          selectedDraftIds: selectedWhileReadOnly,
        },
      }),
    ).toEqual({
      afterDiscard: {
        selectorDisabled: false,
        selectedDraftIds: [secondDraftId],
      },
      whileReadOnly: {
        selectorDisabled: false,
        selectedDraftIds: [secondDraftId],
      },
    })
  })

  it('opens URL entry without a draft and submits the separate draft request', async () => {
    const createdUrls: string[] = []
    mount(
      <NoDraftScreen
        onCreate={(url) => {
          createdUrls.push(url)
          return Promise.resolve(true)
        }}
      />,
    )
    await click(buttonByText('Open a draft'))
    const sourceUrl = document.querySelector<HTMLInputElement>('#source-url')
    if (sourceUrl === null) {
      throw new Error('The new article URL field was not rendered.')
    }
    await act(async () => {
      await userEvent.fill(sourceUrl, 'https://stories.example.test/new-entry')
      await userEvent.click(buttonByText('Create draft'))
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)

    expect(
      captureOutput({
        createdUrls,
        managerOpen: document.querySelector('[role="dialog"]') !== null,
      }),
    ).toEqual({
      createdUrls: ['https://stories.example.test/new-entry'],
      managerOpen: false,
    })
  })

  it('keeps URL entry open when creating a draft fails', async () => {
    const attemptedUrls: string[] = []
    mount(
      <NoDraftScreen
        onCreate={(url) => {
          attemptedUrls.push(url)
          return Promise.resolve(false)
        }}
      />,
    )
    await openDrafts(0)
    const sourceUrl = document.querySelector<HTMLInputElement>('#source-url')
    if (sourceUrl === null) {
      throw new Error('The new article URL field was not rendered.')
    }
    await act(async () => {
      await userEvent.fill(
        sourceUrl,
        'https://stories.example.test/retry-entry',
      )
      await userEvent.click(buttonByText('Create draft'))
    })

    expect(
      captureOutput({
        attemptedUrls,
        sourceUrl: sourceUrl.value,
        managerOpen: document.querySelector('[role="dialog"]') !== null,
      }),
    ).toEqual({
      attemptedUrls: ['https://stories.example.test/retry-entry'],
      sourceUrl: 'https://stories.example.test/retry-entry',
      managerOpen: true,
    })
  })

  it('closes draft management before requesting discard confirmation', async () => {
    const discardRequests: string[] = []
    mount(
      <ComposeScreen
        {...screenProps({
          onRequestDiscard: () => discardRequests.push(firstDraft.id),
        })}
      />,
    )
    await openDrafts(2)
    await click(buttonByText('Discard current draft'))
    await waitFor(() => document.querySelector('[role="dialog"]') === null)

    expect(
      captureOutput({
        discardRequests,
        managerOpen: document.querySelector('[role="dialog"]') !== null,
      }),
    ).toEqual({ discardRequests: [firstDraft.id], managerOpen: false })
  })

  it('disables draft changes while a delivery is in progress', async () => {
    mount(
      <ComposeScreen
        {...screenProps({
          state: { ...editingState, deliveryState: 'sending' },
          sourceUrl: 'https://stories.example.test/another-entry',
        })}
      />,
    )
    await openDrafts(2)

    expect(
      captureOutput({
        selectorDisabled: draftSelector().disabled,
        createDisabled: buttonByText('Create draft').disabled,
        discardDisabled: buttonByText('Discard current draft').disabled,
      }),
    ).toEqual({
      selectorDisabled: true,
      createDisabled: true,
      discardDisabled: true,
    })
  })

  it('retries saving from the header after saving fails', async () => {
    let retries = 0
    mount(
      <ComposeScreen
        {...screenProps({
          state: { ...editingState, saveState: 'failed' },
          onRetrySave: () => {
            retries += 1
          },
        })}
      />,
    )
    await click(buttonByText('Retry'))

    expect(captureOutput(retries)).toBe(1)
  })
})
