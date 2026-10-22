import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type { Article, Summary, Verification } from 'api/contracts'

type AnalysisDisplayState =
  'not-requested' | 'loading' | 'success' | 'failed' | 'stale' | 'unavailable'

function stateMessage(
  state: AnalysisDisplayState,
  subject: string,
  customComment = false,
): string | null {
  switch (state) {
    case 'not-requested':
      return customComment
        ? 'This custom comment has not been checked in this session.'
        : `${subject} has not been requested.`
    case 'loading':
      return `${subject} is in progress.`
    case 'failed':
      return `${subject} could not be completed. The saved draft is still available.`
    case 'stale':
      return `The previous ${subject.toLowerCase()} is out of date. Run it again.`
    case 'unavailable':
      return 'The analysis service is temporarily unavailable.'
    case 'success':
      return null
  }
}

export type ComposeAnalysisPanelProps = {
  article: Article | null
  canEdit: boolean
  extractionState: AnalysisDisplayState
  summary: Summary | null
  verification: Verification | null
  summaryState: AnalysisDisplayState
  verificationState: AnalysisDisplayState
  verificationTargets: Array<{ id: string; label: string }>
  selectedVerificationTargetId: string
  isCustomComment: boolean
  canVerifyComment: boolean
  onExtractArticle: () => void
  onSummarizeArticle: () => void
  onVerifyComment: () => void
  onVerificationTargetChange: (id: string) => void
}

export function ComposeAnalysisPanel({
  article,
  canEdit,
  extractionState,
  summary,
  verification,
  summaryState,
  verificationState,
  verificationTargets,
  selectedVerificationTargetId,
  isCustomComment,
  canVerifyComment,
  onExtractArticle,
  onSummarizeArticle,
  onVerifyComment,
  onVerificationTargetChange,
}: ComposeAnalysisPanelProps) {
  const hasArticleText = (article?.text.trim().length ?? 0) > 0
  const extractionMessage = stateMessage(extractionState, 'Article extraction')
  const summaryMessage = stateMessage(summaryState, 'Summary')
  const verificationMessage = stateMessage(
    verificationState,
    'Comment check',
    isCustomComment,
  )

  return (
    <Panel padding="md" className="space-y-5 rounded-lg p-5 sm:p-6">
      <div>
        <h2 className="font-medium">Article analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Summaries and comment checks use only the available article text.
        </p>
        {article?.partial === true && (
          <p className="mt-2 text-sm text-muted-foreground" role="status">
            The article text is partial.
          </p>
        )}
        {!hasArticleText && (
          <div className="mt-3 space-y-2">
            <Button
              disabled={
                !canEdit || article === null || extractionState === 'loading'
              }
              onClick={onExtractArticle}
              size="sm"
              variant="outline"
            >
              {extractionState === 'failed' || extractionState === 'unavailable'
                ? 'Retry article extraction'
                : 'Extract article text'}
            </Button>
            {extractionMessage !== null && (
              <p className="text-sm text-muted-foreground" role="status">
                {extractionMessage}
              </p>
            )}
          </div>
        )}
      </div>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Summary</h3>
          <Button
            disabled={!canEdit || !hasArticleText || summaryState === 'loading'}
            onClick={onSummarizeArticle}
            size="sm"
            variant="outline"
          >
            {summaryState === 'failed' || summaryState === 'unavailable'
              ? 'Retry summary'
              : 'Generate summary'}
          </Button>
        </div>
        {summaryMessage !== null && summary !== null && (
          <p className="text-sm text-muted-foreground" role="status">
            {summaryMessage}
          </p>
        )}
        {summary === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            {summaryMessage}
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="whitespace-pre-wrap">{summary.summary}</p>
            {summary.partial && (
              <p className="text-muted-foreground" role="status">
                This summary is based on partial article text.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Comment check</h3>
          <Button
            disabled={
              !canEdit ||
              !hasArticleText ||
              !canVerifyComment ||
              verificationState === 'loading'
            }
            onClick={onVerifyComment}
            size="sm"
            variant="outline"
          >
            Check comment
          </Button>
        </div>
        {verificationTargets.length > 1 && (
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="analysis-comment-target"
            >
              Comment to check
            </label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              disabled={!canEdit}
              id="analysis-comment-target"
              onChange={(event) => {
                onVerificationTargetChange(event.currentTarget.value)
              }}
              value={selectedVerificationTargetId}
            >
              {verificationTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {verificationMessage !== null && verification !== null && (
          <p className="text-sm text-muted-foreground" role="status">
            {verificationMessage}
          </p>
        )}
        {verification === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            {verificationMessage}
          </p>
        ) : (
          <div className="space-y-3 text-sm">
            {verification.partial && (
              <p className="text-muted-foreground" role="status">
                This check is based on partial article text.
              </p>
            )}
            {verification.issues.length === 0 ? (
              <p role="status">
                No issues were found in the available article text.
              </p>
            ) : (
              <ul className="space-y-3">
                {verification.issues.map((issue, index) => (
                  <li key={index} className="border-l-2 border-border pl-3">
                    <p className="font-medium">
                      {issue.kind === 'error'
                        ? 'Contradicted by the article'
                        : issue.kind === 'unsupported'
                          ? 'Not supported by the article'
                          : 'Cannot be confirmed from the article'}
                    </p>
                    {issue.quote.length > 0 && (
                      <blockquote className="mt-1 text-muted-foreground">
                        {issue.quote}
                      </blockquote>
                    )}
                    <p className="mt-1">{issue.reason}</p>
                    {issue.evidence !== undefined && (
                      <p className="mt-1 text-muted-foreground">
                        Evidence: {issue.evidence}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          This checks the comment against the article, not against external
          facts.
        </p>
      </section>
    </Panel>
  )
}
