import type { DeliveryResult, PublishTarget } from 'api/contracts'

const unconfirmedDeliveryMessage =
  'The delivery result could not be confirmed. Check whether the item reached the destination before publishing again.'

export const unconfirmedDeliveryResult = (
  target: Pick<PublishTarget, 'destination' | 'operationId'>,
): DeliveryResult => ({
  destination: target.destination,
  operationId: target.operationId,
  status: 'failed',
  retryable: false,
  message: unconfirmedDeliveryMessage,
})
