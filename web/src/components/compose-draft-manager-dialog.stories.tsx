import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeDraftManagerDialog } from '#components/compose-draft-manager-dialog'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000103',
  source: {
    version: 1,
    url: 'https://stories.example.test/paper-kite',
    title: 'A fictional paper kite guide',
    partial: true,
  },
  article: {
    url: 'https://stories.example.test/paper-kite',
    title: 'A fictional paper kite guide',
    text: 'A fictional note about building a paper kite.',
    source: 'manual',
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  component: ComposeDraftManagerDialog,
  args: {
    open: true,
    activeDraft: draft,
    drafts: [draft],
    sourceUrl: '',
    canCreate: true,
    canSwitchDraft: true,
    canDiscard: true,
    intakeError: null,
    onOpenChange: () => undefined,
    onSourceUrlChange: () => undefined,
    onOpenSource: () => undefined,
    onSelectDraft: () => undefined,
    onRequestDiscard: () => undefined,
  },
} satisfies Meta<typeof ComposeDraftManagerDialog>

export default meta

type Story = StoryObj<typeof meta>

export const ManagingDrafts: Story = {
  name: 'The dialog shows saved drafts and a new URL field.',
}

export const NoDrafts: Story = {
  args: { activeDraft: null, drafts: [], canDiscard: false },
  name: 'The dialog offers URL entry when no draft exists.',
}

export const DeliveryInProgress: Story = {
  args: { canCreate: false, canSwitchDraft: false, canDiscard: false },
  name: 'The dialog disables changes while delivery is in progress.',
}

export const InvalidUrl: Story = {
  args: { intakeError: 'Enter a valid HTTP or HTTPS article URL.' },
  name: 'The dialog explains when an article URL is invalid.',
}
