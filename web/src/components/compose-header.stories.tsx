import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposeHeader } from '#components/compose-header'

const meta = {
  component: ComposeHeader,
  args: {
    draftCount: 3,
    saveState: 'saved',
    canRetrySave: true,
    onOpenDrafts: () => undefined,
    onRetrySave: () => undefined,
  },
} satisfies Meta<typeof ComposeHeader>

export default meta

type Story = StoryObj<typeof meta>

export const Saved: Story = {
  name: 'The header shows the draft count and that the draft is saved.',
}

export const Saving: Story = {
  args: { saveState: 'saving' },
  name: 'The header shows that the latest input is being saved.',
}

export const SaveFailed: Story = {
  args: { saveState: 'failed' },
  name: 'The header offers a retry after saving fails.',
}

export const NoDraft: Story = {
  args: { draftCount: 2, saveState: null },
  name: 'The header shows only the draft count when no draft is open.',
}
