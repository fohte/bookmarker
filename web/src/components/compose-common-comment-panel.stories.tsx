import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeCommonCommentPanel } from '#components/compose-common-comment-panel'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000001',
  source: {
    version: 1,
    url: 'https://example.test/article',
    partial: true,
  },
  commonComment: 'A note to share with this article.',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  component: ComposeCommonCommentPanel,
  args: {
    activeDraft: draft,
    canEdit: true,
    saveState: 'saved',
    onCommentChange: () => undefined,
    onRetrySave: () => undefined,
  },
} satisfies Meta<typeof ComposeCommonCommentPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The editor shows the shared comment for this draft.',
}

export const Empty: Story = {
  args: { activeDraft: null },
  name: 'The editor asks the reader to open a draft before writing.',
}

export const SaveFailed: Story = {
  args: { saveState: 'failed' },
  name: 'The editor offers to retry a failed local save.',
}
