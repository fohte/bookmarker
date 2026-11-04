import type {
  BookmarkDraft,
  DeliveryResult,
  DestinationMetadata,
  PublishArticle,
  PublishRequest,
  PublishTarget,
} from 'api/contracts'
import { PublishRequestSchema } from 'api/contracts'
import { err, ok, type Result } from 'neverthrow'

import { destinationHasSucceeded } from '#features/editor/compose-delivery-history'
import {
  effectiveDestinationComment,
  isRaindropCollectionAvailable,
} from '#features/editor/compose-destination'
import { unconfirmedDeliveryResult } from '#features/publish/unconfirmed-delivery'

export type ComposeDeliveryPlan = {
  request: PublishRequest
  snapshots: BookmarkDraft['delivery']
}

export type PendingDeliveryComment = {
  destination: Exclude<PublishTarget['destination'], 'x'>
  commentTargetId: string
  comment: string
}

const operationKey = (
  target: Pick<PublishTarget, 'destination' | 'operationId'>,
) => `${target.destination}:${target.operationId}`

type NewPublishTarget =
  | Omit<Extract<PublishTarget, { destination: 'hatena' }>, 'operationId'>
  | Omit<Extract<PublishTarget, { destination: 'mastodon' }>, 'operationId'>
  | Omit<Extract<PublishTarget, { destination: 'raindrop' }>, 'operationId'>

function createNewPublishTarget(
  destination: Exclude<
    BookmarkDraft['destinations'][number],
    { destination: 'x' }
  >,
  comment: string,
): NewPublishTarget {
  switch (destination.destination) {
    case 'hatena':
      return {
        destination: 'hatena',
        comment,
        options: destination.options,
      }
    case 'mastodon':
      return {
        destination: 'mastodon',
        comment,
        options: destination.options,
      }
    case 'raindrop':
      return {
        destination: 'raindrop',
        comment,
        options: destination.options,
      }
  }
}

const isSelectedPublishDestination = (
  destination: BookmarkDraft['destinations'][number],
): destination is Extract<
  BookmarkDraft['destinations'][number],
  { destination: PublishTarget['destination'] }
> => destination.selected && destination.destination !== 'x'

export function getPendingDeliveryComments(
  draft: BookmarkDraft,
): PendingDeliveryComment[] {
  return draft.destinations
    .filter(isSelectedPublishDestination)
    .filter(
      (destination) =>
        !destinationHasSucceeded(draft.delivery, destination.destination),
    )
    .map((destination) => ({
      destination: destination.destination,
      commentTargetId:
        destination.commentMode === 'common'
          ? 'common'
          : `destination:${destination.destination}`,
      comment: effectiveDestinationComment(draft.commonComment, destination),
    }))
}

function publishArticle(draft: BookmarkDraft): PublishArticle {
  if (draft.article !== undefined) {
    return { url: draft.article.url, title: draft.article.title }
  }

  return {
    url: draft.source.url,
    ...(draft.source.title === undefined ? {} : { title: draft.source.title }),
  }
}

function parsePlan(
  article: PublishArticle,
  targets: PublishTarget[],
): Result<ComposeDeliveryPlan, string> {
  const parsed = PublishRequestSchema.safeParse({ article, targets })
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' ')
    return err(`Correct the publish details before sending. ${details}`)
  }

  return ok({
    request: parsed.data,
    snapshots: parsed.data.targets.map((target) => ({
      article: parsed.data.article,
      target,
    })),
  })
}

function destinationError(destination: string): string {
  return `${destination} is not connected. Connect it before publishing.`
}

function isConfigured(
  destination: PublishTarget['destination'],
  metadata: DestinationMetadata,
): boolean {
  return metadata.destinations[destination].configured
}

export function createNewDeliveryPlan(
  draft: BookmarkDraft,
  metadata: DestinationMetadata,
): Result<ComposeDeliveryPlan, string> {
  const selected = draft.destinations.filter(isSelectedPublishDestination)
  if (selected.length === 0) {
    return err('Select at least one API destination to publish.')
  }

  const targets: PublishTarget[] = []
  const article = publishArticle(draft)
  for (const destination of selected) {
    const comment = effectiveDestinationComment(
      draft.commonComment,
      destination,
    )
    const target = createNewPublishTarget(destination, comment)
    if (destinationHasSucceeded(draft.delivery, destination.destination)) {
      continue
    }

    if (!isConfigured(destination.destination, metadata)) {
      return err(destinationError(destination.destination))
    }

    if (destination.destination === 'raindrop') {
      const collections = metadata.destinations.raindrop.collections
      if (
        !isRaindropCollectionAvailable(
          destination.options.collectionId,
          collections,
        )
      ) {
        return err(
          collections === undefined
            ? 'Raindrop collection details are unavailable. Retry destination details or choose Unsorted. The saved collection ID was kept.'
            : 'Choose an available Raindrop collection. The saved collection ID was kept.',
        )
      }
    }

    if (
      typeof crypto === 'undefined' ||
      typeof crypto.randomUUID !== 'function'
    ) {
      return err('This browser cannot create a safe publishing operation.')
    }

    const operationId = crypto.randomUUID()
    targets.push({ ...target, operationId })
  }

  if (targets.length === 0) {
    return err('All selected destinations already have a successful delivery.')
  }

  return parsePlan(article, targets)
}

export function appendPendingDeliverySnapshots(
  draft: BookmarkDraft,
  plan: ComposeDeliveryPlan,
): BookmarkDraft {
  return {
    ...draft,
    delivery: [...draft.delivery, ...plan.snapshots],
    updatedAt: new Date().toISOString(),
  }
}

export function applyDeliveryResults(
  draft: BookmarkDraft,
  request: PublishRequest,
  results: readonly DeliveryResult[],
): BookmarkDraft {
  const requestKeys = new Set(request.targets.map(operationKey))
  const resultsByKey = new Map<string, DeliveryResult[]>()
  for (const result of results) {
    const key = operationKey(result)
    if (!requestKeys.has(key)) continue
    resultsByKey.set(key, [...(resultsByKey.get(key) ?? []), result])
  }

  return {
    ...draft,
    delivery: draft.delivery.map((snapshot) => {
      const key = operationKey(snapshot.target)
      if (!requestKeys.has(key)) return snapshot
      const matches = resultsByKey.get(key) ?? []
      return {
        article: snapshot.article,
        target: snapshot.target,
        result:
          matches.length === 1
            ? matches[0]
            : unconfirmedDeliveryResult(snapshot.target),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}
