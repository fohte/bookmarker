import type { Meta, StoryObj } from '@storybook/react-vite'

import { App } from '#App'
import { ComposeScreen } from '#components/compose-screen'

const meta = {
  component: App,
} satisfies Meta<typeof App>

export default meta

type Story = StoryObj<typeof meta>

export const Preview: Story = {
  args: {
    children: (
      <ComposeScreen
        state={{
          drafts: [],
          unreadableDraftCount: 0,
          activeDraft: null,
          isLoading: false,
          canEdit: false,
          lockState: 'available',
          saveState: 'saved',
          errorMessage: null,
          intakeError: null,
          discardOpen: false,
          deliveryState: 'idle',
          deliveryErrorMessage: null,
          deliveryAuthenticationRequired: false,
        }}
        sourceUrl=""
        onSourceUrlChange={() => undefined}
        onOpenSource={() => Promise.resolve(true)}
        onSelectDraft={() => undefined}
        onTitleChange={() => undefined}
        onArticleTextChange={() => undefined}
        articleTextError={null}
        onCommonCommentChange={() => undefined}
        onDestinationChange={() => undefined}
        analysis={{
          article: null,
          extractionState: 'not-requested',
          summary: null,
          summaryState: 'unavailable',
          onExtractArticle: () => undefined,
          onSummarizeArticle: () => undefined,
        }}
        deliveryControls={{
          isLoadingMetadata: true,
          metadataErrorMessage: null,
          canPublish: false,
          canOpenX: false,
          xIntentHref: null,
          deliveryState: 'idle',
          deliveryErrorMessage: null,
          authenticationRequired: false,
          signInHref: null,
          onRequestPublishReview: () => undefined,
          onRetryDeliverySave: () => undefined,
          onRetryMetadata: () => undefined,
        }}
        prePublishReview={null}
        onCancelPrePublishReview={() => undefined}
        onConfirmPrePublish={() => undefined}
        copyConfirmationDestination={null}
        onRequestCopyCommonComment={() => undefined}
        onCancelCopyCommonComment={() => undefined}
        onCopyCommonComment={() => undefined}
        onRetrySave={() => undefined}
        onRetryLock={() => undefined}
        onRequestDiscard={() => undefined}
        onCancelDiscard={() => undefined}
        onConfirmDiscard={() => undefined}
      />
    ),
  },
  name: 'The app shell shows an empty draft screen without storage access.',
}
