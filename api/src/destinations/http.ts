import type {
  DeliveryResult,
  DestinationMetadataError,
  PublishTarget,
} from 'api/contracts'

import type {
  MetadataAdapterError,
  PublishAdapterError,
} from '#destinations/types'

const publishErrorMessages = {
  not_configured: 'This destination is not configured.',
  rejected: 'The destination rejected this article.',
  unauthorized: 'The destination requires authorization.',
  rate_limited: 'The destination is rate limited.',
  unavailable:
    'The destination is temporarily unavailable. Check whether the item reached the destination before publishing again.',
  invalid_response:
    'The destination returned an invalid response. Check whether the item reached the destination before publishing again.',
} satisfies Record<PublishAdapterError['code'], string>

const metadataErrorMessages = {
  unavailable: 'Destination metadata is unavailable.',
  unauthorized: 'The destination requires authorization.',
  rate_limited: 'The destination is rate limited.',
  invalid_response: 'The destination returned invalid metadata.',
} satisfies Record<DestinationMetadataError['code'], string>

export const adapterErrorToDeliveryResult = (
  target: PublishTarget,
  error: PublishAdapterError,
): DeliveryResult => {
  return {
    destination: target.destination,
    operationId: target.operationId,
    status: 'failed',
    retryable: error.retryable,
    message: publishErrorMessages[error.code],
  }
}

export const invalidAdapterResult = (
  target: PublishTarget,
): DeliveryResult => ({
  destination: target.destination,
  operationId: target.operationId,
  status: 'failed',
  retryable: false,
  message:
    'The delivery result could not be confirmed. Check whether the item reached the destination before publishing again.',
})

export const metadataAdapterError = (
  error: MetadataAdapterError,
): DestinationMetadataError => ({
  code: error.code,
  message: metadataErrorMessages[error.code],
})
