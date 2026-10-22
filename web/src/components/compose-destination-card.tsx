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

const destinationNames: Record<DestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
  x: 'X',
}

function tagsToText(tags: string[]): string {
  return tags.join(',')
}

function tagsFromText(value: string): string[] {
  return value === '' ? [] : value.split(',')
}

export function ComposeDestinationCard({
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
  const destinationMetadata = metadata?.destinations[destination.destination]
  const selectionUnavailable = destinationMetadata?.configured === false
  const metadataError =
    destinationMetadata !== undefined && 'metadataError' in destinationMetadata
      ? destinationMetadata.metadataError
      : undefined
  const name = destinationNames[destination.destination]
  const comment =
    destination.commentMode === 'common'
      ? commonComment
      : destination.customComment

  const update = (updated: DestinationDraft) => {
    onDestinationChange(updated)
  }

  const requestCopy = () => {
    if (destination.customComment.length > 0) {
      onRequestCopyCommonComment(destination.destination)
      return
    }
    onCopyCommonComment(destination.destination)
  }

  return (
    <article className="space-y-4 border border-border p-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-medium">{name}</h3>
          {selectionUnavailable && (
            <p className="mt-1 text-sm text-muted-foreground">
              This destination is not connected. Its saved settings are kept.
            </p>
          )}
          {metadataError !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">
              Destination details are unavailable: {metadataError.message}
            </p>
          )}
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            aria-label={`Select ${name}`}
            checked={destination.selected}
            className="size-4 accent-primary disabled:opacity-50"
            disabled={!canEdit || selectionUnavailable}
            onChange={(event) => {
              update({ ...destination, selected: event.currentTarget.checked })
            }}
            type="checkbox"
          />
          Select
        </label>
      </header>

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
              update({ ...destination, commentMode: value })
            }
          }}
          value={destination.commentMode}
        >
          <SelectTrigger
            aria-label={`${name} comment mode`}
            id={`${destination.destination}-comment-mode`}
          >
            <SelectValue />
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
              update({
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="hatena-tags">
              Tags (comma separated)
            </label>
            <Input
              aria-label="Hatena tags"
              autoComplete="off"
              disabled={!canEdit}
              id="hatena-tags"
              onChange={(event) => {
                update({
                  ...destination,
                  options: {
                    ...destination.options,
                    tags: tagsFromText(event.currentTarget.value),
                  },
                })
              }}
              value={tagsToText(destination.options.tags)}
            />
            <p className="text-xs text-muted-foreground">
              Each edit, including an unfinished tag, is saved on this device.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              checked={destination.options.private}
              className="size-4 accent-primary disabled:opacity-50"
              disabled={!canEdit}
              onChange={(event) => {
                update({
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
                  update({
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
                <SelectValue />
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
                update({
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
                update({
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
              Collection ID
            </label>
            <Input
              disabled={!canEdit}
              id="raindrop-collection"
              inputMode="numeric"
              onChange={(event) => {
                const collectionId = event.currentTarget.valueAsNumber
                if (Number.isInteger(collectionId)) {
                  update({
                    ...destination,
                    options: { ...destination.options, collectionId },
                  })
                }
              }}
              type="number"
              value={destination.options.collectionId}
            />
            <p className="text-xs text-muted-foreground">
              -1 is Raindrop&apos;s Unsorted system collection. Other collection
              IDs are kept as entered.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="raindrop-tags">
              Tags (comma separated)
            </label>
            <Input
              aria-label="Raindrop tags"
              autoComplete="off"
              disabled={!canEdit}
              id="raindrop-tags"
              onChange={(event) => {
                update({
                  ...destination,
                  options: {
                    ...destination.options,
                    tags: tagsFromText(event.currentTarget.value),
                  },
                })
              }}
              value={tagsToText(destination.options.tags)}
            />
            <p className="text-xs text-muted-foreground">
              Each edit, including an unfinished tag, is saved on this device.
            </p>
          </div>
        </div>
      )}

      {destination.destination === 'x' && (
        <p className="text-sm text-muted-foreground">
          X opens an external composer. That action is not connected yet, so no
          post result will be shown.
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
              Keep individual comment
            </Button>
            <Button
              onClick={() => {
                onCopyCommonComment(destination.destination)
              }}
            >
              Replace custom comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
