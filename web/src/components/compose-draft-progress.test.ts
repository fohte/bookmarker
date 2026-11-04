import type { BookmarkDraft } from 'api/contracts'
import { describe, expect, it } from 'vitest'

import {
  composeDraftProgress,
  isComposeDraftPosted,
} from '#components/compose-draft-progress'

type Snapshot = BookmarkDraft['delivery'][number]

function draft(delivery: Snapshot[]): BookmarkDraft {
  return {
    version: 1,
    id: '00000000-0000-4000-8000-000000000401',
    source: {
      version: 1,
      url: 'https://progress.example.test/a',
      partial: true,
    },
    commonComment: '',
    destinations: [],
    delivery,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function snapshot(
  destination: 'hatena' | 'raindrop',
  operationId: string,
  status: 'succeeded' | 'failed' | null,
): Snapshot {
  const target =
    destination === 'hatena'
      ? {
          destination,
          operationId,
          comment: '',
          options: { tags: [], private: false },
        }
      : {
          destination,
          operationId,
          comment: '',
          options: { collectionId: -1, tags: [] },
        }
  const article = { url: 'https://progress.example.test/a' }
  if (status === null) return { article, target }
  return {
    article,
    target,
    result:
      status === 'succeeded'
        ? { destination, operationId, status, retryable: false }
        : { destination, operationId, status, retryable: true },
  }
}

describe('composeDraftProgress', () => {
  it('labels a draft by the latest outcome of each destination', () => {
    const drafts = [
      draft([]),
      draft([
        snapshot('hatena', '00000000-0000-4000-8000-000000000411', 'succeeded'),
      ]),
      draft([
        snapshot('hatena', '00000000-0000-4000-8000-000000000412', 'failed'),
        snapshot('hatena', '00000000-0000-4000-8000-000000000413', 'succeeded'),
      ]),
      draft([
        snapshot('hatena', '00000000-0000-4000-8000-000000000414', 'failed'),
        snapshot('raindrop', '00000000-0000-4000-8000-000000000415', null),
      ]),
    ]

    expect(
      drafts.map((draft) => ({
        label: composeDraftProgress(draft),
        posted: isComposeDraftPosted(draft),
      })),
    ).toEqual([
      { label: 'not posted', posted: false },
      { label: 'posted', posted: true },
      { label: 'posted', posted: true },
      { label: '1 failed, 1 not recorded', posted: false },
    ])
  })
})
