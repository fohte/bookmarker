import type {
  DeliveryResult,
  DestinationMetadata,
  PublishTarget,
} from 'api/contracts'
import { errAsync, okAsync } from 'neverthrow'
import { z } from 'zod'

import { readMastodonConfig } from '#destinations/mastodon/config'
import {
  discardMastodonResponse,
  mastodonApiUrl,
  readMastodonJson,
  requestMastodon,
} from '#destinations/mastodon/http'
import type {
  DestinationAdapter,
  MetadataAdapterError,
  PublishAdapterError,
} from '#destinations/types'

const instanceMetadataSchema = z
  .object({
    configuration: z
      .object({
        statuses: z
          .object({
            max_characters: z.number().int().positive(),
            characters_reserved_per_url: z.number().int().nonnegative(),
          })
          .loose(),
      })
      .loose(),
  })
  .loose()

const createdStatusSchema = z.object({
  id: z.string().min(1),
  url: z.string().nullable().optional(),
})

const metadataErrorForStatus = (status: number): MetadataAdapterError => {
  if (status === 401 || status === 403) {
    return { code: 'unauthorized' }
  }
  if (status === 429) {
    return { code: 'rate_limited' }
  }
  return { code: 'unavailable' }
}

const publishError = (
  code: PublishAdapterError['code'],
  outcome: PublishAdapterError['outcome'],
  retryable: boolean,
): PublishAdapterError => ({ code, outcome, retryable })

const remoteUrlFrom = (
  value: string | null | undefined,
): string | undefined => {
  if (
    value === undefined ||
    value === null ||
    value.length === 0 ||
    !URL.canParse(value)
  ) {
    return undefined
  }

  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    return undefined
  }

  return url.href
}

const statusTextFor = (comment: string, articleUrl: string): string =>
  comment.length > 0 ? `${comment}\n\n${articleUrl}` : articleUrl

const getMetadata = (
  configured: boolean,
  instanceUrl: URL | undefined,
): ReturnType<DestinationAdapter<'mastodon'>['getMetadata']> => {
  if (!configured) {
    return okAsync({ configured: false })
  }
  if (!instanceUrl) {
    return errAsync({ code: 'unavailable' } satisfies MetadataAdapterError)
  }

  return requestMastodon(instanceUrl, { method: 'GET' }).andThen((response) => {
    if (!response.ok) {
      const error = metadataErrorForStatus(response.status)
      discardMastodonResponse(response)
      return errAsync(error)
    }

    return readMastodonJson(response).andThen((body) => {
      const parsed = instanceMetadataSchema.safeParse(body)
      if (!parsed.success) {
        return errAsync({
          code: 'invalid_response',
        } satisfies MetadataAdapterError)
      }

      const metadata: DestinationMetadata['destinations']['mastodon'] = {
        configured: true,
        maxCharacters: parsed.data.configuration.statuses.max_characters,
        charactersReservedPerUrl:
          parsed.data.configuration.statuses.characters_reserved_per_url,
      }
      return okAsync(metadata)
    })
  })
}

const publish = (
  configured: boolean,
  statusesUrl: URL | undefined,
  accessToken: string | undefined,
  input: {
    article: { url: string }
    target: Extract<PublishTarget, { destination: 'mastodon' }>
  },
): ReturnType<DestinationAdapter<'mastodon'>['publish']> => {
  if (!configured || statusesUrl === undefined || accessToken === undefined) {
    return errAsync(publishError('not_configured', 'failed', false))
  }

  const { article, target } = input
  const form = new URLSearchParams({
    status: statusTextFor(target.comment, article.url),
    visibility: target.options.visibility,
    spoiler_text: target.options.spoilerText,
    sensitive: String(target.options.sensitive),
  })

  return requestMastodon(statusesUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'idempotency-key': target.operationId,
    },
    body: form.toString(),
  })
    .mapErr((error) => publishError(error.code, 'unknown', false))
    .andThen((response) => {
      if (response.status === 401 || response.status === 403) {
        discardMastodonResponse(response)
        return errAsync(publishError('unauthorized', 'failed', false))
      }
      if (response.status === 429) {
        discardMastodonResponse(response)
        return errAsync(publishError('rate_limited', 'failed', true))
      }
      if (
        response.status === 408 ||
        response.status >= 500 ||
        (response.status >= 300 && response.status < 400)
      ) {
        discardMastodonResponse(response)
        return errAsync(publishError('unavailable', 'unknown', false))
      }
      if (!response.ok) {
        discardMastodonResponse(response)
        return errAsync(publishError('rejected', 'failed', false))
      }

      return readMastodonJson(response)
        .mapErr((error) => publishError(error.code, 'unknown', false))
        .andThen((body) => {
          const parsed = createdStatusSchema.safeParse(body)
          if (!parsed.success) {
            return errAsync(publishError('invalid_response', 'unknown', false))
          }

          const remoteUrl = remoteUrlFrom(parsed.data.url)
          const result: DeliveryResult = {
            destination: 'mastodon',
            operationId: target.operationId,
            status: 'succeeded',
            retryable: false,
            ...(remoteUrl !== undefined ? { remoteUrl } : {}),
          }
          return okAsync(result)
        })
    })
}

export const createMastodonAdapter = (): DestinationAdapter<'mastodon'> => {
  const config = readMastodonConfig()
  const instanceMetadataUrl = mastodonApiUrl(config, '/api/v2/instance')
  const instanceStatusesUrl = mastodonApiUrl(config, '/api/v1/statuses')

  return {
    destination: 'mastodon',
    configured: config.configured,
    getMetadata: () => getMetadata(config.configured, instanceMetadataUrl),
    publish: (input) =>
      publish(
        config.configured,
        instanceStatusesUrl,
        config.accessToken,
        input,
      ),
  }
}
