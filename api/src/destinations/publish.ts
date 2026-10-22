import { createHash } from 'node:crypto'

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import type {
  DeliveryResult,
  PublishArticle,
  PublishTarget,
} from 'api/contracts'
import { DeliveryResultSchema } from 'api/contracts'
import { errAsync, ResultAsync } from 'neverthrow'

import {
  adapterErrorToDeliveryResult,
  invalidAdapterResult,
} from '#destinations/http'
import type {
  DestinationRegistry,
  PublishAdapterError,
} from '#destinations/types'

type InflightPublishError = {
  code: 'operation_conflict' | 'capacity_exceeded'
}

type PublishOperation = {
  target: PublishTarget
  payloadHash: string
  execute: () => ResultAsync<DeliveryResult, PublishAdapterError>
}

type InflightEntry = {
  payloadHash: string
  promise: Promise<DeliveryResult>
  resolve: (result: DeliveryResult) => void
  settlement?: Promise<void>
}

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))

    return `{${entries
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

const hashPublishPayload = (
  article: PublishArticle,
  target: PublishTarget,
): string =>
  createHash('sha256')
    .update(
      canonicalJson({
        article,
        target: {
          destination: target.destination,
          comment: target.comment,
          options: target.options,
        },
      }),
    )
    .digest('hex')

const operationKey = (operationId: string) => operationId.toLowerCase()

const operationConflict = (): InflightPublishError => ({
  code: 'operation_conflict',
})

const capacityExceeded = (): InflightPublishError => ({
  code: 'capacity_exceeded',
})

export class InflightPublishGuard {
  private readonly inflight = new Map<string, InflightEntry>()

  constructor(private readonly capacity = 100) {}

  publish(
    operations: readonly PublishOperation[],
  ): ResultAsync<DeliveryResult[], InflightPublishError> {
    const uniqueOperations = new Map<string, PublishOperation>()

    for (const operation of operations) {
      const key = operationKey(operation.target.operationId)
      const duplicate = uniqueOperations.get(key)
      const inflight = this.inflight.get(key)

      if (
        (duplicate && duplicate.payloadHash !== operation.payloadHash) ||
        (inflight && inflight.payloadHash !== operation.payloadHash)
      ) {
        return errAsync(operationConflict())
      }

      uniqueOperations.set(key, operation)
    }

    const newOperationCount = [...uniqueOperations.keys()].filter(
      (key) => !this.inflight.has(key),
    ).length

    if (this.inflight.size + newOperationCount > this.capacity) {
      return errAsync(capacityExceeded())
    }

    const newEntries: Array<{
      operation: PublishOperation
      entry: InflightEntry
    }> = []

    for (const [key, operation] of uniqueOperations) {
      if (this.inflight.has(key)) {
        continue
      }

      let resolve: (result: DeliveryResult) => void = () => {}
      const promise = new Promise<DeliveryResult>((resolvePromise) => {
        resolve = resolvePromise
      })
      const entry: InflightEntry = {
        payloadHash: operation.payloadHash,
        promise,
        resolve,
      }

      this.inflight.set(key, entry)
      newEntries.push({ operation, entry })
    }

    for (const { operation, entry } of newEntries) {
      const settle = ResultAsync.fromPromise(
        Promise.resolve().then(() =>
          operation.execute().match(
            (result) => {
              const parsed = DeliveryResultSchema.safeParse(result)
              if (
                !parsed.success ||
                parsed.data.destination !== operation.target.destination ||
                parsed.data.operationId.toLowerCase() !==
                  operation.target.operationId.toLowerCase()
              ) {
                return invalidAdapterResult(operation.target)
              }

              return {
                ...parsed.data,
                operationId: operation.target.operationId,
              }
            },
            (error) => adapterErrorToDeliveryResult(operation.target, error),
          ),
        ),
        (error) => {
          captureWithFingerprint(error, 'publish-adapter-unexpected-error', {
            tags: { destination: operation.target.destination },
          })
          return invalidAdapterResult(operation.target)
        },
      )

      entry.settlement = settle.match(
        (result) => {
          this.complete(operation, entry, result)
        },
        (result) => {
          this.complete(operation, entry, result)
        },
      )
    }

    return ResultAsync.fromSafePromise(
      Promise.all(
        operations.map((operation) => {
          const entry = this.inflight.get(
            operationKey(operation.target.operationId),
          )
          const resultPromise =
            entry?.promise ??
            Promise.resolve(invalidAdapterResult(operation.target))

          return resultPromise.then((result) => ({
            ...result,
            operationId: operation.target.operationId,
          }))
        }),
      ),
    )
  }

  private complete(
    operation: PublishOperation,
    entry: InflightEntry,
    result: DeliveryResult,
  ): void {
    entry.resolve(result)
    const key = operationKey(operation.target.operationId)
    if (this.inflight.get(key) === entry) {
      this.inflight.delete(key)
    }
  }
}

const adapterPublish = (
  registry: DestinationRegistry,
  article: PublishArticle,
  target: PublishTarget,
): ResultAsync<DeliveryResult, PublishAdapterError> => {
  switch (target.destination) {
    case 'hatena':
      return registry.hatena.publish({ article, target })
    case 'mastodon':
      return registry.mastodon.publish({ article, target })
    case 'raindrop':
      return registry.raindrop.publish({ article, target })
  }
}

export const createPublishOperations = (
  registry: DestinationRegistry,
  article: PublishArticle,
  targets: readonly PublishTarget[],
): PublishOperation[] =>
  targets.map((target) => ({
    target,
    payloadHash: hashPublishPayload(article, target),
    execute: () => adapterPublish(registry, article, target),
  }))
