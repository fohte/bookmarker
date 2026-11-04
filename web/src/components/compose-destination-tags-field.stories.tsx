import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposeDestinationTagsField } from '#components/compose-destination-tags-field'

const meta = {
  component: ComposeDestinationTagsField,
  args: {
    id: 'destination-tags',
    tags: ['lanterns', 'paper'],
    disabled: false,
    onTagsChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-120 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeDestinationTagsField>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'Saved tags appear as removable chips before the field for the next tag.',
}

export const Empty: Story = {
  args: { tags: [] },
  name: 'A destination without tags shows only the field for adding one.',
}

export const ReadOnly: Story = {
  args: { disabled: true },
  name: 'Tags cannot be removed or added while another tab owns the draft.',
}
