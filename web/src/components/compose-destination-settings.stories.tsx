import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationSettings } from '#components/compose-destination-settings'

type ComposeDestinationSettingsProps = Parameters<
  typeof ComposeDestinationSettings
>[0]

const hatena: DestinationDraft = {
  destination: 'hatena',
  selected: false,
  commentMode: 'custom',
  customComment: 'A short individual note.',
  options: { tags: ['sample', 'unfinished'], private: true },
}

const mastodon: DestinationDraft = {
  destination: 'mastodon',
  selected: true,
  commentMode: 'custom',
  customComment: 'A separate Mastodon note.',
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

const x: DestinationDraft = {
  destination: 'x',
  selected: false,
  commentMode: 'common',
  customComment: '',
}

const mastodonMetadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: {
      configured: true,
      maxCharacters: 480,
      charactersReservedPerUrl: 24,
    },
    raindrop: { configured: true },
    x: { configured: true },
  },
}

const raindropMetadata: DestinationMetadata = {
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

const handlers: Omit<ComposeDestinationSettingsProps, 'destination'> = {
  commonComment: 'A shared note for the article.',
  canEdit: true,
  copyConfirmationOpen: false,
  settingsOpen: true,
  onSettingsOpenChange: () => undefined,
  onDestinationChange: () => undefined,
  onRequestCopyCommonComment: () => undefined,
  onCancelCopyCommonComment: () => undefined,
  onCopyCommonComment: () => undefined,
}

const meta = {
  component: ComposeDestinationSettings,
  args: {
    ...handlers,
    destination: hatena,
  },
} satisfies Meta<typeof ComposeDestinationSettings>

export default meta

type Story = StoryObj<typeof meta>

export const Hatena: Story = {
  name: 'Hatena settings keep an unfinished tag and privacy option editable.',
}

export const Mastodon: Story = {
  args: { destination: mastodon, metadata: mastodonMetadata },
  name: 'Mastodon settings show visibility, content warning, and sensitivity.',
}

export const Raindrop: Story = {
  args: { destination: raindrop, metadata: raindropMetadata },
  name: 'Raindrop settings keep collection and tag values visible.',
}

export const X: Story = {
  args: { destination: x },
  name: 'X settings explain that posting opens another composer.',
}
