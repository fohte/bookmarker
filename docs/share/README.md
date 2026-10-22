# Share entrypoints

Share links use one of two forms:

- URL only: `/compose?url=<encoded article URL>`
- Article text: `/compose#share=<encodeURIComponent(JSON.stringify(ShareInput))>`

The article text is carried in the fragment, which browsers do not send in the HTTP request. It remains visible in the address bar and browser history, so use the URL-only entrypoint when the text is sensitive. The parser accepts at most 8,192 UTF-16 code units of `sharedText` and at most 16,384 encoded bytes for the complete fragment. These are app limits, not browser guarantees. Oversized text is kept in full on the clipboard and omitted from the link; the shortcut reports `requiresPaste` instead of truncating it.

## iPhone and iPad

Create two separate shortcuts so a URL can still be shared if JavaScript access is unavailable.

### URL-only shortcut

1. Create a shortcut, turn on `Show in Share Sheet`, and accept `URLs` and `Safari Web Pages`. Set the no-input response to `Stop and Respond` with a short message.
2. Add `Get URLs from Input`. If it returns no URLs, show an alert and stop the shortcut. Otherwise, add `Get Item from List` and select the first item.
3. Add `URL Encode` and pass it the first URL.
4. Add a `Text` action containing `https://bookmark-app.example.invalid/compose?url=` followed by the encoded result.
5. Pass that text to a `URL` action, then open its result with `Open URLs`.
6. Replace `bookmark-app.example.invalid` with the deployed Bookmarker host.

### Safari article shortcut

1. Create another shortcut, turn on `Show in Share Sheet`, and accept only `Safari Web Pages`.
2. Add `Run JavaScript on Web Page` and paste the contents of [`safari-shortcut.txt`](./safari-shortcut.txt) into the action.
3. Replace `bookmark-app.example.invalid` in the script with the deployed Bookmarker host.
4. Read `clipboardText`, `editorUrl`, and `requiresPaste` from the returned dictionary.
5. If `requiresPaste` is true, show an alert that the article text is on the clipboard and must be pasted manually.
6. Add `Copy to Clipboard` for `clipboardText`, then `Open URLs` for `editorUrl`, in that order.

Run the Safari article shortcut from Safari after signing in to the article site. The first run may ask for permission to access the webpage; review the script before allowing it. Enable `Settings > Shortcuts > Advanced > Allow Running Scripts` if the setting is off. Apple notes that a JavaScript timeout prevents the shortcut from completing, so this shortcut returns the result immediately and does not fetch more page content.

If Bookmarker requires sign-in, sign in before opening a shared link. An authentication redirect can drop a fragment or carry it into another URL, depending on the redirect. Avoid placing sensitive text in the fragment; use the URL-only shortcut and paste text manually when needed.

## macOS browser bookmarklet

1. Create a bookmark in Safari or Chrome and edit its address to the contents of [`mac-bookmarklet.txt`](./mac-bookmarklet.txt).
2. Replace `bookmark-app.example.invalid` with the deployed Bookmarker host.
3. Open an article and select the bookmark to open its URL-only compose link in a new tab. If the browser blocks the new tab, copy the URL from the prompt into the address bar.

The compose page receives the article URL. Paste article text manually if you want to include it. The bookmarklet does not depend on clipboard access.

## Browser and authentication limits

Safari may deny the Safari article shortcut because of its webpage permission, script policy, or execution timeout. A site's Content Security Policy may also block a bookmarklet. The shortcut copies through the Shortcuts `Copy to Clipboard` action; the browser Clipboard API is not required or assumed to succeed.

The fragment is not sent in the initial HTTP request, but browser history, extensions, or later redirects can still expose or lose it. Do not use it as a reliable transport for secrets. If authentication is needed, authenticate first and use URL-only plus manual paste for text you do not want in a URL.

## iOS device checklist

The shortcuts have not been verified on an iOS device. Complete these checks on the device before relying on them:

- [ ] Confirm the URL-only shortcut appears in Safari's Share Sheet and opens a draft with the shared URL.
- [ ] Confirm the Safari article shortcut requests webpage access, runs after enabling `Allow Running Scripts`, and copies text before opening the compose URL.
- [ ] Share a short article and confirm its text reaches the editor. Share a long article and confirm the alert appears and the clipboard still contains the complete text for manual paste.
- [ ] Confirm the app is signed in before using a text fragment. If authentication redirects and loses the fragment, use the URL-only shortcut and paste the text manually.

See Apple's guides for [Shortcut input types](https://support.apple.com/en-gb/guide/shortcuts/apd7644168e1/ios), [list actions](https://support.apple.com/en-gb/guide/shortcuts/apd4dcacc115/ios), [limiting shortcut input](https://support.apple.com/en-gb/guide/shortcuts/apd8195f96d6/ios), [running JavaScript on a webpage](https://support.apple.com/en-gb/guide/shortcuts/apdb71a01d93/ios), [Shortcuts privacy settings](https://support.apple.com/en-euro/guide/shortcuts/apdfeb05586f/ios), and [sharing a shortcut](https://support.apple.com/en-by/guide/shortcuts/apdf01f8c054/ios), plus the [URI fragment reference](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment).
