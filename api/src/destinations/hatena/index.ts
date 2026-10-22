import type {
  DeliveryResult,
  PublishArticle,
  PublishTarget,
} from 'api/contracts'
import type { ResultAsync } from 'neverthrow'
import { err, errAsync, ok, okAsync, Result } from 'neverthrow'

import { HttpUrlSchema } from '#contracts/http'
import {
  discardResponseBody,
  readResponseText,
  sendOAuthForm,
} from '#destinations/hatena/http'
import type {
  DestinationAdapter,
  PublishAdapterError,
} from '#destinations/types'

const HATENA_BOOKMARK_URL = new URL(
  'https://bookmark.hatenaapis.com/rest/1/my/bookmark',
)
const MAX_RESPONSE_BYTES = 65_536
const REQUEST_TIMEOUT_MS = 10_000

type HatenaEnvironment = Partial<
  Record<
    | 'HATENA_CONSUMER_KEY'
    | 'HATENA_CONSUMER_SECRET'
    | 'HATENA_ACCESS_TOKEN'
    | 'HATENA_ACCESS_TOKEN_SECRET',
    string
  >
>

type HatenaCredentials = {
  consumerKey: string
  consumerSecret: string
  accessToken: string
  accessTokenSecret: string
}

type HatenaAdapterDependencies = {
  env?: HatenaEnvironment
  fetch?: typeof fetch
  nonce?: () => string
  now?: () => number
  timeoutMs?: number
}

const readCredentials = (
  env: HatenaEnvironment,
): HatenaCredentials | undefined => {
  const consumerKey = env.HATENA_CONSUMER_KEY
  const consumerSecret = env.HATENA_CONSUMER_SECRET
  const accessToken = env.HATENA_ACCESS_TOKEN
  const accessTokenSecret = env.HATENA_ACCESS_TOKEN_SECRET

  if (
    consumerKey === undefined ||
    consumerKey.length === 0 ||
    consumerSecret === undefined ||
    consumerSecret.length === 0 ||
    accessToken === undefined ||
    accessToken.length === 0 ||
    accessTokenSecret === undefined ||
    accessTokenSecret.length === 0
  ) {
    return undefined
  }

  return { consumerKey, consumerSecret, accessToken, accessTokenSecret }
}

const createPublishError = (
  code: PublishAdapterError['code'],
  outcome: PublishAdapterError['outcome'],
  retryable: boolean,
): PublishAdapterError => ({ code, outcome, retryable })

const parseBookmarkPermalink = (
  text: string,
): Result<string, 'invalid_response'> =>
  Result.fromThrowable(
    () => JSON.parse(text) as unknown,
    () => 'invalid_response' as const,
  )().andThen((value) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('permalink' in value)
    ) {
      return err('invalid_response')
    }

    const permalink = HttpUrlSchema.safeParse(value.permalink)
    return permalink.success ? ok(permalink.data) : err('invalid_response')
  })

const publishHatenaBookmark = (
  credentials: HatenaCredentials,
  input: {
    article: PublishArticle
    target: Extract<PublishTarget, { destination: 'hatena' }>
  },
  dependencies: HatenaAdapterDependencies,
): ResultAsync<DeliveryResult, PublishAdapterError> => {
  const { article, target } = input

  if (target.options.tags.length > 10) {
    return errAsync(createPublishError('rejected', 'failed', false))
  }

  const body = new URLSearchParams()
  body.append('url', article.url)
  body.append('comment', target.comment)
  for (const tag of target.options.tags) {
    body.append('tags', tag)
  }
  body.append('private', target.options.private ? '1' : '0')

  return sendOAuthForm({
    fetch: dependencies.fetch ?? fetch,
    url: HATENA_BOOKMARK_URL,
    body,
    credentials: {
      consumerKey: credentials.consumerKey,
      consumerSecret: credentials.consumerSecret,
      token: credentials.accessToken,
      tokenSecret: credentials.accessTokenSecret,
    },
    ...(dependencies.nonce === undefined
      ? {}
      : { nonce: dependencies.nonce() }),
    ...(dependencies.now === undefined
      ? {}
      : { timestamp: Math.floor(dependencies.now() / 1000) }),
    timeoutMs: dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS,
    headers: {
      'User-Agent': 'bookmarker (https://github.com/fohte/bookmarker)',
    },
  })
    .mapErr(() => createPublishError('unavailable', 'unknown', false))
    .andThen((response) => {
      if (response.status === 429) {
        discardResponseBody(response)
        return errAsync(createPublishError('rate_limited', 'failed', true))
      }

      if (response.status === 401 || response.status === 403) {
        discardResponseBody(response)
        return errAsync(createPublishError('unauthorized', 'failed', false))
      }

      if (
        response.status === 408 ||
        (response.status >= 300 && response.status < 400) ||
        response.status < 200 ||
        response.status >= 500
      ) {
        discardResponseBody(response)
        return errAsync(
          createPublishError(
            response.status >= 500 ? 'unavailable' : 'invalid_response',
            'unknown',
            false,
          ),
        )
      }

      if (response.status >= 400) {
        discardResponseBody(response)
        return errAsync(createPublishError('rejected', 'failed', false))
      }

      return readResponseText(response, MAX_RESPONSE_BYTES)
        .andThen((text) => {
          const parsed = parseBookmarkPermalink(text)
          return parsed.isOk()
            ? okAsync(parsed.value)
            : errAsync(createPublishError('invalid_response', 'unknown', false))
        })
        .map((remoteUrl) => ({
          destination: 'hatena' as const,
          operationId: target.operationId,
          status: 'succeeded' as const,
          retryable: false as const,
          remoteUrl,
        }))
        .mapErr(() => createPublishError('invalid_response', 'unknown', false))
    })
}

export const createHatenaAdapter = (
  dependencies: HatenaAdapterDependencies = {},
): DestinationAdapter<'hatena'> => {
  const credentials = readCredentials(dependencies.env ?? process.env)

  return {
    destination: 'hatena',
    configured: credentials !== undefined,
    getMetadata: () => okAsync({ configured: credentials !== undefined }),
    publish: (input) =>
      credentials === undefined
        ? errAsync(createPublishError('not_configured', 'failed', false))
        : publishHatenaBookmark(credentials, input, dependencies),
  }
}
