import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeDraftPanel } from '#components/compose-draft-panel'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000104',
  source: {
    version: 1,
    url: 'https://stories.example.test/glass-lantern',
    title: 'A fictional glass lantern note',
    partial: true,
  },
  article: {
    url: 'https://stories.example.test/glass-lantern',
    title: 'A fictional glass lantern note',
    text: 'A fictional passage about making a glass lantern.',
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
    canCreate: true,
    canSwitchDraft: true,
    saveState: 'saved',
    sourceUrl: '',
    intakeError: null,
    articleTextError: null,
    onSourceUrlChange: () => undefined,
    onOpenSource: () => Promise.resolve(true),
    onSelectDraft: () => undefined,
    onTitleChange: () => undefined,
    onArticleTextChange: () => undefined,
    onRequestDiscard: () => undefined,
  },
} satisfies Meta<typeof ComposeDraftPanel>

export default meta

type Story = StoryObj<typeof meta>

export const SavedArticle: Story = {
  name: 'The compact header identifies the saved article.',
}

export const Empty: Story = {
  args: { activeDraft: null, drafts: [], canEdit: false, canCreate: true },
  name: 'The compact header opens draft management without an active draft.',
}

export const Saving: Story = {
  args: { saveState: 'saving' },
  name: 'The compact header shows that the latest input is being saved.',
}

export const SaveFailed: Story = {
  args: { saveState: 'failed' },
  name: 'The compact header keeps the failed save state visible.',
}
