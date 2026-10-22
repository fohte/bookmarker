import type { BookmarkDraft, DestinationMetadata } from 'api/contracts'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComposeDeliveryPanel } from '#components/compose-delivery-panel'
import {
  type ComposeState,
  initialComposeState,
} from '#features/editor/compose-state'
import { useComposeDelivery } from '#features/editor/use-compose-delivery'

const draft: BookmarkDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000121',
  source: {
    version: 1,
    url: 'https://fictional.example.invalid/saved-article',
    partial: true,
  },
  article: {
    url: 'https://fictional.example.invalid/saved-article',
    title: 'A saved fictional article',
    text: 'A saved fictional passage.',
    source: 'manual',
    partial: true,
  },
  commonComment: 'A saved comment 😀',
  destinations: [
    {
      destination: 'x',
      selected: true,
      commentMode: 'common',
      customComment: '',
    },
  ],
  delivery: [],
  updatedAt: '2026-10-22T00:00:00.000Z',
}

const metadata: DestinationMetadata = {
  destinations: {
    hatena: { configured: true },
    mastodon: { configured: true },
    raindrop: { configured: true },
    x: { configured: true },
  },
}

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const captureOutput = <T,>(value: T): T => value

type HarnessProps = {
  draft: BookmarkDraft
  state: ComposeState
  canEdit: boolean
}

const noop = () => undefined

const Harness = ({ draft: activeDraft, state, canEdit }: HarnessProps) => {
  const controls = useComposeDelivery({ draft: activeDraft, state, canEdit })
  const { onLoadMetadata, ...deliveryProps } = controls

  return (
    <ComposeDeliveryPanel
      {...deliveryProps}
      delivery={activeDraft.delivery}
      onPublish={noop}
      onRetryDeliverySave={noop}
      onRetryFailed={noop}
      onRetryMetadata={onLoadMetadata}
    />
  )
}

let root: Root | undefined
let container: HTMLDivElement | undefined

const render = async (props: HarnessProps) => {
  const mountedRoot = root
  if (mountedRoot === undefined)
    throw new Error('The test root is not mounted.')
  await act(async () => {
    mountedRoot.render(<Harness {...props} />)
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

const xLinkOutput = () => {
  const link = container?.querySelector<HTMLAnchorElement>(
    'a[href^="https://x.com/intent/tweet"]',
  )
  if (link === null || link === undefined) return null
  const url = new URL(link.href)
  return {
    origin: url.origin,
    pathname: url.pathname,
    comment: url.searchParams.get('text'),
    articleUrl: url.searchParams.get('url'),
    target: link.target,
    rel: link.rel,
  }
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  window.history.replaceState(null, '', `/compose?draft=${draft.id}`)
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(response(metadata))),
  )
})

afterEach(() => {
  if (root !== undefined) {
    act(() => root?.unmount())
  }
  root = undefined
  container?.remove()
  container = undefined
  vi.unstubAllGlobals()
})

describe('useComposeDelivery in a browser', () => {
  it('opens X only for a saved revision and delays re-login until the draft is saved', async () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    const savedState: ComposeState = {
      ...initialComposeState,
      isLoading: false,
      canEdit: true,
      lockState: 'owned',
      saveState: 'saved',
    }
    const savingState: ComposeState = { ...savedState, saveState: 'saving' }

    await render({ draft, state: savedState, canEdit: true })
    const savedLink = xLinkOutput()
    await render({ draft, state: savingState, canEdit: true })
    const xButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent.trim() === 'Open X composer',
    )
    const whileSaving = {
      xLink: xLinkOutput(),
      xButtonDisabled: xButton?.disabled ?? false,
    }

    const authenticationState: ComposeState = {
      ...savingState,
      deliveryAuthenticationRequired: true,
    }
    await render({ draft, state: authenticationState, canEdit: true })
    const signInUnavailableWhileSaving =
      Array.from(container.querySelectorAll('a')).find(
        (link) => link.textContent.trim() === 'Sign in again',
      ) ?? null

    const savedAuthenticationState: ComposeState = {
      ...savedState,
      deliveryAuthenticationRequired: true,
    }
    await render({ draft, state: savedAuthenticationState, canEdit: true })
    const signIn = Array.from(container.querySelectorAll('a')).find(
      (link) => link.textContent.trim() === 'Sign in again',
    )

    const actual = {
      savedLink,
      whileSaving,
      signInUnavailableWhileSaving,
      savedSignIn:
        signIn === undefined
          ? null
          : new URL(signIn.href).pathname + new URL(signIn.href).search,
    }

    expect(captureOutput(actual)).toEqual({
      savedLink: {
        origin: 'https://x.com',
        pathname: '/intent/tweet',
        comment: 'A saved comment 😀',
        articleUrl: 'https://fictional.example.invalid/saved-article',
        target: '_blank',
        rel: 'noreferrer',
      },
      whileSaving: {
        xLink: null,
        xButtonDisabled: true,
      },
      signInUnavailableWhileSaving: null,
      savedSignIn: `/compose?draft=${draft.id}`,
    })
  })
})
