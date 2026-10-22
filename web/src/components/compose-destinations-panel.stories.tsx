import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'

type ComposeDestinationsPanelProps = Parameters<
  typeof ComposeDestinationsPanel
>[0]

const destinations: DestinationDraft[] = [
  {
    destination: 'hatena',
    selected: false,
    commentMode: 'common',
    customComment: '',
    options: { tags: ['sample', 'unfinished'], private: false },
  },
  {
    destination: 'mastodon',
    selected: true,
    commentMode: 'custom',
    customComment: 'A short individual note.',
    options: {
      visibility: 'unlisted',
      spoilerText: '',
      sensitive: false,
    },
  },
  {
    destination: 'raindrop',
    selected: true,
    commentMode: 'common',
    customComment: '',
    options: { collectionId: 187, tags: ['reading'] },
  },
  {
    destination: 'x',
    selected: false,
    commentMode: 'common',
    customComment: '',
  },
]

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: false },
    mastodon: { configured: true },
    raindrop: {
      configured: true,
      collections: [
        { id: 187, title: 'Fictional reading list', public: false },
      ],
    },
    x: { configured: true },
  },
}

const metadataUnavailable: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: {
      configured: true,
      metadataError: {
        code: 'unavailable',
        message: 'Instance details are temporarily unavailable.',
      },
    },
    raindrop: { configured: true },
    x: { configured: true },
  },
}

const handlers: Omit<ComposeDestinationsPanelProps, 'destinations'> = {
  commonComment: 'A shared note for the article.',
  canEdit: true,
  copyConfirmationDestination: null,
  onDestinationChange: () => undefined,
  onRequestCopyCommonComment: () => undefined,
  onCancelCopyCommonComment: () => undefined,
  onCopyCommonComment: () => undefined,
}

const meta = {
  component: ComposeDestinationsPanel,
  args: {
    ...handlers,
    destinations,
  },
} satisfies Meta<typeof ComposeDestinationsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The editor shows all four destinations and their saved settings.',
}

export const NewDraft: Story = {
  args: { destinations: [] },
  name: 'A new draft shows editable defaults without saving them early.',
}

export const Unconfigured: Story = {
  args: { metadata },
  name: 'An unconfigured destination stays disabled while its settings remain accessible.',
}

export const MetadataUnavailable: Story = {
  args: { metadata: metadataUnavailable },
  name: 'A metadata failure remains visible beside its destination.',
}

export const ReadOnly: Story = {
  args: { canEdit: false, defaultOpenDestination: 'mastodon' },
  name: 'Destination inputs are read-only while another tab owns the draft.',
}

export const ConfirmingCopy: Story = {
  args: { copyConfirmationDestination: 'mastodon' },
  name: 'The editor confirms before replacing an individual comment.',
}

export const SettingsOpen: Story = {
  args: { defaultOpenDestination: 'mastodon' },
  name: 'Mastodon settings open over the compact destination list.',
}
