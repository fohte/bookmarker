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
  createRetryDeliveryPlans,
  makeRetryPending,
} from '#features/editor/compose-delivery-command'
import type { ComposeState } from '#features/editor/compose-state'
import { publishTargets } from '#features/publish/index'

type DeliveryResponse = Awaited<ReturnType<typeof publishTargets>>
type DeliveryStatePatch = Partial<
  Pick<
    ComposeState,
    'deliveryState' | 'deliveryErrorMessage' | 'deliveryAuthenticationRequired'
  >
>
type PlanSendResult = {
  saved: boolean
  authenticationRequired: boolean
}

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

function unknownResponse(request: PublishRequest): DeliveryResponse {
  return {
    results: request.targets.map((target) => ({
      destination: target.destination,
      operationId: target.operationId,
      status: 'unknown',
      retryable: false,
      message: 'Delivery could not be confirmed.',
    })),
  }
}

function updatedSnapshot(draft: BookmarkDraft): BookmarkDraft {
  return structuredClone(draft)
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

  retryFailedDeliveries(metadata: DestinationMetadata): Promise<void> {
    if (this.#busy || !this.port.canOperate()) return Promise.resolve()
    const draft = this.port.getDraft()
    if (draft === null) return Promise.resolve()

    const plans = createRetryDeliveryPlans(draft, metadata)
    if (plans.isErr()) {
      this.port.setState({
        deliveryState: 'idle',
        deliveryErrorMessage: plans.error,
      })
      return Promise.resolve()
    }

    return this.#start(() => this.#retryPlans(plans.value))
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

    const pending = updatedSnapshot(appendPendingDeliverySnapshots(draft, plan))
    await this.#sendPlan(draft, pending, plan, 'Publishing')
  }

  async #sendPlan(
    base: BookmarkDraft,
    pending: BookmarkDraft,
    plan: ComposeDeliveryPlan,
    action: 'Publishing' | 'Retry',
    continueOperation = false,
  ): Promise<PlanSendResult> {
    if (!this.port.stageDraft(pending)) {
      this.#finish('The active draft changed before publishing could start.')
      return { saved: false, authenticationRequired: false }
    }
    this.port.setState({ deliveryState: 'saving-pending' })
    const pendingSave = await this.port.flushQueue()
    if (pendingSave.isErr()) {
      await this.#restoreBeforeSend(base)
      this.#finish(
        `${action} was cancelled because its pending snapshot could not be saved. No request was sent. ${pendingSave.error.message}`,
      )
      return { saved: false, authenticationRequired: false }
    }

    this.port.setState({ deliveryState: 'sending' })
    const response = await this.#publishRequest(plan.request)
    const authenticationRequired = response.authenticationRequired === true
    const outcome = updatedSnapshot(
      applyDeliveryResults(pending, plan.request, response.results),
    )
    const saved = await this.#saveOutcome(
      outcome,
      authenticationRequired,
      continueOperation && !authenticationRequired,
    )
    return { saved, authenticationRequired }
  }

  async #retryPlans(plans: ComposeDeliveryPlan[]): Promise<void> {
    this.port.setState({
      deliveryState: 'saving-input',
      deliveryErrorMessage: null,
    })
    const latestSave = await this.port.flushQueue()
    if (latestSave.isErr()) {
      this.#finish(
        `Retry was cancelled because the latest draft could not be saved. ${latestSave.error.message}`,
      )
      return
    }

    for (const [index, plan] of plans.entries()) {
      const current = this.port.getDraft()
      const target = plan.request.targets[0]
      if (current === null || target === undefined) {
        this.#finish('The active draft changed before retry could start.')
        return
      }

      const pending = updatedSnapshot(makeRetryPending(current, target))
      const result = await this.#sendPlan(
        current,
        pending,
        plan,
        'Retry',
        index < plans.length - 1,
      )
      if (!result.saved || result.authenticationRequired) return
    }
  }

  async #restoreBeforeSend(draft: BookmarkDraft): Promise<void> {
    const snapshot = updatedSnapshot(draft)
    this.port.restoreDraft(snapshot)
    if (this.port.enqueueSnapshot(snapshot)) {
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
    continueOperation = false,
  ): Promise<boolean> {
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
      return false
    }

    const resultSave = await this.port.flushQueue()
    if (resultSave.isErr()) {
      this.port.setState({
        deliveryState: 'result-save-failed',
        deliveryErrorMessage:
          'The delivery result could not be saved. Retry saving it; the service will not be contacted again.',
      })
      return false
    }

    this.#showCommittedResult(continueOperation)
    return true
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

  #showCommittedResult(continueOperation = false): void {
    const pendingResult = this.#pendingResult
    if (pendingResult === null) return

    this.port.showCommittedDraft(pendingResult)
    this.#pendingResult = null
    if (continueOperation) {
      this.port.setState({
        deliveryState: 'saving-input',
        deliveryErrorMessage: null,
        deliveryAuthenticationRequired: this.#pendingAuthenticationRequired,
      })
    } else {
      this.#busy = false
      this.port.setState({
        deliveryState: 'idle',
        deliveryErrorMessage: null,
        deliveryAuthenticationRequired: this.#pendingAuthenticationRequired,
      })
    }
  }

  async #publishRequest(request: PublishRequest): Promise<DeliveryResponse> {
    const response = await ResultAsync.fromPromise(
      publishTargets(request),
      () => unknownResponse(request),
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
