import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  ComposePrePublishReview,
  type ComposePrePublishReviewProps,
} from '#components/compose-pre-publish-review'

const controls: Omit<ComposePrePublishReviewProps, 'status' | 'checks'> = {
  onCancel: () => undefined,
  onPublish: () => undefined,
}

const meta = {
  component: ComposePrePublishReview,
  args: {
    ...controls,
    status: 'complete',
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'success',
        verification: { issues: [], partial: false },
        error: null,
      },
    ],
  },
} satisfies Meta<typeof ComposePrePublishReview>

export default meta

type Story = StoryObj<typeof meta>

export const Checking: Story = {
  args: {
    status: 'checking',
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'checking',
        verification: null,
        error: null,
      },
    ],
  },
  name: 'The editor checks the selected destination comment.',
}

export const NoIssues: Story = {
  name: 'The editor finds no issues in the comment.',
}

export const IssuesFound: Story = {
  args: {
    checks: [
      {
        destination: 'hatena',
        commentTargetId: 'destination:hatena',
        comment: 'A fictional custom comment.',
        status: 'success',
        verification: {
          issues: [
            {
              kind: 'uncertain',
              quote: 'The bridge is blue.',
              reason: 'The available article text does not state its color.',
              evidence: 'The article describes the bridge material only.',
            },
          ],
          partial: true,
        },
        error: null,
      },
    ],
  },
  name: 'The editor shows a comment detail that needs review.',
}

export const CheckFailed: Story = {
  args: {
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'failed',
        verification: null,
        error: 'The comment check service is temporarily unavailable.',
      },
    ],
  },
  name: 'The editor allows publishing after a comment check failure.',
}
