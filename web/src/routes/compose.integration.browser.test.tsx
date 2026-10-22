import '#index.css'

import {
  type Article,
  type BookmarkDraft,
  type DestinationMetadata,
  type PublishRequest,
  PublishRequestSchema,
  type ShareInput,
  type Summary,
} from 'api/contracts'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { createIndexedDbDraftStore } from '#features/drafts/draft-store'
import { ComposeRoute } from '#routes/compose'

const databaseName = 'bookmarker-local-drafts'
const shareInput: ShareInput = {
  version: 1,
  url: 'https://fictional.example.invalid/shared-copper-fox',
  title: 'A shared fictional copper fox',
  sharedText: 'A copper fox crosses a quiet garden.',
  partial: true,
}
const extractedArticle: Article = {
  url: shareInput.url,
  title: 'The extracted copper fox',
  text: 'A copper fox crosses a quiet garden.',
  source: 'fetched',
  partial: false,
}
const summary: Summary = {
  summary: 'The article describes a copper fox crossing a quiet garden.',
  partial: false,
}
const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: {
      configured: true,
      maxCharacters: 500,
      charactersReservedPerUrl: 23,
    },
    raindrop: {
      configured: true,
      collections: [
        { id: 71, title: 'Fictional reading collection', public: false },
      ],
    },
    x: { configured: true },
  },
}

let mounted: { container: HTMLDivElement; root: Root } | null = null

const captureOutput = <T,>(value: T): T => value

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.pathname
  return new URL(input.url).pathname
}

function bodyValue(init: RequestInit | undefined): unknown {
  return typeof init?.body === 'string' ? JSON.parse(init.body) : null
}

function parsePublishRequest(value: unknown): PublishRequest {
  const parsed = PublishRequestSchema.safeParse(value)
  if (!parsed.success) throw new Error('The publish request was invalid.')
  return parsed.data
}

function normalizeRequest(request: PublishRequest): PublishRequest {
  return {
    article: request.article,
    targets: request.targets.map((target) => ({
      ...target,
      operationId: '<operation>',
    })),
  }
}

function normalizeDelivery(
  delivery: BookmarkDraft['delivery'],
): BookmarkDraft['delivery'] {
  return delivery.map((snapshot) => ({
    article: snapshot.article,
    target: { ...snapshot.target, operationId: '<operation>' },
    ...(snapshot.result === undefined
      ? {}
      : { result: { ...snapshot.result, operationId: '<operation>' } }),
  }))
}

function input(selector: string): HTMLInputElement {
  const match = document.querySelector(selector)
  if (!(match instanceof HTMLInputElement)) {
    throw new Error(`Element ${selector} was not found.`)
  }
  return match
}

function textarea(selector: string): HTMLTextAreaElement {
  const match = document.querySelector(selector)
  if (!(match instanceof HTMLTextAreaElement)) {
    throw new Error(`Element ${selector} was not found.`)
  }
  return match
}

function button(selector: string): HTMLButtonElement {
  const match = document.querySelector(selector)
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Element ${selector} was not found.`)
  }
  return match
}

function deliveryStatusLabels(): string[] {
  const list = document.querySelector(
    '[aria-label="Delivery results by destination"]',
  )
  if (!(list instanceof HTMLUListElement)) return []
  return [...list.querySelectorAll('[role="status"]')].map((status) =>
    status.textContent.trim(),
  )
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (predicate()) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
  throw new Error('The expected compose screen state was not reached.')
}

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => {
      resolve()
    }
    request.onerror = () => {
      reject(
        request.error ?? new Error('The test database could not be deleted.'),
      )
    }
    request.onblocked = () => {
      reject(new Error('The test database is still open.'))
    }
  })
}

beforeEach(async () => {
  await deleteDatabase()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const shareFragment = encodeURIComponent(JSON.stringify(shareInput))
  window.history.replaceState(null, '', `/compose#share=${shareFragment}`)
})

afterEach(async () => {
  const current = mounted
  if (current !== null) {
    await act(async () => {
      current.root.unmount()
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
    current.container.remove()
    mounted = null
  }
  vi.unstubAllGlobals()
  await deleteDatabase()
  window.history.replaceState(null, '', '/compose')
})

describe('ComposeRoute publishing in a browser', () => {
  it('imports a shared article, analyzes it, saves both comments, and publishes through the screen', async () => {
    const requests: Array<{ path: string; body: unknown }> = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = requestPath(input)
      const body = bodyValue(init)
      requests.push({ path, body })

      if (path === '/api/destinations')
        return Promise.resolve(response(metadata))
      if (path === '/api/articles/extract') {
        return Promise.resolve(response(extractedArticle))
      }
      if (path === '/api/analysis/summary') {
        return Promise.resolve(response(summary))
      }
      if (path === '/api/publish') {
        const request = parsePublishRequest(body)
        return Promise.resolve(
          response({
            results: request.targets.map((target) => ({
              destination: target.destination,
              operationId: target.operationId,
              status: 'succeeded',
              retryable: false,
            })),
          }),
        )
      }
      throw new Error(`Unexpected request path: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mounted = { container, root }
    act(() => {
      root.render(<ComposeRoute />)
    })
    await waitFor(() =>
      document.body.textContent.includes(extractedArticle.title),
    )
    await act(async () => {
      await userEvent.click(button('button[aria-label="Open article details"]'))
    })
    await waitFor(
      () =>
        document.querySelector<HTMLInputElement>('#article-title')?.value ===
        extractedArticle.title,
    )
    await act(async () => {
      const closeButton = document.querySelector<HTMLButtonElement>(
        '[data-slot="dialog-close"]',
      )
      if (closeButton === null) {
        throw new Error(
          'The article details dialog close button was not found.',
        )
      }
      await userEvent.click(closeButton)
    })
    await waitFor(() => document.querySelector('#article-title') === null)
    await waitFor(
      () =>
        document.body.textContent.includes(summary.summary) &&
        document.body.textContent.includes('Destination details are loaded.'),
    )

    await act(async () => {
      await userEvent.fill(
        textarea('#common-comment'),
        'A shared comment with trailing spaces  ',
      )
      await userEvent.click(input('input[aria-label="Select Hatena Bookmark"]'))
      await userEvent.click(input('input[aria-label="Select Mastodon"]'))
      const trigger = button('#hatena-comment-mode')
      await userEvent.click(trigger)
      const customOption = [
        ...document.querySelectorAll('[role="option"]'),
      ].find((option) => option.textContent.trim() === 'Use individual comment')
      if (!(customOption instanceof HTMLElement)) {
        throw new Error('The individual comment option was not found.')
      }
      await userEvent.click(customOption)
      await userEvent.fill(
        textarea('#hatena-custom-comment'),
        'A separate individual comment 😀 ',
      )
    })

    await waitFor(() =>
      [...document.querySelectorAll('[role="status"]')].some(
        (status) => status.textContent.trim() === 'Saved on this device',
      ),
    )
    await act(async () => {
      const publishButton = [...document.querySelectorAll('button')].find(
        (button) =>
          button.textContent.trim() === 'Publish selected destinations',
      )
      if (!(publishButton instanceof HTMLButtonElement)) {
        throw new Error('The publish button was not found.')
      }
      await userEvent.click(publishButton)
    })
    await waitFor(() => {
      const labels = deliveryStatusLabels()
      return (
        labels.length === 2 &&
        labels[0] === 'Succeeded' &&
        labels[1] === 'Succeeded'
      )
    })

    const draftId = new URLSearchParams(window.location.search).get('draft')
    if (draftId === null)
      throw new Error('The shared draft ID was not saved in the URL.')
    const store = createIndexedDbDraftStore()
    const stored = await store.getDraft(draftId)
    if (stored.isErr()) throw stored.error
    const publishBody = requests.find(
      ({ path }) => path === '/api/publish',
    )?.body
    const actual = {
      requestPaths: requests
        .map(({ path }) => path)
        .filter((path) => path !== '/api/destinations'),
      request:
        publishBody === undefined || publishBody === null
          ? null
          : normalizeRequest(parsePublishRequest(publishBody)),
      persistedDraft: {
        id: stored.value?.id === draftId ? '<draft>' : null,
        source: stored.value?.source ?? null,
        article: stored.value?.article ?? null,
        commonComment: stored.value?.commonComment ?? null,
        destinations: stored.value?.destinations ?? [],
        summary: stored.value?.analysis?.summary ?? null,
        delivery: normalizeDelivery(stored.value?.delivery ?? []),
      },
      deliveryStatusLabels: deliveryStatusLabels(),
    }

    expect(captureOutput(actual)).toEqual({
      requestPaths: [
        '/api/articles/extract',
        '/api/analysis/summary',
        '/api/publish',
      ],
      request: {
        article: {
          url: extractedArticle.url,
          title: extractedArticle.title,
        },
        targets: [
          {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'A separate individual comment 😀 ',
            options: { tags: [], private: false },
          },
          {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'A shared comment with trailing spaces  ',
            options: {
              visibility: 'public',
              spoilerText: '',
              sensitive: false,
            },
          },
        ],
      },
      persistedDraft: {
        id: '<draft>',
        source: shareInput,
        article: extractedArticle,
        commonComment: 'A shared comment with trailing spaces  ',
        destinations: [
          {
            destination: 'hatena',
            selected: true,
            commentMode: 'custom',
            customComment: 'A separate individual comment 😀 ',
            options: { tags: [], private: false },
          },
          {
            destination: 'mastodon',
            selected: true,
            commentMode: 'common',
            customComment: '',
            options: {
              visibility: 'public',
              spoilerText: '',
              sensitive: false,
            },
          },
        ],
        summary,
        delivery: [
          {
            article: {
              url: extractedArticle.url,
              title: extractedArticle.title,
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: 'A separate individual comment 😀 ',
              options: { tags: [], private: false },
            },
            result: {
              destination: 'hatena',
              operationId: '<operation>',
              status: 'succeeded',
              retryable: false,
            },
          },
          {
            article: {
              url: extractedArticle.url,
              title: extractedArticle.title,
            },
            target: {
              destination: 'mastodon',
              operationId: '<operation>',
              comment: 'A shared comment with trailing spaces  ',
              options: {
                visibility: 'public',
                spoilerText: '',
                sensitive: false,
              },
            },
            result: {
              destination: 'mastodon',
              operationId: '<operation>',
              status: 'succeeded',
              retryable: false,
            },
          },
        ],
      },
      deliveryStatusLabels: ['Succeeded', 'Succeeded'],
    })
  })
})
