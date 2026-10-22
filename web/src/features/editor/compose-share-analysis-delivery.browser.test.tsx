import {
  type Article,
  type BookmarkDraft,
  type DestinationDraft,
  type DestinationMetadata,
  type PublishRequest,
  PublishRequestSchema,
  type ShareInput,
  type Summary,
} from 'api/contracts'
import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createIndexedDbDraftStore } from '#features/drafts/draft-store'
import type { ComposeAnalysisSaveCommand } from '#features/editor/compose-analysis-command'
import { ComposeController } from '#features/editor/compose-controller'
import { useComposeAnalysis } from '#features/editor/use-compose-analysis'

const databaseName = 'bookmarker-local-drafts'
const existingDraftId = '00000000-0000-4000-8000-000000000131'

const shareInput: ShareInput = {
  version: 1,
  url: 'https://fictional.example.invalid/shared-paper-kite',
  title: 'A shared fictional paper kite',
  sharedText: 'A paper kite has a tail made from violet ribbon.',
  partial: true,
}

const extractedArticle: Article = {
  url: shareInput.url,
  title: 'The extracted violet kite',
  text: 'A paper kite has a tail made from violet ribbon.',
  source: 'fetched',
  partial: false,
}

const summary: Summary = {
  summary: 'The article describes a paper kite with a violet ribbon tail.',
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

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const captureOutput = <T,>(value: T): T => value

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: (value: T) => resolvePromise?.(value),
  }
}

function existingDraft(): BookmarkDraft {
  return {
    version: 1,
    id: existingDraftId,
    source: {
      version: 1,
      url: 'https://fictional.example.invalid/previous-article',
      title: 'A previous fictional article',
      partial: true,
    },
    article: {
      url: 'https://fictional.example.invalid/previous-article',
      title: 'A previous fictional article',
      text: 'A previous fictional passage.',
      source: 'manual',
      partial: true,
    },
    commonComment: 'A comment on the existing draft.',
    destinations: [],
    delivery: [],
    analysis: {
      summary: {
        summary: 'A previously saved fictional summary.',
        partial: true,
      },
    },
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
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

function parsePublishRequest(body: unknown): PublishRequest {
  const parsed = PublishRequestSchema.safeParse(body)
  if (!parsed.success) throw new Error('The publish request was invalid.')
  return parsed.data
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

function waitForSummary(
  controller: ComposeController,
  draftId: string,
): Promise<BookmarkDraft> {
  return new Promise((resolve) => {
    let unsubscribe = () => {}
    unsubscribe = controller.subscribe((state) => {
      const activeDraft = state.activeDraft
      if (
        activeDraft?.id === draftId &&
        activeDraft.analysis?.summary !== undefined
      ) {
        unsubscribe()
        resolve(activeDraft)
      }
    })
  })
}

let root: Root | undefined
let container: HTMLDivElement | undefined
let setAutoAnalyzeDraftId: (id: string | null) => void = () => undefined

const WorkflowHarness = ({ controller }: { controller: ComposeController }) => {
  const [state, setState] = useState(controller.state)
  const [autoAnalyzeId, setAutoAnalyzeId] = useState<string | null>(null)
  setAutoAnalyzeDraftId = setAutoAnalyzeId

  useEffect(() => controller.subscribe(setState), [controller])
  useComposeAnalysis({
    draft: state.activeDraft,
    canEdit: state.canEdit && !state.isLoading,
    autoAnalyzeDraftId: autoAnalyzeId,
    saveAnalysisResult: (command: ComposeAnalysisSaveCommand) =>
      controller.saveAnalysisResult(command),
  })

  return null
}

beforeEach(async () => {
  await deleteDatabase()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.history.replaceState(null, '', '/compose')
  setAutoAnalyzeDraftId = () => undefined
})

afterEach(async () => {
  if (root !== undefined) act(() => root?.unmount())
  root = undefined
  container?.remove()
  container = undefined
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe('shared draft analysis and delivery', () => {
  it('analyzes a shared draft, preserves comments, and publishes its saved snapshot', async () => {
    const store = createIndexedDbDraftStore()
    const previousDraft = existingDraft()
    const added = await store.addDraft(previousDraft)
    if (added.isErr()) throw added.error

    const requests: Array<{ path: string; body: unknown }> = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      const bodyValue = init?.body
      const body: unknown =
        typeof bodyValue === 'string' ? JSON.parse(bodyValue) : null
      requests.push({ path, body })

      if (path === '/api/articles/extract') {
        return Promise.resolve(jsonResponse(extractedArticle))
      }
      if (path === '/api/analysis/summary') {
        return Promise.resolve(jsonResponse(summary))
      }
      if (path === '/api/publish') {
        const publishRequest = parsePublishRequest(body)
        return Promise.resolve(
          jsonResponse({
            results: publishRequest.targets.map((target) => ({
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

    const controller = new ComposeController(store)
    await controller.start(previousDraft.id)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(<WorkflowHarness controller={controller} />)
      await Promise.resolve()
    })

    const openedDraftPromise = deferred<BookmarkDraft>()
    await act(async () => {
      const opened = await controller.openSource(shareInput, {
        cleanupUrl: '/compose',
        intake: 'share',
      })
      if (opened.isErr()) throw opened.error
      openedDraftPromise.resolve(opened.value)
    })
    const openedDraft = await openedDraftPromise.promise

    const summarySaved = waitForSummary(controller, openedDraft.id)
    await act(async () => {
      setAutoAnalyzeDraftId(openedDraft.id)
      await Promise.resolve()
    })
    await act(async () => {
      await summarySaved
    })

    const hatena: DestinationDraft = {
      destination: 'hatena',
      selected: true,
      commentMode: 'custom',
      customComment: 'A separate fictional note 😀 ',
      options: { tags: ['fictional', 'unfinished tag'], private: true },
    }
    const mastodon: DestinationDraft = {
      destination: 'mastodon',
      selected: true,
      commentMode: 'common',
      customComment: 'An inactive individual note.',
      options: {
        visibility: 'unlisted',
        spoilerText: 'A fictional warning.',
        sensitive: true,
      },
    }
    await act(async () => {
      controller.updateCommonComment('A shared note with trailing spaces  ')
      controller.updateDestination(hatena)
      controller.updateDestination(mastodon)
      await controller.publishSelectedDestinations(metadata)
    })

    const storedExisting = await store.getDraft(previousDraft.id)
    if (storedExisting.isErr()) throw storedExisting.error
    const storedNewDraft = await store.getDraft(openedDraft.id)
    if (storedNewDraft.isErr()) throw storedNewDraft.error
    const newDraft = storedNewDraft.value
    const publishRequest = requests.find(({ path }) => path === '/api/publish')
    const actual = {
      requestPaths: requests.map(({ path }) => path),
      article: newDraft?.article ?? null,
      source: newDraft?.source ?? null,
      commonComment: newDraft?.commonComment ?? null,
      destinations: newDraft?.destinations ?? [],
      summary: newDraft?.analysis?.summary ?? null,
      verification: newDraft?.analysis?.verification ?? null,
      delivery: normalizeDelivery(newDraft?.delivery ?? []),
      request:
        publishRequest?.body === null || publishRequest?.body === undefined
          ? null
          : normalizeRequest(parsePublishRequest(publishRequest.body)),
      existingDraft: storedExisting.value,
      routeDraftMatchesOpenedDraft:
        new URLSearchParams(window.location.search).get('draft') ===
        openedDraft.id,
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      requestPaths: [
        '/api/articles/extract',
        '/api/analysis/summary',
        '/api/publish',
      ],
      article: extractedArticle,
      source: shareInput,
      commonComment: 'A shared note with trailing spaces  ',
      destinations: [hatena, mastodon],
      summary,
      verification: null,
      delivery: [
        {
          article: {
            url: extractedArticle.url,
            title: extractedArticle.title,
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'A separate fictional note 😀 ',
            options: { tags: ['fictional', 'unfinished tag'], private: true },
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
            comment: 'A shared note with trailing spaces  ',
            options: {
              visibility: 'unlisted',
              spoilerText: 'A fictional warning.',
              sensitive: true,
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
      request: {
        article: {
          url: extractedArticle.url,
          title: extractedArticle.title,
        },
        targets: [
          {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'A separate fictional note 😀 ',
            options: { tags: ['fictional', 'unfinished tag'], private: true },
          },
          {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'A shared note with trailing spaces  ',
            options: {
              visibility: 'unlisted',
              spoilerText: 'A fictional warning.',
              sensitive: true,
            },
          },
        ],
      },
      existingDraft: previousDraft,
      routeDraftMatchesOpenedDraft: true,
    })
  })
})
