import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeArticleHeader } from '#components/compose-article-header'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000101',
  source: {
    version: 1,
    url: 'https://stories.example.test/quiet-orchard',
    title: 'A fictional orchard journal',
    partial: true,
  },
  article: {
    url: 'https://stories.example.test/quiet-orchard',
    title: 'A fictional orchard journal',
    text: 'A fictional note about tending an orchard.',
    source: 'manual',
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  component: ComposeArticleHeader,
  args: {
    activeDraft: draft,
    draftCount: 2,
    saveState: 'saved',
    onOpenDetails: () => undefined,
    onOpenDrafts: () => undefined,
  },
} satisfies Meta<typeof ComposeArticleHeader>

export default meta

type Story = StoryObj<typeof meta>

export const SavedArticle: Story = {
  name: 'The header identifies a saved article and its URL.',
}

export const Empty: Story = {
  args: { activeDraft: null, draftCount: 0 },
  name: 'The header invites the reader to create a draft.',
}

export const SaveFailed: Story = {
  args: { saveState: 'failed' },
  name: 'The header keeps a failed save visible.',
}
