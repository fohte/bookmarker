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

export const NoPendingComments: Story = {
  args: { status: 'complete', checks: [] },
  name: 'The editor has no API destination comments to check.',
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

export const IssuesWithUnverifiedCitations: Story = {
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
            },
          ],
          partial: false,
          omittedIssueCount: 1,
        },
        error: null,
      },
    ],
  },
  name: 'The editor shows verified issues and unverified potential issues.',
}

export const UnverifiedPotentialIssues: Story = {
  args: {
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'success',
        verification: {
          issues: [],
          partial: false,
          omittedIssueCount: 2,
        },
        error: null,
      },
    ],
  },
  name: 'The editor reports potential issues with unverified citations.',
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

export const InsufficientArticle: Story = {
  args: {
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'failed',
        verification: null,
        error:
          'The article does not contain enough information for comment checking.',
      },
    ],
  },
  name: 'The editor explains when the article has too little information.',
}

export const CheckTimedOut: Story = {
  args: {
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'failed',
        verification: null,
        error: 'The comment check timed out. Try again.',
      },
    ],
  },
  name: 'The editor explains when a comment check times out.',
}

export const InvalidCheckResponse: Story = {
  args: {
    checks: [
      {
        destination: 'mastodon',
        commentTargetId: 'common',
        comment: 'A fictional comment.',
        status: 'failed',
        verification: null,
        error: 'The AI check could not return a usable result.',
      },
    ],
  },
  name: 'The editor explains when the AI check returns an unusable result.',
}
