import type { BookmarkDraft } from 'api/contracts'

import type { ComposeDeliveryState } from '#features/editor/compose-state'

export function deliveryStatus(
  snapshot: BookmarkDraft['delivery'][number],
  deliveryState: ComposeDeliveryState,
  destinationHasSucceeded: boolean,
): {
  label: string
  details: string[]
} {
  const result = snapshot.result
  if (result === undefined) {
    if (deliveryState === 'saving-pending') {
      return {
        label: 'Saving attempt',
        details: ['The attempt must be saved before contacting the service.'],
      }
    }
    if (deliveryState === 'sending') {
      return {
        label: 'Sending',
        details: ['The outcome has not been recorded yet.'],
      }
    }
    if (deliveryState === 'saving-results') {
      return {
        label: 'Saving result',
        details: ['The result must be saved before it is shown.'],
      }
    }
    if (deliveryState === 'result-save-failed') {
      return {
        label: 'Result not saved',
        details: ['The response is held in memory. Save it before continuing.'],
      }
    }
    return {
      label: 'Outcome not recorded',
      details: [
        'Check whether the item reached the destination before publishing again.',
      ],
    }
  }
  if (result.status === 'succeeded') {
    return {
      label: 'Succeeded',
      details: result.message === undefined ? [] : [result.message],
    }
  }
  return {
    label: 'Failed',
    details: [
      ...(result.message === undefined ? [] : [result.message]),
      ...(destinationHasSucceeded
        ? []
        : ['You can publish to this destination again.']),
    ],
  }
}
