import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import type { Article, Summary, Verification } from 'api/contracts'

export type AnalysisDisplayState =
  'not-requested' | 'loading' | 'failed' | 'unavailable'

function stateMessage(state: AnalysisDisplayState, subject: string): string {
  switch (state) {
    case 'not-requested':
      return `${subject} has not been requested.`
    case 'loading':
      return `${subject} is in progress.`
    case 'failed':
      return `${subject} failed. The saved draft is still available.`
    case 'unavailable':
      return `${subject} is unavailable because the analysis service is not connected.`
  }
}

export function ComposeAnalysisPanel({
  article,
  summary,
  verification,
  summaryState,
  verificationState,
}: {
  article: Article | null
  summary: Summary | null
  verification: Verification | null
  summaryState: AnalysisDisplayState
  verificationState: AnalysisDisplayState
}) {
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
      </div>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Summary</h3>
          <Button disabled size="sm" variant="outline">
            Generate summary
          </Button>
        </div>
        {summary === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            {stateMessage(summaryState, 'Summary')}
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
          <Button disabled size="sm" variant="outline">
            Check comment
          </Button>
        </div>
        {verification === null ? (
          <p className="text-sm text-muted-foreground" role="status">
            {stateMessage(verificationState, 'Comment check')}
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
