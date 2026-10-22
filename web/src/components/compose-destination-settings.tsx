import { Button } from '@fohte/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import type {
  DestinationDraft,
  DestinationId,
  DestinationMetadata,
} from 'api/contracts'

import { ComposeDestinationTagsField } from '#components/compose-destination-tags-field'
import {
  effectiveDestinationComment,
  isRaindropCollectionAvailable,
} from '#features/editor/compose-destination'

const destinationNames: Record<DestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
  x: 'X',
}

const visibilityLabels = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Followers only',
  direct: 'Mentioned people only',
} as const

export function ComposeDestinationSettings({
  destination,
  commonComment,
  canEdit,
  metadata,
  copyConfirmationOpen,
  onDestinationChange,
  onRequestCopyCommonComment,
  onCancelCopyCommonComment,
  onCopyCommonComment,
}: {
  destination: DestinationDraft
  commonComment: string
  canEdit: boolean
  metadata?: DestinationMetadata
  copyConfirmationOpen: boolean
  onDestinationChange: (destination: DestinationDraft) => void
  onRequestCopyCommonComment: (destination: DestinationId) => void
  onCancelCopyCommonComment: () => void
  onCopyCommonComment: (destination: DestinationId) => void
}) {
  const raindropMetadata = metadata?.destinations.raindrop
  const raindropCollections = raindropMetadata?.collections
  const savedCollectionAvailable =
    destination.destination === 'raindrop' &&
    isRaindropCollectionAvailable(
      destination.options.collectionId,
      raindropCollections,
    )
  const name = destinationNames[destination.destination]
  const comment = effectiveDestinationComment(commonComment, destination)

  const requestCopy = () => {
    if (destination.customComment.length > 0) {
      onRequestCopyCommonComment(destination.destination)
      return
    }
    onCopyCommonComment(destination.destination)
  }

  return (
    <>
      <div className="space-y-1.5">
        <label
          className="text-sm font-medium"
          htmlFor={`${destination.destination}-comment-mode`}
        >
          Comment
        </label>
        <Select
          disabled={!canEdit}
          onValueChange={(value) => {
            if (value === 'common' || value === 'custom') {
              onDestinationChange({ ...destination, commentMode: value })
            }
          }}
          value={destination.commentMode}
        >
          <SelectTrigger
            aria-label={`${name} comment mode`}
            id={`${destination.destination}-comment-mode`}
          >
            <SelectValue>
              {destination.commentMode === 'common'
                ? 'Use common comment'
                : 'Use individual comment'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="common">Use common comment</SelectItem>
            <SelectItem value="custom">Use individual comment</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          Preview: {comment.length > 0 ? comment : 'No comment'}
        </p>
      </div>

      {destination.commentMode === 'custom' && (
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor={`${destination.destination}-custom-comment`}
          >
            Individual comment
          </label>
          <textarea
            className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canEdit}
            id={`${destination.destination}-custom-comment`}
            onChange={(event) => {
              onDestinationChange({
                ...destination,
                customComment: event.currentTarget.value,
              })
            }}
            placeholder="Write an individual comment."
            value={destination.customComment}
          />
        </div>
      )}

      <Button
        disabled={!canEdit}
        onClick={requestCopy}
        size="sm"
        variant="outline"
      >
        Copy common comment
      </Button>

      {destination.destination === 'hatena' && (
        <div className="space-y-3">
          <ComposeDestinationTagsField
            disabled={!canEdit}
            id="hatena-tags"
            label="Hatena tags (comma separated)"
            onTagsChange={(tags) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, tags },
              })
            }}
            tags={destination.options.tags}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={destination.options.private}
              className="size-4 accent-primary disabled:opacity-50"
              disabled={!canEdit}
              onChange={(event) => {
                onDestinationChange({
                  ...destination,
                  options: {
                    ...destination.options,
                    private: event.currentTarget.checked,
                  },
                })
              }}
              type="checkbox"
            />
            Private bookmark
          </label>
        </div>
      )}

      {destination.destination === 'mastodon' && (
        <div className="space-y-3">
          {metadata?.destinations.mastodon.maxCharacters !== undefined && (
            <p className="text-xs text-muted-foreground" role="status">
              This instance allows up to{' '}
              {metadata.destinations.mastodon.maxCharacters} characters. Each
              URL reserves{' '}
              {metadata.destinations.mastodon.charactersReservedPerUrl ?? 0}{' '}
              characters.
            </p>
          )}
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="mastodon-visibility"
            >
              Visibility
            </label>
            <Select
              disabled={!canEdit}
              onValueChange={(value) => {
                if (
                  value === 'public' ||
                  value === 'unlisted' ||
                  value === 'private' ||
                  value === 'direct'
                ) {
                  onDestinationChange({
                    ...destination,
                    options: { ...destination.options, visibility: value },
                  })
                }
              }}
              value={destination.options.visibility}
            >
              <SelectTrigger
                aria-label="Mastodon visibility"
                id="mastodon-visibility"
              >
                <SelectValue>
                  {visibilityLabels[destination.options.visibility]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="unlisted">Unlisted</SelectItem>
                <SelectItem value="private">Followers only</SelectItem>
                <SelectItem value="direct">Mentioned people only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="mastodon-cw">
              Content warning
            </label>
            <Input
              disabled={!canEdit}
              id="mastodon-cw"
              onChange={(event) => {
                onDestinationChange({
                  ...destination,
                  options: {
                    ...destination.options,
                    spoilerText: event.currentTarget.value,
                  },
                })
              }}
              value={destination.options.spoilerText}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={destination.options.sensitive}
              className="size-4 accent-primary disabled:opacity-50"
              disabled={!canEdit}
              onChange={(event) => {
                onDestinationChange({
                  ...destination,
                  options: {
                    ...destination.options,
                    sensitive: event.currentTarget.checked,
                  },
                })
              }}
              type="checkbox"
            />
            Mark media as sensitive
          </label>
        </div>
      )}

      {destination.destination === 'raindrop' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium"
              htmlFor="raindrop-collection"
            >
              Collection
            </label>
            <Select
              disabled={!canEdit || raindropMetadata?.configured !== true}
              onValueChange={(value) => {
                const collectionId = Number(value)
                if (
                  Number.isInteger(collectionId) &&
                  isRaindropCollectionAvailable(
                    collectionId,
                    raindropCollections,
                  )
                ) {
                  onDestinationChange({
                    ...destination,
                    options: { ...destination.options, collectionId },
                  })
                }
              }}
              value={String(destination.options.collectionId)}
            >
              <SelectTrigger
                aria-label="Raindrop collection"
                id="raindrop-collection"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">Unsorted</SelectItem>
                {raindropCollections?.map((collection) => (
                  <SelectItem key={collection.id} value={String(collection.id)}>
                    {collection.title}
                  </SelectItem>
                ))}
                {!savedCollectionAvailable && (
                  <SelectItem
                    disabled
                    value={String(destination.options.collectionId)}
                  >
                    Saved collection ID {destination.options.collectionId}
                    {raindropCollections === undefined
                      ? ' (details unavailable)'
                      : ' (not in the available list)'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {raindropCollections !== undefined && !savedCollectionAvailable && (
              <p className="text-xs text-muted-foreground" role="status">
                Saved collection ID {destination.options.collectionId} is not
                available. Choose an available collection.
              </p>
            )}
          </div>
          <ComposeDestinationTagsField
            disabled={!canEdit}
            id="raindrop-tags"
            label="Raindrop tags (comma separated)"
            onTagsChange={(tags) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, tags },
              })
            }}
            tags={destination.options.tags}
          />
        </div>
      )}

      {destination.destination === 'x' && (
        <p className="text-sm text-muted-foreground">
          X opens a separate composer with the saved comment and article URL.
          Posting there does not mark this draft as delivered.
        </p>
      )}

      <Dialog
        open={copyConfirmationOpen}
        onOpenChange={(open) => {
          if (!open) onCancelCopyCommonComment()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace the individual comment?</DialogTitle>
            <DialogDescription>
              Copying the common comment will replace this saved individual
              comment.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onCancelCopyCommonComment} variant="outline">
              Keep individual
            </Button>
            <Button
              onClick={() => {
                onCopyCommonComment(destination.destination)
              }}
            >
              Replace with common
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
