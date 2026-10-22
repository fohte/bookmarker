javascript: (() => {
  const composeUrl = new URL('https://bookmark-app.example.invalid/compose')
  composeUrl.search = ''
  composeUrl.hash = ''
  composeUrl.searchParams.set('url', window.location.href)
  window.location.assign(composeUrl.toString())
})()
