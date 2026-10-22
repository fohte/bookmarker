import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Article, Summary, Verification } from 'api/contracts'

import { ComposeAnalysisPanel } from '#components/compose-analysis-panel'

const article: Article = {
  url: 'https://example.test/article',
  title: 'A sample article title',
  text: 'A short fictional passage used to preview the available source.',
  source: 'manual',
  partial: true,
}

const summary: Summary = {
  summary: 'A fictional summary of the sample article.',
  partial: true,
}

const verification: Verification = {
  issues: [
    {
      kind: 'error',
      quote: 'A claim that conflicts with the article.',
      reason: 'The article gives a different value.',
      evidence: 'A fictional passage from the article.',
    },
    {
      kind: 'unsupported',
      quote: 'A claim without supporting detail.',
      reason: 'The article does not discuss this point.',
    },
    {
      kind: 'uncertain',
      quote: 'A claim with unclear context.',
      reason: 'The available text does not settle this claim.',
    },
  ],
  partial: true,
}

const meta = {
  component: ComposeAnalysisPanel,
  args: {
    article,
    canEdit: true,
    extractionState: 'not-requested',
    summary: null,
    verification: null,
    summaryState: 'unavailable',
    verificationState: 'unavailable',
    verificationTargets: [{ id: 'common', label: 'Common comment' }],
    selectedVerificationTargetId: 'common',
    isCustomComment: false,
    canVerifyComment: true,
    onExtractArticle: () => undefined,
    onSummarizeArticle: () => undefined,
    onVerifyComment: () => undefined,
    onVerificationTargetChange: () => undefined,
  },
} satisfies Meta<typeof ComposeAnalysisPanel>

export default meta

type Story = StoryObj<typeof meta>

export const Unavailable: Story = {
  name: 'The editor explains that the analysis service is temporarily unavailable.',
}

export const AuthenticationRequired: Story = {
  args: {
    summaryState: 'authentication-required',
    verificationState: 'not-requested',
  },
  name: 'The editor asks the user to sign in before running analysis.',
}

export const Loading: Story = {
  args: { summaryState: 'loading', verificationState: 'loading' },
  name: 'The editor distinguishes analysis that is still in progress.',
}

export const Failed: Story = {
  args: { summaryState: 'failed', verificationState: 'failed' },
  name: 'The editor preserves the draft after analysis fails.',
}

export const NotRequested: Story = {
  args: {
    summaryState: 'not-requested',
    verificationState: 'not-requested',
  },
  name: 'The editor distinguishes analysis that has not been requested.',
}

export const PartialIssues: Story = {
  args: { summary, verification },
  name: 'The editor shows a partial summary and all three comment issue types.',
}

export const ArticleTextUnavailable: Story = {
  args: {
    article: { ...article, text: '' },
    extractionState: 'failed',
    summaryState: 'not-requested',
    verificationState: 'not-requested',
  },
  name: 'The editor offers article extraction after the previous request failed.',
}

export const CustomCommentUnverified: Story = {
  args: {
    verificationTargets: [
      { id: 'common', label: 'Common comment' },
      { id: 'destination:hatena', label: 'Hatena custom comment' },
    ],
    selectedVerificationTargetId: 'destination:hatena',
    isCustomComment: true,
    verification: null,
    verificationState: 'not-requested',
  },
  name: 'The editor marks a custom comment as unchecked in this session.',
}

export const NoIssues: Story = {
  args: {
    verification: { issues: [], partial: false },
    verificationState: 'not-requested',
  },
  name: 'The editor reports that no issue was found in the article text.',
}
