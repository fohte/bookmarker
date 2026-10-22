import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import type { ComposeState } from '#features/editor/compose-controller'
import {
  ComposeScreen,
  type ComposeScreenProps,
} from '#features/editor/compose-screen'

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
  onOpenSource: () => undefined,
  onSelectDraft: () => undefined,
  onTitleChange: () => undefined,
  onArticleTextChange: () => undefined,
  onCommonCommentChange: () => undefined,
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
