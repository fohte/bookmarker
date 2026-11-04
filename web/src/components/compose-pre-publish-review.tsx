import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import type { Verification } from 'api/contracts'

import { destinationNames } from '#components/compose-destination-labels'
import type { PrePublishReview } from '#features/editor/compose-pre-publish'

export type ComposePrePublishReviewProps = PrePublishReview & {
  onCancel: () => void
  onPublish: () => void
}

const omittedIssueMessage = (count: number): string =>
  `${String(count)} potential ${count === 1 ? 'issue was' : 'issues were'} omitted because ${count === 1 ? 'its citation' : 'their citations'} could not be verified.`

const verificationMessage = (verification: Verification): string => {
  const omittedIssueCount = verification.omittedIssueCount ?? 0
  if (verification.issues.length > 0) {
    return `${String(verification.issues.length)} item(s) to review.`
  }
  if (omittedIssueCount > 0) {
    return `No verifiable issues were found. ${omittedIssueMessage(omittedIssueCount)}`
  }
  return 'No issues found in the available article text.'
}

export function ComposePrePublishReview({
  status,
  checks,
  onCancel,
  onPublish,
}: ComposePrePublishReviewProps) {
  const isChecking = status === 'checking'

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isChecking) onCancel()
      }}
    >
      <DialogContent className="max-h-dvh w-full flex flex-col overflow-visible sm:max-w-lg">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Review comments before publishing</DialogTitle>
          <DialogDescription>
            {isChecking
              ? `Checking ${String(checks.filter((check) => check.status === 'checking').length)} comment(s) against the available article text.`
              : 'Review each comment check result before publishing.'}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {checks.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">
              No API destination comments are pending.
            </p>
          ) : (
            checks.map((check, index) => (
              <section
                key={`${check.destination}:${String(index)}`}
                data-prepublish-destination={check.destination}
                data-prepublish-status={check.status}
                className="space-y-1 border-t border-border pt-3 first:border-0 first:pt-0"
              >
                <h3 className="text-sm font-medium">
                  {destinationNames[check.destination]} comment
                </h3>
                {check.comment.length > 0 && (
                  <p
                    data-prepublish-comment
                    className="whitespace-pre-wrap break-words text-sm"
                  >
                    {check.comment}
                  </p>
                )}
                {check.status === 'checking' ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    Checking comment…
                  </p>
                ) : check.status === 'failed' ? (
                  <p className="text-sm text-destructive" role="alert">
                    Check failed: {check.error} You can still publish.
                  </p>
                ) : check.status === 'skipped' ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    There is no comment to check.
                  </p>
                ) : check.verification === null ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    The result is unavailable.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground" role="status">
                      {verificationMessage(check.verification)}
                    </p>
                    {check.verification.partial && (
                      <p className="text-xs text-muted-foreground">
                        Based on partial article text.
                      </p>
                    )}
                    {check.verification.issues.length > 0 &&
                      (check.verification.omittedIssueCount ?? 0) > 0 && (
                        <p
                          className="text-xs text-muted-foreground"
                          role="status"
                        >
                          {omittedIssueMessage(
                            check.verification.omittedIssueCount ?? 0,
                          )}
                        </p>
                      )}
                    {check.verification.issues.length > 0 && (
                      <ul className="space-y-2 text-sm">
                        {check.verification.issues.map((issue, issueIndex) => (
                          <li
                            key={`${issue.kind}:${String(issueIndex)}`}
                            data-prepublish-issue
                            className="rounded-md border border-border p-2"
                          >
                            <p className="font-medium">
                              {issue.kind}: {issue.quote}
                            </p>
                            <p className="text-muted-foreground">
                              {issue.reason}
                            </p>
                            {issue.evidence !== undefined && (
                              <p className="mt-1 text-muted-foreground">
                                Evidence: {issue.evidence}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            ))
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
          {!isChecking && <Button onClick={onPublish}>Publish</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
