import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'

import {
  ComposeScreen,
  type ComposeScreenProps,
} from '#components/compose-screen'
import type { ComposeState } from '#features/editor/compose-controller'

const exampleDraft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000001',
  source: {
    version: 1,
    url: 'https://example.test/article',
    partial: true,
  },
  article: {
    url: 'https://example.test/article',
    title: 'A sample article title',
    text: 'A short fictional passage for the editor preview.',
    source: 'manual',
    partial: true,
  },
  commonComment: 'A note to share with this article.',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const savedState: ComposeState = {
  drafts: [exampleDraft],
  unreadableDraftCount: 0,
  activeDraft: exampleDraft,
  isLoading: false,
  canEdit: true,
  lockState: 'owned',
  saveState: 'saved',
  errorMessage: null,
  intakeError: null,
  discardOpen: false,
  deliveryState: 'idle',
  deliveryErrorMessage: null,
  deliveryAuthenticationRequired: false,
}

const emptyState: ComposeState = {
  ...savedState,
  drafts: [],
  activeDraft: null,
  canEdit: false,
  lockState: 'available',
}

const handlers: Omit<ComposeScreenProps, 'state' | 'sourceUrl'> = {
  onSourceUrlChange: () => undefined,
  onOpenSource: () => Promise.resolve(true),
  onSelectDraft: () => undefined,
  onTitleChange: () => undefined,
  onArticleTextChange: () => undefined,
  articleTextError: null,
  onCommonCommentChange: () => undefined,
  onDestinationChange: () => undefined,
  deliveryControls: {
    isLoadingMetadata: false,
    metadataErrorMessage: null,
    canPublish: true,
    canOpenX: false,
    xIntentHref: null,
    deliveryState: 'idle',
    deliveryErrorMessage: null,
    authenticationRequired: false,
    signInHref: null,
    onRequestPublishReview: () => undefined,
    onRetryDeliverySave: () => undefined,
    onRetryMetadata: () => undefined,
  },
  analysis: {
    article: exampleDraft.article ?? null,
    extractionState: 'not-requested',
    summary: null,
    summaryState: 'not-requested',
    onExtractArticle: () => undefined,
    onSummarizeArticle: () => undefined,
  },
  prePublishReview: null,
  onCancelPrePublishReview: () => undefined,
  onConfirmPrePublish: () => undefined,
  copyConfirmationDestination: null,
  onRequestCopyCommonComment: () => undefined,
  onCancelCopyCommonComment: () => undefined,
  onCopyCommonComment: () => undefined,
  onRetrySave: () => undefined,
  onRetryLock: () => undefined,
  onRequestDiscard: () => undefined,
  onCancelDiscard: () => undefined,
  onConfirmDiscard: () => undefined,
}

const meta = {
  component: ComposeScreen,
  args: {
    ...handlers,
    sourceUrl: '',
  },
} satisfies Meta<typeof ComposeScreen>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  args: {
    state: savedState,
    sourceUrl: '',
  },
  name: 'The editor shows a saved article and common comment.',
}

export const ReviewingComments: Story = {
  args: {
    state: savedState,
    prePublishReview: {
      status: 'complete',
      checks: [
        {
          destinations: ['hatena'],
          commentTargetIds: ['destination:hatena'],
          comment: 'A fictional individual comment.',
          status: 'success',
          verification: {
            issues: [
              {
                kind: 'uncertain',
                quote: 'A detail in the comment.',
                reason: 'The article does not include that detail.',
              },
            ],
            partial: false,
          },
          error: null,
        },
      ],
    },
    sourceUrl: '',
  },
  name: 'The editor shows comment check results before publishing.',
}

export const Empty: Story = {
  args: {
    state: emptyState,
    sourceUrl: '',
  },
  name: 'The editor offers to open a draft when none is open.',
}

export const Saving: Story = {
  args: {
    state: { ...savedState, saveState: 'saving' },
    sourceUrl: 'https://example.test/another-article',
  },
  name: 'The editor shows that the latest input is being saved.',
}

const sendingDraft: BookmarkDraft = {
  ...exampleDraft,
  destinations: [
    {
      destination: 'hatena',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { tags: ['fictional'], private: false },
    },
  ],
  delivery: [
    {
      article: {
        url: 'https://example.test/article',
        title: 'A sample article title',
      },
      target: {
        destination: 'hatena',
        operationId: '00000000-0000-4000-8000-000000000011',
        comment: 'A note to share with this article.',
        options: { tags: ['fictional'], private: false },
      },
    },
  ],
}

export const Sending: Story = {
  args: {
    state: {
      ...savedState,
      drafts: [sendingDraft],
      activeDraft: sendingDraft,
      deliveryState: 'sending',
    },
    deliveryControls: {
      ...handlers.deliveryControls,
      deliveryState: 'sending',
      canPublish: false,
    },
    sourceUrl: 'https://example.test/another-article',
  },
  name: 'The editor prevents changes while a saved delivery is sending.',
}

export const SaveFailed: Story = {
  args: {
    state: {
      ...savedState,
      saveState: 'failed',
      errorMessage: 'The latest draft could not be saved on this device.',
    },
    sourceUrl: '',
  },
  name: 'The editor offers a retry after saving fails.',
}

export const ReadOnly: Story = {
  args: {
    state: { ...savedState, canEdit: false, lockState: 'locked' },
    sourceUrl: '',
  },
  name: 'The editor is read-only while another tab holds the draft.',
}

export const LockUnavailable: Story = {
  args: {
    state: { ...savedState, canEdit: false, lockState: 'unsupported' },
    sourceUrl: '',
  },
  name: 'The editor explains when browser locking is unavailable.',
}

export const ConfirmDiscard: Story = {
  args: {
    state: { ...savedState, discardOpen: true },
    sourceUrl: '',
  },
  name: 'The editor asks before discarding the saved draft.',
}

const unconfiguredMetadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: false },
    mastodon: { configured: true },
    raindrop: { configured: true },
    x: { configured: true },
  },
}

export const DestinationUnavailable: Story = {
  args: { state: savedState, destinationMetadata: unconfiguredMetadata },
  name: 'The editor keeps saved settings visible when a service is unconfigured.',
}

export const ConfirmCopy: Story = {
  args: {
    state: {
      ...savedState,
      activeDraft: {
        ...exampleDraft,
        destinations: [
          {
            destination: 'mastodon',
            selected: true,
            commentMode: 'custom',
            customComment: 'An existing individual comment.',
            options: {
              visibility: 'unlisted',
              spoilerText: '',
              sensitive: false,
            },
          },
        ],
      },
    },
    copyConfirmationDestination: 'mastodon',
  },
  name: 'The editor confirms before replacing a saved custom comment.',
}

const compactDraft: BookmarkDraft = {
  ...exampleDraft,
  destinations: [
    {
      destination: 'hatena',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { tags: [], private: false },
    },
    {
      destination: 'mastodon',
      selected: true,
      commentMode: 'common',
      customComment: '',
      options: { visibility: 'public', spoilerText: '', sensitive: false },
    },
    {
      destination: 'raindrop',
      selected: false,
      commentMode: 'common',
      customComment: '',
      options: { collectionId: -1, tags: [] },
    },
    {
      destination: 'x',
      selected: false,
      commentMode: 'common',
      customComment: '',
    },
  ],
}

const compactState: ComposeState = {
  ...savedState,
  drafts: [compactDraft],
  activeDraft: compactDraft,
}

const compactStoryArgs = {
  state: compactState,
  analysis: {
    ...handlers.analysis,
    summary: {
      summary:
        'The article describes a small observation that is useful to revisit after reading.',
      partial: false,
    },
    summaryState: 'success' as const,
  },
  sourceUrl: '',
}

export const StaleAnalysis: Story = {
  args: {
    ...compactStoryArgs,
    analysis: {
      ...compactStoryArgs.analysis,
      article: {
        url: 'https://example.test/article',
        title: 'A sample article title',
        text: 'A revised fictional article passage.',
        source: 'manual',
        partial: false,
      },
      summary: {
        summary: 'A saved summary from before the article text changed.',
        partial: false,
      },
      summaryState: 'stale',
    },
  },
  name: 'The editor keeps the saved summary visible while it is out of date.',
}

function viewportStory(width: number, height: number) {
  const viewportName = `compose-${String(width)}x${String(height)}`
  return {
    globals: { viewport: { value: viewportName } },
    parameters: {
      viewport: {
        options: {
          [viewportName]: {
            name: `${String(width)} × ${String(height)} px`,
            styles: {
              width: `${String(width)}px`,
              height: `${String(height)}px`,
            },
          },
        },
      },
      screenshot: {
        viewport: { width, height },
        fullPage: false,
        scale: 'css',
      },
    },
  }
}

export const Phone390x844: Story = {
  ...viewportStory(390, 844),
  args: compactStoryArgs,
  name: 'On a phone, the editor stacks the article, comment, and destinations in one scrolling column.',
}

export const Desktop1280x900: Story = {
  ...viewportStory(1280, 900),
  args: compactStoryArgs,
  name: 'On a wide screen, the editor places the article beside the comment and destinations.',
}

const mixedOutcomeDraft: BookmarkDraft = {
  ...compactDraft,
  delivery: [
    {
      article: { url: 'https://example.test/article' },
      target: {
        destination: 'hatena',
        operationId: '00000000-0000-4000-8000-000000000031',
        comment: 'A fictional shared note.',
        options: { tags: [], private: false },
      },
      result: {
        destination: 'hatena',
        operationId: '00000000-0000-4000-8000-000000000031',
        status: 'succeeded',
        retryable: false,
      },
    },
    {
      article: { url: 'https://example.test/article' },
      target: {
        destination: 'mastodon',
        operationId: '00000000-0000-4000-8000-000000000032',
        comment: 'A fictional shared note.',
        options: {
          visibility: 'public',
          spoilerText: '',
          sensitive: false,
        },
      },
      result: {
        destination: 'mastodon',
        operationId: '00000000-0000-4000-8000-000000000032',
        status: 'failed',
        retryable: false,
        message:
          'The delivery result could not be confirmed. Check whether the item reached the destination before publishing again.',
      },
    },
  ],
}

export const DeliveryFailure: Story = {
  args: {
    ...compactStoryArgs,
    state: {
      ...compactState,
      drafts: [mixedOutcomeDraft],
      activeDraft: mixedOutcomeDraft,
    },
  },
  name: 'The editor keeps a failed delivery warning visible outside delivery details.',
}
