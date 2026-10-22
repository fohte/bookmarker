import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { ApiErrorEnvelope } from '#contracts/error'

type ApiError = ApiErrorEnvelope['error']

export const respondWithApiError = (
  context: Context,
  status: ContentfulStatusCode,
  error: ApiError,
) => context.json({ error }, status)
