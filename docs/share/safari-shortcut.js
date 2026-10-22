function createShareLink(composeUrl, input) {
  const sharedText = input.sharedText ?? input.title ?? ''
  const shareFragment = `#share=${encodeURIComponent(JSON.stringify(input))}`
  const requiresPaste =
    (input.sharedText?.length ?? 0) > 8_192 || shareFragment.length > 16_384
  const editorUrl = new URL(composeUrl)

  editorUrl.search = ''
  editorUrl.hash = ''

  if (requiresPaste) {
    editorUrl.searchParams.set('url', input.url)
  } else if (
    input.sharedText !== undefined ||
    input.title !== undefined ||
    input.partial
  ) {
    editorUrl.hash = shareFragment
  } else {
    editorUrl.searchParams.set('url', input.url)
  }

  return {
    clipboardText: sharedText,
    editorUrl: editorUrl.toString(),
    requiresPaste,
  }
}

const composeUrl = 'https://bookmark-app.example.invalid/compose'
const input = {
  version: 1,
  url: location.href,
  title: document.title,
  sharedText: document.body?.innerText ?? '',
  partial: true,
}

completion(createShareLink(composeUrl, input))
