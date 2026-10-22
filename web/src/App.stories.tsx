import type { Meta, StoryObj } from '@storybook/react-vite'

import { App } from '#App'
import { ComposeScreen } from '#features/editor/compose-screen'

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
        }}
        sourceUrl=""
        onSourceUrlChange={() => undefined}
        onOpenSource={() => undefined}
        onSelectDraft={() => undefined}
        onTitleChange={() => undefined}
        onArticleTextChange={() => undefined}
        onCommonCommentChange={() => undefined}
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
