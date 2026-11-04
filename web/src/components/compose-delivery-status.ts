import type { BookmarkDraft } from 'api/contracts'

import type { ComposeDeliveryState } from '#features/editor/compose-state'

export function deliveryStatus(
  snapshot: BookmarkDraft['delivery'][number],
  deliveryState: ComposeDeliveryState,
): {
  label: string
  details: string[]
} {
  const result = snapshot.result
  if (result === undefined) {
    if (deliveryState === 'saving-pending') {
      return {
        label: 'saving attempt',
        details: ['The attempt must be saved before contacting the service.'],
      }
    }
    if (deliveryState === 'sending') {
      return { label: 'posting…', details: [] }
    }
    if (deliveryState === 'saving-results') {
      return {
        label: 'saving result',
        details: ['The result must be saved before it is shown.'],
      }
    }
    if (deliveryState === 'result-save-failed') {
      return {
        label: 'result not saved',
        details: ['The response is held in memory. Save it before continuing.'],
      }
    }
    return {
      label: 'not recorded',
      details: [
        'Check whether the item reached the destination before posting again.',
      ],
    }
  }
  if (result.status === 'succeeded') {
    return {
      label: 'posted',
      details: result.message === undefined ? [] : [result.message],
    }
  }
  return {
    label: 'failed',
    details: [
      ...(result.message === undefined ? [] : [result.message]),
      ...(result.retryable
        ? ['The draft is kept, so it is safe to retry.']
        : []),
    ],
  }
}
