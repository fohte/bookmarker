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

import {
  effectiveDestinationComment,
  isRaindropCollectionAvailable,
} from '#features/editor/compose-destination'
import { selectRetryTargets } from '#features/publish/index'

export type ComposeDeliveryPlan = {
  request: PublishRequest
  snapshots: BookmarkDraft['delivery']
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

function optionsKey(options: PublishTarget['options']): string {
  return JSON.stringify(
    Object.entries(options).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
}

function hasSamePayload(
  article: PublishArticle,
  target: NewPublishTarget,
  snapshot: BookmarkDraft['delivery'][number],
): boolean {
  return (
    article.url === snapshot.article.url &&
    article.title === snapshot.article.title &&
    target.destination === snapshot.target.destination &&
    target.comment === snapshot.target.comment &&
    optionsKey(target.options) === optionsKey(snapshot.target.options)
  )
}

const isSelectedPublishDestination = (
  destination: BookmarkDraft['destinations'][number],
): destination is Extract<
  BookmarkDraft['destinations'][number],
  { destination: PublishTarget['destination'] }
> => destination.selected && destination.destination !== 'x'

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

    const comment = effectiveDestinationComment(
      draft.commonComment,
      destination,
    )
    const target = createNewPublishTarget(destination, comment)
    const history = draft.delivery.filter(
      (snapshot) => snapshot.target.destination === destination.destination,
    )
    if (
      history.some(
        (snapshot) =>
          snapshot.result === undefined || snapshot.result.status !== 'failed',
      ) ||
      history.some((snapshot) => hasSamePayload(article, target, snapshot))
    ) {
      continue
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
    return err(
      'No selected destination has a new publishable snapshot. Retry eligible failures separately.',
    )
  }

  return parsePlan(article, targets)
}

export function getRetryDeliveryTargets(draft: BookmarkDraft): PublishTarget[] {
  const blockedDestinations = new Set(
    draft.delivery
      .filter(
        (snapshot) =>
          snapshot.result === undefined || snapshot.result.status !== 'failed',
      )
      .map((snapshot) => snapshot.target.destination),
  )
  const retryableHistory = draft.delivery.filter(
    (snapshot) => !blockedDestinations.has(snapshot.target.destination),
  )

  return selectRetryTargets(
    retryableHistory.map((snapshot) => snapshot.target),
    retryableHistory.flatMap((snapshot) =>
      snapshot.result === undefined ? [] : [snapshot.result],
    ),
  )
}

export function createRetryDeliveryPlans(
  draft: BookmarkDraft,
  metadata: DestinationMetadata,
  targets = getRetryDeliveryTargets(draft),
): Result<ComposeDeliveryPlan[], string> {
  const snapshots = targets.flatMap((target) => {
    const matches = draft.delivery.filter(
      (snapshot) => operationKey(snapshot.target) === operationKey(target),
    )
    const [snapshot] = matches
    return matches.length === 1 && snapshot !== undefined ? [snapshot] : []
  })
  const retryableSnapshots = snapshots.filter((snapshot) =>
    isConfigured(snapshot.target.destination, metadata),
  )

  if (retryableSnapshots.length === 0) {
    return err(
      'There are no connected failed destinations that can be retried.',
    )
  }

  const plans: ComposeDeliveryPlan[] = []
  for (const snapshot of retryableSnapshots) {
    const plan = parsePlan(snapshot.article, [snapshot.target])
    if (plan.isErr()) return err(plan.error)
    plans.push(plan.value)
  }

  return ok(plans)
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

export function makeRetryPending(
  draft: BookmarkDraft,
  target: PublishTarget,
): BookmarkDraft {
  const key = operationKey(target)
  return {
    ...draft,
    delivery: draft.delivery.map((snapshot) =>
      operationKey(snapshot.target) === key
        ? { article: snapshot.article, target: snapshot.target }
        : snapshot,
    ),
    updatedAt: new Date().toISOString(),
  }
}

function unknownResult(target: PublishTarget): DeliveryResult {
  return {
    destination: target.destination,
    operationId: target.operationId,
    status: 'unknown',
    retryable: false,
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
          matches.length === 1 ? matches[0] : unknownResult(snapshot.target),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}
