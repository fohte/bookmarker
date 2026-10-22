import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeArticleDetailsDialog } from '#components/compose-article-details-dialog'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000102',
  source: {
    version: 1,
    url: 'https://stories.example.test/stone-bridge',
    title: 'A fictional bridge study',
    partial: true,
  },
  article: {
    url: 'https://stories.example.test/stone-bridge',
    title: 'A fictional bridge study',
    text: 'A fictional passage about a stone bridge beside a river.',
    source: 'manual',
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  component: ComposeArticleDetailsDialog,
  args: {
    open: true,
    activeDraft: draft,
    canEdit: true,
    articleTextError: null,
    onOpenChange: () => undefined,
    onTitleChange: () => undefined,
    onArticleTextChange: () => undefined,
  },
} satisfies Meta<typeof ComposeArticleDetailsDialog>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The details dialog shows the article title and text.',
}

export const ReadOnly: Story = {
  args: { canEdit: false },
  name: 'The details dialog keeps article fields read-only.',
}

export const ArticleTextTooLong: Story = {
  args: {
    articleTextError:
      'Article text must be 100,000 UTF-16 code units or fewer.',
  },
  name: 'The details dialog shows the manual text validation error.',
}
