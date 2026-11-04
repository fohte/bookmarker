import type { Meta, StoryObj } from '@storybook/react-vite'

import { ComposeSwitch } from '#components/compose-switch'

const meta = {
  component: ComposeSwitch,
  args: {
    label: 'Private bookmark',
    checked: false,
    disabled: false,
    onCheckedChange: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="max-w-120 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeSwitch>

export default meta

type Story = StoryObj<typeof meta>

export const Off: Story = {
  name: 'A switch that is off shows its knob on the left.',
}

export const On: Story = {
  args: { checked: true },
  name: 'A switch that is on fills in and moves its knob to the right.',
}

export const Disabled: Story = {
  args: { checked: true, disabled: true },
  name: 'A disabled switch is dimmed.',
}
