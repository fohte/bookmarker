import type { Article, BookmarkDraft, Summary } from 'api/contracts'
import { useState } from 'react'

import { getComposeDraftTitle } from '#components/compose-draft-title'
import type { AnalysisDisplayState } from '#features/editor/compose-analysis-state'

const retryableAnalysisStates: ReadonlySet<AnalysisDisplayState> = new Set([
  'failed',
  'insufficient',
  'timeout',
  'invalid-response',
  'unavailable',
  'authentication-required',
])

function stateMessage(
  state: AnalysisDisplayState,
  subject: string,
): string | null {
  switch (state) {
    case 'not-requested':
    case 'success':
      return null
    case 'loading':
      return `${subject} is in progress.`
    case 'failed':
      return `${subject} could not be completed. The saved draft is still available.`
    case 'insufficient':
      return 'The article does not contain enough information for this analysis.'
    case 'timeout':
      return `${subject} timed out. Try again.`
    case 'invalid-response':
      return 'The AI could not return a usable result. The saved draft is still available.'
    case 'stale':
      return `The previous ${subject.toLowerCase()} is out of date. Run it again.`
    case 'unavailable':
      return 'The analysis service is temporarily unavailable.'
    case 'authentication-required':
      return 'Sign in to use article analysis, then try again.'
  }
}

export type ComposeArticleAnalysis = {
  article: Article | null
  extractionState: AnalysisDisplayState
  summary: Summary | null
  summaryState: AnalysisDisplayState
  onExtractArticle: () => void
  onSummarizeArticle: () => void
}

function analysisActionFor({
  canEdit,
  hasArticleText,
  article,
  extractionState,
  summary,
  summaryState,
  onExtractArticle,
  onSummarizeArticle,
}: ComposeArticleAnalysis & { canEdit: boolean; hasArticleText: boolean }) {
  if (!hasArticleText) {
    return {
      message:
        stateMessage(extractionState, 'Article extraction') ??
        'The article text is not loaded yet.',
      label: retryableAnalysisStates.has(extractionState)
        ? 'Retry extract'
        : 'Extract text',
      disabled: !canEdit || article === null || extractionState === 'loading',
      onClick: onExtractArticle,
    }
  }
  if (summary !== null && summaryState === 'success') return null

  let label = 'Refresh summary'
  if (retryableAnalysisStates.has(summaryState)) label = 'Retry summary'
  else if (summary === null) label = 'Summarize'
  return {
    message: stateMessage(summaryState, 'Summary'),
    label,
    disabled: !canEdit || summaryState === 'loading',
    onClick: onSummarizeArticle,
  }
}

export function ComposeArticle({
  draft,
  canEdit,
  article,
  extractionState,
  summary,
  summaryState,
  defaultSummaryExpanded = false,
  onEditArticle,
  onExtractArticle,
  onSummarizeArticle,
}: ComposeArticleAnalysis & {
  draft: BookmarkDraft
  canEdit: boolean
  defaultSummaryExpanded?: boolean
  onEditArticle: () => void
}) {
  const [summaryExpanded, setSummaryExpanded] = useState(defaultSummaryExpanded)
  const title = getComposeDraftTitle(draft, 'Untitled article')
  const hasArticleText = (article?.text.trim().length ?? 0) > 0
  const analysisAction = analysisActionFor({
    canEdit,
    hasArticleText,
    article,
    extractionState,
    summary,
    summaryState,
    onExtractArticle,
    onSummarizeArticle,
  })
  const partialNote =
    summary?.partial === true
      ? 'Summary of partial article text'
      : hasArticleText && article?.partial === true
        ? 'Partial article text'
        : null

  return (
    <section
      aria-label="Article"
      className="flex flex-col gap-1.5 border-b border-border p-4 md:min-w-0 md:grow md:basis-80 md:gap-3 md:border-b-0 md:p-0"
    >
      <p className="truncate font-mono text-xs text-muted-foreground-strong">
        {draft.source.url.replace(/^https?:\/\//, '')}
      </p>
      <h2 className="text-lg leading-snug font-bold break-words md:text-2xl">
        <button
          aria-label="Edit article title and text"
          className="text-left md:hidden"
          onClick={onEditArticle}
          type="button"
        >
          {title}
        </button>
        <span className="hidden md:inline">{title}</span>
      </h2>
      {summary !== null && (
        <>
          <p
            className={`mt-0.5 text-sm leading-relaxed break-words text-muted-foreground-strong md:mt-2 md:line-clamp-none md:text-base ${summaryExpanded ? '' : 'line-clamp-2'}`}
          >
            {summary.summary}
          </p>
          <button
            aria-expanded={summaryExpanded}
            className="min-h-7 self-start text-sm text-primary md:hidden"
            onClick={() => {
              setSummaryExpanded((expanded) => !expanded)
            }}
            type="button"
          >
            {summaryExpanded ? 'Show less' : 'Read summary'}
          </button>
        </>
      )}
      {partialNote !== null && (
        <p className="font-mono text-xs text-muted-foreground-faint">
          {partialNote}
        </p>
      )}
      {analysisAction !== null && (
        <div className="flex flex-wrap items-center gap-x-3 text-sm">
          {analysisAction.message !== null && (
            <p className="text-muted-foreground-strong" role="status">
              {analysisAction.message}
            </p>
          )}
          <button
            className="min-h-7 text-primary disabled:opacity-50"
            disabled={analysisAction.disabled}
            onClick={analysisAction.onClick}
            type="button"
          >
            {analysisAction.label}
          </button>
        </div>
      )}
      <div className="hidden gap-5 pt-1 text-sm md:flex">
        <button
          className="min-h-8 text-primary"
          onClick={onEditArticle}
          type="button"
        >
          Edit title and text
        </button>
        <a
          className="flex min-h-8 items-center text-primary"
          href={draft.source.url}
          rel="noreferrer"
          target="_blank"
        >
          Open article
        </a>
      </div>
    </section>
  )
}
