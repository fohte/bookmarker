import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeResults } from '#components/compose-results'

const article = { url: 'https://example.test/notes/paper-lantern' }
const comment = 'Folding thinner paper gives a softer glow.'

const hatenaPosted: BookmarkDraft['delivery'][number] = {
  article,
  target: {
    destination: 'hatena',
    operationId: '00000000-0000-4000-8000-000000000011',
    comment,
    options: { tags: ['lanterns'], private: false },
  },
  result: {
    destination: 'hatena',
    operationId: '00000000-0000-4000-8000-000000000011',
    status: 'succeeded',
    retryable: false,
    remoteUrl: 'https://example.test/bookmarks/paper-lantern',
  },
}

const mastodonPosted: BookmarkDraft['delivery'][number] = {
  article,
  target: {
    destination: 'mastodon',
    operationId: '00000000-0000-4000-8000-000000000012',
    comment,
    options: { visibility: 'unlisted', spoilerText: '', sensitive: false },
  },
  result: {
    destination: 'mastodon',
    operationId: '00000000-0000-4000-8000-000000000012',
    status: 'succeeded',
    retryable: false,
    remoteUrl: 'https://example.test/@reader/1',
  },
}

const raindropTarget: BookmarkDraft['delivery'][number]['target'] = {
  destination: 'raindrop',
  operationId: '00000000-0000-4000-8000-000000000013',
  comment,
  options: { collectionId: -1, tags: [] },
}

const raindropTimedOut: BookmarkDraft['delivery'][number] = {
  article,
  target: raindropTarget,
  result: {
    destination: 'raindrop',
    operationId: raindropTarget.operationId,
    status: 'failed',
    retryable: true,
    message: 'Raindrop did not respond.',
  },
}

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000041',
  source: { version: 1, url: article.url, partial: true },
  article: {
    url: article.url,
    title: 'Paper lanterns that glow evenly',
    text: 'A fictional passage.',
    source: 'manual',
    partial: true,
  },
  commonComment: comment,
  destinations: [
    {
      destination: 'x',
      selected: true,
      commentMode: 'common',
      customComment: '',
    },
  ],
  delivery: [hatenaPosted, mastodonPosted, raindropTimedOut],
  updatedAt: '2026-10-22T00:00:00.000Z',
}

const meta = {
  component: ComposeResults,
  args: {
    draft,
    xSelected: true,
    canOpenX: true,
    xIntentHref: 'https://x.com/intent/tweet?text=A%20fictional%20note',
    canRetry: true,
    isLoadingMetadata: false,
    metadataErrorMessage: null,
    deliveryState: 'idle',
    deliveryErrorMessage: null,
    authenticationRequired: false,
    signInHref: null,
    onRetry: () => undefined,
    onDone: () => undefined,
    onRetryDeliverySave: () => undefined,
    onRetryMetadata: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="flex h-dvh flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeResults>

export default meta

type Story = StoryObj<typeof meta>

export const PartlyFailed: Story = {
  name: 'The results screen opens posted items, offers a retry for a failed one, and continues in X.',
}

export const AllPosted: Story = {
  args: {
    draft: {
      ...draft,
      destinations: [],
      delivery: [hatenaPosted, mastodonPosted],
    },
    xSelected: false,
  },
  name: 'The results screen shows every destination as posted without an X step.',
}

export const Posting: Story = {
  args: {
    draft: {
      ...draft,
      delivery: [
        hatenaPosted,
        { article, target: mastodonPosted.target },
        { article, target: raindropTarget },
      ],
    },
    deliveryState: 'sending',
    canOpenX: false,
    canRetry: false,
  },
  name: 'The results screen waits for the services and keeps X until posting finishes.',
}

export const RejectedWithoutRetry: Story = {
  args: {
    draft: {
      ...draft,
      destinations: [],
      delivery: [
        {
          article,
          target: raindropTarget,
          result: {
            destination: 'raindrop',
            operationId: raindropTarget.operationId,
            status: 'failed',
            retryable: false,
            message: 'The destination rejected the request.',
          },
        },
      ],
    },
    xSelected: false,
  },
  name: 'The results screen leaves a rejected post to be fixed in the editor instead of offering a retry.',
}

export const ResultSaveFailed: Story = {
  args: {
    draft: {
      ...draft,
      destinations: [],
      delivery: [{ article, target: raindropTarget }],
    },
    xSelected: false,
    deliveryState: 'result-save-failed',
    deliveryErrorMessage: 'The result could not be saved on this device.',
    canRetry: false,
  },
  name: 'The results screen offers to save a held result without contacting the service again.',
}
