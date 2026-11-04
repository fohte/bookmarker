import type { DestinationDraft, DestinationMetadata } from 'api/contracts'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'

import {
  destinationNames,
  raindropCollectionLabel,
  visibilityLabels,
} from '#components/compose-destination-labels'
import { ComposeDestinationSettings } from '#components/compose-destination-settings'
import { countDestinationCharacters } from '#features/editor/compose-character-count'
import { effectiveDestinationComment } from '#features/editor/compose-destination'

function tagList(tags: string[]): string[] {
  return tags.filter((tag) => tag.trim() !== '').map((tag) => `[${tag}]`)
}

function settingsSummary(
  destination: DestinationDraft,
  metadata: DestinationMetadata | undefined,
): string[] {
  switch (destination.destination) {
    case 'hatena':
      return [
        ...tagList(destination.options.tags),
        ...(destination.options.private ? ['private'] : []),
      ]
    case 'mastodon':
      return [
        visibilityLabels[destination.options.visibility],
        ...(destination.options.spoilerText === ''
          ? []
          : [`CW: ${destination.options.spoilerText}`]),
        ...(destination.options.sensitive ? ['sensitive'] : []),
      ]
    case 'raindrop':
      return [
        raindropCollectionLabel(
          destination.options.collectionId,
          metadata?.destinations.raindrop.collections,
        ),
        ...tagList(destination.options.tags),
      ]
    case 'x':
      return []
  }
}

export function ComposeDestinationRow({
  destination,
  commonComment,
  articleUrl,
  canEdit,
  metadata,
  open,
  onOpenChange,
  onDestinationChange,
}: {
  destination: DestinationDraft
  commonComment: string
  articleUrl: string
  canEdit: boolean
  metadata?: DestinationMetadata
  open: boolean
  onOpenChange: (open: boolean) => void
  onDestinationChange: (destination: DestinationDraft) => void
}) {
  const id = destination.destination
  const name = destinationNames[id]
  const nameId = `${id}-destination-name`
  const destinationMetadata = metadata?.destinations[id]
  const notConnected = destinationMetadata?.configured === false
  const metadataError =
    destinationMetadata !== undefined && 'metadataError' in destinationMetadata
      ? destinationMetadata.metadataError
      : undefined
  const ownComment = destination.commentMode === 'custom'
  const comment = effectiveDestinationComment(commonComment, destination)
  const count = destination.selected
    ? countDestinationCharacters(id, comment, metadata)
    : null
  const expanded = destination.selected && open
  const editLabel =
    id === 'x' ? 'Edit X post' : `Edit ${name} post and settings`
  const displayUrl = articleUrl.replace(/^https?:\/\//, '')
  let status: string | null = null
  if (notConnected) status = 'Not connected'
  else if (metadataError !== undefined) status = 'Details unavailable'
  const summary = settingsSummary(destination, metadata).join(' · ')

  return (
    <li className={`border-b border-border ${expanded ? 'bg-muted' : ''}`}>
      <div className="flex min-h-12 items-center gap-2 pr-2 pl-1.5">
        <button
          aria-checked={destination.selected}
          aria-label={`Post to ${name}`}
          className="flex size-11 shrink-0 items-center justify-center disabled:opacity-50"
          disabled={!canEdit || (notConnected && !destination.selected)}
          onClick={() => {
            onDestinationChange({
              ...destination,
              selected: !destination.selected,
            })
          }}
          role="checkbox"
          type="button"
        >
          {destination.selected ? (
            <span
              aria-hidden="true"
              className="flex size-4.5 items-center justify-center bg-foreground text-background"
            >
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="size-4.5 border border-border-strong"
            />
          )}
        </button>
        <span
          className={`text-sm font-bold ${destination.selected ? '' : 'text-muted-foreground-strong'}`}
          id={nameId}
        >
          {name}
          {ownComment && <span className="text-primary">*</span>}
        </span>
        {destination.selected ? (
          <>
            <span
              className={`ml-auto text-xs ${count !== null && count.length > count.max ? 'text-destructive' : 'text-muted-foreground-strong'}`}
            >
              {count === null
                ? ''
                : `${String(count.length)} / ${String(count.max)}`}
            </span>
            <button
              aria-expanded={expanded}
              aria-label={editLabel}
              className="flex h-11 w-10 shrink-0 items-center justify-center"
              onClick={() => {
                onOpenChange(!expanded)
              }}
              type="button"
            >
              <ChevronDownIcon
                aria-hidden="true"
                className={`size-4 text-muted-foreground-strong ${expanded ? 'rotate-180' : ''}`}
                strokeWidth={1.5}
              />
            </button>
          </>
        ) : (
          <span
            className="ml-auto pr-3 text-xs text-muted-foreground-strong"
            role={status === null ? undefined : 'status'}
          >
            {status ?? 'off'}
          </span>
        )}
      </div>

      {destination.selected && !expanded && (
        <button
          aria-label={editLabel}
          className="-mt-1 flex w-full flex-col gap-1.5 pr-4 pb-3 pl-12.5 text-left"
          onClick={() => {
            onOpenChange(true)
          }}
          type="button"
        >
          <span
            className={`text-sm leading-relaxed break-words ${ownComment ? '' : 'text-muted-foreground-strong'}`}
          >
            <span className="whitespace-pre-wrap">{comment}</span>
            {id === 'x' && (
              <span className="ml-1 text-xs text-primary">{displayUrl}</span>
            )}
            {id === 'mastodon' && (
              <span className="block text-xs text-primary">{displayUrl}</span>
            )}
          </span>
          {(status !== null || summary !== '') && (
            <span className="text-xs text-muted-foreground-strong">
              {status !== null && <span role="status">{status}</span>}
              {status !== null && summary !== '' && ' · '}
              {summary}
            </span>
          )}
        </button>
      )}

      {expanded && (
        <div className="flex flex-col gap-3.5 px-4 pb-1.5 md:px-5">
          {notConnected && (
            <p className="text-xs text-muted-foreground-strong" role="status">
              This destination is not connected. Its saved settings are kept.
            </p>
          )}
          {metadataError !== undefined && (
            <p className="text-xs text-muted-foreground-strong" role="status">
              Destination details are unavailable: {metadataError.message}
            </p>
          )}
          <div className="flex flex-col gap-1 border border-border-strong bg-background px-3 py-2.5">
            <textarea
              aria-labelledby={nameId}
              className={`h-20 resize-none bg-transparent text-base leading-relaxed outline-none disabled:cursor-not-allowed disabled:opacity-50 ${ownComment ? '' : 'text-muted-foreground-strong'}`}
              disabled={!canEdit}
              id={`${id}-comment`}
              onChange={(event) => {
                onDestinationChange({
                  ...destination,
                  commentMode: 'custom',
                  customComment: event.currentTarget.value,
                })
              }}
              value={comment}
            />
            {(id === 'x' || id === 'mastodon') && (
              <span className="text-xs text-primary">{displayUrl}</span>
            )}
          </div>
          {!ownComment && (
            <p className="-mt-1.5 text-xs text-muted-foreground-strong">
              Same as main. Typing here makes it {name}-only.
            </p>
          )}
          <ComposeDestinationSettings
            canEdit={canEdit}
            destination={destination}
            {...(metadata === undefined ? {} : { metadata })}
            onDestinationChange={onDestinationChange}
          />
          <div className="flex justify-between">
            {ownComment ? (
              <button
                className="min-h-10 text-sm text-primary disabled:opacity-50"
                disabled={!canEdit}
                onClick={() => {
                  onDestinationChange({
                    ...destination,
                    commentMode: 'common',
                    customComment: '',
                  })
                }}
                type="button"
              >
                Use main comment
              </button>
            ) : (
              <span />
            )}
            <button
              className="min-h-10 text-sm font-medium"
              onClick={() => {
                onOpenChange(false)
              }}
              type="button"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
