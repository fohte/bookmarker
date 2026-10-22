# Share entrypoints

Share links use one of two forms:

- URL only: `/compose?url=<encoded article URL>`
- Article text: `/compose#share=<encodeURIComponent(JSON.stringify(ShareInput))>`

The article text is carried in the fragment, which browsers do not send in the HTTP request. It remains visible in the address bar and browser history, so use the URL-only entrypoint when the text is sensitive. The parser accepts at most 8,192 UTF-16 code units of `sharedText` and at most 16,384 encoded bytes for the complete fragment. These are app limits, not browser guarantees. Oversized text is kept in full on the clipboard and omitted from the link; the shortcut reports `requiresPaste` instead of truncating it.

## iPhone and iPad

Create two separate shortcuts so a URL can still be shared if JavaScript access is unavailable.

### URL-only shortcut

1. Create a shortcut that accepts `URLs` from the Share Sheet.
2. Add `URL Encode` and pass it the Shortcut Input URL.
3. Add a `Text` action containing `https://bookmark-app.example.invalid/compose?url=` followed by the encoded result.
4. Pass that text to a `URL` action, then open its result with `Open URLs`.
5. Replace `bookmark-app.example.invalid` with the deployed Bookmarker host.

### Safari article shortcut

1. Create another shortcut that accepts Safari web pages from the Share Sheet.
2. Add `Run JavaScript on Web Page` and paste the contents of [`safari-shortcut.js`](./safari-shortcut.js) into the action.
3. Replace `bookmark-app.example.invalid` in the script with the deployed Bookmarker host.
4. Read `clipboardText`, `editorUrl`, and `requiresPaste` from the returned dictionary.
5. If `requiresPaste` is true, show an alert that the article text is on the clipboard and must be pasted manually.
6. Add `Copy to Clipboard` for `clipboardText`, then `Open URLs` for `editorUrl`, in that order.

Run the body shortcut from Safari after signing in to the article site. The first run may ask for permission to access the webpage; review the script before allowing it. Enable `Settings > Shortcuts > Advanced > Allow Running Scripts` if the setting is off. Apple notes that a JavaScript timeout prevents the shortcut from completing, so this shortcut returns the result immediately and does not fetch more page content.

If Bookmarker requires sign-in, sign in before opening a shared link. An authentication redirect can drop a fragment or carry it into another URL, depending on the redirect. Avoid placing sensitive text in the fragment; use the URL-only shortcut and paste text manually when needed.

## macOS browser bookmarklet

1. Create a bookmark in Safari and edit its address to the contents of [`mac-bookmarklet.js`](./mac-bookmarklet.js).
2. Replace `bookmark-app.example.invalid` with the deployed Bookmarker host.
3. Open an article and select the bookmark to open its URL-only compose link.

The app fetches article text from the URL. Copy and paste article text manually if the site blocks fetching or requires an authenticated browser session. The bookmarklet does not depend on clipboard access.

## Browser and authentication limits

Safari may deny the body shortcut because of its webpage permission, script policy, or execution timeout. A site's Content Security Policy may also block a bookmarklet. The body shortcut copies through the Shortcuts `Copy to Clipboard` action; the browser Clipboard API is not required or assumed to succeed.

The fragment is not sent in the initial HTTP request, but browser history, extensions, or later redirects can still expose or lose it. Do not use it as a reliable transport for secrets. If authentication is needed, authenticate first and use URL-only plus manual paste for text you do not want in a URL.

See Apple's guides for [Shortcut input types](https://support.apple.com/en-gb/guide/shortcuts/apd7644168e1/ios), [running JavaScript on a webpage](https://support.apple.com/en-gb/guide/shortcuts/apd218e2187d/9.0/ios/26), [Shortcuts privacy settings](https://support.apple.com/en-euro/guide/shortcuts/apdfeb05586f/ios), and [sharing a shortcut](https://support.apple.com/en-by/guide/shortcuts/apdf01f8c054/ios), plus the [URI fragment reference](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment).
