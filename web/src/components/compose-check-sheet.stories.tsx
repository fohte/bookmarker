import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'

import { ComposeCheckSheet } from '#components/compose-check-sheet'
import type { PublishCommentCheck } from '#features/editor/compose-pre-publish'

const controls: Omit<
  ComponentProps<typeof ComposeCheckSheet>,
  'status' | 'checks'
> = {
  postHref: null,
  onBackToEdit: () => undefined,
  onPost: () => undefined,
  onEditComment: () => undefined,
}

const clean = (
  destinations: PublishCommentCheck['destinations'],
  commentTargetId: string,
): PublishCommentCheck => ({
  destinations,
  commentTargetIds: [commentTargetId],
  comment: 'A fictional comment about paper lanterns.',
  status: 'success',
  verification: { issues: [], partial: false },
  error: null,
})

const failed = (error: string): PublishCommentCheck => ({
  destinations: ['mastodon'],
  commentTargetIds: ['common'],
  comment: 'A fictional comment about paper lanterns.',
  status: 'failed',
  verification: null,
  error,
})

const meta = {
  component: ComposeCheckSheet,
  args: {
    ...controls,
    status: 'complete',
    checks: [clean(['hatena'], 'destination:hatena')],
  },
} satisfies Meta<typeof ComposeCheckSheet>

export default meta

type Story = StoryObj<typeof meta>

export const Checking: Story = {
  args: {
    status: 'checking',
    checks: [
      {
        ...clean(['mastodon', 'x'], 'common'),
        status: 'checking',
        verification: null,
      },
    ],
  },
  name: 'The sheet checks the comments and offers only going back to edit.',
}

export const NoIssues: Story = {
  args: {
    checks: [
      clean(['hatena'], 'destination:hatena'),
      clean(['mastodon', 'x'], 'common'),
    ],
  },
  name: 'The sheet finds no issues and makes posting the main action.',
}

export const IssueFound: Story = {
  args: {
    checks: [
      clean(['hatena'], 'destination:hatena'),
      {
        destinations: ['mastodon'],
        commentTargetIds: ['destination:mastodon'],
        comment:
          'Thin paper makes the lantern glow evenly and always lasts ten years.',
        status: 'success',
        verification: {
          issues: [
            {
              kind: 'unsupported',
              quote: 'always lasts ten years',
              reason:
                'The article compares paper thickness and glow, but does not say how long a lantern lasts.',
              evidence: 'Thinner paper spreads the light more evenly.',
            },
          ],
          partial: true,
        },
        error: null,
      },
    ],
  },
  name: 'The sheet underlines the flagged passage and makes going back to edit the main action.',
}

export const IssuesWithUnverifiedCitations: Story = {
  args: {
    checks: [
      {
        destinations: ['mastodon', 'x'],
        commentTargetIds: ['common'],
        comment: 'The bridge is blue and opened in spring.',
        status: 'success',
        verification: {
          issues: [
            {
              kind: 'uncertain',
              quote: 'The bridge is blue',
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
  name: 'The sheet shows a verified issue on the main comment and counts potential issues it could not verify.',
}

export const UnverifiedPotentialIssues: Story = {
  args: {
    checks: [
      {
        ...clean(['mastodon'], 'common'),
        verification: { issues: [], partial: false, omittedIssueCount: 2 },
      },
    ],
  },
  name: 'The sheet reports potential issues with unverified citations without flagging the comment.',
}

export const CheckFailed: Story = {
  args: {
    checks: [failed('The comment check service is temporarily unavailable.')],
  },
  name: 'The sheet still allows posting after a comment check failure.',
}

export const InsufficientArticle: Story = {
  args: {
    checks: [
      failed(
        'The article does not contain enough information for comment checking.',
      ),
    ],
  },
  name: 'The sheet explains when the article has too little information.',
}

export const CheckTimedOut: Story = {
  args: {
    checks: [failed('The comment check timed out. Try again.')],
  },
  name: 'The sheet explains when a comment check times out.',
}

export const InvalidCheckResponse: Story = {
  args: {
    checks: [failed('The AI check could not return a usable result.')],
  },
  name: 'The sheet explains when the AI check returns an unusable result.',
}

export const OnlyX: Story = {
  args: {
    checks: [clean(['x'], 'common')],
    postHref: 'https://x.com/intent/tweet?text=A%20fictional%20note',
  },
  name: 'The sheet opens X as the post action when only X is selected.',
}
