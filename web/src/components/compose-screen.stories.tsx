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
    canRetryFailed: false,
    hasRetryableTargets: false,
    canOpenX: false,
    xIntentHref: null,
    deliveryState: 'idle',
    deliveryErrorMessage: null,
    authenticationRequired: false,
    signInHref: null,
    onPublish: () => undefined,
    onRetryFailed: () => undefined,
    onRetryDeliverySave: () => undefined,
    onRetryMetadata: () => undefined,
  },
  analysis: {
    article: exampleDraft.article ?? null,
    extractionState: 'not-requested',
    summary: null,
    summaryState: 'not-requested',
    verification: null,
    verificationState: 'not-requested',
    verificationTargets: [{ id: 'common', label: 'Common comment' }],
    selectedVerificationTargetId: 'common',
    isCustomComment: false,
    canVerifyComment: true,
    onExtractArticle: () => undefined,
    onSummarizeArticle: () => undefined,
    onVerifyComment: () => undefined,
    onVerificationTargetChange: () => undefined,
  },
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

export const Empty: Story = {
  args: {
    state: emptyState,
    sourceUrl: '',
  },
  name: 'The editor invites the reader to create a first draft.',
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
    verification: { issues: [], partial: false },
    verificationState: 'success' as const,
  },
  sourceUrl: '',
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

export const Mini420x600: Story = {
  ...viewportStory(420, 600),
  args: compactStoryArgs,
  name: 'The compact editor keeps primary actions visible at 420 × 600 px.',
}

export const Mini390x600: Story = {
  ...viewportStory(390, 600),
  args: compactStoryArgs,
  name: 'The compact editor fits the same workflow at 390 × 600 px.',
}

export const Desktop960x680: Story = {
  ...viewportStory(960, 680),
  args: compactStoryArgs,
  name: 'The editor places summary and comment side by side at 960 × 680 px.',
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
        status: 'unknown',
        retryable: false,
        message: 'The service response could not be confirmed.',
      },
    },
  ],
}

export const UnknownDeliveryOutcome: Story = {
  args: {
    ...compactStoryArgs,
    state: {
      ...compactState,
      drafts: [mixedOutcomeDraft],
      activeDraft: mixedOutcomeDraft,
    },
  },
  name: 'The editor keeps an unknown outcome warning visible outside delivery details.',
}
