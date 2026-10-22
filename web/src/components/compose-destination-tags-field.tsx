import { Input } from '@fohte/ui/input'

export function ComposeDestinationTagsField({
  id,
  label,
  tags,
  disabled,
  onTagsChange,
}: {
  id: string
  label: string
  tags: string[]
  disabled: boolean
  onTagsChange: (tags: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-label={label}
        autoComplete="off"
        disabled={disabled}
        id={id}
        onChange={(event) => {
          const value = event.currentTarget.value
          onTagsChange(value === '' ? [] : value.split(','))
        }}
        value={tags.join(',')}
      />
      <p className="text-xs text-muted-foreground">
        Each edit, including an unfinished tag, is saved on this device.
      </p>
    </div>
  )
}
