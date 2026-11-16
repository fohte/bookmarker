import type { Logger } from '@fohte/service-kit/logger'
import { captureWithFingerprint } from '@fohte/service-kit/observability'

import type { AnalysisFailure } from '#analysis/types'
import { logger as defaultLogger } from '#logger'

export type AnalysisEndpoint = '/api/analysis/summary' | '/api/analysis/verify'

export type AnalysisFailureReporterOptions = {
  logger?: Pick<Logger, 'error'>
  capture?: typeof captureWithFingerprint
}

export const reportAnalysisFailure = (
  endpoint: AnalysisEndpoint,
  failure: AnalysisFailure,
  options: AnalysisFailureReporterOptions = {},
): void => {
  if (
    failure.kind !== 'invalid-response' &&
    failure.kind !== 'upstream-failure' &&
    failure.kind !== 'timeout'
  ) {
    return
  }

  const { logger = defaultLogger, capture = captureWithFingerprint } = options
  const details = 'details' in failure ? (failure.details ?? {}) : {}
  const fields = {
    endpoint,
    kind: failure.kind,
    reason: failure.reason,
    ...(Object.keys(details).length === 0 ? {} : { details }),
  }
  const message = `Analysis failed: ${failure.kind} (${failure.reason})`

  logger.error(fields, message)
  capture(
    new Error(message),
    ['analysis-failure', failure.kind, failure.reason],
    {
      level: 'error',
      tags: {
        endpoint,
        kind: failure.kind,
        reason: failure.reason,
      },
      extras: details,
    },
  )
}
