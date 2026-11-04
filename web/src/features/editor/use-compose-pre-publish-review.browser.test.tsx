import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useComposePrePublishReview } from '#features/editor/use-compose-pre-publish-review'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000121',
  source: {
    version: 1,
    url: 'https://fictional.example.invalid/saved-article',
    partial: true,
  },
  article: {
    url: 'https://fictional.example.invalid/saved-article',
    title: 'A saved fictional article',
    text: 'A saved fictional passage.',
    source: 'manual',
    partial: true,
  },
  commonComment: 'A saved comment.',
  destinations: [
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
  delivery: [],
  updatedAt: '2026-10-22T00:00:00.000Z',
}

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: { configured: true },
    raindrop: { configured: true },
    x: { configured: true },
  },
}

const captureOutput = <T,>(value: T): T => value

let root: Root | undefined
let container: HTMLDivElement | undefined
let current!: ReturnType<typeof useComposePrePublishReview>

const Harness = ({
  verifyComments,
  publish,
}: {
  verifyComments: Parameters<
    typeof useComposePrePublishReview
  >[0]['verifyComments']
  publish: Parameters<typeof useComposePrePublishReview>[0]['publish']
}) => {
  current = useComposePrePublishReview({
    draft,
    metadata,
    verifyComments,
    publish,
  })
  return null
}

const unmount = () => {
  const mountedRoot = root
  root = undefined
  if (mountedRoot !== undefined) {
    act(() => {
      mountedRoot.unmount()
    })
  }
  container?.remove()
  container = undefined
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterEach(() => {
  unmount()
})

describe('useComposePrePublishReview', () => {
  it('shows a rejected check as failed and still allows publishing', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const publishedMetadata: DestinationMetadata[] = []
    const verifyComments = () =>
      Promise.reject(new Error('The check service rejected the request.'))
    const publish = (value: DestinationMetadata) => {
      publishedMetadata.push(value)
    }

    await act(async () => {
      root?.render(
        <Harness verifyComments={verifyComments} publish={publish} />,
      )
      await Promise.resolve()
    })
    await act(async () => {
      current.requestReview()
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    const failedReview = current.review
    act(() => {
      current.publishAfterReview()
    })

    expect(
      captureOutput({
        failedReview,
        publishedMetadata,
        review: current.review,
      }),
    ).toEqual({
      failedReview: {
        status: 'complete',
        checks: [
          {
            destinations: ['mastodon'],
            commentTargetIds: ['common'],
            comment: 'A saved comment.',
            status: 'failed',
            verification: null,
            error: 'The check service rejected the request.',
          },
        ],
      },
      publishedMetadata: [metadata],
      review: null,
    })
  })
})
