import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationRow } from '#components/compose-destination-row'

const hatena: DestinationDraft = {
  destination: 'hatena',
  selected: true,
  commentMode: 'custom',
  customComment: 'A shorter note for the bookmark list.',
  options: { tags: ['lanterns', 'paper'], private: true },
}

const mastodon: DestinationDraft = {
  destination: 'mastodon',
  selected: true,
  commentMode: 'common',
  customComment: '',
  options: {
    visibility: 'unlisted',
    spoilerText: 'Craft notes',
    sensitive: true,
  },
}

const raindrop: DestinationDraft = {
  destination: 'raindrop',
  selected: true,
  commentMode: 'common',
  customComment: '',
  options: { collectionId: 918, tags: ['reading'] },
}

const x: DestinationDraft = {
  destination: 'x',
  selected: true,
  commentMode: 'custom',
  customComment: 'Thin paper makes the lantern glow evenly.',
}

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: {
      configured: true,
      maxCharacters: 500,
      charactersReservedPerUrl: 23,
    },
    raindrop: {
      configured: true,
      collections: [
        { id: 71, title: 'Fictional reading collection', public: false },
      ],
    },
    x: { configured: true },
  },
}

const meta = {
  component: ComposeDestinationRow,
  args: {
    destination: hatena,
    commonComment:
      'Folding thinner paper gives a softer glow. Worth trying for the next lantern.',
    articleUrl: 'https://example.test/notes/paper-lantern',
    canEdit: true,
    metadata,
    open: false,
    onOpenChange: () => undefined,
    onDestinationChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <ul className="max-w-120">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof ComposeDestinationRow>

export default meta

type Story = StoryObj<typeof meta>

export const OwnComment: Story = {
  name: 'A destination with its own comment marks its name and shows its tags and privacy.',
}

export const MainComment: Story = {
  args: { destination: mastodon },
  name: 'A destination that uses the main comment shows it dimmed with the article URL and its count.',
}

export const Off: Story = {
  args: { destination: { ...raindrop, selected: false } },
  name: 'An unselected destination shows that it is off.',
}

export const OverLimit: Story = {
  args: {
    destination: {
      ...x,
      customComment:
        'A long fictional note that keeps going about folding, lighting, and hanging a paper lantern, then repeats the same advice twice more so the post runs past the limit of the X composer by a clear margin.',
    },
  },
  name: 'A comment that is too long for the destination shows its count in red.',
}

export const NotConnected: Story = {
  args: {
    destination: { ...hatena, selected: false },
    metadata: {
      destinations: { ...metadata.destinations, hatena: { configured: false } },
    },
  },
  name: 'An unconnected destination cannot be selected.',
}

export const DetailsUnavailable: Story = {
  args: {
    destination: mastodon,
    metadata: {
      destinations: {
        ...metadata.destinations,
        mastodon: {
          configured: true,
          metadataError: {
            code: 'unavailable',
            message: 'Instance details are temporarily unavailable.',
          },
        },
      },
    },
  },
  name: 'A destination whose details failed to load says so in its summary.',
}

export const HatenaOpen: Story = {
  args: { open: true },
  name: 'An open Hatena row edits its own comment, tags, and privacy in place.',
}

export const MastodonOpen: Story = {
  args: { destination: mastodon, open: true },
  name: 'An open Mastodon row explains that typing makes the comment Mastodon-only.',
}

export const RaindropOpen: Story = {
  args: { destination: raindrop, open: true },
  name: 'An open Raindrop row asks to replace a saved collection that is no longer available.',
}

export const XOpen: Story = {
  args: { destination: x, open: true },
  name: 'An open X row offers to go back to the main comment.',
}

export const ReadOnly: Story = {
  args: { canEdit: false, open: true },
  name: 'An open row is read-only while another tab owns the draft.',
}
