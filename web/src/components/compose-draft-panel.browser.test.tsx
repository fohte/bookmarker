import type { BookmarkDraft } from 'api/contracts'
import { act, createElement, type ReactNode } from 'react'
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
      url: `https://example.test/${id}`,
      title,
      partial: true,
    },
    article: {
      url: `https://example.test/${id}`,
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

async function selectDraft(id: string): Promise<boolean> {
  const select = document.getElementById('draft-selection')
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error('The saved draft selector was not rendered.')
  }

  const disabled = select.disabled
  await act(async () => {
    await userEvent.selectOptions(select, id)
  })
  return disabled
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
  it('keeps saved drafts selectable after discard or while a draft is read-only', async () => {
    const selectedAfterDiscard: string[] = []
    mount(
      createElement(ComposeDraftPanel, {
        activeDraft: null,
        drafts: [firstDraft, secondDraft],
        canEdit: false,
        canSwitchDraft: true,
        articleTextError: null,
        onSelectDraft: (id: string) => selectedAfterDiscard.push(id),
        onTitleChange: () => undefined,
        onArticleTextChange: () => undefined,
        onRequestDiscard: () => undefined,
      }),
    )
    const afterDiscardDisabled = await selectDraft(secondDraftId)

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
      createElement(ComposeDraftPanel, {
        activeDraft: firstDraft,
        drafts: [firstDraft, secondDraft],
        canEdit: false,
        canSwitchDraft: true,
        articleTextError: null,
        onSelectDraft: (id: string) => selectedWhileReadOnly.push(id),
        onTitleChange: () => undefined,
        onArticleTextChange: () => undefined,
        onRequestDiscard: () => undefined,
      }),
    )
    const whileReadOnlyDisabled = await selectDraft(secondDraftId)

    const actual = {
      afterDiscard: {
        selectorDisabled: afterDiscardDisabled,
        selectedDraftIds: selectedAfterDiscard,
      },
      whileReadOnly: {
        selectorDisabled: whileReadOnlyDisabled,
        selectedDraftIds: selectedWhileReadOnly,
      },
    }

    expect(captureOutput(actual)).toEqual({
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

  it('disables draft switching while a delivery is in progress', () => {
    mount(
      createElement(ComposeDraftPanel, {
        activeDraft: firstDraft,
        drafts: [firstDraft, secondDraft],
        canEdit: false,
        canSwitchDraft: false,
        articleTextError: null,
        onSelectDraft: () => undefined,
        onTitleChange: () => undefined,
        onArticleTextChange: () => undefined,
        onRequestDiscard: () => undefined,
      }),
    )

    const select = document.getElementById('draft-selection')
    const actual = select instanceof HTMLSelectElement ? select.disabled : null

    expect(actual).toEqual(true)
  })
})
