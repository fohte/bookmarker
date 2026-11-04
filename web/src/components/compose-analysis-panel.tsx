import { Button } from '@fohte/ui/button'
import { Chip } from '@fohte/ui/chip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Panel } from '@fohte/ui/panel'
import type { Article, Summary, Verification } from 'api/contracts'
import { useState } from 'react'

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
    case 'insufficient':
      return 'The article does not contain enough information for this analysis.'
    case 'timeout':
      return `${subject} timed out. Try again.`
    case 'invalid-response':
      return 'The AI check could not return a usable result. The saved draft is still available.'
    case 'stale':
      return `The previous ${subject.toLowerCase()} is out of date. Run it again.`
    case 'unavailable':
      return 'The analysis service is temporarily unavailable.'
    case 'authentication-required':
      return 'Sign in to use article analysis, then try again.'
    case 'success':
      return null
  }
}

type AnalysisDetail = 'summary' | 'verification' | null

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
  defaultOpenDetail?: Exclude<AnalysisDetail, null>
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
  defaultOpenDetail,
  onExtractArticle,
  onSummarizeArticle,
  onVerifyComment,
  onVerificationTargetChange,
}: ComposeAnalysisPanelProps) {
  const [openDetail, setOpenDetail] = useState<AnalysisDetail>(
    defaultOpenDetail ?? null,
  )
  const hasArticleText = (article?.text.trim().length ?? 0) > 0
  const extractionMessage = stateMessage(extractionState, 'Article extraction')
  const summaryMessage = stateMessage(summaryState, 'Summary')
  const verificationMessage = stateMessage(
    verificationState,
    'Comment check',
    isCustomComment,
  )
  const omittedIssueCount = verification?.omittedIssueCount ?? 0
  return (
    <Panel
      data-compose-section="analysis"
      padding="sm"
      className="min-h-0 min-w-0 space-y-1 rounded-lg p-2 max-md:p-1.5"
    >
      {!hasArticleText && (
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <p className="min-w-0 text-xs text-muted-foreground" role="status">
            {extractionMessage}
          </p>
          <Button
            disabled={
              !canEdit || article === null || extractionState === 'loading'
            }
            onClick={onExtractArticle}
            size="xs"
            variant="outline"
          >
            {retryableAnalysisStates.has(extractionState)
              ? 'Retry extract'
              : 'Extract text'}
          </Button>
        </div>
      )}

      <section className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="text-sm font-medium">Summary</h2>
            {article?.partial === true && <Chip>Article partial</Chip>}
          </div>
          <Button
            disabled={!canEdit || !hasArticleText || summaryState === 'loading'}
            onClick={onSummarizeArticle}
            size="xs"
            variant="outline"
          >
            {retryableAnalysisStates.has(summaryState)
              ? 'Retry'
              : summary === null
                ? 'Generate'
                : 'Refresh'}
          </Button>
        </div>
        {summary === null ? (
          <p className="text-xs text-muted-foreground" role="status">
            {summaryMessage}
          </p>
        ) : (
          <>
            <p className="line-clamp-2 break-words text-xs leading-4 max-md:line-clamp-1">
              {summary.summary}
            </p>
            <div className="flex items-center justify-between gap-2">
              {summary.partial ? (
                <Chip>Summary partial</Chip>
              ) : summaryMessage !== null ? (
                <p
                  className="min-w-0 truncate text-2xs text-muted-foreground"
                  role="status"
                >
                  {summaryMessage}
                </p>
              ) : (
                <span />
              )}
              <Button
                aria-label="Read full summary"
                onClick={() => {
                  setOpenDetail('summary')
                }}
                size="xs"
                variant="ghost"
              >
                Details
              </Button>
            </div>
            {summary.partial && summaryMessage !== null && (
              <p className="text-2xs text-muted-foreground" role="status">
                {summaryMessage}
              </p>
            )}
          </>
        )}
        {summary === null && (
          <Button
            aria-label="Read full summary"
            onClick={() => {
              setOpenDetail('summary')
            }}
            size="xs"
            variant="ghost"
          >
            Details
          </Button>
        )}
      </section>

      <section className="space-y-1 border-t border-border pt-2 max-md:pt-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Comment check</h3>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              disabled={
                !canEdit ||
                !hasArticleText ||
                !canVerifyComment ||
                verificationState === 'loading'
              }
              onClick={onVerifyComment}
              size="xs"
              variant="outline"
            >
              {retryableAnalysisStates.has(verificationState)
                ? 'Retry'
                : 'Check'}
            </Button>
            <Button
              aria-label="Read comment check details"
              onClick={() => {
                setOpenDetail('verification')
              }}
              size="xs"
              variant="ghost"
            >
              Details
            </Button>
          </div>
        </div>
        <div
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          data-compose-verification-status
        >
          <p role="status">
            {verificationMessage ??
              (verification?.issues.length === 0
                ? 'No issues found in the available article text.'
                : `${String(verification?.issues.length ?? 0)} item(s) to review.`)}
          </p>
          {verification?.partial === true && <Chip>Based on partial text</Chip>}
          {verification !== null && verification.issues.length > 0 && (
            <Chip tone="strong">
              {String(verification.issues.length)} item(s) to review
            </Chip>
          )}
        </div>
      </section>

      <Dialog
        open={openDetail !== null}
        onOpenChange={(open) => {
          if (!open) setOpenDetail(null)
        }}
      >
        <DialogContent className="max-h-dvh w-full flex flex-col overflow-visible sm:max-w-lg">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>
              {openDetail === 'summary' ? 'Article summary' : 'Comment check'}
            </DialogTitle>
            <DialogDescription>
              Summaries and comment checks use only the available article text.
            </DialogDescription>
          </DialogHeader>
          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
            data-compose-analysis-detail-scroll
          >
            {openDetail === 'summary' ? (
              <section className="space-y-3">
                <Button
                  disabled={
                    !canEdit || !hasArticleText || summaryState === 'loading'
                  }
                  onClick={onSummarizeArticle}
                  size="sm"
                  variant="outline"
                >
                  {retryableAnalysisStates.has(summaryState)
                    ? 'Retry summary'
                    : summary === null
                      ? 'Generate summary'
                      : 'Refresh summary'}
                </Button>
                {summaryMessage !== null && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {summaryMessage}
                  </p>
                )}
                {summary !== null && (
                  <>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {summary.summary}
                    </p>
                    {summary.partial && (
                      <p
                        className="text-sm text-muted-foreground"
                        role="status"
                      >
                        This summary is based on partial article text.
                      </p>
                    )}
                  </>
                )}
              </section>
            ) : (
              <section className="space-y-3 text-sm">
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
                  {retryableAnalysisStates.has(verificationState)
                    ? 'Retry comment check'
                    : 'Check comment'}
                </Button>
                {verificationMessage !== null && (
                  <p className="text-sm text-muted-foreground" role="status">
                    {verificationMessage}
                  </p>
                )}
                {verification !== null && (
                  <div className="space-y-3">
                    {verification.partial && (
                      <p className="text-muted-foreground" role="status">
                        This check is based on partial article text.
                      </p>
                    )}
                    {verification.issues.length > 0 &&
                      omittedIssueCount > 0 && (
                        <p className="text-muted-foreground" role="status">
                          {omittedIssueCount} potential{' '}
                          {omittedIssueCount === 1
                            ? 'issue was'
                            : 'issues were'}{' '}
                          omitted because their citations could not be verified.
                        </p>
                      )}
                    {verification.issues.length === 0 ? (
                      <p role="status">
                        {omittedIssueCount > 0
                          ? `No verifiable issues were found. ${String(omittedIssueCount)} potential ${omittedIssueCount === 1 ? 'issue was' : 'issues were'} omitted because their citations could not be verified.`
                          : 'No issues were found in the available article text.'}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {verification.issues.map((issue, index) => (
                          <li
                            key={index}
                            className="border-l-2 border-border pl-3"
                          >
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
                  This checks the comment against the article, not against
                  external facts.
                </p>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
