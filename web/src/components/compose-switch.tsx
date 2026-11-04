import { useId } from 'react'

export function ComposeSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const labelId = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" id={labelId}>
        {label}
      </span>
      <button
        aria-checked={checked}
        aria-labelledby={labelId}
        className={`flex h-7 w-12 shrink-0 border p-0.75 disabled:opacity-50 ${checked ? 'justify-end border-foreground bg-foreground' : 'justify-start border-border-strong bg-background'}`}
        disabled={disabled}
        onClick={() => {
          onCheckedChange(!checked)
        }}
        role="switch"
        type="button"
      >
        <span
          aria-hidden="true"
          className={`size-5 ${checked ? 'bg-background' : 'bg-muted-foreground-strong'}`}
        />
      </button>
    </div>
  )
}
