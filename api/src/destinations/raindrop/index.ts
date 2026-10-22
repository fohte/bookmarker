import type {
  DeliveryResult,
  DestinationMetadata,
  PublishArticle,
  PublishTarget,
} from 'api/contracts'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'
import { z } from 'zod'

import { createDisabledAdapter } from '#destinations/disabled'
import {
  raindropFailed,
  raindropInvalidResponse,
  raindropUnknown,
  requestRaindropJson,
} from '#destinations/raindrop/http'
import type {
  DestinationAdapter,
  MetadataAdapterError,
  PublishAdapterError,
} from '#destinations/types'

type RaindropCollection = NonNullable<
  DestinationMetadata['destinations']['raindrop']['collections']
>[number]
type RaindropTarget = Extract<PublishTarget, { destination: 'raindrop' }>

const ExistsResponseSchema = z
  .object({
    result: z.boolean(),
    ids: z.array(z.number().int().positive()),
  })
  .loose()
  .superRefine(({ result, ids }, context) => {
    if (result !== ids.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'The result flag does not match the returned IDs.',
      })
    }
  })

const RaindropItemSchema = z
  .object({
    _id: z.number().int().positive(),
    link: z.string(),
  })
  .loose()

const SingleResponseSchema = z
  .object({
    result: z.literal(true),
    item: RaindropItemSchema,
  })
  .loose()

const ResultResponseSchema = z.object({ result: z.boolean() }).loose()

const CollectionItemSchema = z
  .object({
    _id: z.number().int(),
    title: z.string(),
    public: z.boolean(),
    parent: z
      .object({ $id: z.number().int().positive() })
      .loose()
      .nullable()
      .optional(),
  })
  .loose()

const CollectionResponseSchema = z
  .object({
    result: z.literal(true),
    items: z.array(CollectionItemSchema),
  })
  .loose()

const parseExistsResponse = (
  payload: unknown,
): ResultAsync<number[], PublishAdapterError> => {
  const parsed = ExistsResponseSchema.safeParse(payload)
  return parsed.success
    ? okAsync(parsed.data.ids)
    : errAsync(raindropFailed('invalid_response'))
}

const parseSingleResponse = (
  payload: unknown,
  mode: 'read' | 'write',
): ResultAsync<z.infer<typeof RaindropItemSchema>, PublishAdapterError> => {
  const resultEnvelope = ResultResponseSchema.safeParse(payload)
  if (resultEnvelope.success && !resultEnvelope.data.result) {
    return errAsync(raindropFailed('rejected'))
  }

  const parsed = SingleResponseSchema.safeParse(payload)
  return parsed.success
    ? okAsync(parsed.data.item)
    : errAsync(raindropInvalidResponse(mode))
}

const parseCollectionItems = (
  payload: unknown,
): ResultAsync<RaindropCollection[], PublishAdapterError> => {
  const parsed = CollectionResponseSchema.safeParse(payload)
  if (!parsed.success) {
    return errAsync(raindropFailed('invalid_response'))
  }

  return okAsync(
    parsed.data.items.map(({ _id, title, parent, public: isPublic }) => ({
      id: _id,
      title,
      ...(parent?.$id === undefined ? {} : { parentId: parent.$id }),
      public: isPublic,
    })),
  )
}

const metadataError = (error: PublishAdapterError): MetadataAdapterError => {
  if (error.code === 'unauthorized' || error.code === 'rate_limited') {
    return { code: error.code }
  }

  if (error.code === 'invalid_response' || error.code === 'rejected') {
    return { code: 'invalid_response' }
  }

  return { code: 'unavailable' }
}

const successfulDelivery = (target: PublishTarget): DeliveryResult => ({
  destination: 'raindrop',
  operationId: target.operationId,
  status: 'succeeded',
  retryable: false,
})

const sharedPayloadFields = (
  article: PublishArticle,
  target: RaindropTarget,
) => ({
  ...(article.title === undefined ? {} : { title: article.title }),
  note: target.comment,
  tags: target.options.tags,
  collection: { $id: target.options.collectionId },
})

const createPayload = (article: PublishArticle, target: RaindropTarget) => ({
  link: article.url,
  ...sharedPayloadFields(article, target),
})

const updatePayload = sharedPayloadFields

const publishNewRaindrop = (
  token: string,
  article: PublishArticle,
  target: RaindropTarget,
): ResultAsync<DeliveryResult, PublishAdapterError> =>
  requestRaindropJson(
    token,
    '/rest/v1/raindrop',
    'POST',
    'write',
    createPayload(article, target),
  )
    .andThen((payload) => parseSingleResponse(payload, 'write'))
    .andThen((item) =>
      item.link === article.url
        ? okAsync(successfulDelivery(target))
        : errAsync(raindropUnknown('invalid_response')),
    )

const updateExistingRaindrop = (
  token: string,
  article: PublishArticle,
  target: RaindropTarget,
  raindropId: number,
): ResultAsync<DeliveryResult, PublishAdapterError> =>
  requestRaindropJson(
    token,
    '/rest/v1/raindrop/' + String(raindropId),
    'GET',
    'read',
  )
    .andThen((payload) => parseSingleResponse(payload, 'read'))
    .andThen((item) => {
      if (item._id !== raindropId) {
        return errAsync(raindropFailed('invalid_response'))
      }

      if (item.link !== article.url) {
        return errAsync(raindropFailed('rejected'))
      }

      return requestRaindropJson(
        token,
        '/rest/v1/raindrop/' + String(raindropId),
        'PUT',
        'write',
        updatePayload(article, target),
      )
        .andThen((payload) => parseSingleResponse(payload, 'write'))
        .andThen((updatedItem) =>
          updatedItem._id === raindropId && updatedItem.link === article.url
            ? okAsync(successfulDelivery(target))
            : errAsync(raindropUnknown('invalid_response')),
        )
    })

const findAndPublishRaindrop = (
  token: string,
  article: PublishArticle,
  target: RaindropTarget,
): ResultAsync<DeliveryResult, PublishAdapterError> =>
  requestRaindropJson(token, '/rest/v1/import/url/exists', 'POST', 'read', {
    urls: [article.url],
  })
    .andThen(parseExistsResponse)
    .andThen((ids) => {
      if (ids.length > 1) {
        return errAsync(raindropFailed('rejected'))
      }

      const raindropId = ids.at(0)
      if (raindropId !== undefined) {
        return updateExistingRaindrop(token, article, target, raindropId)
      }

      return publishNewRaindrop(token, article, target)
    })

export const createRaindropAdapter = (
  env: Readonly<Record<string, string | undefined>> = process.env,
): DestinationAdapter<'raindrop'> => {
  const token = env['RAINDROP_ACCESS_TOKEN']?.trim()
  if (token === undefined || token.length === 0) {
    return createDisabledAdapter('raindrop')
  }

  return {
    destination: 'raindrop',
    configured: true,
    getMetadata: () => {
      const roots = requestRaindropJson(
        token,
        '/rest/v1/collections',
        'GET',
        'read',
      )
      const children = requestRaindropJson(
        token,
        '/rest/v1/collections/childrens',
        'GET',
        'read',
      )

      return roots
        .andThen((rootPayload) =>
          parseCollectionItems(rootPayload).andThen((rootCollections) =>
            children.andThen(parseCollectionItems).map((childCollections) => [
              {
                id: -1,
                title: 'Unsorted',
                public: false,
              },
              ...rootCollections,
              ...childCollections,
            ]),
          ),
        )
        .map((collections) => ({ configured: true, collections }))
        .mapErr(metadataError)
    },
    publish: ({ article, target }) =>
      findAndPublishRaindrop(token, article, target),
  }
}
