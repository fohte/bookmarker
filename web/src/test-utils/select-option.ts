import { act } from 'react'
import { expect } from 'vitest'
import { page } from 'vitest/browser'

type SelectOptionInput = {
  settingsDialogName: string
  comboboxName: string
  optionName: string
}

export async function selectOption({
  settingsDialogName,
  comboboxName,
  optionName,
}: SelectOptionInput): Promise<void> {
  const dialog = page.getByRole('dialog', {
    exact: true,
    name: settingsDialogName,
  })
  await act(async () => expect.element(dialog).toBeVisible())

  const combobox = page.getByRole('combobox', {
    exact: true,
    name: comboboxName,
  })
  await act(async () => expect.element(combobox).toBeVisible())
  await act(async () => combobox.click())
  await act(async () =>
    expect.element(combobox).toHaveAttribute('aria-expanded', 'true'),
  )

  const option = page.getByRole('option', { exact: true, name: optionName })
  await act(async () => expect.element(option).toBeVisible())
  await act(async () => option.click())
}
