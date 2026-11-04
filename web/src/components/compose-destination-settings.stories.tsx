import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationSettings } from '#components/compose-destination-settings'

const hatena: DestinationDraft = {
  destination: 'hatena',
  selected: true,
  commentMode: 'common',
  customComment: '',
  options: { tags: ['sample', 'unfinished'], private: true },
}

const mastodon: DestinationDraft = {
  destination: 'mastodon',
  selected: true,
  commentMode: 'common',
  customComment: '',
  options: {
    visibility: 'unlisted',
    spoilerText: 'A fictional content warning.',
    sensitive: true,
  },
}

const raindrop: DestinationDraft = {
  destination: 'raindrop',
  selected: true,
  commentMode: 'common',
  customComment: '',
  options: { collectionId: 283, tags: ['reading'] },
}

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: { configured: true },
    raindrop: {
      configured: true,
      collections: [
        { id: 283, title: 'Fictional reading collection', public: false },
      ],
    },
    x: { configured: true },
  },
}

const meta = {
  component: ComposeDestinationSettings,
  args: {
    destination: hatena,
    canEdit: true,
    metadata,
    onDestinationChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-120 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeDestinationSettings>

export default meta

type Story = StoryObj<typeof meta>

export const Hatena: Story = {
  name: 'Hatena settings show its tags and a private bookmark switch.',
}

export const Mastodon: Story = {
  args: { destination: mastodon },
  name: 'Mastodon settings show visibility, a content warning, and a sensitive switch.',
}

export const Raindrop: Story = {
  args: { destination: raindrop },
  name: 'Raindrop settings show the saved collection and tags.',
}

export const X: Story = {
  args: {
    destination: {
      destination: 'x',
      selected: true,
      commentMode: 'common',
      customComment: '',
    },
  },
  name: 'X settings explain that X opens its own composer.',
}

export const ReadOnly: Story = {
  args: { destination: mastodon, canEdit: false },
  name: 'Destination settings are read-only while another tab owns the draft.',
}
