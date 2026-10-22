import type {
  BookmarkDraft,
  DestinationMetadata,
  PublishRequest,
} from 'api/contracts'
import { PublishRequestSchema } from 'api/contracts'
import { errAsync, type Result, ResultAsync } from 'neverthrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DraftError } from '#features/drafts/draft-error'
import {
  createIndexedDbDraftStore,
  type DraftStore,
} from '#features/drafts/draft-store'
import { ComposeController } from '#features/editor/compose-controller'

const databaseName = 'bookmarker-local-drafts'
const firstDraftId = '00000000-0000-4000-8000-000000000101'
const secondDraftId = '00000000-0000-4000-8000-000000000102'
const successfulOperationId = '00000000-0000-4000-8000-000000000111'
const failedOperationId = '00000000-0000-4000-8000-000000000112'
const unknownOperationId = '00000000-0000-4000-8000-000000000113'

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
      collections: [{ id: 71, title: 'Fictional collection', public: false }],
    },
    x: { configured: true },
  },
}

const captureOutput = <T,>(value: T): T => value

function parseRequest(init: RequestInit | undefined): PublishRequest {
  const body = init?.body
  if (typeof body !== 'string') throw new Error('The request body is missing.')
  const value: unknown = JSON.parse(body)
  const parsed = PublishRequestSchema.safeParse(value)
  if (!parsed.success) throw new Error('The request body is invalid.')
  return parsed.data
}

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

function valueOrThrow<T, E>(result: Result<T, E>): T {
  return result.match(
    (value) => value,
    (error) => {
      throw error instanceof Error
        ? error
        : new Error('The operation returned an error.')
    },
  )
}

function draft(id = firstDraftId): BookmarkDraft {
  return {
    version: 1,
    id,
    source: {
      version: 1,
      url: 'https://fictional.example.invalid/article',
      title: 'A fictional article',
      sharedText: 'A fictional passage.',
      partial: true,
    },
    article: {
      url: 'https://fictional.example.invalid/article',
      title: 'A fictional article',
      text: 'A fictional passage.',
      source: 'shared',
      partial: true,
    },
    commonComment: 'An unfinished common comment',
    destinations: [
      {
        destination: 'hatena',
        selected: true,
        commentMode: 'common',
        customComment: 'An inactive individual comment',
        options: { tags: ['fictional tag'], private: false },
      },
    ],
    delivery: [],
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function deliveryStore(
  base: DraftStore,
  saveDraft: (
    draft: BookmarkDraft,
    persist: () => ResultAsync<void, DraftError>,
  ) => ResultAsync<void, DraftError>,
): DraftStore {
  return {
    listDrafts: () => base.listDrafts(),
    getDraft: (id) => base.getDraft(id),
    addDraft: (draft) => base.addDraft(draft),
    saveDraft: (draft) => saveDraft(draft, () => base.saveDraft(draft)),
    commitImport: (importId, draft) => base.commitImport(importId, draft),
    deleteDraft: (id, options) => base.deleteDraft(id, options),
    clearDiscardedImport: (importId) => base.clearDiscardedImport(importId),
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

beforeEach(async () => {
  await deleteDatabase()
  window.history.replaceState(null, '', '/compose')
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await deleteDatabase()
})

describe('ComposeController delivery', () => {
  it('waits for the pending snapshot and saves results before showing success', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await base.addDraft(initialDraft))
    valueOrThrow(await base.addDraft(draft(secondDraftId)))
    const pendingSaveStarted = deferred<undefined>()
    const allowPendingSave = deferred<undefined>()
    const resultSaveAttempts: BookmarkDraft[] = []
    let failFirstResultSave = true
    const store = deliveryStore(base, (snapshot, persist) => {
      if (snapshot.delivery.some((item) => item.result !== undefined)) {
        resultSaveAttempts.push(structuredClone(snapshot))
        if (failFirstResultSave) {
          failFirstResultSave = false
          return errAsync(
            new DraftError('storage-failed', 'Fictional storage failure.'),
          )
        }
      }

      if (snapshot.delivery.some((item) => item.result === undefined)) {
        pendingSaveStarted.resolve(undefined)
        return ResultAsync.fromPromise(
          allowPendingSave.promise,
          () => new DraftError('storage-failed', 'Fictional storage failure.'),
        ).andThen(persist)
      }

      return persist()
    })
    const publishStarted = deferred<{
      request: PublishRequest
      persisted: BookmarkDraft
    }>()
    const allowPublishResponse = deferred<undefined>()
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = parseRequest(init)
        const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
        if (persisted === null)
          throw new Error('The pending snapshot was not stored.')
        publishStarted.resolve({ request, persisted })
        await allowPublishResponse.promise
        return response({
          results: request.targets.map((target) => ({
            destination: target.destination,
            operationId: target.operationId,
            status: 'succeeded',
            retryable: false,
          })),
        })
      },
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('  Latest common comment 😀  ')
    const publish = controller.publishSelectedDestinations(metadata)
    await pendingSaveStarted.promise

    const secondTab = new ComposeController(store)
    await secondTab.start(initialDraft.id)
    const duplicatePublish = controller.publishSelectedDestinations(metadata)
    await duplicatePublish
    await secondTab.publishSelectedDestinations(metadata)
    await controller.selectDraft(secondDraftId)
    controller.requestDiscard()
    await controller.discardDraft()
    const rejectedShare = await controller.openSource(
      {
        version: 1,
        url: 'https://fictional.example.invalid/blocked-share',
        partial: true,
      },
      { cleanupUrl: '/compose', intake: 'share' },
    )
    const beforePendingCommit = valueOrThrow(
      await base.getDraft(initialDraft.id),
    )
    const beforeSend = {
      callCount: fetchMock.mock.calls.length,
      deliveryState: controller.state.deliveryState,
      activeDraftId: controller.state.activeDraft?.id ?? null,
      discardOpen: controller.state.discardOpen,
      rejectedShareCode: rejectedShare.isErr()
        ? rejectedShare.error.code
        : null,
      secondTabCanEdit: secondTab.state.canEdit,
      secondTabLockState: secondTab.state.lockState,
      persistedComment: beforePendingCommit?.commonComment ?? null,
      persistedDelivery: beforePendingCommit?.delivery ?? [],
    }

    allowPendingSave.resolve(undefined)
    const requestAtSend = await publishStarted.promise
    const whileSending = {
      deliveryState: controller.state.deliveryState,
      persistedDelivery: normalizeDelivery(requestAtSend.persisted.delivery),
      request: normalizeRequest(requestAtSend.request),
    }
    allowPublishResponse.resolve(undefined)
    await publish

    const resultSaveFailedDraft = valueOrThrow(
      await base.getDraft(initialDraft.id),
    )
    const afterResultSaveFailure = {
      callCount: fetchMock.mock.calls.length,
      deliveryState: controller.state.deliveryState,
      saveState: controller.state.saveState,
      errorMessage: controller.state.deliveryErrorMessage,
      memoryDelivery: normalizeDelivery(
        controller.state.activeDraft?.delivery ?? [],
      ),
      persistedDelivery: normalizeDelivery(
        resultSaveFailedDraft?.delivery ?? [],
      ),
    }

    await controller.retryDeliverySave()
    const finalDraft = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      beforeSend,
      whileSending,
      afterResultSaveFailure,
      afterSaveRetry: {
        callCount: fetchMock.mock.calls.length,
        resultSaveAttempts: resultSaveAttempts.length,
        deliveryState: controller.state.deliveryState,
        saveState: controller.state.saveState,
        commonComment: controller.state.activeDraft?.commonComment ?? null,
        memoryDelivery: normalizeDelivery(
          controller.state.activeDraft?.delivery ?? [],
        ),
        persistedDelivery: normalizeDelivery(finalDraft?.delivery ?? []),
      },
    }
    await secondTab.dispose()
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      beforeSend: {
        callCount: 0,
        deliveryState: 'saving-pending',
        activeDraftId: firstDraftId,
        discardOpen: false,
        rejectedShareCode: 'delivery-in-progress',
        secondTabCanEdit: false,
        secondTabLockState: 'locked',
        persistedComment: '  Latest common comment 😀  ',
        persistedDelivery: [],
      },
      whileSending: {
        deliveryState: 'sending',
        persistedDelivery: [
          {
            article: {
              url: 'https://fictional.example.invalid/article',
              title: 'A fictional article',
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
          },
        ],
        request: {
          article: {
            url: 'https://fictional.example.invalid/article',
            title: 'A fictional article',
          },
          targets: [
            {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
          ],
        },
      },
      afterResultSaveFailure: {
        callCount: 1,
        deliveryState: 'result-save-failed',
        saveState: 'failed',
        errorMessage:
          'The delivery result could not be saved. Retry saving it; the service will not be contacted again.',
        memoryDelivery: [
          {
            article: {
              url: 'https://fictional.example.invalid/article',
              title: 'A fictional article',
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
          },
        ],
        persistedDelivery: [
          {
            article: {
              url: 'https://fictional.example.invalid/article',
              title: 'A fictional article',
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
          },
        ],
      },
      afterSaveRetry: {
        callCount: 1,
        resultSaveAttempts: 2,
        deliveryState: 'idle',
        saveState: 'saved',
        commonComment: '  Latest common comment 😀  ',
        memoryDelivery: [
          {
            article: {
              url: 'https://fictional.example.invalid/article',
              title: 'A fictional article',
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
            result: {
              destination: 'hatena',
              operationId: '<operation>',
              status: 'succeeded',
              retryable: false,
            },
          },
        ],
        persistedDelivery: [
          {
            article: {
              url: 'https://fictional.example.invalid/article',
              title: 'A fictional article',
            },
            target: {
              destination: 'hatena',
              operationId: '<operation>',
              comment: '  Latest common comment 😀  ',
              options: { tags: ['fictional tag'], private: false },
            },
            result: {
              destination: 'hatena',
              operationId: '<operation>',
              status: 'succeeded',
              retryable: false,
            },
          },
        ],
      },
    })
  })

  it('does not contact the API when saving a pending snapshot fails', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await base.addDraft(initialDraft))
    let failedPendingSave = false
    const store = deliveryStore(base, (snapshot, persist) => {
      if (
        !failedPendingSave &&
        snapshot.delivery.some((item) => item.result === undefined)
      ) {
        failedPendingSave = true
        return errAsync(
          new DraftError('storage-failed', 'Fictional storage failure.'),
        )
      }
      return persist()
    })
    const fetchMock = vi.fn(() => Promise.resolve(response({ results: [] })))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('Keep this local comment.')

    await controller.publishSelectedDestinations(metadata)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      failedPendingSave,
      deliveryState: controller.state.deliveryState,
      saveState: controller.state.saveState,
      errorMessage: controller.state.deliveryErrorMessage,
      commonComment: persisted?.commonComment ?? null,
      delivery: persisted?.delivery ?? [],
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 0,
      failedPendingSave: true,
      deliveryState: 'idle',
      saveState: 'saved',
      errorMessage:
        'Publishing was cancelled because its pending snapshot could not be saved. No request was sent. Fictional storage failure.',
      commonComment: 'Keep this local comment.',
      delivery: [],
    })
  })

  it('keeps the latest input when its save fails before publishing', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await base.addDraft(initialDraft))
    const store = deliveryStore(base, (snapshot, persist) => {
      if (snapshot.commonComment === 'An unsaved comment.') {
        return errAsync(
          new DraftError('storage-failed', 'Fictional storage failure.'),
        )
      }
      return persist()
    })
    const fetchMock = vi.fn(() => Promise.resolve(response({ results: [] })))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('An unsaved comment.')

    await controller.publishSelectedDestinations(metadata)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      deliveryState: controller.state.deliveryState,
      saveState: controller.state.saveState,
      memoryComment: controller.state.activeDraft?.commonComment ?? null,
      persistedComment: persisted?.commonComment ?? null,
      delivery: persisted?.delivery ?? [],
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 0,
      deliveryState: 'idle',
      saveState: 'failed',
      memoryComment: 'An unsaved comment.',
      persistedComment: 'An unfinished common comment',
      delivery: [],
    })
  })

  it('does not contact the API when saving a retry pending snapshot fails', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft: BookmarkDraft = {
      ...draft(),
      delivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'hatena',
            operationId: failedOperationId,
            comment: 'The frozen failed comment.',
            options: { tags: ['frozen tag'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: failedOperationId,
            status: 'failed',
            retryable: true,
          },
        },
      ],
    }
    valueOrThrow(await base.addDraft(initialDraft))
    let pendingSaveFailed = false
    const store = deliveryStore(base, (snapshot, persist) => {
      if (
        !pendingSaveFailed &&
        snapshot.delivery.some((item) => item.result === undefined)
      ) {
        pendingSaveFailed = true
        return errAsync(
          new DraftError('storage-failed', 'Fictional storage failure.'),
        )
      }
      return persist()
    })
    const fetchMock = vi.fn(() => Promise.resolve(response({ results: [] })))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)

    await controller.retryFailedDeliveries(metadata)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      pendingSaveFailed,
      deliveryState: controller.state.deliveryState,
      saveState: controller.state.saveState,
      errorMessage: controller.state.deliveryErrorMessage,
      memoryDelivery: normalizeDelivery(
        controller.state.activeDraft?.delivery ?? [],
      ),
      persistedDelivery: normalizeDelivery(persisted?.delivery ?? []),
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 0,
      pendingSaveFailed: true,
      deliveryState: 'idle',
      saveState: 'saved',
      errorMessage:
        'Retry was cancelled because its pending snapshot could not be saved. No request was sent. Fictional storage failure.',
      memoryDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'The frozen failed comment.',
            options: { tags: ['frozen tag'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: '<operation>',
            status: 'failed',
            retryable: true,
          },
        },
      ],
      persistedDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'The frozen failed comment.',
            options: { tags: ['frozen tag'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: '<operation>',
            status: 'failed',
            retryable: true,
          },
        },
      ],
    })
  })

  it('retries only the original retryable failure and never resends other attempts', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft: BookmarkDraft = {
      ...draft(),
      article: {
        url: 'https://fictional.example.invalid/original-snapshot',
        title: 'The original saved title',
        text: 'The original saved body.',
        source: 'shared',
        partial: false,
      },
      destinations: [
        {
          destination: 'hatena',
          selected: true,
          commentMode: 'custom',
          customComment: 'A newer Hatena comment.',
          options: { tags: ['new tag'], private: false },
        },
        {
          destination: 'mastodon',
          selected: true,
          commentMode: 'custom',
          customComment: 'A newer Mastodon comment.',
          options: {
            visibility: 'public',
            spoilerText: 'A newer warning.',
            sensitive: true,
          },
        },
        {
          destination: 'raindrop',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: { collectionId: 71, tags: ['new collection tag'] },
        },
      ],
      delivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/old-article',
            title: 'The frozen article title',
          },
          target: {
            destination: 'hatena',
            operationId: successfulOperationId,
            comment: 'The already successful comment.',
            options: { tags: ['old tag'], private: true },
          },
          result: {
            destination: 'hatena',
            operationId: successfulOperationId,
            status: 'succeeded',
            retryable: false,
          },
        },
        {
          article: {
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'mastodon',
            operationId: failedOperationId,
            comment: 'The frozen failed comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'The frozen warning.',
              sensitive: false,
            },
          },
          result: {
            destination: 'mastodon',
            operationId: failedOperationId,
            status: 'failed',
            retryable: true,
            message: 'A temporary failure.',
          },
        },
        {
          article: { url: 'https://fictional.example.invalid/unknown-article' },
          target: {
            destination: 'raindrop',
            operationId: unknownOperationId,
            comment: 'The unknown result comment.',
            options: { collectionId: 71, tags: ['unknown tag'] },
          },
          result: {
            destination: 'raindrop',
            operationId: unknownOperationId,
            status: 'unknown',
            retryable: false,
          },
        },
      ],
    }
    valueOrThrow(await base.addDraft(initialDraft))
    const requests: PublishRequest[] = []
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(init)
      requests.push(request)
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
    })
    vi.stubGlobal('fetch', fetchMock)

    const controller = new ComposeController(base)
    await controller.start(initialDraft.id)
    controller.updateTitle('A newly edited title.')
    controller.updateCommonComment('A newly edited common comment.')
    await controller.retryFailedDeliveries(metadata)
    await controller.publishSelectedDestinations(metadata)
    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      retryRequest:
        requests[0] === undefined ? null : normalizeRequest(requests[0]),
      memoryDelivery: normalizeDelivery(
        controller.state.activeDraft?.delivery ?? [],
      ),
      persistedDelivery: normalizeDelivery(persisted?.delivery ?? []),
      deliveryErrorMessage: controller.state.deliveryErrorMessage,
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 1,
      retryRequest: {
        article: {
          url: 'https://fictional.example.invalid/retry-article',
          title: 'The frozen retry title',
        },
        targets: [
          {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'The frozen failed comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'The frozen warning.',
              sensitive: false,
            },
          },
        ],
      },
      memoryDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/old-article',
            title: 'The frozen article title',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'The already successful comment.',
            options: { tags: ['old tag'], private: true },
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
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'The frozen failed comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'The frozen warning.',
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
        {
          article: { url: 'https://fictional.example.invalid/unknown-article' },
          target: {
            destination: 'raindrop',
            operationId: '<operation>',
            comment: 'The unknown result comment.',
            options: { collectionId: 71, tags: ['unknown tag'] },
          },
          result: {
            destination: 'raindrop',
            operationId: '<operation>',
            status: 'unknown',
            retryable: false,
          },
        },
      ],
      persistedDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/old-article',
            title: 'The frozen article title',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'The already successful comment.',
            options: { tags: ['old tag'], private: true },
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
            url: 'https://fictional.example.invalid/retry-article',
            title: 'The frozen retry title',
          },
          target: {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'The frozen failed comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'The frozen warning.',
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
        {
          article: { url: 'https://fictional.example.invalid/unknown-article' },
          target: {
            destination: 'raindrop',
            operationId: '<operation>',
            comment: 'The unknown result comment.',
            options: { collectionId: 71, tags: ['unknown tag'] },
          },
          result: {
            destination: 'raindrop',
            operationId: '<operation>',
            status: 'unknown',
            retryable: false,
          },
        },
      ],
      deliveryErrorMessage:
        'Every selected API destination already has a delivery attempt. Retry eligible failures separately.',
    })
  })

  it('stops retrying after an authentication failure between destination attempts', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft: BookmarkDraft = {
      ...draft(),
      destinations: [],
      delivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/first-article',
          },
          target: {
            destination: 'hatena',
            operationId: successfulOperationId,
            comment: 'The first saved comment.',
            options: { tags: ['first'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: successfulOperationId,
            status: 'failed',
            retryable: true,
          },
        },
        {
          article: {
            url: 'https://fictional.example.invalid/second-article',
          },
          target: {
            destination: 'mastodon',
            operationId: failedOperationId,
            comment: 'The second saved comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'A saved warning.',
              sensitive: false,
            },
          },
          result: {
            destination: 'mastodon',
            operationId: failedOperationId,
            status: 'failed',
            retryable: true,
          },
        },
      ],
    }
    valueOrThrow(await base.addDraft(initialDraft))
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response(
          { error: { code: 'unauthorized', message: 'Sign in required.' } },
          401,
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new ComposeController(base)
    await controller.start(initialDraft.id)
    await controller.retryFailedDeliveries(metadata)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      authenticationRequired: controller.state.deliveryAuthenticationRequired,
      delivery: normalizeDelivery(persisted?.delivery ?? []),
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 1,
      authenticationRequired: true,
      delivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/first-article',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'The first saved comment.',
            options: { tags: ['first'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: '<operation>',
            status: 'unknown',
            retryable: false,
            message: 'Delivery could not be confirmed.',
          },
        },
        {
          article: {
            url: 'https://fictional.example.invalid/second-article',
          },
          target: {
            destination: 'mastodon',
            operationId: '<operation>',
            comment: 'The second saved comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: 'A saved warning.',
              sensitive: false,
            },
          },
          result: {
            destination: 'mastodon',
            operationId: '<operation>',
            status: 'failed',
            retryable: true,
          },
        },
      ],
    })
  })

  it('does not publish a saved collection when Raindrop details are unavailable', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft: BookmarkDraft = {
      ...draft(),
      destinations: [
        {
          destination: 'raindrop',
          selected: true,
          commentMode: 'common',
          customComment: '',
          options: { collectionId: 71, tags: ['kept tag'] },
        },
      ],
    }
    valueOrThrow(await base.addDraft(initialDraft))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const detailsUnavailable: DestinationMetadata = {
      destinations: {
        ...metadata.destinations,
        raindrop: {
          configured: true,
          metadataError: {
            code: 'unavailable',
            message: 'Collection details are unavailable.',
          },
        },
      },
    }

    const controller = new ComposeController(base)
    await controller.start(initialDraft.id)
    await controller.publishSelectedDestinations(detailsUnavailable)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const activeRaindrop = controller.state.activeDraft?.destinations.find(
      (destination) => destination.destination === 'raindrop',
    )
    const actual = {
      requestCount: fetchMock.mock.calls.length,
      delivery: normalizeDelivery(persisted?.delivery ?? []),
      collectionId:
        activeRaindrop?.destination === 'raindrop'
          ? activeRaindrop.options.collectionId
          : null,
      deliveryErrorMessage: controller.state.deliveryErrorMessage,
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      requestCount: 0,
      delivery: [],
      collectionId: 71,
      deliveryErrorMessage:
        'Raindrop collection details are unavailable. Retry destination details or choose Unsorted. The saved collection ID was kept.',
    })
  })

  it('keeps edited input and records unknown when the API requires authentication', async () => {
    const base = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await base.addDraft(initialDraft))
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        response(
          { error: { code: 'unauthorized', message: 'Sign in required.' } },
          401,
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const controller = new ComposeController(base)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('Keep this exact comment 😀  ')

    await controller.publishSelectedDestinations(metadata)

    controller.updateCommonComment('Keep this exact comment after sign-in.  ')
    await controller.retrySave()
    await controller.publishSelectedDestinations(metadata)

    const persisted = valueOrThrow(await base.getDraft(initialDraft.id))
    const actual = {
      callCount: fetchMock.mock.calls.length,
      deliveryState: controller.state.deliveryState,
      saveState: controller.state.saveState,
      authenticationRequired: controller.state.deliveryAuthenticationRequired,
      deliveryErrorMessage: controller.state.deliveryErrorMessage,
      memoryComment: controller.state.activeDraft?.commonComment ?? null,
      memoryDelivery: normalizeDelivery(
        controller.state.activeDraft?.delivery ?? [],
      ),
      persistedComment: persisted?.commonComment ?? null,
      persistedDelivery: normalizeDelivery(persisted?.delivery ?? []),
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      callCount: 1,
      deliveryState: 'idle',
      saveState: 'saved',
      authenticationRequired: true,
      deliveryErrorMessage:
        'Every selected API destination already has a delivery attempt. Retry eligible failures separately.',
      memoryComment: 'Keep this exact comment after sign-in.  ',
      memoryDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/article',
            title: 'A fictional article',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'Keep this exact comment 😀  ',
            options: { tags: ['fictional tag'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: '<operation>',
            status: 'unknown',
            retryable: false,
            message: 'Delivery could not be confirmed.',
          },
        },
      ],
      persistedComment: 'Keep this exact comment after sign-in.  ',
      persistedDelivery: [
        {
          article: {
            url: 'https://fictional.example.invalid/article',
            title: 'A fictional article',
          },
          target: {
            destination: 'hatena',
            operationId: '<operation>',
            comment: 'Keep this exact comment 😀  ',
            options: { tags: ['fictional tag'], private: false },
          },
          result: {
            destination: 'hatena',
            operationId: '<operation>',
            status: 'unknown',
            retryable: false,
            message: 'Delivery could not be confirmed.',
          },
        },
      ],
    })
  })
})
