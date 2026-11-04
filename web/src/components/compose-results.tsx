import type { BookmarkDraft } from 'api/contracts'
import {
  ArrowUpRightIcon,
  CheckIcon,
  CircleDashedIcon,
  XIcon,
} from 'lucide-react'

import {
  ComposeDeliveryNotices,
  type ComposeDeliveryNoticesProps,
} from '#components/compose-delivery-notices'
import { deliveryStatus } from '#components/compose-delivery-status'
import { destinationNames } from '#components/compose-destination-labels'
import { latestDeliverySnapshots } from '#features/editor/compose-delivery-history'

export type ComposeResultsProps = ComposeDeliveryNoticesProps & {
  draft: BookmarkDraft
  xSelected: boolean
  canOpenX: boolean
  xIntentHref: string | null
  canRetry: boolean
  onRetry: () => void
  onBackToEdit: () => void
}

function ResultIcon({ status }: { status: 'succeeded' | 'failed' | null }) {
  const className = 'mt-1 size-4 shrink-0'
  if (status === 'succeeded') {
    return <CheckIcon aria-hidden="true" className={className} />
  }
  if (status === 'failed') {
    return <XIcon aria-hidden="true" className={className} />
  }
  return (
    <CircleDashedIcon
      aria-hidden="true"
      className={`${className} text-muted-foreground-strong`}
      strokeWidth={1.5}
    />
  )
}

export function ComposeResults({
  draft,
  xSelected,
  canOpenX,
  xIntentHref,
  canRetry,
  onRetry,
  onBackToEdit,
  ...notices
}: ComposeResultsProps) {
  const url = draft.article?.url ?? draft.source.url
  const displayUrl = url.replace(/^https?:\/\//, '')
  const title = draft.article?.title ?? draft.source.title ?? displayUrl

  return (
    <>
      <div data-compose-content className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-180 md:px-6 md:py-12">
          <section
            aria-label="Article"
            className="flex flex-col gap-2 border-b border-border px-4 pt-5 pb-4.5 md:px-0"
          >
            <p className="font-mono text-xs break-all text-muted-foreground-strong">
              {displayUrl}
            </p>
            <p className="text-xl leading-snug font-bold">{title}</p>
          </section>
          {draft.commonComment.trim() !== '' && (
            <section
              aria-label="Posted comment"
              className="border-b border-border p-4 md:px-0"
            >
              <p className="text-base leading-relaxed break-words whitespace-pre-wrap text-muted-foreground-strong">
                {draft.commonComment}
              </p>
            </section>
          )}
          <section aria-label="Results">
            <div className="px-4 pt-3 empty:hidden md:px-0">
              <ComposeDeliveryNotices {...notices} />
            </div>
            <ul aria-label="Results by destination">
              {latestDeliverySnapshots(draft.delivery).map((snapshot) => {
                const destination = snapshot.target.destination
                const name = destinationNames[destination]
                const result = snapshot.result
                const status = deliveryStatus(snapshot, notices.deliveryState)
                const failed = result?.status === 'failed'
                return (
                  <li
                    key={destination}
                    className={`flex items-start gap-3 border-b border-border px-4 py-3.5 md:px-3 ${failed ? 'bg-muted' : ''}`}
                  >
                    <ResultIcon status={result?.status ?? null} />
                    <div className="min-w-0 flex-1">
                      <p className="text-base">
                        {name}{' '}
                        <span
                          className="text-sm text-muted-foreground-strong"
                          role="status"
                        >
                          {status.label}
                        </span>
                      </p>
                      {status.details.map((detail) => (
                        <p
                          key={detail}
                          className="mt-1.5 text-sm leading-relaxed text-muted-foreground-strong"
                        >
                          {detail}
                        </p>
                      ))}
                    </div>
                    {result?.remoteUrl !== undefined && (
                      <a
                        aria-label={`Open the ${name} post`}
                        className="flex min-h-11 items-center gap-1 text-sm"
                        href={result.remoteUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open
                        <ArrowUpRightIcon
                          aria-hidden="true"
                          className="size-3 text-primary"
                          strokeWidth={1.5}
                        />
                      </a>
                    )}
                    {failed && result.retryable && (
                      <button
                        className="min-h-9 shrink-0 border border-border-strong px-3 text-sm font-medium disabled:opacity-50"
                        disabled={!canRetry}
                        onClick={onRetry}
                        type="button"
                      >
                        Retry
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
      <footer className="shrink-0">
        <div className="mx-auto flex max-w-180 flex-col gap-1 px-4 pt-2 pb-7 md:flex-row-reverse md:items-center md:gap-4 md:px-6 md:py-4">
          {xSelected &&
            (canOpenX && xIntentHref !== null ? (
              <a
                className="flex h-13 items-center justify-center gap-2 bg-foreground px-6 text-base font-bold text-background md:h-11 md:text-sm"
                href={xIntentHref}
                rel="noreferrer"
                target="_blank"
              >
                Continue in X
                <ArrowUpRightIcon aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <button
                className="flex h-13 items-center justify-center bg-foreground px-6 text-base font-bold text-background opacity-50 md:h-11 md:text-sm"
                disabled
                type="button"
              >
                Continue in X
              </button>
            ))}
          <button
            className="flex h-11 items-center justify-center px-3 text-sm text-muted-foreground-strong"
            onClick={onBackToEdit}
            type="button"
          >
            Back to edit
          </button>
        </div>
      </footer>
    </>
  )
}
