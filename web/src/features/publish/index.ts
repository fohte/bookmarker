import type {
  DeliveryResult,
  DestinationMetadata,
  PublishRequest,
  PublishTarget,
} from 'api/contracts'
import {
  ApiErrorEnvelopeSchema,
  DeliveryResultSchema,
  DestinationMetadataSchema,
} from 'api/contracts'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

type PublishClientError = {
  code: 'authentication_required' | 'unavailable' | 'invalid_response'
  message: string
  authenticationRequired?: true
}

type PublishTargetsResult = {
  results: DeliveryResult[]
  authenticationRequired?: boolean
}

const networkError: PublishClientError = {
  code: 'unavailable',
  message: 'The request could not reach the server.',
}

const invalidResponseError: PublishClientError = {
  code: 'invalid_response',
  message: 'The server returned an invalid response.',
}

const authenticationError: PublishClientError = {
  code: 'authentication_required',
  message: 'Authentication is required to use publishing.',
  authenticationRequired: true,
}

const apiErrorCode = (value: unknown): string | undefined => {
  const parsed = ApiErrorEnvelopeSchema.safeParse(value)
  return parsed.success ? parsed.data.error.code : undefined
}

const isAccessLoginResponse = (response: Response): boolean => {
  const accessChallenge =
    response.headers
      .get('www-authenticate')
      ?.includes('.well-known/cloudflare-access-protected-resource/') ?? false
  const accessLoginRedirect =
    response.redirected &&
    /^https:\/\/[^/]+\.cloudflareaccess\.com\/cdn-cgi\/access\/login\//i.test(
      response.url,
    )

  return accessChallenge || accessLoginRedirect
}

const hasAuthenticationEvidence = (
  response: Response,
  body: unknown,
): boolean => {
  if (isAccessLoginResponse(response)) {
    return true
  }

  const code = apiErrorCode(body)
  return (
    (response.status === 401 && code !== undefined) ||
    (response.status === 403 &&
      (code === 'authentication_required' || code === 'unauthorized'))
  )
}

const resultAsync = <T>(value: T): ResultAsync<T, PublishClientError> =>
  okAsync<T, PublishClientError>(value)

const errorAsync = <T>(
  error: PublishClientError,
): ResultAsync<T, PublishClientError> => errAsync<T, PublishClientError>(error)

export const getDestinations = (): ResultAsync<
  DestinationMetadata,
  PublishClientError
> => {
  const response = ResultAsync.fromThrowable(
    () =>
      fetch('/api/destinations', {
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
      }),
    () => networkError,
  )()

  return response.andThen((value) => {
    if (isAccessLoginResponse(value)) {
      return errorAsync<DestinationMetadata>(authenticationError)
    }

    return ResultAsync.fromThrowable(
      () => value.json() as Promise<unknown>,
      () => invalidResponseError,
    )().andThen((body) => {
      if (hasAuthenticationEvidence(value, body)) {
        return errorAsync<DestinationMetadata>(authenticationError)
      }

      if (!value.ok) {
        return errorAsync<DestinationMetadata>(networkError)
      }

      const parsed = DestinationMetadataSchema.safeParse(body)
      return parsed.success
        ? resultAsync(parsed.data)
        : errorAsync<DestinationMetadata>(invalidResponseError)
    })
  })
}

const unknownResult = (target: PublishTarget): DeliveryResult => ({
  destination: target.destination,
  operationId: target.operationId,
  status: 'unknown',
  retryable: false,
  message: 'Delivery could not be confirmed.',
})

const unknownTargets = (
  request: PublishRequest,
  authenticationRequired = false,
): PublishTargetsResult => ({
  results: request.targets.map(unknownResult),
  ...(authenticationRequired ? { authenticationRequired: true } : {}),
})

const resultKey = (
  result: Pick<DeliveryResult, 'destination' | 'operationId'>,
) => `${result.destination}:${result.operationId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parsePublishResults = (value: unknown): DeliveryResult[] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (Object.keys(value).length !== 1 || !Array.isArray(value['results'])) {
    return undefined
  }

  const results: DeliveryResult[] = []
  for (const result of value['results']) {
    const parsed = DeliveryResultSchema.safeParse(result)
    if (!parsed.success) {
      return undefined
    }

    results.push(parsed.data)
  }

  return results
}

const alignResults = (
  request: PublishRequest,
  results: readonly DeliveryResult[],
): DeliveryResult[] => {
  const requestKeys = new Set(request.targets.map(resultKey))
  if (results.some((result) => !requestKeys.has(resultKey(result)))) {
    return request.targets.map(unknownResult)
  }

  return request.targets.map((target) => {
    const matches = results.filter(
      (result) => resultKey(result) === resultKey(target),
    )

    return matches.length === 1
      ? (matches[0] ?? unknownResult(target))
      : unknownResult(target)
  })
}

export const publishTargets = async (
  request: PublishRequest,
): Promise<PublishTargetsResult> => {
  const response = await ResultAsync.fromThrowable(
    () =>
      fetch('/api/publish', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(request),
      }),
    () => networkError,
  )()

  return response.match(
    async (value) => {
      if (isAccessLoginResponse(value)) {
        return unknownTargets(request, true)
      }

      const body = await ResultAsync.fromThrowable(
        () => value.json() as Promise<unknown>,
        () => invalidResponseError,
      )()

      return body.match(
        (json) => {
          if (hasAuthenticationEvidence(value, json)) {
            return unknownTargets(request, true)
          }

          if (!value.ok) {
            return unknownTargets(request)
          }

          const parsed = parsePublishResults(json)
          return parsed
            ? { results: alignResults(request, parsed) }
            : unknownTargets(request)
        },
        () => unknownTargets(request),
      )
    },
    () => unknownTargets(request),
  )
}

export const selectRetryTargets = (
  snapshotTargets: readonly PublishTarget[],
  results: readonly DeliveryResult[],
): PublishTarget[] => {
  const resultCounts = new Map<
    string,
    { count: number; result?: DeliveryResult }
  >()

  for (const result of results) {
    const key = resultKey(result)
    const current = resultCounts.get(key)
    resultCounts.set(key, {
      count: (current?.count ?? 0) + 1,
      result,
    })
  }

  return snapshotTargets.filter((target) => {
    const result = resultCounts.get(resultKey(target))
    return (
      result?.count === 1 &&
      result.result?.status === 'failed' &&
      result.result.retryable
    )
  })
}

export const createXIntent = ({
  url,
  comment,
}: {
  url: string
  comment: string
}): URL => {
  const intent = new URL('https://x.com/intent/tweet')
  intent.searchParams.set('text', comment)
  intent.searchParams.set('url', url)
  return intent
}
