import type { Meta, StoryObj } from '@storybook/react-vite'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { ComposeDestinationsPanel } from '#components/compose-destinations-panel'

const destinations: DestinationDraft[] = [
  {
    destination: 'hatena',
    selected: true,
    commentMode: 'custom',
    customComment: 'A shorter note for the bookmark list.',
    options: { tags: ['lanterns', 'paper'], private: false },
  },
  {
    destination: 'mastodon',
    selected: true,
    commentMode: 'common',
    customComment: '',
    options: { visibility: 'unlisted', spoilerText: '', sensitive: false },
  },
  {
    destination: 'raindrop',
    selected: false,
    commentMode: 'common',
    customComment: '',
    options: { collectionId: -1, tags: [] },
  },
  {
    destination: 'x',
    selected: true,
    commentMode: 'custom',
    customComment: 'Thin paper makes the lantern glow evenly.',
  },
]

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: {
      configured: true,
      maxCharacters: 500,
      charactersReservedPerUrl: 23,
    },
    raindrop: { configured: true, collections: [] },
    x: { configured: true },
  },
}

const meta = {
  component: ComposeDestinationsPanel,
  args: {
    destinations,
    commonComment:
      'Folding thinner paper gives a softer glow. Worth trying for the next lantern.',
    articleUrl: 'https://example.test/notes/paper-lantern',
    canEdit: true,
    metadata,
    openDestination: null,
    onOpenDestinationChange: () => undefined,
    onDestinationChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-120">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeDestinationsPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The post to list shows each selected destination with its comment, settings, and character count.',
}

export const RowOpen: Story = {
  args: { openDestination: 'hatena' },
  name: 'The post to list opens one destination to edit its comment and settings in place.',
}

export const NewDraft: Story = {
  args: { destinations: [] },
  name: 'A new draft lists every destination as off.',
}
