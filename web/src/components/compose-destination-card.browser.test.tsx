import '#index.css'

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

type SelectOptionInput = {
  settingsDialogName: string
  comboboxName: string
  optionName: string
}

async function selectOption({
  settingsDialogName,
  comboboxName,
  optionName,
}: SelectOptionInput): Promise<void> {
  const dialog = page.getByRole('dialog', {
    exact: true,
    name: settingsDialogName,
  })
  await expect.element(dialog).toBeVisible()

  const combobox = page.getByRole('combobox', {
    exact: true,
    name: comboboxName,
  })
  await expect.element(combobox).toBeVisible()
  await act(async () => combobox.click())
  await expect.element(combobox).toHaveAttribute('aria-expanded', 'true')

  const option = page.getByRole('option', { exact: true, name: optionName })
  await expect.element(option).toBeVisible()
  await act(async () => option.click())
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

function buttonWithAriaLabel(name: string): HTMLButtonElement {
  const button = document.querySelector(`button[aria-label="${name}"]`)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button with aria-label ${name} was not found.`)
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

function settingsLayout() {
  const dialog = [
    ...document.querySelectorAll<HTMLElement>('[data-slot="dialog-content"]'),
  ].find((item) => item.textContent.includes('Mastodon settings'))
  if (dialog === undefined) throw new Error('Mastodon settings were not open.')

  const lastSetting = [...dialog.querySelectorAll('label')].find((label) =>
    label.textContent.includes('Mark media as sensitive'),
  )
  if (lastSetting === undefined) {
    throw new Error('Mastodon settings were incomplete.')
  }
  const scrollArea = dialog.querySelector<HTMLElement>(
    '[data-slot="destination-settings-scroll"]',
  )
  if (scrollArea === null) {
    throw new Error('Mastodon settings scroll area was not found.')
  }

  scrollArea.scrollTop = scrollArea.scrollHeight
  const dialogRect = dialog.getBoundingClientRect()
  const scrollAreaRect = scrollArea.getBoundingClientRect()
  const settingRect = lastSetting.getBoundingClientRect()
  const tolerance = 1

  return {
    dialogWithinViewport:
      dialogRect.left >= -tolerance &&
      dialogRect.right <= window.innerWidth + tolerance &&
      dialogRect.top >= -tolerance &&
      dialogRect.bottom <= window.innerHeight + tolerance,
    lastSettingWithinScrollArea:
      settingRect.left >= scrollAreaRect.left - tolerance &&
      settingRect.right <= scrollAreaRect.right + tolerance &&
      settingRect.top >= scrollAreaRect.top - tolerance &&
      settingRect.bottom <= scrollAreaRect.bottom + tolerance,
    pageHasHorizontalOverflow:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  }
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
      const [settingsOpen, setSettingsOpen] = useState(false)
      currentConfirmationOpen = isOpen
      return (
        <ComposeDestinationCard
          canEdit
          commonComment="A shared comment."
          copyConfirmationOpen={isOpen}
          destination={existingDestination}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
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
    await act(async () =>
      userEvent.click(buttonWithAriaLabel('Open Hatena Bookmark settings')),
    )
    await act(async () => userEvent.click(buttonNamed('Copy common comment')))
    const afterRequest = {
      requestedDestinations: [...requestedDestinations],
      copiedDestinations: [...copiedDestinations],
      confirmationTitle:
        [...document.querySelectorAll('[role="dialog"] h2')].find(
          (title) => title.textContent === 'Replace the individual comment?',
        )?.textContent ?? null,
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
        settingsOpen={false}
        onSettingsOpenChange={() => undefined}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onDestinationChange={() => undefined}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    const layouts: ReturnType<typeof confirmationLayout>[] = []
    await act(async () => {
      await page.viewport(420, 600)
    })
    layouts.push(confirmationLayout())
    await act(async () => {
      await page.viewport(390, 600)
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

  it('keeps Mastodon settings usable within mini viewports', async () => {
    mount(
      <ComposeDestinationCard
        canEdit
        commonComment="A shared comment."
        copyConfirmationOpen={false}
        destination={{
          destination: 'mastodon',
          selected: false,
          commentMode: 'custom',
          customComment: 'A saved individual comment.',
          options: {
            visibility: 'private',
            spoilerText: 'A saved content warning.',
            sensitive: true,
          },
        }}
        settingsOpen
        onSettingsOpenChange={() => undefined}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onDestinationChange={() => undefined}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    const layouts: ReturnType<typeof settingsLayout>[] = []
    await act(async () => {
      await page.viewport(420, 600)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve()
          }),
        )
      })
    })
    layouts.push(settingsLayout())
    await act(async () => {
      await page.viewport(390, 600)
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            resolve()
          }),
        )
      })
    })
    layouts.push(settingsLayout())

    expect(captureOutput(layouts)).toEqual([
      {
        dialogWithinViewport: true,
        lastSettingWithinScrollArea: true,
        pageHasHorizontalOverflow: false,
      },
      {
        dialogWithinViewport: true,
        lastSettingWithinScrollArea: true,
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
        settingsOpen
        onSettingsOpenChange={() => undefined}
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

  it('opens settings for an unselected destination and keeps edits after selection changes', async () => {
    const updates: DestinationDraft[] = []
    const initialDestination: DestinationDraft = {
      destination: 'hatena',
      selected: false,
      commentMode: 'custom',
      customComment: 'A note about an imagined garden.',
      options: { tags: ['quartz'], private: true },
    }
    let settingsOpen = false

    function Harness() {
      const [destination, setDestination] = useState(initialDestination)
      const [isSettingsOpen, setIsSettingsOpen] = useState(false)
      settingsOpen = isSettingsOpen
      return (
        <ComposeDestinationCard
          canEdit
          commonComment="A shared comment."
          copyConfirmationOpen={false}
          destination={destination}
          settingsOpen={isSettingsOpen}
          onSettingsOpenChange={setIsSettingsOpen}
          onCancelCopyCommonComment={() => undefined}
          onCopyCommonComment={() => undefined}
          onDestinationChange={(next) => {
            updates.push(next)
            setDestination(next)
          }}
          onRequestCopyCommonComment={() => undefined}
        />
      )
    }

    mount(createElement(Harness))
    await act(async () =>
      userEvent.click(buttonWithAriaLabel('Open Hatena Bookmark settings')),
    )
    const commentInput = document.querySelector<HTMLTextAreaElement>(
      '#hatena-custom-comment',
    )
    const tagsInput = inputNamed('Hatena tags (comma separated)')
    if (commentInput === null)
      throw new Error('The custom comment was missing.')
    await act(async () =>
      userEvent.fill(commentInput, 'A note about a fictional observatory.'),
    )
    await setInputValue(tagsInput, 'quartz,moonlit')
    await act(async () => userEvent.click(buttonNamed('Close')))
    await act(async () => userEvent.click(inputNamed('Select Hatena Bookmark')))
    await act(async () =>
      userEvent.click(buttonWithAriaLabel('Open Hatena Bookmark settings')),
    )

    const reopenedComment = document.querySelector<HTMLTextAreaElement>(
      '#hatena-custom-comment',
    )
    const actual = {
      updates,
      selected: inputNamed('Select Hatena Bookmark').checked,
      settingsOpen,
      comment: reopenedComment?.value ?? null,
      tags: inputNamed('Hatena tags (comma separated)').value,
      private: document.querySelector<HTMLInputElement>(
        '[role="dialog"] input[type="checkbox"]',
      )?.checked,
    }
    expect(captureOutput(actual)).toEqual({
      updates: [
        {
          ...initialDestination,
          customComment: 'A note about a fictional observatory.',
        },
        {
          ...initialDestination,
          customComment: 'A note about a fictional observatory.',
          options: { tags: ['quartz', 'moonlit'], private: true },
        },
        {
          ...initialDestination,
          selected: true,
          customComment: 'A note about a fictional observatory.',
          options: { tags: ['quartz', 'moonlit'], private: true },
        },
      ],
      selected: true,
      settingsOpen: true,
      comment: 'A note about a fictional observatory.',
      tags: 'quartz,moonlit',
      private: true,
    })
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
      const [settingsOpen, setSettingsOpen] = useState(false)
      return (
        <>
          <ComposeDestinationCard
            canEdit
            commonComment={commonComment}
            copyConfirmationOpen={false}
            destination={destination}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
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

    mount(createElement(Harness))
    await act(async () =>
      userEvent.click(buttonWithAriaLabel('Open Hatena Bookmark settings')),
    )
    await selectOption({
      settingsDialogName: 'Hatena Bookmark settings',
      comboboxName: 'Hatena Bookmark comment mode',
      optionName: 'Use common comment',
    })
    act(() => {
      buttonNamed('Change common comment').click()
    })
    await selectOption({
      settingsDialogName: 'Hatena Bookmark settings',
      comboboxName: 'Hatena Bookmark comment mode',
      optionName: 'Use individual comment',
    })
    const customComment = document.querySelector<HTMLTextAreaElement>(
      '#hatena-custom-comment',
    )
    const preview = [...document.querySelectorAll('[role="dialog"] p')].find(
      (paragraph) => paragraph.textContent.startsWith('Preview:'),
    )?.textContent

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

  it('saves unfinished tags and lets a saved unconfigured selection be removed', async () => {
    const updates: DestinationDraft[] = []
    function Harness() {
      const [destination, setDestination] = useState(existingDestination)
      const [settingsOpen, setSettingsOpen] = useState(true)
      return (
        <ComposeDestinationCard
          canEdit
          commonComment="A shared comment."
          copyConfirmationOpen={false}
          destination={destination}
          metadata={unconfiguredMetadata}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={setSettingsOpen}
          onCancelCopyCommonComment={() => undefined}
          onCopyCommonComment={() => undefined}
          onDestinationChange={(next) => {
            updates.push(next)
            setDestination(next)
          }}
          onRequestCopyCommonComment={() => undefined}
        />
      )
    }

    const container = mount(createElement(Harness))

    const selected = inputNamed('Select Hatena Bookmark')
    await setInputValue(
      inputNamed('Hatena tags (comma separated)'),
      'stored,unfinished',
    )
    const selectionInitiallyChecked = selected.checked
    await act(async () => userEvent.click(buttonNamed('Close')))
    await act(async () => userEvent.click(selected))

    const actual = {
      updates,
      selectionDisabled: selected.disabled,
      selectionInitiallyChecked,
      requestedDeselection: updates.at(-1)?.selected ?? null,
      configurationMessage:
        container.querySelector('article [role="status"]')?.textContent ?? null,
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
        {
          destination: 'hatena',
          selected: false,
          commentMode: 'custom',
          customComment: 'A saved individual comment.',
          options: { tags: ['stored', 'unfinished'], private: true },
        },
      ],
      selectionDisabled: true,
      selectionInitiallyChecked: true,
      requestedDeselection: false,
      configurationMessage: 'Not connected',
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('keeps an unknown Raindrop collection until a real collection is selected', async () => {
    const raindrop: DestinationDraft = {
      destination: 'raindrop',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { collectionId: 918, tags: ['unfinished', '', ' tail '] },
    }
    const metadata: DestinationMetadata = {
      destinations: {
        hatena: { configured: true },
        mastodon: { configured: true },
        raindrop: {
          configured: true,
          collections: [
            { id: 71, title: 'Fictional reading collection', public: false },
          ],
        },
        x: { configured: true },
      },
    }
    const updates: DestinationDraft[] = []
    mount(
      <ComposeDestinationCard
        canEdit
        commonComment="A shared fictional comment."
        copyConfirmationOpen={false}
        destination={raindrop}
        metadata={metadata}
        settingsOpen
        onSettingsOpenChange={() => undefined}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onDestinationChange={(next) => updates.push(next)}
        onRequestCopyCommonComment={() => undefined}
      />,
    )

    const status = document.querySelector('[role="status"]')?.textContent
    const trigger = document.getElementById('raindrop-collection')
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error('Raindrop collection selector was not found.')
    }
    await act(async () => userEvent.click(trigger))
    const unknownOption = page.getByRole('option', {
      exact: true,
      name: 'Saved collection ID 918 (not in the available list)',
    })
    await expect.element(unknownOption).toHaveAttribute('aria-disabled', 'true')
    const unknownOptionDisabled =
      unknownOption.element().getAttribute('aria-disabled') === 'true'
    const availableOption = page.getByRole('option', {
      exact: true,
      name: 'Fictional reading collection',
    })
    await expect.element(availableOption).toBeVisible()
    await act(async () => availableOption.click())

    expect(
      captureOutput({
        status,
        unknownOptionDisabled,
        updates,
      }),
    ).toEqual({
      status:
        'Saved collection ID 918 is not available. Choose an available collection.',
      unknownOptionDisabled: true,
      updates: [
        {
          destination: 'raindrop',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: {
            collectionId: 71,
            tags: ['unfinished', '', ' tail '],
          },
        },
      ],
    })
  })
})
