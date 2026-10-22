import { err, ok, type Result } from 'neverthrow'
import { z } from 'zod'

import type { AnalysisConfig, AnalysisFailure } from '#analysis/types'

const HttpUrlSchema = z.url({ protocol: /^https?$/ })

export const readAnalysisConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<AnalysisConfig, AnalysisFailure> => {
  const baseUrl = env['LITELLM_BASE_URL']?.trim()
  const apiKey = env['LITELLM_API_KEY']?.trim()
  const model = env['LITELLM_MODEL']?.trim()

  if (
    baseUrl === undefined ||
    baseUrl.length === 0 ||
    apiKey === undefined ||
    apiKey.length === 0 ||
    model === undefined ||
    model.length === 0
  ) {
    return err({ kind: 'unavailable' })
  }

  const parsedBaseUrl = HttpUrlSchema.safeParse(baseUrl)
  if (!parsedBaseUrl.success) {
    return err({ kind: 'unavailable' })
  }

  const url = new URL(parsedBaseUrl.data)
  if (
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    !/^[\x21-\x7e]+$/u.test(apiKey) ||
    !/^[\x21-\x7e]+$/u.test(model)
  ) {
    return err({ kind: 'unavailable' })
  }

  return ok({
    baseUrl: url.toString().replace(/\/+$/u, ''),
    apiKey,
    model,
  })
}
