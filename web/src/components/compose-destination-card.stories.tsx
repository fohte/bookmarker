import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationCard } from '#components/compose-destination-card'

type ComposeDestinationCardProps = Parameters<typeof ComposeDestinationCard>[0]

const hatena: DestinationDraft = {
  destination: 'hatena',
  selected: false,
  commentMode: 'common',
  customComment: '',
  options: { tags: ['sample', 'unfinished'], private: false },
}

const mastodon: DestinationDraft = {
  destination: 'mastodon',
  selected: true,
  commentMode: 'custom',
  customComment: 'A short individual note.',
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
  options: { collectionId: 187, tags: ['reading', 'unfinished'] },
}

const x: DestinationDraft = {
  destination: 'x',
  selected: false,
  commentMode: 'custom',
  customComment: '',
}

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: false },
    mastodon: {
      configured: true,
      maxCharacters: 500,
      charactersReservedPerUrl: 23,
    },
    raindrop: {
      configured: true,
      collections: [
        { id: 187, title: 'Fictional reading list', public: false },
      ],
    },
    x: { configured: true },
  },
}

const handlers: Omit<ComposeDestinationCardProps, 'destination'> = {
  commonComment: 'A shared note for the article.',
  canEdit: true,
  copyConfirmationOpen: false,
  onDestinationChange: () => undefined,
  onRequestCopyCommonComment: () => undefined,
  onCancelCopyCommonComment: () => undefined,
  onCopyCommonComment: () => undefined,
}

const meta = {
  component: ComposeDestinationCard,
  args: {
    ...handlers,
    destination: hatena,
  },
} satisfies Meta<typeof ComposeDestinationCard>

export default meta

type Story = StoryObj<typeof meta>

export const Hatena: Story = {
  name: 'Hatena keeps an unfinished tag and privacy setting editable.',
}

export const Mastodon: Story = {
  args: { destination: mastodon, metadata },
  name: 'Mastodon shows its character limit and posting settings.',
}

export const Raindrop: Story = {
  args: { destination: raindrop, metadata },
  name: 'Raindrop offers real collections and keeps its unfinished tag.',
}

export const UnavailableRaindropCollection: Story = {
  args: {
    destination: {
      ...raindrop,
      options: { ...raindrop.options, collectionId: 999 },
    },
    metadata,
  },
  name: 'Raindrop keeps an unavailable saved collection until the user changes it.',
}

export const RaindropDetailsUnavailable: Story = {
  args: {
    destination: raindrop,
    metadata: {
      destinations: {
        ...metadata.destinations,
        raindrop: {
          configured: true,
          metadataError: {
            code: 'unavailable',
            message: 'Collection details are temporarily unavailable.',
          },
        },
      },
    },
  },
  name: 'Raindrop keeps the saved collection when collection details fail.',
}

export const X: Story = {
  args: { destination: x },
  name: 'X keeps its external composer separate from API delivery.',
}

export const Unconfigured: Story = {
  args: { destination: { ...hatena, selected: true }, metadata },
  name: 'The disconnected Hatena destination can be deselected.',
}

export const ConfirmingCopy: Story = {
  args: { destination: mastodon, copyConfirmationOpen: true },
  name: 'The editor confirms before replacing a saved individual comment.',
}
