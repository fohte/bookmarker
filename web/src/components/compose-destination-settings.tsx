import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import type { DestinationDraft, DestinationMetadata } from 'api/contracts'

import { visibilityLabels } from '#components/compose-destination-labels'
import { ComposeDestinationTagsField } from '#components/compose-destination-tags-field'
import { ComposeSwitch } from '#components/compose-switch'
import { isRaindropCollectionAvailable } from '#features/editor/compose-destination'

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: string
}) {
  return (
    <label
      className="font-mono text-xs text-muted-foreground-strong"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  )
}

export function ComposeDestinationSettings({
  destination,
  canEdit,
  metadata,
  onDestinationChange,
}: {
  destination: DestinationDraft
  canEdit: boolean
  metadata?: DestinationMetadata
  onDestinationChange: (destination: DestinationDraft) => void
}) {
  switch (destination.destination) {
    case 'hatena':
      return (
        <div className="flex flex-col gap-3.5">
          <ComposeDestinationTagsField
            disabled={!canEdit}
            id="hatena-tags"
            onTagsChange={(tags) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, tags },
              })
            }}
            tags={destination.options.tags}
          />
          <ComposeSwitch
            checked={destination.options.private}
            disabled={!canEdit}
            label="Private bookmark"
            onCheckedChange={(checked) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, private: checked },
              })
            }}
          />
        </div>
      )
    case 'mastodon':
      return (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="mastodon-visibility">visibility</FieldLabel>
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
                className="h-11 w-full"
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
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="mastodon-cw">content warning</FieldLabel>
            <input
              className="h-11 border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground-strong disabled:cursor-not-allowed disabled:opacity-50"
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
              placeholder="None"
              value={destination.options.spoilerText}
            />
          </div>
          <ComposeSwitch
            checked={destination.options.sensitive}
            disabled={!canEdit}
            label="Mark as sensitive"
            onCheckedChange={(checked) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, sensitive: checked },
              })
            }}
          />
        </div>
      )
    case 'raindrop': {
      const raindropMetadata = metadata?.destinations.raindrop
      const collections = raindropMetadata?.collections
      const savedCollectionAvailable = isRaindropCollectionAvailable(
        destination.options.collectionId,
        collections,
      )
      return (
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="raindrop-collection">collection</FieldLabel>
            <Select
              disabled={!canEdit || raindropMetadata?.configured !== true}
              onValueChange={(value) => {
                const collectionId = Number(value)
                if (
                  Number.isInteger(collectionId) &&
                  isRaindropCollectionAvailable(collectionId, collections)
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
                className="h-11 w-full"
                id="raindrop-collection"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-1">Unsorted</SelectItem>
                {collections?.map((collection) => (
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
                    {collections === undefined
                      ? ' (details unavailable)'
                      : ' (not in the available list)'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {collections !== undefined && !savedCollectionAvailable && (
              <p className="text-xs text-muted-foreground-strong" role="status">
                Saved collection ID {destination.options.collectionId} is not
                available. Choose an available collection.
              </p>
            )}
          </div>
          <ComposeDestinationTagsField
            disabled={!canEdit}
            id="raindrop-tags"
            onTagsChange={(tags) => {
              onDestinationChange({
                ...destination,
                options: { ...destination.options, tags },
              })
            }}
            tags={destination.options.tags}
          />
        </div>
      )
    }
    case 'x':
      return (
        <p className="text-xs leading-relaxed text-muted-foreground-strong">
          X opens its own composer with this comment and the article URL.
        </p>
      )
  }
}
