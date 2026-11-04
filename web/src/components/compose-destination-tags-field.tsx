import { Chip } from '@fohte/ui/chip'
import { useState } from 'react'

export function ComposeDestinationTagsField({
  id,
  tags,
  disabled,
  onTagsChange,
}: {
  id: string
  tags: string[]
  disabled: boolean
  onTagsChange: (tags: string[]) => void
}) {
  const [pendingTag, setPendingTag] = useState('')

  const addTags = (values: string[]) => {
    const added = values.map((value) => value.trim()).filter(Boolean)
    if (added.length > 0) onTagsChange([...tags, ...added])
  }

  const commitPendingTag = () => {
    addTags([pendingTag])
    setPendingTag('')
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="font-mono text-xs text-muted-foreground-strong"
        htmlFor={id}
      >
        tags
      </label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border border-border bg-background px-2.5 py-1.5">
        {tags.map((tag, index) =>
          disabled ? (
            <Chip key={`${String(index)}-${tag}`} size="md" tone="strong">
              {tag}
            </Chip>
          ) : (
            <Chip
              key={`${String(index)}-${tag}`}
              onRemove={() => {
                onTagsChange(tags.filter((_, tagIndex) => tagIndex !== index))
              }}
              removeLabel={`Remove tag ${tag}`}
              size="md"
              tone="strong"
            >
              {tag}
            </Chip>
          ),
        )}
        <input
          autoComplete="off"
          className="h-7 min-w-18 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground-strong disabled:cursor-not-allowed"
          disabled={disabled}
          id={id}
          onBlur={commitPendingTag}
          onChange={(event) => {
            // A comma finishes a tag so a pasted "a,b" list becomes chips.
            const parts = event.currentTarget.value.split(',')
            setPendingTag(parts.pop() ?? '')
            addTags(parts)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commitPendingTag()
          }}
          placeholder="Add tag"
          value={pendingTag}
        />
      </div>
    </div>
  )
}
