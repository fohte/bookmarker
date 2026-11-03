import type {
  BookmarkDraft,
  DestinationMetadata,
  PublishRequest,
} from 'api/contracts'
import { type Result, ResultAsync } from 'neverthrow'

import type { DraftError } from '#features/drafts/draft-error'
import {
  appendPendingDeliverySnapshots,
  applyDeliveryResults,
  type ComposeDeliveryPlan,
  createNewDeliveryPlan,
} from '#features/editor/compose-delivery-command'
import type { ComposeState } from '#features/editor/compose-state'
import { publishTargets } from '#features/publish/index'
import { unconfirmedDeliveryResult } from '#features/publish/unconfirmed-delivery'

type DeliveryResponse = Awaited<ReturnType<typeof publishTargets>>
type DeliveryStatePatch = Partial<
  Pick<
    ComposeState,
    'deliveryState' | 'deliveryErrorMessage' | 'deliveryAuthenticationRequired'
  >
>
type ComposeDeliveryPort = {
  canOperate: () => boolean
  getDraft: () => BookmarkDraft | null
  flushQueue: () => Promise<Result<void, DraftError>>
  retryQueue: () => Promise<Result<void, DraftError>>
  stageDraft: (draft: BookmarkDraft) => boolean
  enqueueSnapshot: (draft: BookmarkDraft) => boolean
  restoreDraft: (draft: BookmarkDraft) => void
  showCommittedDraft: (draft: BookmarkDraft) => void
  setState: (patch: DeliveryStatePatch) => void
}

function failedResponse(request: PublishRequest): DeliveryResponse {
  return {
    results: request.targets.map(unconfirmedDeliveryResult),
  }
}

export class ComposeDeliveryCoordinator {
  #busy = false
  #operation: Promise<void> | null = null
  #pendingResult: BookmarkDraft | null = null
  #pendingAuthenticationRequired = false

  constructor(private readonly port: ComposeDeliveryPort) {}

  get isBusy(): boolean {
    return this.#busy
  }

  get hasPendingResult(): boolean {
    return this.#pendingResult !== null
  }

  waitForOperation(): Promise<void> {
    return this.#operation ?? Promise.resolve()
  }

  publishSelectedDestinations(metadata: DestinationMetadata): Promise<void> {
    if (this.#busy || !this.port.canOperate()) return Promise.resolve()
    const draft = this.port.getDraft()
    if (draft === null) return Promise.resolve()

    const plan = createNewDeliveryPlan(draft, metadata)
    if (plan.isErr()) {
      this.port.setState({
        deliveryState: 'idle',
        deliveryErrorMessage: plan.error,
      })
      return Promise.resolve()
    }

    return this.#start(() => this.#publishNewDraft(draft, plan.value))
  }

  retryDeliverySave(): Promise<void> {
    if (
      !this.#busy ||
      this.#pendingResult === null ||
      this.#operation !== null
    ) {
      return Promise.resolve()
    }

    return this.#start(() => this.#retryPendingResult())
  }

  async #publishNewDraft(
    draft: BookmarkDraft,
    plan: ComposeDeliveryPlan,
  ): Promise<void> {
    this.port.setState({
      deliveryState: 'saving-input',
      deliveryErrorMessage: null,
    })
    const latestSave = await this.port.flushQueue()
    if (latestSave.isErr()) {
      this.#finish(
        `Publishing was cancelled because the latest draft could not be saved. ${latestSave.error.message}`,
      )
      return
    }

    const pending = appendPendingDeliverySnapshots(draft, plan)
    await this.#sendPlan(draft, pending, plan)
  }

  async #sendPlan(
    base: BookmarkDraft,
    pending: BookmarkDraft,
    plan: ComposeDeliveryPlan,
  ): Promise<void> {
    if (!this.port.stageDraft(pending)) {
      this.#finish('The active draft changed before publishing could start.')
      return
    }
    this.port.setState({ deliveryState: 'saving-pending' })
    const pendingSave = await this.port.flushQueue()
    if (pendingSave.isErr()) {
      await this.#restoreBeforeSend(base)
      this.#finish(
        `Publishing was cancelled because its pending snapshot could not be saved. No request was sent. ${pendingSave.error.message}`,
      )
      return
    }

    this.port.setState({ deliveryState: 'sending' })
    const response = await this.#publishRequest(plan.request)
    const authenticationRequired = response.authenticationRequired === true
    const outcome = applyDeliveryResults(
      pending,
      plan.request,
      response.results,
    )
    await this.#saveOutcome(outcome, authenticationRequired)
  }

  async #restoreBeforeSend(draft: BookmarkDraft): Promise<void> {
    this.port.restoreDraft(draft)
    if (this.port.enqueueSnapshot(draft)) {
      const rollbackSave = await this.port.flushQueue()
      rollbackSave.match(
        () => undefined,
        () => undefined,
      )
    }
  }

  async #saveOutcome(
    draft: BookmarkDraft,
    authenticationRequired: boolean,
  ): Promise<void> {
    this.#pendingResult = draft
    this.#pendingAuthenticationRequired = authenticationRequired
    this.port.setState({
      deliveryState: 'saving-results',
      deliveryErrorMessage: null,
      deliveryAuthenticationRequired: authenticationRequired,
    })
    if (!this.port.enqueueSnapshot(draft)) {
      this.port.setState({
        deliveryState: 'result-save-failed',
        deliveryErrorMessage:
          'The delivery result is still in memory. Retry saving it before continuing.',
      })
      return
    }

    const resultSave = await this.port.flushQueue()
    if (resultSave.isErr()) {
      this.port.setState({
        deliveryState: 'result-save-failed',
        deliveryErrorMessage:
          'The delivery result could not be saved. Retry saving it; the service will not be contacted again.',
      })
      return
    }

    this.#showCommittedResult()
  }

  async #retryPendingResult(): Promise<void> {
    this.port.setState({ deliveryState: 'saving-results' })
    const resultSave = await this.port.retryQueue()
    if (resultSave.isErr()) {
      this.port.setState({
        deliveryState: 'result-save-failed',
        deliveryErrorMessage:
          'The delivery result could not be saved. Retry saving it; the service will not be contacted again.',
      })
      return
    }

    this.#showCommittedResult()
  }

  #showCommittedResult(): void {
    const pendingResult = this.#pendingResult
    if (pendingResult === null) return

    this.port.showCommittedDraft(pendingResult)
    this.#pendingResult = null
    this.#busy = false
    this.port.setState({
      deliveryState: 'idle',
      deliveryErrorMessage: null,
      deliveryAuthenticationRequired: this.#pendingAuthenticationRequired,
    })
  }

  async #publishRequest(request: PublishRequest): Promise<DeliveryResponse> {
    const response = await ResultAsync.fromPromise(
      publishTargets(request),
      (cause) => {
        console.error('Unexpected publishing client failure.', cause)
        return failedResponse(request)
      },
    )
    return response.match(
      (result) => result,
      (fallback) => fallback,
    )
  }

  #finish(message: string | null): void {
    this.#busy = false
    this.#pendingResult = null
    this.port.setState({
      deliveryState: 'idle',
      deliveryErrorMessage: message,
    })
  }

  #start(operation: () => Promise<void>): Promise<void> {
    this.#busy = true
    const running = operation()
    this.#operation = running
    void running.then(
      () => {
        if (this.#operation === running) this.#operation = null
      },
      () => {
        if (this.#operation === running) this.#operation = null
      },
    )
    return running
  }
}
