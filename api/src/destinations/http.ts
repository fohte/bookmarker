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
  unavailable: 'The destination is temporarily unavailable.',
  invalid_response: 'The destination returned an invalid response.',
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
  if (error.outcome === 'unknown') {
    return {
      destination: target.destination,
      operationId: target.operationId,
      status: 'unknown',
      retryable: false,
      message: 'Delivery could not be confirmed.',
    }
  }

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
  status: 'unknown',
  retryable: false,
  message: 'Delivery could not be confirmed.',
})

export const metadataAdapterError = (
  error: MetadataAdapterError,
): DestinationMetadataError => ({
  code: error.code,
  message: metadataErrorMessages[error.code],
})
