import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposePostBar } from '#components/compose-post-bar'

const meta = {
  component: ComposePostBar,
  args: {
    pendingCount: 2,
    xSelected: true,
    canPost: true,
    isLoadingMetadata: false,
    metadataErrorMessage: null,
    deliveryState: 'idle',
    deliveryErrorMessage: null,
    authenticationRequired: false,
    signInHref: null,
    onPost: () => undefined,
    onRetryDeliverySave: () => undefined,
    onRetryMetadata: () => undefined,
  },
} satisfies Meta<typeof ComposePostBar>

export default meta

type Story = StoryObj<typeof meta>

export const PostThenX: Story = {
  name: 'The post button checks and posts to two destinations, then opens X.',
}

export const PostOne: Story = {
  args: { pendingCount: 1, xSelected: false },
  name: 'The post button checks and posts to one destination.',
}

export const OnlyX: Story = {
  args: { pendingCount: 0, xSelected: true },
  name: 'The post button checks the comment and opens X when only X is selected.',
}

export const NothingSelected: Story = {
  args: { pendingCount: 0, xSelected: false, canPost: false },
  name: 'The post button asks to choose a destination and cannot be pressed.',
}

export const Posting: Story = {
  args: { deliveryState: 'sending', canPost: false },
  name: 'The post button shows that the post is being sent.',
}

export const MetadataUnavailable: Story = {
  args: {
    metadataErrorMessage: 'Destination details are temporarily unavailable.',
    canPost: false,
  },
  name: 'The post bar keeps posting disabled and offers to retry destination details.',
}
