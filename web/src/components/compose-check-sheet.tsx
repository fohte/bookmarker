import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@fohte/ui/dialog'
import type { Verification } from 'api/contracts'
import { CheckIcon, CircleAlertIcon, CircleDashedIcon } from 'lucide-react'

import { destinationNames } from '#components/compose-destination-labels'
import { destinationIds } from '#features/editor/compose-destination'
import type {
  PrePublishReview,
  PublishCommentCheck,
} from '#features/editor/compose-pre-publish'
import { markQuotes } from '#features/editor/compose-quote-marks'

export type ComposeCheckSheetProps = PrePublishReview & {
  // Set when only X is selected: posting then means opening its composer.
  postHref: string | null
  onBackToEdit: () => void
  onPost: () => void
  onEditComment: (commentTargetId: string) => void
}

const issueTitles: Record<Verification['issues'][number]['kind'], string> = {
  error: 'Contradicts the article',
  unsupported: 'Not supported by the article',
  uncertain: 'Not clear from the article',
}

const plural = (count: number, singular: string, pluralForm: string) =>
  `${String(count)} ${count === 1 ? singular : pluralForm}`

const omittedIssueMessage = (count: number): string =>
  `${plural(count, 'potential issue was', 'potential issues were')} omitted because ${count === 1 ? 'its citation' : 'their citations'} could not be verified.`

const issueCount = (check: PublishCommentCheck): number =>
  check.verification?.issues.length ?? 0

function sheetSummary({ status, checks }: PrePublishReview): string {
  if (checks.length === 0) return 'No selected comments need a check.'
  if (status === 'checking') {
    const checking = checks.filter((check) => check.status === 'checking')
    return `Checking ${plural(checking.length, 'comment', 'comments')} against the article…`
  }
  const checked = checks.filter((check) => check.status !== 'skipped').length
  const points = checks.reduce((total, check) => total + issueCount(check), 0)
  const failed = checks.filter((check) => check.status === 'failed').length
  const checkedMessage = `Checked ${plural(checked, 'comment', 'comments')} against the article.`
  if (points > 0) {
    return `${checkedMessage} ${plural(points, 'point', 'points')} to review.`
  }
  if (failed > 0) {
    return `${checkedMessage} ${plural(failed, 'check', 'checks')} failed.`
  }
  return `${checkedMessage} No issues found.`
}

function rowStatus(check: PublishCommentCheck): string {
  switch (check.status) {
    case 'checking':
      return 'checking…'
    case 'skipped':
      return 'no comment'
    case 'failed':
      return 'check failed'
    case 'success':
      if (check.verification === null) return 'result unavailable'
      return issueCount(check) > 0
        ? plural(issueCount(check), 'point', 'points')
        : 'no issues'
  }
}

function editLabel(commentTargetId: string): string {
  const destination = destinationIds.find(
    (id) => commentTargetId === `destination:${id}`,
  )
  return destination === undefined
    ? 'Edit main comment'
    : `Edit ${destinationNames[destination]} comment`
}

function RowIcon({ check }: { check: PublishCommentCheck }) {
  if (check.status === 'checking') {
    return (
      <CircleDashedIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground-strong"
        strokeWidth={1.5}
      />
    )
  }
  if (check.status === 'failed' || issueCount(check) > 0) {
    return (
      <CircleAlertIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-primary"
        strokeWidth={1.5}
      />
    )
  }
  return (
    <CheckIcon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground-strong"
      strokeWidth={2}
    />
  )
}

function CheckRow({
  check,
  onEditComment,
}: {
  check: PublishCommentCheck
  onEditComment: (commentTargetId: string) => void
}) {
  const verification = check.status === 'success' ? check.verification : null
  const issues = verification?.issues ?? []
  const omittedIssueCount = verification?.omittedIssueCount ?? 0

  return (
    <li
      className="flex flex-col gap-2.5 border-b border-border px-4 py-3.5"
      data-prepublish-destinations={check.destinations.join(',')}
      data-prepublish-status={check.status}
    >
      <div className="flex items-center gap-3">
        <RowIcon check={check} />
        <p className="flex-1 text-sm">
          {check.destinations
            .map((destination) => destinationNames[destination])
            .join(', ')}{' '}
          <span className="text-xs text-muted-foreground-strong">
            {rowStatus(check)}
          </span>
        </p>
      </div>
      <div className="ml-7 flex flex-col gap-2.5 empty:hidden">
        {check.status === 'failed' && (
          <p className="text-sm text-muted-foreground-strong" role="alert">
            Check failed: {check.error} You can still post.
          </p>
        )}
        {issues.length > 0 && (
          <p
            className="text-base leading-relaxed break-words whitespace-pre-wrap"
            data-prepublish-comment
          >
            {markQuotes(
              check.comment,
              issues.map((issue) => issue.quote),
            ).map((segment, index) =>
              segment.marked ? (
                <mark
                  key={`${String(index)}:${segment.text}`}
                  className="bg-transparent text-inherit underline decoration-primary decoration-wavy underline-offset-5"
                >
                  {segment.text}
                </mark>
              ) : (
                segment.text
              ),
            )}
          </p>
        )}
        {issues.map((issue, index) => (
          <div
            key={`${issue.kind}:${String(index)}`}
            className="border border-border bg-background p-3 text-sm"
            data-prepublish-issue
          >
            <p className="font-bold">{issueTitles[issue.kind]}</p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground-strong">
              {issue.reason}
            </p>
            {issue.evidence !== undefined && (
              <p className="mt-1.5 leading-relaxed text-muted-foreground-strong">
                Evidence: {issue.evidence}
              </p>
            )}
          </div>
        ))}
        {verification?.partial === true && (
          <p className="text-xs text-muted-foreground-strong">
            Based on partial article text.
          </p>
        )}
        {omittedIssueCount > 0 && (
          <p className="text-xs text-muted-foreground-strong" role="status">
            {issues.length === 0 && 'No verifiable issues were found. '}
            {omittedIssueMessage(omittedIssueCount)}
          </p>
        )}
        {issues.length > 0 && (
          <div className="flex gap-5">
            {check.commentTargetIds.map((commentTargetId) => (
              <button
                key={commentTargetId}
                className="min-h-10 text-sm"
                onClick={() => {
                  onEditComment(commentTargetId)
                }}
                type="button"
              >
                {editLabel(commentTargetId)}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  )
}

const primaryClassName =
  'flex h-13 w-full items-center justify-center bg-foreground text-base font-bold text-background'
const secondaryClassName =
  'flex h-11 w-full items-center justify-center text-sm text-muted-foreground-strong'

export function ComposeCheckSheet({
  status,
  checks,
  postHref,
  onBackToEdit,
  onPost,
  onEditComment,
}: ComposeCheckSheetProps) {
  const isChecking = status === 'checking'
  const hasConcerns = checks.some(
    (check) => check.status === 'failed' || issueCount(check) > 0,
  )
  const postAction = (label: string, className: string) =>
    postHref === null ? (
      <button className={className} onClick={onPost} type="button">
        {label}
      </button>
    ) : (
      <a
        className={className}
        href={postHref}
        onClick={onPost}
        rel="noreferrer"
        target="_blank"
      >
        {label}
      </a>
    )
  const backToEdit = (className: string) => (
    <button className={className} onClick={onBackToEdit} type="button">
      Back to edit
    </button>
  )
  let actions = backToEdit(secondaryClassName)
  if (!isChecking && hasConcerns) {
    actions = (
      <>
        {backToEdit(primaryClassName)}
        {postAction('Post anyway', secondaryClassName)}
      </>
    )
  } else if (!isChecking) {
    actions = (
      <>
        {postAction('Post', primaryClassName)}
        {backToEdit(secondaryClassName)}
      </>
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isChecking) onBackToEdit()
      }}
    >
      <DialogContent
        className="top-auto bottom-0 left-0 flex max-h-160 max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-t border-border bg-muted p-0 ring-0 sm:max-w-none md:top-1/2 md:bottom-auto md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:border"
        data-compose-check
        showCloseButton={false}
      >
        <div className="border-b border-border px-4 pt-4 pb-3">
          <DialogTitle className="font-mono text-sm font-bold">
            <span aria-hidden="true" className="text-primary">
              #
            </span>{' '}
            check
          </DialogTitle>
          <DialogDescription
            className="mt-1.5 text-sm text-muted-foreground-strong"
            role="status"
          >
            {sheetSummary({ status, checks })}
          </DialogDescription>
        </div>
        <ul className="min-h-0 overflow-y-auto">
          {checks.map((check) => (
            <CheckRow
              key={check.commentTargetIds.join(',')}
              check={check}
              onEditComment={onEditComment}
            />
          ))}
        </ul>
        <footer className="flex shrink-0 flex-col gap-1 px-4 pt-3 pb-7">
          {actions}
        </footer>
      </DialogContent>
    </Dialog>
  )
}
