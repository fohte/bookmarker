import type { BookmarkDraft, PublishDestinationId } from 'api/contracts'

import type { ComposeDeliveryState } from '#features/editor/compose-state'

export const destinationNames: Record<PublishDestinationId, string> = {
  hatena: 'Hatena Bookmark',
  mastodon: 'Mastodon',
  raindrop: 'Raindrop',
}

export function deliveryStatus(
  snapshot: BookmarkDraft['delivery'][number],
  deliveryState: ComposeDeliveryState,
  retryEligible: boolean,
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
        'Check the result directly at the service. This editor cannot resend an unconfirmed attempt.',
      ],
    }
  }
  if (result.status === 'succeeded') {
    return {
      label: 'Succeeded',
      details: result.message === undefined ? [] : [result.message],
    }
  }
  if (result.status === 'unknown') {
    return {
      label: 'Outcome unknown',
      details: [
        ...(result.message === undefined ? [] : [result.message]),
        'Check the result directly at the service. This editor cannot resend an unknown outcome.',
      ],
    }
  }
  return {
    label: 'Failed',
    details: [
      ...(result.message === undefined ? [] : [result.message]),
      result.retryable
        ? retryEligible
          ? 'This failure can be retried when the destination is connected.'
          : 'Another recorded outcome for this destination prevents retrying this failure.'
        : 'This result cannot be retried.',
    ],
  }
}
