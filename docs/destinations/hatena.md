# Hatena Bookmarks

The API reads `HATENA_CONSUMER_KEY`, `HATENA_CONSUMER_SECRET`, `HATENA_ACCESS_TOKEN`, and `HATENA_ACCESS_TOKEN_SECRET` from the backend environment. All four must be non-empty to enable Hatena. Leave them unset or empty to keep Hatena disabled. If you load the repository's `.env.example`, clear its sample Hatena values when you do not have credentials.

## Create credentials

1. Register an OAuth application at [Hatena OAuth settings](https://www.hatena.ne.jp/oauth/develop). Enable `read_public`, `read_private`, `write_public`, and `write_private` for the application.
2. Run the one-time authorization CLI with a new absolute output path outside the repository. The CLI creates any missing parent directories with mode `0700`:

   ```sh
   pnpm --filter api authorize:hatena --output "$HOME/.config/hatena/credentials.json"
   ```

3. Enter the consumer key and consumer secret at the hidden prompts. Open the temporary authorization URL printed by the CLI, approve access in Hatena, then enter the displayed verifier at the hidden prompt.
4. The CLI creates the JSON file with mode `0600`. It refuses to replace an existing file and rejects output paths inside the repository. The access token and token secret are written only to that file; the CLI does not log them or publish a bookmark.

The CLI requests the `read_public,read_private,write_public,write_private` scopes using OAuth 1.0a out-of-band authorization. Hatena returns a temporary request token in the authorization URL; the final access token pair stays in the output file. See [Hatena's OAuth flow](https://developer.hatena.ne.jp/ja/documents/auth/apis/oauth/consumer/) and [scope list](https://developer.hatena.ne.jp/ja/documents/auth/apis/oauth/scopes/).

## Configure the backend

Set each environment variable to the matching field in the JSON file:

| Environment variable         | JSON field          |
| ---------------------------- | ------------------- |
| `HATENA_CONSUMER_KEY`        | `consumerKey`       |
| `HATENA_CONSUMER_SECRET`     | `consumerSecret`    |
| `HATENA_ACCESS_TOKEN`        | `accessToken`       |
| `HATENA_ACCESS_TOKEN_SECRET` | `accessTokenSecret` |

The API process reads environment variables at startup and does not pick up changes until it restarts. Do not print credential values to logs or terminals.

## Publishing behavior

Hatena accepts at most 10 tags and a comment of up to 100 characters. The adapter sends repeated `tags` form fields, UTF-8 form data, and `private=1` or `private=0`; it does not truncate input or request cross-posting to another service. Posting to an existing URL updates that bookmark. See the [bookmark API](https://developer.hatena.ne.jp/ja/documents/bookmark/apis/rest/bookmark/) and [data format](https://developer.hatena.ne.jp/ja/documents/bookmark/apis/rest/datatype/).

The POST has no automatic retry. A definite provider rejection is reported as failed; a timeout, network error, server error, redirect, or unreadable success response is reported as unknown because the write may have reached Hatena.
