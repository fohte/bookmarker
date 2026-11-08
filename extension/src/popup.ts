const origin = process.env['BOOKMARKER_ORIGIN']

const isSignedOut = () =>
  fetch(new URL('/', origin), {
    credentials: 'include',
    redirect: 'manual',
  }).then(
    (response) => response.type === 'opaqueredirect',
    () => false,
  )

const open = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const editorUrl = new URL('/compose', origin)
  // Chrome hides the URL of restricted pages such as chrome://; the editor reports the empty link as invalid.
  editorUrl.searchParams.set('url', tab?.url ?? '')

  // The sign-in page refuses to load in a frame, so signing in has to happen in a tab.
  if (await isSignedOut()) {
    const signIn = document.querySelector<HTMLAnchorElement>('#sign-in')
    if (signIn === null) return
    signIn.href = editorUrl.toString()
    signIn.hidden = false
    return
  }

  const editor = document.querySelector<HTMLIFrameElement>('#editor')
  if (editor === null) return
  editor.src = editorUrl.toString()
  editor.hidden = false
}

void open()
