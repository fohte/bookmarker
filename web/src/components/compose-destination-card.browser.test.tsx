import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'
import { act, createElement, type ReactNode, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { ComposeDestinationCard } from '#components/compose-destination-card'

const existingDestination: DestinationDraft = {
  destination: 'hatena',
  selected: true,
  commentMode: 'custom',
  customComment: 'A saved individual comment.',
  options: { tags: ['stored'], private: true },
}

const unconfiguredMetadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: false },
    mastodon: { configured: true },
    raindrop: { configured: true },
    x: { configured: true },
  },
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

function buttonNamed(name: string): HTMLButtonElement {
  const button = [...document.querySelectorAll('button')].find(
    (item) => item.textContent.trim() === name,
  )
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button ${name} was not found.`)
  }
  return button
}

function inputNamed(name: string): HTMLInputElement {
  const input = document.querySelector(`input[aria-label="${name}"]`)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Input ${name} was not found.`)
  }
  return input
}

function confirmationLayout() {
  const dialog = document.querySelector('[data-slot="dialog-content"]')
  const description = document.querySelector('[data-slot="dialog-description"]')
  const footer = document.querySelector('[data-slot="dialog-footer"]')
  if (
    !(dialog instanceof HTMLElement) ||
    !(description instanceof HTMLElement) ||
    !(footer instanceof HTMLElement)
  ) {
    throw new Error('Copy confirmation layout was not found.')
  }

  const within = (child: HTMLElement, parent: HTMLElement) => {
    const childRect = child.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const tolerance = 1
    return (
      childRect.left >= parentRect.left - tolerance &&
      childRect.right <= parentRect.right + tolerance &&
      childRect.top >= parentRect.top - tolerance &&
      childRect.bottom <= parentRect.bottom + tolerance
    )
  }
  const dialogRect = dialog.getBoundingClientRect()
  const buttons = [...footer.querySelectorAll<HTMLButtonElement>('button')]

  return {
    descriptionWithinDialog: within(description, dialog),
    footerWithinDialog: within(footer, dialog),
    buttonsWithinFooter: buttons.every((button) => within(button, footer)),
    buttonCount: buttons.length,
    dialogWithinViewport:
      dialogRect.left >= -1 &&
      dialogRect.right <= window.innerWidth + 1 &&
      dialogRect.top >= -1 &&
      dialogRect.bottom <= window.innerHeight + 1,
    pageHasHorizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }
}

async function selectOption(
  triggerId: string,
  optionName: string,
): Promise<void> {
  const trigger = document.getElementById(triggerId)
  if (!(trigger instanceof HTMLButtonElement)) {
    throw new Error(`Select trigger ${triggerId} was not found.`)
  }
  await act(async () => userEvent.click(trigger))

  const option = [...document.querySelectorAll('[role="option"]')].find(
    (item) => item.textContent.trim() === optionName,
  )
  if (!(option instanceof HTMLElement)) {
    throw new Error(`Select option ${optionName} was not found.`)
  }
  await act(async () => userEvent.click(option))
}

async function setInputValue(
  input: HTMLInputElement,
  value: string,
): Promise<void> {
  await act(async () => userEvent.fill(input, value))
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

afterEach(async () => {
  await act(async () => {
    await page.viewport(1280, 720)
  })

  const current = mounted
  if (current !== null) {
    act(() => {
      current.root.unmount()
    })
    current.container.remove()
    mounted = null
  }
})

describe('ComposeDestinationCard in a browser', () => {
  it('asks before replacing an existing individual comment', async () => {
    const requestedDestinations: DestinationId[] = []
    const copiedDestinations: DestinationId[] = []
    let currentConfirmationOpen = false

    function Harness() {
      const [isOpen, setIsOpen] = useState(false)
      currentConfirmationOpen = isOpen
      return (
        <ComposeDestinationCard
          canEdit
          commonComment="A shared comment."
          copyConfirmationOpen={isOpen}
          destination={existingDestination}
          onCancelCopyCommonComment={() => {
            setIsOpen(false)
          }}
          onCopyCommonComment={(destination) => {
            copiedDestinations.push(destination)
            setIsOpen(false)
          }}
          onDestinationChange={() => undefined}
          onRequestCopyCommonComment={(destination) => {
            requestedDestinations.push(destination)
            setIsOpen(true)
          }}
        />
      )
    }

    mount(createElement(Harness))
    await act(async () => userEvent.click(buttonNamed('Copy common comment')))
    const afterRequest = {
      requestedDestinations: [...requestedDestinations],
      copiedDestinations: [...copiedDestinations],
      confirmationTitle:
        document.querySelector('[role="dialog"] h2')?.textContent ?? null,
    }

    act(() => {
      buttonNamed('Replace with common').click()
    })
    const afterConfirm = {
      copiedDestinations: [...copiedDestinations],
      confirmationOpen: currentConfirmationOpen,
    }

    const actual = { afterRequest, afterConfirm }
    const expected = {
      afterRequest: {
        requestedDestinations: ['hatena'],
        copiedDestinations: [],
        confirmationTitle: 'Replace the individual comment?',
      },
      afterConfirm: {
        copiedDestinations: ['hatena'],
        confirmationOpen: false,
      },
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('keeps the copy confirmation within desktop and mobile viewports', async () => {
    mount(
      <ComposeDestinationCard
        canEdit
        commonComment="A shared comment."
        copyConfirmationOpen
        destination={existingDestination}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onDestinationChange={() => undefined}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    const layouts: ReturnType<typeof confirmationLayout>[] = []
    await act(async () => {
      await page.viewport(1280, 900)
    })
    layouts.push(confirmationLayout())
    await act(async () => {
      await page.viewport(390, 844)
    })
    layouts.push(confirmationLayout())

    expect(captureOutput(layouts)).toEqual([
      {
        descriptionWithinDialog: true,
        footerWithinDialog: true,
        buttonsWithinFooter: true,
        buttonCount: 2,
        dialogWithinViewport: true,
        pageHasHorizontalOverflow: false,
      },
      {
        descriptionWithinDialog: true,
        footerWithinDialog: true,
        buttonsWithinFooter: true,
        buttonCount: 2,
        dialogWithinViewport: true,
        pageHasHorizontalOverflow: false,
      },
    ])
  })

  it('copies the common comment directly when the individual comment is empty', async () => {
    const copied: string[] = []
    const container = mount(
      <ComposeDestinationCard
        canEdit
        commonComment="A shared comment."
        copyConfirmationOpen={false}
        destination={{
          ...existingDestination,
          commentMode: 'common',
          customComment: '',
        }}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={(destination) => {
          copied.push(destination)
        }}
        onDestinationChange={() => undefined}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    await act(async () => userEvent.click(buttonNamed('Copy common comment')))

    const actual = {
      copied,
      confirmation: container.querySelector('[role="dialog"]') !== null,
    }
    const expected = {
      copied: ['hatena'],
      confirmation: false,
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('keeps custom text while switching to the common comment and back', async () => {
    const updates: DestinationDraft[] = []
    const initialDestination: DestinationDraft = {
      ...existingDestination,
      commentMode: 'custom',
    }

    function Harness() {
      const [destination, setDestination] = useState(initialDestination)
      const [commonComment, setCommonComment] = useState('A shared comment.')
      return (
        <>
          <ComposeDestinationCard
            canEdit
            commonComment={commonComment}
            copyConfirmationOpen={false}
            destination={destination}
            onCancelCopyCommonComment={() => undefined}
            onCopyCommonComment={() => undefined}
            onDestinationChange={(next) => {
              updates.push(next)
              setDestination(next)
            }}
            onRequestCopyCommonComment={() => undefined}
          />
          <button
            onClick={() => {
              setCommonComment('A changed shared comment.')
            }}
            type="button"
          >
            Change common comment
          </button>
        </>
      )
    }

    const container = mount(createElement(Harness))
    await selectOption('hatena-comment-mode', 'Use common comment')
    await act(async () => userEvent.click(buttonNamed('Change common comment')))
    await selectOption('hatena-comment-mode', 'Use individual comment')
    const customComment = container.querySelector<HTMLTextAreaElement>(
      '#hatena-custom-comment',
    )
    const preview = container.querySelector('article > div > p')?.textContent

    const actual = {
      updates,
      customComment: customComment?.value ?? null,
      preview,
    }
    const expected = {
      updates: [
        { ...initialDestination, commentMode: 'common' },
        { ...initialDestination, commentMode: 'custom' },
      ],
      customComment: 'A saved individual comment.',
      preview: 'Preview: A saved individual comment.',
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('saves unfinished tags while keeping an unconfigured selection unchanged', async () => {
    const updates: DestinationDraft[] = []
    const container = mount(
      <ComposeDestinationCard
        canEdit
        commonComment="A shared comment."
        copyConfirmationOpen={false}
        destination={existingDestination}
        metadata={unconfiguredMetadata}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onDestinationChange={(destination) => {
          updates.push(destination)
        }}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    const selected = inputNamed('Select Hatena Bookmark')
    await setInputValue(
      inputNamed('Hatena tags (comma separated)'),
      'stored,unfinished',
    )

    const actual = {
      updates,
      selectionDisabled: selected.disabled,
      selectionChecked: selected.checked,
      configurationMessage:
        container.querySelector('article header p')?.textContent ?? null,
    }
    const expected = {
      updates: [
        {
          destination: 'hatena',
          selected: true,
          commentMode: 'custom',
          customComment: 'A saved individual comment.',
          options: { tags: ['stored', 'unfinished'], private: true },
        },
      ],
      selectionDisabled: true,
      selectionChecked: true,
      configurationMessage:
        'This destination is not connected. Its saved settings are kept.',
    }

    expect(captureOutput(actual)).toEqual(expected)
  })
})
