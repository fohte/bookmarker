import type { BookmarkDraft } from 'api/contracts'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { describe, expect, it } from 'vitest'

import { DraftError } from '#features/drafts/draft-error'
import { DraftSaveQueue } from '#features/drafts/draft-save-queue'
import {
  createIndexedDbDraftStore,
  type DraftStore,
} from '#features/drafts/draft-store'

function createDraft(commonComment: string): BookmarkDraft {
  return {
    version: 1,
    id: '00000000-0000-4000-8000-000000000001',
    source: {
      version: 1,
      url: 'https://example.test/article',
      partial: true,
    },
    article: {
      url: 'https://example.test/article',
      title: 'A sample title',
      text: '',
      source: 'manual',
      partial: true,
    },
    commonComment,
    destinations: [],
    delivery: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

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

function captureOutput<T>(value: T): T {
  return value
}

function gatedWrite(decision: ReturnType<typeof deferred<boolean>>) {
  const failure = new DraftError(
    'storage-failed',
    'The test storage rejected the write.',
  )
  return ResultAsync.fromPromise(decision.promise, () => failure).andThen(
    (shouldSave) => (shouldSave ? okAsync(undefined) : errAsync(failure)),
  )
}

describe('DraftSaveQueue', () => {
  it('writes each immutable snapshot in order and retries the latest snapshot', async () => {
    const firstDecision = deferred<boolean>()
    const secondDecision = deferred<boolean>()
    const firstStarted = deferred<undefined>()
    const secondStarted = deferred<undefined>()
    const attempts: string[] = []
    const states: string[] = []
    let writeCount = 0

    const store: DraftStore = {
      ...createIndexedDbDraftStore(),
      saveDraft: (draft: BookmarkDraft) => {
        attempts.push(draft.commonComment)
        if (writeCount === 0) {
          writeCount += 1
          firstStarted.resolve(undefined)
          return gatedWrite(firstDecision)
        }
        if (writeCount === 1) {
          writeCount += 1
          secondStarted.resolve(undefined)
          return gatedWrite(secondDecision)
        }
        writeCount += 1
        return okAsync(undefined)
      },
    }

    const first = createDraft('first input')
    const queue = new DraftSaveQueue(store, first, (state) =>
      states.push(state),
    )
    queue.enqueue(first)
    first.commonComment = 'mutated after enqueue'
    queue.enqueue(createDraft('latest input'))

    await firstStarted.promise
    firstDecision.resolve(false)
    await secondStarted.promise
    secondDecision.resolve(false)
    const failed = await queue.flush()
    const retried = await queue.retry()

    const actual = {
      attempts,
      states,
      failed: failed.isErr(),
      retried: retried.isOk(),
    }

    expect(captureOutput(actual)).toEqual({
      attempts: ['first input', 'latest input', 'latest input'],
      states: ['saving', 'saving', 'failed', 'saving', 'saved'],
      failed: true,
      retried: true,
    })
  })
})
