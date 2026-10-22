import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposeDestinationTagsField } from '#components/compose-destination-tags-field'

const meta = {
  component: ComposeDestinationTagsField,
  args: {
    id: 'destination-tags',
    label: 'Tags (comma separated)',
    tags: ['sample', 'unfinished'],
    disabled: false,
    onTagsChange: () => undefined,
  },
} satisfies Meta<typeof ComposeDestinationTagsField>

export default meta

type Story = StoryObj<typeof meta>

export const Editing: Story = {
  name: 'The editor keeps an unfinished destination tag visible.',
}

export const Empty: Story = {
  args: { tags: [] },
  name: 'A new destination starts with an empty tag field.',
}
