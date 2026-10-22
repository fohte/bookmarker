import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vitest'

import { parseShareLocation } from '#features/share/parse-share-location'

const safariShortcut = readFileSync(
  new URL('../../../../docs/share/safari-shortcut.txt', import.meta.url),
  'utf8',
)
const macBookmarklet = readFileSync(
  new URL('../../../../docs/share/mac-bookmarklet.txt', import.meta.url),
  'utf8',
)

type SafariOutput = {
  clipboardText: string
  editorUrl: string
  requiresPaste: boolean
}

const runSafariShortcut = (url: string, title: string, text: string) => {
  let output: SafariOutput | undefined
  runInNewContext(safariShortcut, {
    URL,
    document: { body: { innerText: text }, title },
    location: { href: url },
    completion: (value: SafariOutput) => {
      output = value
    },
  })

  return output
}

const parseLink = (link: string) => {
  const url = new URL(link)
  return parseShareLocation(url.pathname, url.search, url.hash)
}

const macBookmarkletOpenOutput = (
  openedUrl: string,
  openedTarget: string,
  fallback: { message: string; url: string } | null,
) => ({
  openedUrl,
  openedTarget,
  fallback,
  parsed: parseLink(openedUrl),
})

const macBookmarkletFallbackOutput = (
  openedUrl: string,
  prompt: { message: string; url: string } | null,
) => ({
  openedUrl,
  prompt,
  parsed: parseLink(openedUrl),
})

const safariResult = (output: SafariOutput | undefined) => ({
  output,
  parsed: parseLink(output?.editorUrl ?? ''),
})

const shareFragment = (input: unknown) =>
  `#share=${encodeURIComponent(JSON.stringify(input))}`

describe('parseShareLocation', () => {
  it('parses Unicode fragment input and preserves unrelated location parts', () => {
    const input = {
      version: 1,
      url: 'https://articles.example.invalid/caf%C3%A9?edition=%C3%A9t%C3%A9',
      title: 'A title: こんにちは 🌱',
      sharedText: '本文に Unicode と 😀 がある',
      partial: true,
    }

    expect(
      parseShareLocation(
        '/compose',
        '?campaign=weekly&draft=legacy&keep=a%2Bb',
        `#section=summary&share=${shareFragment(input).slice('#share='.length)}&tab=references`,
      ),
    ).toEqual({
      type: 'valid',
      input,
      cleanupUrl:
        '/compose?campaign=weekly&keep=a%2Bb#section=summary&tab=references',
    })
  })

  it('decodes a URL-only query once and clears the previous draft parameter', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?campaign=weekly&url=https%3A%2F%2Farticles.example.invalid%2Fstory%3Fq%3Dcaf%C3%A9%26note%3Da%252Bb&draft=legacy',
        '#section=top',
      ),
    ).toEqual({
      type: 'valid',
      input: {
        version: 1,
        url: 'https://articles.example.invalid/story?q=café&note=a%2Bb',
        partial: false,
      },
      cleanupUrl: '/compose?campaign=weekly#section=top',
    })
  })

  it('returns none when the location has no share input', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?campaign=weekly&draft=legacy',
        '#section=top',
      ),
    ).toEqual({ type: 'none' })
  })

  it('rejects malformed fragment encoding without exposing the payload', () => {
    expect(parseShareLocation('/compose', '', '#share=%E0%A4%A')).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects decoded fragment text that is not JSON', () => {
    expect(parseShareLocation('/compose', '', '#share=%7B')).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects a fragment that does not match the shared input schema', () => {
    expect(
      parseShareLocation(
        '/compose',
        '',
        shareFragment({
          version: 2,
          url: 'https://articles.example.invalid/story',
        }),
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects a non-HTTP URL in the fragment', () => {
    expect(
      parseShareLocation(
        '/compose',
        '',
        shareFragment({ version: 1, url: 'javascript:alert(1)' }),
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects a query URL that conflicts with the fragment URL', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?url=https%3A%2F%2Farticles.example.invalid%2Fother',
        shareFragment({
          version: 1,
          url: 'https://articles.example.invalid/story',
        }),
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('accepts matching query and fragment URLs', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
        shareFragment({
          version: 1,
          url: 'https://articles.example.invalid/story',
          sharedText: 'Article text',
        }),
      ),
    ).toEqual({
      type: 'valid',
      input: {
        version: 1,
        url: 'https://articles.example.invalid/story',
        sharedText: 'Article text',
        partial: false,
      },
      cleanupUrl: '/compose',
    })
  })

  it('does not fall back to a valid query URL when the fragment is malformed', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
        '#share=%ZZ',
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects duplicate URL query parameters', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?url=https%3A%2F%2Farticles.example.invalid%2Fstory&%75rl=https%3A%2F%2Farticles.example.invalid%2Fstory',
        '',
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects malformed query encoding', () => {
    expect(
      parseShareLocation(
        '/compose',
        '?url=https%3A%2F%2Farticles.example.invalid%2F%E0%A4%A',
        '',
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects shared text above the app-specific UTF-16 limit', () => {
    expect(
      parseShareLocation(
        '/compose',
        '',
        shareFragment({
          version: 1,
          url: 'https://articles.example.invalid/story',
          sharedText: 'a'.repeat(8_193),
        }),
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('rejects a fragment above the complete encoded byte limit', () => {
    expect(
      parseShareLocation(
        '/compose',
        '',
        shareFragment({
          version: 1,
          url: 'https://articles.example.invalid/story',
          title: 'a'.repeat(16_300),
        }),
      ),
    ).toEqual({
      type: 'invalid',
      message:
        'This shared link is invalid or too large. Copy the article URL and try again.',
    })
  })

  it('accepts a fragment at the complete encoded byte limit', () => {
    const baseInput = {
      version: 1,
      url: 'https://articles.example.invalid/story',
      title: '',
    }
    const baseFragment = shareFragment(baseInput)
    const title = 'a'.repeat(16_384 - baseFragment.length)

    expect(
      parseShareLocation(
        '/compose',
        '',
        shareFragment({ ...baseInput, title }),
      ),
    ).toEqual({
      type: 'valid',
      input: { ...baseInput, title, partial: false },
      cleanupUrl: '/compose',
    })
  })
})

describe('Safari shortcut distribution', () => {
  it('produces a fragment that the parser accepts without losing Unicode text', () => {
    const output = runSafariShortcut(
      'https://articles.example.invalid/story?lang=ja#chapter',
      '記事の題名',
      '本文に Unicode と 😀 がある',
    )

    expect(safariResult(output)).toEqual({
      output: {
        clipboardText: '本文に Unicode と 😀 がある',
        editorUrl:
          'https://bookmark-app.example.invalid/compose#share=%7B%22version%22%3A1%2C%22url%22%3A%22https%3A%2F%2Farticles.example.invalid%2Fstory%3Flang%3Dja%23chapter%22%2C%22title%22%3A%22%E8%A8%98%E4%BA%8B%E3%81%AE%E9%A1%8C%E5%90%8D%22%2C%22sharedText%22%3A%22%E6%9C%AC%E6%96%87%E3%81%AB%20Unicode%20%E3%81%A8%20%F0%9F%98%80%20%E3%81%8C%E3%81%82%E3%82%8B%22%2C%22partial%22%3Atrue%7D',
        requiresPaste: false,
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story?lang=ja#chapter',
          title: '記事の題名',
          sharedText: '本文に Unicode と 😀 がある',
          partial: true,
        },
        cleanupUrl: '/compose',
      },
    })
  })

  it('falls back to URL-only and keeps the complete text on the clipboard', () => {
    const text = 'a'.repeat(8_193)
    const output = runSafariShortcut(
      'https://articles.example.invalid/story',
      'An article',
      text,
    )

    expect(safariResult(output)).toEqual({
      output: {
        clipboardText: text,
        editorUrl:
          'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
        requiresPaste: true,
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story',
          partial: false,
        },
        cleanupUrl: '/compose',
      },
    })
  })

  it('falls back when the complete encoded fragment exceeds its byte limit', () => {
    const text = 'Article body'
    const output = runSafariShortcut(
      'https://articles.example.invalid/story',
      'a'.repeat(16_300),
      text,
    )

    expect(safariResult(output)).toEqual({
      output: {
        clipboardText: text,
        editorUrl:
          'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
        requiresPaste: true,
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story',
          partial: false,
        },
        cleanupUrl: '/compose',
      },
    })
  })

  it('opens the URL-only link when the Safari page has no text', () => {
    const output = runSafariShortcut(
      'https://articles.example.invalid/story',
      'An article',
      '',
    )

    expect(safariResult(output)).toEqual({
      output: {
        clipboardText: '',
        editorUrl:
          'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
        requiresPaste: false,
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story',
          partial: false,
        },
        cleanupUrl: '/compose',
      },
    })
  })

  it('accepts text at the share limit', () => {
    const text = 'a'.repeat(8_192)
    const output = runSafariShortcut(
      'https://articles.example.invalid/story',
      'An article',
      text,
    )

    expect(safariResult(output)).toEqual({
      output: {
        clipboardText: text,
        editorUrl: `https://bookmark-app.example.invalid/compose#share=${encodeURIComponent(
          JSON.stringify({
            version: 1,
            url: 'https://articles.example.invalid/story',
            title: 'An article',
            sharedText: text,
            partial: true,
          }),
        )}`,
        requiresPaste: false,
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story',
          title: 'An article',
          sharedText: text,
          partial: true,
        },
        cleanupUrl: '/compose',
      },
    })
  })

  it('opens a URL-only link in a new tab from the Mac bookmarklet', () => {
    let openedUrl = ''
    let openedTarget = ''
    let fallback: { message: string; url: string } | null = null
    runInNewContext(
      macBookmarklet.replace(/^javascript:/, '').replace(/[\t\n\r]/g, ''),
      {
        URL,
        window: {
          location: {
            href: 'https://articles.example.invalid/story?q=a%2Bb#chapter',
          },
          open: (url: string, target: string) => {
            openedUrl = url
            openedTarget = target
            return {}
          },
          prompt: (message: string, url: string) => {
            fallback = { message, url }
          },
        },
      },
    )

    expect(macBookmarkletOpenOutput(openedUrl, openedTarget, fallback)).toEqual(
      {
        openedUrl:
          'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory%3Fq%3Da%252Bb%23chapter',
        openedTarget: '_blank',
        fallback: null,
        parsed: {
          type: 'valid',
          input: {
            version: 1,
            url: 'https://articles.example.invalid/story?q=a%2Bb#chapter',
            partial: false,
          },
          cleanupUrl: '/compose',
        },
      },
    )
  })

  it('prompts with the URL if the Mac browser blocks the new tab', () => {
    let openedUrl = ''
    let prompt: { message: string; url: string } | null = null
    runInNewContext(
      macBookmarklet.replace(/^javascript:/, '').replace(/[\t\n\r]/g, ''),
      {
        URL,
        window: {
          location: { href: 'https://articles.example.invalid/story' },
          open: (url: string) => {
            openedUrl = url
            return null
          },
          prompt: (message: string, url: string) => {
            prompt = { message, url }
          },
        },
      },
    )

    expect(macBookmarkletFallbackOutput(openedUrl, prompt)).toEqual({
      openedUrl:
        'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
      prompt: {
        message: 'Copy this URL to open Bookmarker',
        url: 'https://bookmark-app.example.invalid/compose?url=https%3A%2F%2Farticles.example.invalid%2Fstory',
      },
      parsed: {
        type: 'valid',
        input: {
          version: 1,
          url: 'https://articles.example.invalid/story',
          partial: false,
        },
        cleanupUrl: '/compose',
      },
    })
  })
})
