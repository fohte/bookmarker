import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import {
  ComposeDeliveryPanel,
  type ComposeDeliveryPanelProps,
} from '#components/compose-delivery-panel'

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
      status: 'failed',
      retryable: false,
      message:
        'The delivery result could not be confirmed. Check whether the item reached the destination before publishing again.',
    },
  },
]

const controls: Omit<ComposeDeliveryPanelProps, 'delivery'> = {
  isLoadingMetadata: false,
  metadataErrorMessage: null,
  canPublish: true,
  canOpenX: false,
  xIntentHref: null,
  deliveryState: 'idle',
  deliveryErrorMessage: null,
  authenticationRequired: false,
  signInHref: null,
  onPublish: () => undefined,
  onRetryDeliverySave: () => undefined,
  onRetryMetadata: () => undefined,
}

const meta = {
  component: ComposeDeliveryPanel,
  args: { ...controls, delivery: [] },
} satisfies Meta<typeof ComposeDeliveryPanel>

export default meta

type Story = StoryObj<typeof meta>

export const NotSent: Story = {
  name: 'The editor shows that no destination has been sent.',
}

export const MixedResults: Story = {
  args: {
    delivery,
    defaultResultsOpen: true,
    deliveryState: 'sending',
  },
  name: 'The editor distinguishes in-progress and failed results.',
}

export const Succeeded: Story = {
  args: {
    defaultResultsOpen: true,
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

export const FailedBeforeSuccess: Story = {
  args: {
    defaultResultsOpen: true,
    delivery: [
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
          retryable: false,
          message: 'The destination rejected the request.',
        },
      },
      {
        article: { url: 'https://example.test/article' },
        target: {
          destination: 'mastodon',
          operationId: operationIds.third,
          comment: 'A fictional comment.',
          options: {
            visibility: 'unlisted',
            spoilerText: '',
            sensitive: false,
          },
        },
        result: {
          destination: 'mastodon',
          operationId: operationIds.third,
          status: 'succeeded',
          retryable: false,
        },
      },
    ],
  },
  name: 'The editor hides resend guidance after the destination succeeds.',
}

export const SavingPendingSnapshot: Story = {
  args: {
    deliveryState: 'saving-pending',
    canPublish: false,
  },
  name: 'The editor waits for the pending snapshot before sending.',
}

export const SavingLatestInput: Story = {
  args: {
    deliveryState: 'saving-input',
    canPublish: false,
  },
  name: 'The editor saves the latest input before sending.',
}

export const ResultSaveFailed: Story = {
  args: {
    defaultResultsOpen: true,
    delivery: delivery.slice(0, 1),
    deliveryState: 'result-save-failed',
    deliveryErrorMessage: 'The result could not be saved on this device.',
    canPublish: false,
  },
  name: 'The editor offers a save retry without contacting the service again.',
}

export const SavingResult: Story = {
  args: {
    delivery: delivery.slice(0, 1),
    deliveryState: 'saving-results',
    canPublish: false,
  },
  name: 'The editor waits until the delivery result is saved.',
}

export const AuthenticationRequired: Story = {
  args: {
    authenticationRequired: true,
    signInHref: '/compose?draft=00000000-0000-4000-8000-000000000041',
  },
  name: 'The editor asks the user to sign in after saving the draft.',
}

export const MetadataUnavailable: Story = {
  args: {
    metadataErrorMessage: 'Destination details are temporarily unavailable.',
    canPublish: false,
  },
  name: 'The editor keeps publishing disabled when destination details fail.',
}

export const LoadingMetadata: Story = {
  args: {
    isLoadingMetadata: true,
    canPublish: false,
  },
  name: 'The editor checks which destinations are connected.',
}

export const XIntentReady: Story = {
  args: {
    canOpenX: true,
    xSelected: true,
    xIntentHref: 'https://x.com/intent/tweet?text=A%20fictional%20note',
  },
  name: 'The editor opens X with the saved comment through a normal link.',
}
