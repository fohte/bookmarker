# Raindrop

The API reads `RAINDROP_ACCESS_TOKEN` from the backend environment. The token is never sent to the browser.

## Create and store a personal Test token

1. Sign in to Raindrop.io and open [Integrations](https://app.raindrop.io/settings/integrations).
2. Create or open the application used by this deployment, then copy its Test token. Raindrop documents Test tokens as an option for accessing only your own account without completing the OAuth flow. See [Obtain access token](https://developer.raindrop.io/v1/authentication/token).
3. In AWS Systems Manager Parameter Store, create a parameter named `/infra/bookmarker/raindrop-access-token` with type `SecureString`. Store the copied Test token as its value and save the parameter.
4. Wait for the ExternalSecret to synchronize the parameter into the backend environment. Restart the API deployment if it does not pick up the updated secret automatically.

Do not put the token in source files, browser storage, or command history.

Raindrop states that regular OAuth access tokens expire after two weeks, with Test tokens as an exception. That exception does not guarantee that a Test token will remain valid permanently. The adapter reports whether a token is configured separately from metadata retrieval errors, so a configured token can still be rejected by Raindrop.

## What publishing does

The adapter checks the article URL before writing. It creates a raindrop when none exists, updates the one matching item after verifying its URL, and refuses to choose an item when multiple IDs are returned. A failed read stops before any write. A write whose outcome cannot be confirmed is returned as unknown and is not retried automatically.

Comments are stored in the raindrop `note`; tags and the selected collection are sent with the item. Collection metadata includes root and child collections, the `Unsorted` system collection, and each collection's public flag. The adapter does not change collection visibility.

See the official documentation for [URL existence checks](https://developer.raindrop.io/v1/import), [creating and updating raindrops](https://developer.raindrop.io/v1/raindrops/single), [raindrop fields](https://developer.raindrop.io/v1/raindrops), [collections](https://developer.raindrop.io/v1/collections/methods), and [system collections](https://developer.raindrop.io/v1/collections).
