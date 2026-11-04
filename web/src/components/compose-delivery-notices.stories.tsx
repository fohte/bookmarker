import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposeDeliveryNotices } from '#components/compose-delivery-notices'

const meta = {
  component: ComposeDeliveryNotices,
  args: {
    isLoadingMetadata: false,
    metadataErrorMessage: null,
    deliveryState: 'idle',
    deliveryErrorMessage: null,
    authenticationRequired: false,
    signInHref: null,
    onRetryDeliverySave: () => undefined,
    onRetryMetadata: () => undefined,
  },
} satisfies Meta<typeof ComposeDeliveryNotices>

export default meta

type Story = StoryObj<typeof meta>

export const LoadingMetadata: Story = {
  args: { isLoadingMetadata: true },
  name: 'The notices say that connected destinations are being checked.',
}

export const MetadataUnavailable: Story = {
  args: {
    metadataErrorMessage: 'Destination details are temporarily unavailable.',
  },
  name: 'The notices offer to retry destination details after they fail to load.',
}

export const SavingLatestInput: Story = {
  args: { deliveryState: 'saving-input' },
  name: 'The notices say the latest edits are saved before posting.',
}

export const DeliveryError: Story = {
  args: {
    deliveryErrorMessage:
      'Choose an available Raindrop collection. The saved collection ID was kept.',
  },
  name: 'The notices show why the post could not start.',
}

export const ResultSaveFailed: Story = {
  args: {
    deliveryState: 'result-save-failed',
    deliveryErrorMessage: 'The result could not be saved on this device.',
  },
  name: 'The notices offer to save a held result again.',
}

export const AuthenticationRequired: Story = {
  args: {
    authenticationRequired: true,
    signInHref: '/compose?draft=00000000-0000-4000-8000-000000000041',
  },
  name: 'The notices ask the user to sign in again after the draft is saved.',
}

export const AuthenticationWhileSaving: Story = {
  args: { authenticationRequired: true },
  name: 'The notices wait for the draft to be saved before offering to sign in.',
}
