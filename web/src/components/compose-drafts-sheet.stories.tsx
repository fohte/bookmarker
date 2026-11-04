import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeDraftsSheet } from '#components/compose-drafts-sheet'

const draft = (
  id: string,
  url: string,
  title: string | undefined,
  delivery: BookmarkDraft['delivery'] = [],
): BookmarkDraft => ({
  version: 1,
  id,
  source: {
    version: 1,
    url,
    ...(title === undefined ? {} : { title }),
    partial: true,
  },
  commonComment: '',
  destinations: [],
  delivery,
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const editing = draft(
  '00000000-0000-4000-8000-000000000103',
  'https://www.lanterns.example.test/paper',
  'A fictional guide to folding paper lanterns',
)
const failed = draft(
  '00000000-0000-4000-8000-000000000104',
  'https://kites.example.test/frames',
  'Bamboo frames for a fictional kite',
  [
    {
      article: { url: 'https://kites.example.test/frames' },
      target: {
        destination: 'hatena',
        operationId: '00000000-0000-4000-8000-000000000141',
        comment: '',
        options: { tags: [], private: false },
      },
      result: {
        destination: 'hatena',
        operationId: '00000000-0000-4000-8000-000000000141',
        status: 'failed',
        retryable: true,
      },
    },
    {
      article: { url: 'https://kites.example.test/frames' },
      target: {
        destination: 'raindrop',
        operationId: '00000000-0000-4000-8000-000000000142',
        comment: '',
        options: { collectionId: -1, tags: [] },
      },
      result: {
        destination: 'raindrop',
        operationId: '00000000-0000-4000-8000-000000000142',
        status: 'failed',
        retryable: true,
      },
    },
  ],
)
const untitled = draft(
  '00000000-0000-4000-8000-000000000105',
  'https://notes.example.test/42',
  undefined,
)

const meta = {
  component: ComposeDraftsSheet,
  args: {
    open: true,
    activeDraft: editing,
    drafts: [editing, failed, untitled],
    sourceUrl: '',
    canCreate: true,
    canSwitchDraft: true,
    canDiscard: true,
    intakeError: null,
    onOpenChange: () => undefined,
    onSourceUrlChange: () => undefined,
    onOpenSource: () => Promise.resolve(true),
    onSelectDraft: () => undefined,
    onRequestDiscard: () => undefined,
  },
  parameters: {
    screenshot: {
      viewport: { width: 390, height: 844 },
      fullPage: false,
      scale: 'css',
    },
  },
} satisfies Meta<typeof ComposeDraftsSheet>

export default meta

type Story = StoryObj<typeof meta>

export const ManagingDrafts: Story = {
  name: 'The sheet marks the open draft and shows how far each other draft got.',
}

export const NoDrafts: Story = {
  args: { activeDraft: null, drafts: [], canDiscard: false },
  name: 'The sheet offers only the URL field when no draft exists.',
}

export const DeliveryInProgress: Story = {
  args: {
    sourceUrl: 'https://example.test/another-article',
    canCreate: false,
    canSwitchDraft: false,
    canDiscard: false,
  },
  name: 'The sheet disables opening, switching, and discarding while a delivery is in progress.',
}

export const InvalidUrl: Story = {
  args: {
    sourceUrl: 'not a url',
    intakeError: 'Enter a valid HTTP or HTTPS article URL.',
  },
  name: 'The sheet explains when an article URL is invalid.',
}
