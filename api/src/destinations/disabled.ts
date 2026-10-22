import type { PublishDestinationId } from 'api/contracts'
import { errAsync, okAsync } from 'neverthrow'

import type { DestinationAdapter } from '#destinations/types'

export const createDisabledAdapter = <D extends PublishDestinationId>(
  destination: D,
): DestinationAdapter<D> => ({
  destination,
  configured: false,
  getMetadata: () => okAsync({ configured: false }),
  publish: () =>
    errAsync({
      code: 'not_configured',
      outcome: 'failed',
      retryable: false,
    }),
})
