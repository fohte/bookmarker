import type { Meta, StoryObj } from '@storybook/react-vite'
import type { Article, BookmarkDraft } from 'api/contracts'

import { ComposeArticle } from '#components/compose-article'

const article: Article = {
  url: 'https://example.test/notes/paper-lantern',
  title: 'Notes on a fictional paper lantern',
  text: 'A fictional passage about folding and lighting a paper lantern.',
  source: 'shared',
  partial: false,
}

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000301',
  source: {
    version: 1,
    url: article.url,
    title: article.title,
    partial: false,
  },
  article,
  commonComment: '',
  destinations: [],
  delivery: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const summary = {
  summary:
    'The fictional notes compare three ways to fold a paper lantern, explain why the thinnest paper glows most evenly, and close with a short checklist for hanging it safely indoors.',
  partial: false,
}

const phone = {
  parameters: {
    screenshot: {
      viewport: { width: 390, height: 844 },
      fullPage: false,
      scale: 'css',
    },
  },
}

const meta = {
  component: ComposeArticle,
  args: {
    draft,
    canEdit: true,
    article,
    extractionState: 'success',
    summary,
    summaryState: 'success',
    onEditArticle: () => undefined,
    onExtractArticle: () => undefined,
    onSummarizeArticle: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-270 flex-col md:flex-row md:px-6 md:py-12">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComposeArticle>

export default meta

type Story = StoryObj<typeof meta>

export const SummaryCollapsed: Story = {
  ...phone,
  name: 'On a phone, the article shows its URL, title, and the first two lines of the summary.',
}

export const SummaryExpanded: Story = {
  ...phone,
  args: { defaultSummaryExpanded: true },
  name: 'On a phone, the article shows the whole summary with a toggle to show less.',
}

export const WideScreen: Story = {
  name: 'On a wide screen, the article shows the whole summary with links to edit and open it.',
}

export const PartialSummary: Story = {
  ...phone,
  args: {
    article: { ...article, partial: true },
    summary: { ...summary, partial: true },
  },
  name: 'The article notes that its summary covers only part of the text.',
}

export const TextMissing: Story = {
  ...phone,
  args: {
    article: { ...article, text: '' },
    extractionState: 'not-requested',
    summary: null,
    summaryState: 'not-requested',
  },
  name: 'The article offers to extract text when none is loaded.',
}

export const ExtractionTimedOut: Story = {
  ...phone,
  args: {
    article: { ...article, text: '' },
    extractionState: 'timeout',
    summary: null,
    summaryState: 'not-requested',
  },
  name: 'The article offers a retry after text extraction times out.',
}

export const NotSummarized: Story = {
  ...phone,
  args: { summary: null, summaryState: 'not-requested' },
  name: 'The article offers to summarize the loaded text.',
}

export const Summarizing: Story = {
  ...phone,
  args: { summary: null, summaryState: 'loading' },
  name: 'The article shows that a summary is being written.',
}
