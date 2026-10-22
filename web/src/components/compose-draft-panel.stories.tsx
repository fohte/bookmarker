import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeDraftPanel } from '#components/compose-draft-panel'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000001',
  source: {
    version: 1,
    url: 'https://example.test/article',
    title: 'A sample article title',
    partial: true,
  },
  article: {
    url: 'https://example.test/article',
    title: 'A sample article title',
    text: 'A short fictional passage for the editor preview.',
    source: 'manual',
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  component: ComposeDraftPanel,
  args: {
    activeDraft: draft,
    drafts: [draft],
    canEdit: true,
    articleTextError: null,
    onSelectDraft: () => undefined,
    onTitleChange: () => undefined,
    onArticleTextChange: () => undefined,
    onRequestDiscard: () => undefined,
  },
} satisfies Meta<typeof ComposeDraftPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The editor shows the selected article details.',
}

export const Empty: Story = {
  args: { activeDraft: null, drafts: [] },
  name: 'The editor invites the reader to choose or create a draft.',
}

export const ReadOnly: Story = {
  args: { canEdit: false },
  name: 'The article fields are disabled while the draft is read-only.',
}

export const ArticleTextTooLong: Story = {
  args: {
    articleTextError:
      'Article text must be 100,000 UTF-16 code units or fewer.',
  },
  name: 'The editor explains why an oversized article text was rejected.',
}
