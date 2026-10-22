import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeDeliveryPanel } from '#components/compose-delivery-panel'

const operationIds = {
  first: '00000000-0000-4000-8000-000000000011',
  second: '00000000-0000-4000-8000-000000000012',
  third: '00000000-0000-4000-8000-000000000013',
} as const

const delivery: BookmarkDraft['delivery'] = [
  {
    article: { url: 'https://example.test/article' },
    target: {
      destination: 'hatena',
      operationId: operationIds.first,
      comment: 'A fictional comment.',
      options: { tags: ['sample'], private: false },
    },
  },
  {
    article: { url: 'https://example.test/article' },
    target: {
      destination: 'mastodon',
      operationId: operationIds.second,
      comment: 'A fictional comment.',
      options: {
        visibility: 'unlisted',
        spoilerText: '',
        sensitive: false,
      },
    },
    result: {
      destination: 'mastodon',
      operationId: operationIds.second,
      status: 'failed',
      retryable: true,
      message: 'A temporary service error.',
    },
  },
  {
    article: { url: 'https://example.test/article' },
    target: {
      destination: 'raindrop',
      operationId: operationIds.third,
      comment: 'A fictional comment.',
      options: { collectionId: 187, tags: ['reading'] },
    },
    result: {
      destination: 'raindrop',
      operationId: operationIds.third,
      status: 'unknown',
      retryable: false,
      message: 'The service response could not be confirmed.',
    },
  },
]

const meta = {
  component: ComposeDeliveryPanel,
  args: { delivery: [] },
} satisfies Meta<typeof ComposeDeliveryPanel>

export default meta

type Story = StoryObj<typeof meta>

export const NotSent: Story = {
  name: 'The editor shows that no destination has been sent.',
}

export const MixedResults: Story = {
  args: { delivery },
  name: 'The editor distinguishes in-progress, failed, and unknown results.',
}

export const Succeeded: Story = {
  args: {
    delivery: [
      {
        article: { url: 'https://example.test/article' },
        target: {
          destination: 'hatena',
          operationId: operationIds.first,
          comment: 'A fictional comment.',
          options: { tags: ['sample'], private: false },
        },
        result: {
          destination: 'hatena',
          operationId: operationIds.first,
          status: 'succeeded',
          retryable: false,
          remoteUrl: 'https://example.test/bookmarks/example',
        },
      },
    ],
  },
  name: 'The editor shows a saved successful result with its remote link.',
}
