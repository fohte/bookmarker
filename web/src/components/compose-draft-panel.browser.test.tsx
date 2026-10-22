import '#index.css'

import type { BookmarkDraft } from 'api/contracts'
import {
  act,
  type ComponentProps,
  createElement,
  type ReactNode,
  useState,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'

import { ComposeDraftPanel } from '#components/compose-draft-panel'

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

function panelProps(
  overrides: Partial<ComponentProps<typeof ComposeDraftPanel>> = {},
): ComponentProps<typeof ComposeDraftPanel> {
  return {
    activeDraft: firstDraft,
    drafts: [firstDraft, secondDraft],
    canEdit: true,
    canCreate: true,
    canSwitchDraft: true,
    saveState: 'saved',
    sourceUrl: '',
    intakeError: null,
    articleTextError: null,
    onSourceUrlChange: () => undefined,
    onOpenSource: () => Promise.resolve(true),
    onSelectDraft: () => undefined,
    onTitleChange: () => undefined,
    onArticleTextChange: () => undefined,
    onRequestDiscard: () => undefined,
    ...overrides,
  }
}

let mounted: { container: HTMLDivElement; root: Root } | null = null

function captureOutput<T>(value: T): T {
  return value
}

function mount(component: ReactNode): HTMLDivElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(component)
  })
  mounted = { container, root }
  return container
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

async function clickButton(text: string): Promise<void> {
  await act(async () => {
    await userEvent.click(buttonByText(text))
  })
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  throw new Error('The expected draft panel state was not reached.')
}

function closeDialogButton(): HTMLButtonElement {
  const match = document.querySelector('[data-slot="dialog-close"]')
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error('The dialog close button was not rendered.')
  }
  return match
}

function EditableDraftPanel() {
  const [activeDraft, setActiveDraft] = useState(firstDraft)

  return (
    <ComposeDraftPanel
      {...panelProps({
        activeDraft,
        articleTextError:
          'The fictional article text exceeds the allowed length.',
        onArticleTextChange: (text) => {
          setActiveDraft((current) => {
            const article = current.article
            return article === undefined
              ? current
              : { ...current, article: { ...article, text } }
          })
        },
        onTitleChange: (title) => {
          setActiveDraft((current) => {
            const article = current.article
            return article === undefined
              ? current
              : { ...current, article: { ...article, title } }
          })
        },
      })}
    />
  )
}

function EmptyDraftPanel({
  onCreate,
}: {
  onCreate: (url: string) => Promise<boolean>
}) {
  const [sourceUrl, setSourceUrl] = useState('')

  return (
    <ComposeDraftPanel
      {...panelProps({
        activeDraft: null,
        drafts: [],
        canEdit: false,
        sourceUrl,
        onSourceUrlChange: setSourceUrl,
        onOpenSource: () => onCreate(sourceUrl),
      })}
    />
  )
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

describe('ComposeDraftPanel in a browser', () => {
  it('keeps article edits and validation errors after the details dialog closes', async () => {
    mount(createElement(EditableDraftPanel))
    await clickButton('Article details')
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

    await clickButton('Article details')
    await waitFor(() => document.querySelector('#article-title') !== null)
    const title = document.querySelector<HTMLInputElement>('#article-title')
    const articleText =
      document.querySelector<HTMLTextAreaElement>('#article-text')
    const actual = {
      title: title?.value ?? null,
      articleText: articleText?.value ?? null,
      validationError:
        document.querySelector('#article-text-error')?.textContent ?? null,
      errorDescription: articleText?.getAttribute('aria-describedby') ?? null,
    }

    expect(captureOutput(actual)).toEqual({
      title: 'A fictional edited title',
      articleText: 'A fictional edited passage.',
      validationError: 'The fictional article text exceeds the allowed length.',
      errorDescription: 'article-text-error',
    })
  })

  it('keeps saved drafts selectable after discard or while a draft is read-only', async () => {
    const selectedAfterDiscard: string[] = []
    mount(
      createElement(
        ComposeDraftPanel,
        panelProps({
          activeDraft: null,
          drafts: [firstDraft, secondDraft],
          canEdit: false,
          onSelectDraft: (id: string) => selectedAfterDiscard.push(id),
        }),
      ),
    )
    await clickButton('Drafts (2)')
    const afterDiscardSelector = document.querySelector('#draft-selection')
    if (!(afterDiscardSelector instanceof HTMLSelectElement)) {
      throw new Error('The saved draft selector was not rendered.')
    }
    const afterDiscardDisabled = afterDiscardSelector.disabled
    await act(async () => {
      await userEvent.selectOptions(afterDiscardSelector, secondDraftId)
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)
    const managerClosedAfterDiscardSelection =
      document.querySelector('[role="dialog"]') === null

    const current = mounted
    if (current !== null) {
      act(() => {
        current.root.unmount()
      })
      current.container.remove()
      mounted = null
    }

    const selectedWhileReadOnly: string[] = []
    mount(
      createElement(
        ComposeDraftPanel,
        panelProps({
          activeDraft: firstDraft,
          canEdit: false,
          onSelectDraft: (id: string) => selectedWhileReadOnly.push(id),
        }),
      ),
    )
    await clickButton('Drafts (2)')
    const readOnlySelector = document.querySelector('#draft-selection')
    if (!(readOnlySelector instanceof HTMLSelectElement)) {
      throw new Error('The saved draft selector was not rendered.')
    }
    const readOnlyDisabled = readOnlySelector.disabled
    await act(async () => {
      await userEvent.selectOptions(readOnlySelector, secondDraftId)
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)
    const managerClosedAfterReadOnlySelection =
      document.querySelector('[role="dialog"]') === null

    const actual = {
      afterDiscard: {
        selectorDisabled: afterDiscardDisabled,
        selectedDraftIds: selectedAfterDiscard,
        managerClosed: managerClosedAfterDiscardSelection,
      },
      whileReadOnly: {
        selectorDisabled: readOnlyDisabled,
        selectedDraftIds: selectedWhileReadOnly,
        managerClosed: managerClosedAfterReadOnlySelection,
      },
    }

    expect(captureOutput(actual)).toEqual({
      afterDiscard: {
        selectorDisabled: false,
        selectedDraftIds: [secondDraftId],
        managerClosed: true,
      },
      whileReadOnly: {
        selectorDisabled: false,
        selectedDraftIds: [secondDraftId],
        managerClosed: true,
      },
    })
  })

  it('opens URL entry without a draft and submits the separate draft request', async () => {
    const createdUrls: string[] = []
    mount(
      createElement(EmptyDraftPanel, {
        onCreate: (url) => {
          createdUrls.push(url)
          return Promise.resolve(true)
        },
      }),
    )
    await clickButton('Drafts (0)')
    const sourceUrl = document.querySelector<HTMLInputElement>('#source-url')
    if (sourceUrl === null) {
      throw new Error('The new article URL field was not rendered.')
    }
    await act(async () => {
      await userEvent.fill(sourceUrl, 'https://stories.example.test/new-entry')
      await userEvent.click(buttonByText('Create draft'))
    })
    await waitFor(() => document.querySelector('[role="dialog"]') === null)

    const actual = {
      createdUrls,
      managerOpen: document.querySelector('[role="dialog"]') !== null,
    }

    expect(captureOutput(actual)).toEqual({
      createdUrls: ['https://stories.example.test/new-entry'],
      managerOpen: false,
    })
  })

  it('keeps URL entry open when creating a draft fails', async () => {
    const attemptedUrls: string[] = []
    mount(
      createElement(EmptyDraftPanel, {
        onCreate: (url) => {
          attemptedUrls.push(url)
          return Promise.resolve(false)
        },
      }),
    )
    await clickButton('Drafts (0)')
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

    const actual = {
      attemptedUrls,
      sourceUrl: sourceUrl.value,
      managerOpen: document.querySelector('[role="dialog"]') !== null,
    }

    expect(captureOutput(actual)).toEqual({
      attemptedUrls: ['https://stories.example.test/retry-entry'],
      sourceUrl: 'https://stories.example.test/retry-entry',
      managerOpen: true,
    })
  })

  it('closes draft management before requesting discard confirmation', async () => {
    const discardRequests: string[] = []
    mount(
      createElement(
        ComposeDraftPanel,
        panelProps({
          onRequestDiscard: () => discardRequests.push(firstDraft.id),
        }),
      ),
    )
    await clickButton('Drafts (2)')
    await clickButton('Discard current draft')
    await waitFor(() => document.querySelector('[role="dialog"]') === null)

    const actual = {
      discardRequests,
      managerOpen: document.querySelector('[role="dialog"]') !== null,
    }

    expect(captureOutput(actual)).toEqual({
      discardRequests: [firstDraft.id],
      managerOpen: false,
    })
  })

  it('disables draft changes while a delivery is in progress', async () => {
    mount(
      createElement(
        ComposeDraftPanel,
        panelProps({
          canEdit: false,
          canCreate: false,
          canSwitchDraft: false,
          sourceUrl: 'https://stories.example.test/another-entry',
        }),
      ),
    )
    await clickButton('Drafts (2)')

    const selector = document.querySelector('#draft-selection')
    const createButton = buttonByText('Create draft')
    const discardButton = buttonByText('Discard current draft')
    const actual = {
      selectorDisabled:
        selector instanceof HTMLSelectElement ? selector.disabled : null,
      createDisabled: createButton.disabled,
      discardDisabled: discardButton.disabled,
    }

    expect(captureOutput(actual)).toEqual({
      selectorDisabled: true,
      createDisabled: true,
      discardDisabled: true,
    })
  })
})
