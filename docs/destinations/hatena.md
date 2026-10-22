# Hatena Bookmarks

The API reads `HATENA_CONSUMER_KEY`, `HATENA_CONSUMER_SECRET`, `HATENA_ACCESS_TOKEN`, and `HATENA_ACCESS_TOKEN_SECRET` from the backend environment. All four must be non-empty to enable Hatena. Leave them unset or empty to keep Hatena disabled. If you load the repository's `.env.example`, clear its sample Hatena values when you do not have credentials.

## Create credentials

1. Register an OAuth application at [Hatena OAuth settings](https://www.hatena.ne.jp/oauth/develop). Enable `read_public`, `read_private`, `write_public`, and `write_private` for the application.
2. Create a private directory outside the repository, then run the one-time authorization CLI with a new absolute output path:

   ```sh
   mkdir -p "$HOME/.config/bookmarker"
   chmod 700 "$HOME/.config/bookmarker"
   pnpm --filter api authorize:hatena -- --output "$HOME/.config/bookmarker/hatena.json"
   ```

3. Enter the consumer key and consumer secret at the hidden prompts. Open the temporary authorization URL printed by the CLI, approve access in Hatena, then enter the displayed verifier at the hidden prompt.
4. The CLI creates the JSON file with mode `0600`. It refuses to replace an existing file and rejects output paths inside the repository. The access token and token secret are written only to that file; the CLI does not log them or publish a bookmark.

The CLI requests the `read_public,read_private,write_public,write_private` scopes using OAuth 1.0a out-of-band authorization. Hatena returns a temporary request token in the authorization URL; the final access token pair stays in the output file. See [Hatena's OAuth flow](https://developer.hatena.ne.jp/ja/documents/auth/apis/oauth/consumer/) and [scope list](https://developer.hatena.ne.jp/ja/documents/auth/apis/oauth/scopes/).

## Store the credentials in Parameter Store

Set `HATENA_CREDENTIALS_FILE` to the file created above. The commands below pass each value to AWS CLI through standard input so the credential values do not appear in shell history or process arguments.

```sh
HATENA_CREDENTIALS_FILE="$HOME/.config/bookmarker/hatena.json"

put_hatena_parameter() {
  local suffix="$1"
  local field="$2"

  jq -c --arg name "/infra/bookmarker/$suffix" --arg field "$field" \
    '{Name: $name, Type: "SecureString", Value: .[$field], Overwrite: true}' \
    "$HATENA_CREDENTIALS_FILE" \
    | aws ssm put-parameter --cli-input-json file:///dev/stdin --no-cli-pager
}

put_hatena_parameter hatena-consumer-key consumerKey
put_hatena_parameter hatena-consumer-secret consumerSecret
put_hatena_parameter hatena-access-token accessToken
put_hatena_parameter hatena-access-token-secret accessTokenSecret
```

This creates or updates these `SecureString` parameters:

| Environment variable         | Parameter Store name                           |
| ---------------------------- | ---------------------------------------------- |
| `HATENA_CONSUMER_KEY`        | `/infra/bookmarker/hatena-consumer-key`        |
| `HATENA_CONSUMER_SECRET`     | `/infra/bookmarker/hatena-consumer-secret`     |
| `HATENA_ACCESS_TOKEN`        | `/infra/bookmarker/hatena-access-token`        |
| `HATENA_ACCESS_TOKEN_SECRET` | `/infra/bookmarker/hatena-access-token-secret` |

The `bookmarker-hatena` ExternalSecret in the `bookmarker` namespace reads these four parameters and creates the `bookmarker-hatena` Kubernetes Secret. ESO's `.status.refreshTime` records when it fetched the parameters and updated the target Secret, so compare it before and after requesting an immediate refresh ([ESO FAQ](https://external-secrets.io/latest/introduction/faq/)):

```sh
previous_refresh="$(kubectl -n bookmarker get externalsecret bookmarker-hatena -o jsonpath='{.status.refreshTime}')"
kubectl -n bookmarker annotate externalsecret bookmarker-hatena force-sync="$(date +%s)" --overwrite
waited=0
while [ "$waited" -lt 120 ]; do
  current_refresh="$(kubectl -n bookmarker get externalsecret bookmarker-hatena -o jsonpath='{.status.refreshTime}')"
  if [ -n "$current_refresh" ] && [ "$current_refresh" != "$previous_refresh" ]; then
    break
  fi
  sleep 2
  waited=$((waited + 2))
done
if [ -z "$current_refresh" ] || [ "$current_refresh" = "$previous_refresh" ]; then
  printf '%s\n' 'Timed out waiting for the Hatena ExternalSecret refresh' >&2
  exit 1
fi
kubectl -n bookmarker wait externalsecret/bookmarker-hatena --for=condition=Ready --timeout=120s
kubectl -n bookmarker get externalsecret bookmarker-hatena
```

Confirm that `READY` is `True`. The status commands do not show secret values. Once the refresh is complete, restart the API deployment so its environment picks up the synchronized values:

```sh
kubectl -n bookmarker rollout restart deployment/bookmarker-api
kubectl -n bookmarker rollout status deployment/bookmarker-api
```

The API process reads environment variables at startup and does not pick up changes until it restarts. Do not print credential values to logs or terminals.

## Publishing behavior

Hatena accepts at most 10 tags and a comment of up to 100 characters. The adapter sends repeated `tags` form fields, UTF-8 form data, and `private=1` or `private=0`; it does not truncate input or request cross-posting to another service. Posting to an existing URL updates that bookmark. See the [bookmark API](https://developer.hatena.ne.jp/ja/documents/bookmark/apis/rest/bookmark/) and [data format](https://developer.hatena.ne.jp/ja/documents/bookmark/apis/rest/datatype/).

The POST has no automatic retry. A definite provider rejection is reported as failed; a timeout, network error, server error, redirect, or unreadable success response is reported as unknown because the write may have reached Hatena.
