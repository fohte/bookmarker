chrome.action.onClicked.addListener((tab) => {
  const editorUrl = new URL('/compose', process.env['BOOKMARKER_ORIGIN'])
  // Chrome hides the URL of restricted pages such as chrome://; the editor reports the empty link as invalid.
  editorUrl.searchParams.set('url', tab.url ?? '')
  void chrome.tabs.create({ url: editorUrl.toString(), index: tab.index + 1 })
})
