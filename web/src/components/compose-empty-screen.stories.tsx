import type { Meta, StoryObj } from '@storybook/react-vite'
import type { BookmarkDraft } from 'api/contracts'

import { ComposeEmptyScreen } from '#components/compose-empty-screen'

const draft = (
  id: string,
  url: string,
  title: string | undefined,
  status: 'succeeded' | 'failed' | null,
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
  delivery:
    status === null
      ? []
      : [
          {
            article: { url },
            target: {
              destination: 'hatena',
              operationId: id,
              comment: '',
              options: { tags: [], private: false },
            },
            result:
              status === 'succeeded'
                ? {
                    destination: 'hatena',
                    operationId: id,
                    status,
                    retryable: false,
                  }
                : {
                    destination: 'hatena',
                    operationId: id,
                    status,
                    retryable: true,
                  },
          },
        ],
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const meta = {
  component: ComposeEmptyScreen,
  args: {
    drafts: [
      draft(
        '00000000-0000-4000-8000-000000000301',
        'https://lanterns.example.test/paper',
        'A fictional guide to folding paper lanterns',
        'succeeded',
      ),
      draft(
        '00000000-0000-4000-8000-000000000302',
        'https://kites.example.test/frames',
        'Bamboo frames for a fictional kite',
        'failed',
      ),
      draft(
        '00000000-0000-4000-8000-000000000303',
        'https://notes.example.test/42',
        undefined,
        null,
      ),
    ],
    sourceUrl: '',
    canCreate: true,
    canSwitchDraft: true,
    onSourceUrlChange: () => undefined,
    onOpenSource: () => Promise.resolve(true),
    onSelectDraft: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="flex h-dvh flex-col">
        <Story />
      </div>
    ),
  ],
  parameters: {
    screenshot: {
      viewport: { width: 390, height: 844 },
      fullPage: false,
      scale: 'css',
    },
  },
} satisfies Meta<typeof ComposeEmptyScreen>

export default meta

type Story = StoryObj<typeof meta>

export const UnfinishedDrafts: Story = {
  name: 'The screen asks for an article URL and lists only the drafts that are not fully posted.',
}

export const NoDrafts: Story = {
  args: { drafts: [] },
  name: 'The screen asks for an article URL when there are no drafts.',
}

export const UrlEntered: Story = {
  args: { sourceUrl: 'https://example.test/new-article' },
  name: 'The screen enables Start once a URL is entered.',
}
