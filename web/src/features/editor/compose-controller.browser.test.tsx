import type { BookmarkDraft, ShareInput } from 'api/contracts'
import { errAsync, type Result, ResultAsync } from 'neverthrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DraftError } from '#features/drafts/draft-error'
import { acquireDraftLock } from '#features/drafts/draft-lock'
import {
  createIndexedDbDraftStore,
  type DraftStore,
} from '#features/drafts/draft-store'
import { ComposeController } from '#features/editor/compose-controller'

const databaseName = 'bookmarker-local-drafts'
const firstDraftId = '00000000-0000-4000-8000-000000000001'
const secondDraftId = '00000000-0000-4000-8000-000000000002'
const operationId = '00000000-0000-4000-8000-000000000003'

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return {
    promise,
    resolve: (value: T) => {
      resolvePromise?.(value)
    },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function captureOutput<T>(value: T): T {
  return value
}

function draft(id = firstDraftId): BookmarkDraft {
  return {
    version: 1,
    id,
    source: {
      version: 1,
      url: 'https://example.test/article',
      title: 'Source title',
      sharedText: 'Source excerpt',
      partial: true,
    },
    article: {
      url: 'https://example.test/article',
      title: 'Original title',
      text: 'Original article text',
      source: 'manual',
      partial: true,
    },
    commonComment: 'Original comment',
    destinations: [
      {
        destination: 'hatena',
        selected: true,
        commentMode: 'custom',
        customComment: 'A separate destination comment',
        options: { tags: ['sample'], private: false },
      },
      {
        destination: 'x',
        selected: false,
        commentMode: 'common',
        customComment: '',
      },
    ],
    delivery: [
      {
        article: { url: 'https://example.test/sent', title: 'Sent title' },
        target: {
          destination: 'hatena',
          operationId,
          comment: 'Sent comment',
          options: { tags: ['sent'], private: true },
        },
        result: {
          destination: 'hatena',
          operationId,
          status: 'succeeded',
          retryable: false,
          remoteUrl: 'https://example.test/published',
          message: 'Published',
        },
      },
    ],
    analysis: {
      summary: { summary: 'A short summary', partial: false },
      verification: {
        issues: [
          {
            kind: 'uncertain',
            quote: 'A claim',
            reason: 'Needs another source.',
          },
        ],
        partial: true,
      },
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function pendingDraft(id = firstDraftId): BookmarkDraft {
  const snapshot = draft(id)
  return {
    ...snapshot,
    delivery: [
      {
        article: { url: 'https://example.test/sent', title: 'Sent title' },
        target: {
          destination: 'hatena',
          operationId,
          comment: 'Sent comment',
          options: { tags: ['sent'], private: true },
        },
      },
    ],
  }
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

async function putRawDraft(value: unknown): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      db.createObjectStore('drafts', { keyPath: 'id' })
      const imports = db.createObjectStore('imports', { keyPath: 'importId' })
      imports.createIndex('by-draft-id', 'draftId')
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(
        request.error ?? new Error('The test database could not be opened.'),
      )
    }
  })

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readwrite')
    transaction.objectStore('drafts').put(value)
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('The test write was aborted.'))
    }
  })
  database.close()
}

async function readRawDraft(id: string): Promise<unknown> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(
        request.error ?? new Error('The test database could not be opened.'),
      )
    }
  })

  const value = await new Promise<unknown>((resolve, reject) => {
    const transaction = database.transaction('drafts', 'readonly')
    const request = transaction.objectStore('drafts').get(id)
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('The test read failed.'))
    }
  })
  database.close()
  return value
}

beforeEach(async () => {
  await deleteDatabase()
  window.history.replaceState({ tab: 'compose' }, '', '/compose')
})

afterEach(async () => {
  await deleteDatabase()
})

describe('ComposeController in a browser', () => {
  it('creates and restores a draft while preserving every other field', async () => {
    const store = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await store.addDraft(initialDraft))

    const editing = new ComposeController(store)
    await editing.start(initialDraft.id)
    editing.updateTitle('Edited title')
    editing.updateArticleText('Edited article text')
    editing.updateCommonComment('Edited comment')
    await editing.dispose()

    window.history.replaceState(
      { tab: 'compose' },
      '',
      `/compose?draft=${initialDraft.id}`,
    )
    const restoring = new ComposeController(store)
    await restoring.start(
      new URLSearchParams(window.location.search).get('draft'),
    )
    const restored = restoring.state.activeDraft
    await restoring.dispose()

    const actual =
      restored === null ? null : { ...restored, updatedAt: '<saved timestamp>' }
    const expected = {
      ...initialDraft,
      article: {
        url: 'https://example.test/article',
        title: 'Edited title',
        text: 'Edited article text',
        source: 'manual',
        partial: true,
      },
      commonComment: 'Edited comment',
      updatedAt: '<saved timestamp>',
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('keeps failed input active until the latest snapshot is retried', async () => {
    const baseStore = createIndexedDbDraftStore()
    const initialDraft = draft()
    const otherDraft = draft(secondDraftId)
    valueOrThrow(await baseStore.addDraft(initialDraft))
    valueOrThrow(await baseStore.addDraft(otherDraft))

    let failNextSave = true
    const writeFailure = new DraftError(
      'storage-failed',
      'The draft could not be saved on this device. Your input is still available to retry.',
    )
    const store: DraftStore = {
      ...baseStore,
      saveDraft: (snapshot) => {
        if (failNextSave) {
          failNextSave = false
          return errAsync(writeFailure)
        }
        return baseStore.saveDraft(snapshot)
      },
    }

    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('Unsaved user input')
    await controller.selectDraft(otherDraft.id)
    const afterFailedSwitch = {
      activeId: controller.state.activeDraft?.id ?? null,
      comment: controller.state.activeDraft?.commonComment ?? null,
      saveState: controller.state.saveState,
      errorMessage: controller.state.errorMessage,
    }

    await controller.retrySave()
    await controller.selectDraft(otherDraft.id)
    const persisted = valueOrThrow(await baseStore.getDraft(initialDraft.id))
    const afterRetry = {
      activeId: controller.state.activeDraft?.id ?? null,
      persistedComment: persisted?.commonComment ?? null,
      lockState: controller.state.lockState,
    }
    await controller.dispose()

    const actual = { afterFailedSwitch, afterRetry }
    const expected = {
      afterFailedSwitch: {
        activeId: initialDraft.id,
        comment: 'Unsaved user input',
        saveState: 'failed',
        errorMessage: writeFailure.message,
      },
      afterRetry: {
        activeId: otherDraft.id,
        persistedComment: 'Unsaved user input',
        lockState: 'owned',
      },
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('serializes overlapping draft activation requests without leaking locks', async () => {
    const baseStore = createIndexedDbDraftStore()
    const initialDraft = draft()
    const secondDraft = draft(secondDraftId)
    const thirdDraft = draft('00000000-0000-4000-8000-000000000004')
    valueOrThrow(await baseStore.addDraft(initialDraft))
    valueOrThrow(await baseStore.addDraft(secondDraft))
    valueOrThrow(await baseStore.addDraft(thirdDraft))

    const secondReadStarted = deferred<undefined>()
    const finishSecondRead = deferred<BookmarkDraft | null>()
    const store: DraftStore = {
      ...baseStore,
      getDraft: (id) => {
        if (id !== secondDraft.id) return baseStore.getDraft(id)
        secondReadStarted.resolve(undefined)
        return ResultAsync.fromPromise(
          finishSecondRead.promise,
          () => new DraftError('storage-failed', 'The test read failed.'),
        )
      },
    }

    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    const selectSecond = controller.selectDraft(secondDraft.id)
    await secondReadStarted.promise
    const selectThird = controller.selectDraft(thirdDraft.id)
    finishSecondRead.resolve(secondDraft)
    await Promise.all([selectSecond, selectThird])

    const secondLock = valueOrThrow(await acquireDraftLock(secondDraft.id))
    const thirdLock = valueOrThrow(await acquireDraftLock(thirdDraft.id))
    const beforeDispose = {
      activeDraftId: controller.state.activeDraft?.id ?? null,
      secondLockAvailable: secondLock !== null,
      thirdLockHeld: thirdLock === null,
    }
    if (secondLock !== null) await secondLock.release()
    if (thirdLock !== null) await thirdLock.release()
    await controller.dispose()
    const thirdLockAfterDispose = valueOrThrow(
      await acquireDraftLock(thirdDraft.id),
    )
    if (thirdLockAfterDispose !== null) await thirdLockAfterDispose.release()

    const actual = {
      beforeDispose,
      thirdLockAvailableAfterDispose: thirdLockAfterDispose !== null,
    }
    expect(captureOutput(actual)).toEqual({
      beforeDispose: {
        activeDraftId: thirdDraft.id,
        secondLockAvailable: true,
        thirdLockHeld: true,
      },
      thirdLockAvailableAfterDispose: true,
    })
  })

  it('blocks edits while a draft switch waits for its save to finish', async () => {
    const baseStore = createIndexedDbDraftStore()
    const initialDraft = draft()
    const otherDraft = draft(secondDraftId)
    valueOrThrow(await baseStore.addDraft(initialDraft))
    valueOrThrow(await baseStore.addDraft(otherDraft))

    const writeStarted = deferred<undefined>()
    const finishWrite = deferred<undefined>()
    const store: DraftStore = {
      ...baseStore,
      saveDraft: (snapshot) => {
        writeStarted.resolve(undefined)
        return ResultAsync.fromPromise(
          finishWrite.promise,
          () => new DraftError('storage-failed', 'The test save failed.'),
        ).andThen(() => baseStore.saveDraft(snapshot))
      },
    }

    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('Input saved before switching')
    await writeStarted.promise
    const switching = controller.selectDraft(otherDraft.id)
    const switchState = {
      canEdit: controller.state.canEdit,
      isLoading: controller.state.isLoading,
    }
    controller.updateCommonComment('Input sent after switching began')
    finishWrite.resolve(undefined)
    await switching

    const persisted = valueOrThrow(await baseStore.getDraft(initialDraft.id))
    const actual = {
      switchState,
      activeId: controller.state.activeDraft?.id ?? null,
      persistedComment: persisted?.commonComment ?? null,
    }
    await controller.dispose()

    expect(captureOutput(actual)).toEqual({
      switchState: { canEdit: false, isLoading: true },
      activeId: otherDraft.id,
      persistedComment: 'Input saved before switching',
    })
  })

  it('holds the edit lock until an in-flight save settles during disposal', async () => {
    const baseStore = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await baseStore.addDraft(initialDraft))
    const writeStarted = deferred<undefined>()
    const finishWrite = deferred<undefined>()
    const store: DraftStore = {
      ...baseStore,
      saveDraft: (snapshot) => {
        writeStarted.resolve(undefined)
        return ResultAsync.fromPromise(
          finishWrite.promise,
          () =>
            new DraftError('storage-failed', 'The test save did not settle.'),
        ).andThen(() => baseStore.saveDraft(snapshot))
      },
    }

    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    controller.updateCommonComment('Saved before releasing the lock')
    await writeStarted.promise
    const disposing = controller.dispose()
    const lockBeforeSaveSettled = valueOrThrow(
      await acquireDraftLock(initialDraft.id),
    )

    finishWrite.resolve(undefined)
    await disposing
    const lockAfterDispose = valueOrThrow(
      await acquireDraftLock(initialDraft.id),
    )
    const persisted = valueOrThrow(await baseStore.getDraft(initialDraft.id))
    if (lockAfterDispose !== null) await lockAfterDispose.release()

    const actual = {
      lockedDuringSave: lockBeforeSaveSettled === null,
      availableAfterDispose: lockAfterDispose !== null,
      savedComment: persisted?.commonComment ?? null,
    }
    const expected = {
      lockedDuringSave: true,
      availableAfterDispose: true,
      savedComment: 'Saved before releasing the lock',
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('reacquires a contended lock, reloads the latest draft, and recovers pending delivery', async () => {
    const store = createIndexedDbDraftStore()
    const initialDraft = pendingDraft()
    valueOrThrow(await store.addDraft(initialDraft))

    const owner = valueOrThrow(await acquireDraftLock(initialDraft.id))
    if (owner === null)
      throw new Error('The test could not acquire the draft lock.')
    const controller = new ComposeController(store)
    await controller.start(initialDraft.id)
    const readOnly = {
      canEdit: controller.state.canEdit,
      lockState: controller.state.lockState,
      result: controller.state.activeDraft?.delivery[0]?.result ?? null,
    }

    valueOrThrow(
      await store.saveDraft({
        ...initialDraft,
        commonComment: 'Latest value from the other tab',
      }),
    )
    await owner.release()
    await controller.retryLock()
    await controller.dispose()
    const persisted = valueOrThrow(await store.getDraft(initialDraft.id))

    const actual = {
      readOnly,
      recovered:
        persisted === null
          ? null
          : {
              commonComment: persisted.commonComment,
              delivery: persisted.delivery,
            },
    }
    const expected = {
      readOnly: {
        canEdit: false,
        lockState: 'locked',
        result: null,
      },
      recovered: {
        commonComment: 'Latest value from the other tab',
        delivery: [
          {
            article: { url: 'https://example.test/sent', title: 'Sent title' },
            target: {
              destination: 'hatena',
              operationId,
              comment: 'Sent comment',
              options: { tags: ['sent'], private: true },
            },
            result: {
              destination: 'hatena',
              operationId,
              status: 'unknown',
              retryable: false,
            },
          },
        ],
      },
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('commits one share receipt before cleaning the URL for the same navigation', async () => {
    const baseStore = createIndexedDbDraftStore()
    const commitStarted = deferred<undefined>()
    const allowCommit = deferred<undefined>()
    const store: DraftStore = {
      ...baseStore,
      commitImport: (importId, snapshot) => {
        commitStarted.resolve(undefined)
        return ResultAsync.fromPromise(
          allowCommit.promise,
          () =>
            new DraftError('storage-failed', 'The share could not be saved.'),
        ).andThen(() => baseStore.commitImport(importId, snapshot))
      },
    }
    const controller = new ComposeController(store)
    await controller.start(null)
    window.history.replaceState(
      { tab: 'compose' },
      '',
      '/compose?share=payload&keep=yes#article',
    )
    const input: ShareInput = {
      version: 1,
      url: 'https://example.test/shared-article',
      title: 'Shared title',
      sharedText: 'Shared article text',
      partial: false,
    }

    const firstOpen = controller.openSource(input, {
      cleanupUrl: '/compose?keep=yes#article',
      intake: 'share',
    })
    await commitStarted.promise
    const historyStateBefore: unknown = window.history.state
    const historyRecordBefore = isRecord(historyStateBefore)
      ? historyStateBefore
      : {}
    const beforeCommit = {
      url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      hasImportId:
        typeof historyRecordBefore['__bookmarkerDraftImportId'] === 'string',
      tab: historyRecordBefore['tab'],
      savedDraftCount: valueOrThrow(await baseStore.listDrafts()).drafts.length,
    }
    const repeatedOpen = controller.openSource(input, {
      cleanupUrl: '/compose?keep=yes#article',
      intake: 'share',
    })
    const sameOperation = firstOpen === repeatedOpen

    allowCommit.resolve(undefined)
    const result = await firstOpen
    const opened = result.isOk() ? result.value : null
    const finalUrl = new URL(window.location.href)
    const finalDraftId = finalUrl.searchParams.get('draft')
    finalUrl.searchParams.delete('draft')
    const historyStateAfter: unknown = window.history.state
    const historyRecordAfter = isRecord(historyStateAfter)
      ? historyStateAfter
      : null
    const afterCommit = {
      hasMatchingDraftId: opened !== null && finalDraftId === opened.id,
      url: `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`,
      historyState: historyRecordAfter,
      savedDraftCount: valueOrThrow(await baseStore.listDrafts()).drafts.length,
    }
    await controller.dispose()

    const actual = {
      beforeCommit,
      sameOperation,
      resultOk: result.isOk(),
      afterCommit,
    }
    const expected = {
      beforeCommit: {
        url: '/compose?share=payload&keep=yes#article',
        hasImportId: true,
        tab: 'compose',
        savedDraftCount: 0,
      },
      sameOperation: true,
      resultOk: true,
      afterCommit: {
        hasMatchingDraftId: true,
        url: '/compose?keep=yes#article',
        historyState: { tab: 'compose' },
        savedDraftCount: 1,
      },
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('replays a committed share receipt after a new controller starts', async () => {
    const store = createIndexedDbDraftStore()
    const firstController = new ComposeController(store)
    const input: ShareInput = {
      version: 1,
      url: 'https://example.test/shared-article',
      title: 'Shared title',
      sharedText: 'Shared article text',
      partial: false,
    }
    const cleanupUrl = 'https://other.example.test/compose'
    await firstController.start(null)
    window.history.replaceState(
      { tab: 'compose' },
      '',
      '/compose?share=payload&keep=yes#article',
    )
    const firstResult = await firstController.openSource(input, {
      cleanupUrl,
      intake: 'share',
    })
    const savedAfterFirst = valueOrThrow(await store.listDrafts()).drafts
    const originalDraftId = savedAfterFirst[0]?.id ?? null
    await firstController.dispose()

    const restoredController = new ComposeController(store)
    await restoredController.start(null)
    const replayResult = await restoredController.openSource(input, {
      cleanupUrl,
      intake: 'share',
    })
    const savedAfterReplay = valueOrThrow(await store.listDrafts()).drafts
    const replayState = {
      reusesOriginalDraft:
        restoredController.state.activeDraft?.id === originalDraftId,
      savedDraftCount: savedAfterReplay.length,
      url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      keepsImportId: isRecord(window.history.state)
        ? typeof window.history.state['__bookmarkerDraftImportId'] === 'string'
        : false,
    }
    await restoredController.dispose()

    const actual = {
      firstCommit: {
        errorCode: firstResult.isErr() ? firstResult.error.code : null,
        savedDraft: originalDraftId !== null,
      },
      replay: {
        errorCode: replayResult.isErr() ? replayResult.error.code : null,
        ...replayState,
      },
    }
    expect(captureOutput(actual)).toEqual({
      firstCommit: {
        errorCode: 'history-update-failed',
        savedDraft: true,
      },
      replay: {
        errorCode: 'history-update-failed',
        reusesOriginalDraft: true,
        savedDraftCount: 1,
        url: '/compose?share=payload&keep=yes#article',
        keepsImportId: true,
      },
    })
  })

  it('does not recreate a discarded share after cleanup fails', async () => {
    const store = createIndexedDbDraftStore()
    const controller = new ComposeController(store)
    await controller.start(null)
    window.history.replaceState(
      { tab: 'compose' },
      '',
      '/compose?share=payload&keep=yes#article',
    )
    const replaceState = window.history.replaceState.bind(window.history)
    let cleanupAttempts = 0
    const replaceStateSpy = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation((state, unused, url) => {
        const nextUrl = typeof url === 'string' ? url : url?.toString()
        if (nextUrl !== undefined && nextUrl.startsWith('/compose?keep=yes')) {
          cleanupAttempts += 1
          if (cleanupAttempts <= 2) throw new Error('History is unavailable.')
        }
        replaceState(state, unused, url)
      })
    const input: ShareInput = {
      version: 1,
      url: 'https://example.test/shared-article',
      title: 'Shared title',
      sharedText: 'Shared article text',
      partial: false,
    }
    const options = {
      cleanupUrl: '/compose?keep=yes#article',
      intake: 'share' as const,
    }

    let actual:
      | {
          cleanupAttempts: number
          firstError: string | null
          discarded: {
            activeDraftId: string | null
            discardConfirmed: boolean
            draftWasActive: boolean
            errorMessage: string | null
            importIdWasPresent: boolean
            importIdPreserved: boolean
            savedDraftCount: number
            url: string
          }
          replay: {
            activeDraftId: string | null
            errorCode: string | null
            hasImportId: boolean
            savedDraftCount: number
            url: string
          }
        }
      | undefined
    try {
      const firstOpen = await controller.openSource(input, options)
      const discardedDraftId = controller.state.activeDraft?.id ?? null
      const importIdBeforeDiscard = isRecord(window.history.state)
        ? window.history.state['__bookmarkerDraftImportId']
        : null

      controller.requestDiscard()
      const discardConfirmed = controller.state.discardOpen
      await controller.discardDraft()
      const discarded = {
        activeDraftId: controller.state.activeDraft?.id ?? null,
        discardConfirmed,
        draftWasActive: discardedDraftId !== null,
        errorMessage: controller.state.errorMessage,
        importIdWasPresent: typeof importIdBeforeDiscard === 'string',
        importIdPreserved:
          isRecord(window.history.state) &&
          window.history.state['__bookmarkerDraftImportId'] ===
            importIdBeforeDiscard,
        savedDraftCount: valueOrThrow(await store.listDrafts()).drafts.length,
        url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      }

      const replay = await controller.openSource(input, options)
      const replayState = {
        activeDraftId: controller.state.activeDraft?.id ?? null,
        errorCode: replay.isErr() ? replay.error.code : null,
        hasImportId: isRecord(window.history.state)
          ? typeof window.history.state['__bookmarkerDraftImportId'] ===
            'string'
          : false,
        savedDraftCount: valueOrThrow(await store.listDrafts()).drafts.length,
        url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      }
      actual = {
        cleanupAttempts,
        firstError: firstOpen.isErr() ? firstOpen.error.code : null,
        discarded: {
          ...discarded,
        },
        replay: replayState,
      }
    } finally {
      replaceStateSpy.mockRestore()
      await controller.dispose()
    }

    expect(captureOutput(actual)).toEqual({
      cleanupAttempts: 3,
      firstError: 'history-update-failed',
      discarded: {
        activeDraftId: null,
        discardConfirmed: true,
        draftWasActive: true,
        errorMessage: 'The draft URL could not be updated.',
        importIdWasPresent: true,
        importIdPreserved: true,
        savedDraftCount: 0,
        url: '/compose?share=payload&keep=yes#article',
      },
      replay: {
        activeDraftId: null,
        errorCode: 'draft-discarded',
        hasImportId: false,
        savedDraftCount: 0,
        url: '/compose?keep=yes#article',
      },
    })
  })

  it('keeps drafts viewable but rejects creation without Web Locks', async () => {
    const store = createIndexedDbDraftStore()
    const initialDraft = draft()
    valueOrThrow(await store.addDraft(initialDraft))
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      'locks',
    )
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })

    let actual:
      | {
          activeDraftId: string | null
          canEdit: boolean
          lockState: string
          openingError: string | null
          savedDraftIds: string[]
        }
      | undefined
    try {
      const controller = new ComposeController(store)
      await controller.start(initialDraft.id)
      const opening = await controller.openSource(
        {
          version: 1,
          url: 'https://example.test/new-article',
          partial: true,
        },
        { cleanupUrl: '/compose', intake: 'manual' },
      )
      actual = {
        activeDraftId: controller.state.activeDraft?.id ?? null,
        canEdit: controller.state.canEdit,
        lockState: controller.state.lockState,
        openingError: opening.isErr() ? opening.error.code : null,
        savedDraftIds: valueOrThrow(await store.listDrafts()).drafts.map(
          ({ id }) => id,
        ),
      }
      await controller.dispose()
    } finally {
      if (originalDescriptor === undefined) {
        Reflect.deleteProperty(navigator, 'locks')
      } else {
        Object.defineProperty(navigator, 'locks', originalDescriptor)
      }
    }

    expect(captureOutput(actual)).toEqual({
      activeDraftId: initialDraft.id,
      canEdit: false,
      lockState: 'unsupported',
      openingError: 'lock-unavailable',
      savedDraftIds: [initialDraft.id],
    })
  })

  it('asks before deleting a draft and removes it after confirmation', async () => {
    const store = createIndexedDbDraftStore()
    const controller = new ComposeController(store)
    await controller.start(null)
    const opened = valueOrThrow(
      await controller.openSource(
        {
          version: 1,
          url: 'https://example.test/manual-article',
          partial: true,
        },
        { cleanupUrl: '/compose?draft=stale', intake: 'manual' },
      ),
    )
    const beforeConfirmation = {
      activeIdMatchesCreatedDraft:
        controller.state.activeDraft?.id === opened.id,
      discardOpen: controller.state.discardOpen,
    }

    controller.requestDiscard()
    const confirmation = controller.state.discardOpen
    await controller.discardDraft()
    const afterDiscard = {
      activeId: controller.state.activeDraft?.id ?? null,
      savedDraft: valueOrThrow(await store.getDraft(opened.id)),
      url: `${window.location.pathname}${window.location.search}${window.location.hash}`,
      discardOpen: controller.state.discardOpen,
    }
    await controller.dispose()

    const actual = { beforeConfirmation, confirmation, afterDiscard }
    const expected = {
      beforeConfirmation: {
        activeIdMatchesCreatedDraft: true,
        discardOpen: false,
      },
      confirmation: true,
      afterDiscard: {
        activeId: null,
        savedDraft: null,
        url: '/compose',
        discardOpen: false,
      },
    }

    expect(captureOutput(actual)).toEqual(expected)
  })

  it('leaves an unknown draft version unchanged and unopened', async () => {
    const store = createIndexedDbDraftStore()
    const unknownDraft = {
      version: 2,
      id: firstDraftId,
      source: { version: 1, url: 'https://example.test/legacy', partial: true },
      commonComment: 'Preserved legacy input',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    valueOrThrow(await store.listDrafts())
    await putRawDraft(unknownDraft)

    const controller = new ComposeController(store)
    await controller.start(firstDraftId)
    const editorState = {
      activeDraft: controller.state.activeDraft,
      unreadableDraftCount: controller.state.unreadableDraftCount,
      errorMessage: controller.state.errorMessage,
    }
    await controller.dispose()

    const actual = {
      editorState,
      persistedValue: await readRawDraft(firstDraftId),
    }
    const expected = {
      editorState: {
        activeDraft: null,
        unreadableDraftCount: 1,
        errorMessage:
          'This saved draft has an unsupported or invalid format and was left unchanged.',
      },
      persistedValue: unknownDraft,
    }

    expect(captureOutput(actual)).toEqual(expected)
  })
})
