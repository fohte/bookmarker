import { describe, expect, it, vi } from 'vitest'

type ClickedTab = { url?: string; index: number }

const clickToolbarButton = async (tab: ClickedTab) => {
  let clicked: ((tab: ClickedTab) => void) | undefined
  const createTab = vi.fn()
  vi.stubGlobal('chrome', {
    action: {
      onClicked: {
        addListener: (listener: (tab: ClickedTab) => void) => {
          clicked = listener
        },
      },
    },
    tabs: { create: createTab },
  })

  vi.resetModules()
  await import('#background')
  clicked?.(tab)

  return createTab.mock.calls
}

describe('toolbar button', () => {
  it('opens the editor for the article in a tab next to it', async () => {
    const calls = await clickToolbarButton({
      url: 'https://example.com/story?id=1',
      index: 3,
    })

    expect(calls).toEqual([
      [
        {
          url: 'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory%3Fid%3D1',
          index: 4,
        },
      ],
    ])
  })

  it('opens the editor with an empty link on a page that hides its URL', async () => {
    const calls = await clickToolbarButton({ index: 0 })

    expect(calls).toEqual([
      [{ url: 'https://bookmark-app.example.invalid/compose?url=', index: 1 }],
    ])
  })
})
