import { describe, expect, it, vi } from 'vitest'

type Probe = (
  ...request: Parameters<typeof fetch>
) => Promise<{ type: ResponseType }>

const openPopup = async (activeTab: { url?: string }, probe: Probe) => {
  const elements = {
    '#editor': { src: '', hidden: true },
    '#sign-in': { href: '', hidden: true },
  }
  vi.stubGlobal('chrome', {
    tabs: { query: () => Promise.resolve([activeTab]) },
  })
  vi.stubGlobal('document', {
    querySelector: (selector: keyof typeof elements) => elements[selector],
  })
  vi.stubGlobal('fetch', probe)

  vi.resetModules()
  await import('#popup')
  await vi.waitFor(() => {
    expect(elements['#editor'].hidden && elements['#sign-in'].hidden).toBe(
      false,
    )
  })

  return elements
}

const signedIn: Probe = () => Promise.resolve({ type: 'basic' })

describe('toolbar popup', () => {
  it('shows the editor for the article in the active tab', async () => {
    expect(
      await openPopup({ url: 'https://example.com/story?id=1' }, signedIn),
    ).toEqual({
      '#editor': {
        src: 'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory%3Fid%3D1',
        hidden: false,
      },
      '#sign-in': { href: '', hidden: true },
    })
  })

  it('shows the editor with an empty link on a page that hides its URL', async () => {
    expect(await openPopup({}, signedIn)).toEqual({
      '#editor': {
        src: 'https://bookmark-app.example.invalid/compose?url=',
        hidden: false,
      },
      '#sign-in': { href: '', hidden: true },
    })
  })

  it('links to the editor in a tab when the deployment redirects to sign-in', async () => {
    expect(
      await openPopup({ url: 'https://example.com/story' }, () =>
        Promise.resolve({ type: 'opaqueredirect' }),
      ),
    ).toEqual({
      '#editor': { src: '', hidden: true },
      '#sign-in': {
        href: 'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory',
        hidden: false,
      },
    })
  })

  it('checks sign-in with the session cookie and without following the redirect', async () => {
    const probe = vi.fn<Probe>(signedIn)

    await openPopup({ url: 'https://example.com/story' }, probe)

    expect(probe.mock.calls).toEqual([
      [
        new URL('https://bookmark-app.example.invalid/'),
        { credentials: 'include', redirect: 'manual' },
      ],
    ])
  })

  it('still shows the editor when the sign-in check cannot reach the deployment', async () => {
    expect(
      await openPopup({ url: 'https://example.com/story' }, () =>
        Promise.reject(new TypeError('Failed to fetch')),
      ),
    ).toEqual({
      '#editor': {
        src: 'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Fexample.com%2Fstory',
        hidden: false,
      },
      '#sign-in': { href: '', hidden: true },
    })
  })
})
