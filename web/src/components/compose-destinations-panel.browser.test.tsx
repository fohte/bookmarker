import '#index.css'

import type { DestinationDraft, DestinationMetadata } from 'api/contracts'
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'

const configured: DestinationMetadata = {
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

const captureOutput = <T,>(value: T): T => value

let mounted: { container: HTMLDivElement; root: Root } | null = null

function mountPanel(
  initialDestinations: DestinationDraft[],
  metadata: DestinationMetadata = configured,
): DestinationDraft[] {
  const updates: DestinationDraft[] = []
  function Harness() {
    const [destinations, setDestinations] = useState(initialDestinations)
    return (
      <ComposeDestinationsPanel
        articleUrl="https://example.test/notes/paper-lantern"
        canEdit
        commonComment="A shared fictional note."
        destinations={destinations}
        metadata={metadata}
        onDestinationChange={(next) => {
          updates.push(next)
          setDestinations((current) => [
            ...current.filter((item) => item.destination !== next.destination),
            next,
          ])
        }}
      />
    )
  }
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Harness />)
  })
  mounted = { container, root }
  return updates
}

function buttonLabelled(label: string): HTMLButtonElement {
  const button = document.querySelector(`button[aria-label="${label}"]`)
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Button ${label} was not found.`)
  }
  return button
}

function field<T extends Element>(
  selector: string,
  type: abstract new () => T,
): T {
  const element = document.querySelector(selector)
  if (!(element instanceof type)) {
    throw new Error(`${selector} was not found.`)
  }
  return element
}

async function click(target: Element): Promise<void> {
  await act(async () => userEvent.click(target))
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
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

describe('ComposeDestinationsPanel in a browser', () => {
  it('turns typing in a row into a destination-only comment and back', async () => {
    const updates = mountPanel([])

    await click(buttonLabelled('Post to Mastodon'))
    await click(buttonLabelled('Edit Mastodon post and settings'))
    const inheritedText = field('#mastodon-comment', HTMLTextAreaElement).value
    await act(async () =>
      userEvent.fill(
        field('#mastodon-comment', HTMLTextAreaElement),
        'A Mastodon-only note.',
      ),
    )
    await click(
      page.getByRole('button', { name: 'Use main comment' }).element(),
    )
    await click(page.getByRole('button', { name: 'Done' }).element())

    expect(
      captureOutput({
        inheritedText,
        updates,
        rowOpen: document.querySelector('#mastodon-comment') !== null,
      }),
    ).toEqual({
      inheritedText: 'A shared fictional note.',
      updates: [
        {
          destination: 'mastodon',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: { visibility: 'public', spoilerText: '', sensitive: false },
        },
        {
          destination: 'mastodon',
          selected: true,
          commentMode: 'custom',
          customComment: 'A Mastodon-only note.',
          options: { visibility: 'public', spoilerText: '', sensitive: false },
        },
        {
          destination: 'mastodon',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: { visibility: 'public', spoilerText: '', sensitive: false },
        },
      ],
      rowOpen: false,
    })
  })

  it('adds tags from commas, Enter, and leaving the field, and removes a chip', async () => {
    const updates = mountPanel([
      {
        destination: 'hatena',
        selected: true,
        commentMode: 'common',
        customComment: '',
        options: { tags: ['saved'], private: false },
      },
    ])

    await click(buttonLabelled('Edit Hatena post and settings'))
    const tags = () => field('#hatena-tags', HTMLInputElement)
    await act(async () => userEvent.type(tags(), 'paper,lan'))
    await act(async () => userEvent.keyboard('tern{Enter}'))
    await act(async () => userEvent.type(tags(), 'glow'))
    await click(
      page.getByRole('switch', { name: 'Private bookmark' }).element(),
    )
    await click(buttonLabelled('Remove tag saved'))

    const hatena = (tags: string[], isPrivate: boolean) => ({
      destination: 'hatena',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { tags, private: isPrivate },
    })
    expect(updates).toEqual([
      hatena(['saved', 'paper'], false),
      hatena(['saved', 'paper', 'lantern'], false),
      hatena(['saved', 'paper', 'lantern', 'glow'], false),
      hatena(['saved', 'paper', 'lantern', 'glow'], true),
      hatena(['paper', 'lantern', 'glow'], true),
    ])
  })

  it('updates Mastodon visibility, content warning, and sensitivity', async () => {
    const updates = mountPanel([
      {
        destination: 'mastodon',
        selected: true,
        commentMode: 'common',
        customComment: '',
        options: { visibility: 'public', spoilerText: '', sensitive: false },
      },
    ])

    await click(buttonLabelled('Edit Mastodon post and settings'))
    await click(field('#mastodon-visibility', HTMLButtonElement))
    await act(async () =>
      page.getByRole('option', { exact: true, name: 'Unlisted' }).click(),
    )
    await act(async () =>
      userEvent.fill(
        field('#mastodon-cw', HTMLInputElement),
        'Fictional spoiler',
      ),
    )
    await click(
      page.getByRole('switch', { name: 'Mark as sensitive' }).element(),
    )

    const mastodon = (
      visibility: string,
      spoilerText: string,
      sensitive: boolean,
    ) => ({
      destination: 'mastodon',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { visibility, spoilerText, sensitive },
    })
    expect(updates).toEqual([
      mastodon('unlisted', '', false),
      mastodon('unlisted', 'Fictional spoiler', false),
      mastodon('unlisted', 'Fictional spoiler', true),
    ])
  })

  it('blocks selecting an unconnected destination but lets a saved one be removed', async () => {
    const updates = mountPanel(
      [
        {
          destination: 'raindrop',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: { collectionId: -1, tags: [] },
        },
      ],
      {
        destinations: {
          ...configured.destinations,
          hatena: { configured: false },
          raindrop: { configured: false },
        },
      },
    )

    const hatenaDisabled = buttonLabelled('Post to Hatena').disabled
    await click(buttonLabelled('Post to Raindrop'))

    expect(
      captureOutput({
        hatenaDisabled,
        raindropDisabled: buttonLabelled('Post to Raindrop').disabled,
        statuses: [...document.querySelectorAll('[role="status"]')].map(
          (status) => status.textContent,
        ),
        updates: updates.map((update) => [update.destination, update.selected]),
      }),
    ).toEqual({
      hatenaDisabled: true,
      raindropDisabled: true,
      statuses: ['Not connected', 'Not connected'],
      updates: [['raindrop', false]],
    })
  })

  it('keeps an unknown Raindrop collection until a real collection is chosen', async () => {
    const updates = mountPanel([
      {
        destination: 'raindrop',
        selected: true,
        commentMode: 'common',
        customComment: '',
        options: { collectionId: 918, tags: [] },
      },
    ])

    await click(buttonLabelled('Edit Raindrop post and settings'))
    const status = document.querySelector('[role="status"]')?.textContent
    const collectionField = () =>
      field('#raindrop-collection', HTMLButtonElement)
    const savedCollectionLabel = collectionField().textContent
    await click(collectionField())
    const unknownOption = page.getByRole('option', {
      exact: true,
      name: 'Saved collection ID 918 (not in the available list)',
    })
    const unknownOptionDisabled = (
      await vi.waitFor(() => unknownOption.element())
    ).getAttribute('aria-disabled')
    await act(async () =>
      page
        .getByRole('option', {
          exact: true,
          name: 'Fictional reading collection',
        })
        .click(),
    )
    const chosenCollectionLabel = collectionField().textContent
    await click(collectionField())
    await act(async () =>
      page.getByRole('option', { exact: true, name: 'Unsorted' }).click(),
    )

    const raindrop = (collectionId: number) => ({
      destination: 'raindrop',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { collectionId, tags: [] },
    })
    expect(
      captureOutput({
        status,
        savedCollectionLabel,
        unknownOptionDisabled,
        chosenCollectionLabel,
        unsortedLabel: collectionField().textContent,
        updates,
      }),
    ).toEqual({
      status:
        'Saved collection ID 918 is not available. Choose an available collection.',
      savedCollectionLabel: 'Collection 918',
      unknownOptionDisabled: 'true',
      chosenCollectionLabel: 'Fictional reading collection',
      unsortedLabel: 'Unsorted',
      updates: [raindrop(71), raindrop(-1)],
    })
  })
})
