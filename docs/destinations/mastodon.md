# Mastodon destination

The API posts the article comment followed by its URL to `POST /api/v1/statuses`. It sends the selected visibility, content warning, and sensitive flag. The comment is sent as written; it is never shortened to fit an instance limit.

## Runtime configuration

Set these environment variables on the backend only:

| Variable                | Value                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `MASTODON_BASE_URL`     | The instance HTTPS origin, for example `https://mastodon.example.test`. Do not include a path, query, fragment, or credentials. |
| `MASTODON_ACCESS_TOKEN` | A user access token with the `write:statuses` scope.                                                                            |

Both values are optional at startup. If either is missing or blank, the adapter is unconfigured and makes no Mastodon requests. If both values are non-empty but the base URL is invalid, the adapter remains configured by environment presence, reports metadata as unavailable, and does not send the token.

The adapter reads instance limits from the public `GET /api/v2/instance` endpoint. It returns `configuration.statuses.max_characters` and `configuration.statuses.characters_reserved_per_url` as metadata. A metadata failure does not mark the destination unconfigured or block other destinations.

## Issue a user access token

Create an OAuth application on the target instance and authorize it as the account that will publish. The statuses endpoint requires a user token with `write:statuses`; an app token from `client_credentials` cannot publish as the user. See the official [statuses API](https://docs.joinmastodon.org/methods/statuses/), [apps API](https://docs.joinmastodon.org/methods/apps/), and [OAuth API](https://docs.joinmastodon.org/methods/oauth/).

1. Register an application with `POST /api/v1/apps`. Use a descriptive `client_name`, `redirect_uris` set to `urn:ietf:wg:oauth:2.0:oob`, and `scopes` set to `write:statuses`. Keep the returned `client_id` and `client_secret` private while issuing the token.
2. Open the instance's `/oauth/authorize` endpoint in a browser while signed in to the publishing account. Set `response_type=code`, the registered `client_id`, the same OOB `redirect_uri`, `scope=write:statuses`, and a random `state`. Approve access and record the returned authorization code. Treat the code as a password.
3. Exchange the code with `POST /oauth/token`, using `grant_type=authorization_code`, the code, `client_id`, `client_secret`, and the same `redirect_uri`. Store the returned user `access_token` securely. Do not request `grant_type=client_credentials`.
4. The runtime needs only the user access token and instance base URL. It does not need the OAuth application's client ID or client secret.

Do not put OAuth credentials or the token in the repository, task pages, shell history, application logs, or browser code.

## Store the backend values

In AWS Systems Manager Parameter Store, create each parameter with type `SecureString`:

| Name                                      | Value                             |
| ----------------------------------------- | --------------------------------- |
| `/infra/bookmarker/mastodon-base-url`     | The target instance HTTPS origin. |
| `/infra/bookmarker/mastodon-access-token` | The issued user access token.     |

After saving both parameters, verify that the API `ExternalSecret` has synchronized them. Then restart the API deployment with a rollout restart so its processes read the values as `MASTODON_BASE_URL` and `MASTODON_ACCESS_TOKEN`. Keep parameter values out of logs and deployment output.

## Delivery and failure handling

- Each POST sends `operationId` as `Idempotency-Key`. Mastodon retains idempotency keys for up to one hour, so this is not a permanent duplicate guarantee.
- The adapter never retries a write or follows redirects. It uses a 10-second timeout and limits each response body to 64 KiB.
- A `401`/`403` is reported as an authorization failure, `429` as a rate-limit failure, and other `4xx` responses except `408` as rejected input. These are failed deliveries; only `429` is marked retryable for a later manual retry. Provider response bodies are not exposed.
- A network failure, timeout, `408`, redirect, `5xx`, oversized or unreadable response, or invalid success payload is `unknown` and cannot be retried by the application. Check the account before making a new operation because Mastodon may have accepted the post.
- Instance character limits are metadata only. The API does not truncate comments; an instance that rejects a long post returns a safe rejection result.

Mastodon documents response rate-limit headers and may return `429`. The adapter reports that response as `rate_limited` and does not perform an automatic retry. See [rate limits](https://docs.joinmastodon.org/api/rate-limits/).
