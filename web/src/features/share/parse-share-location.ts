import type { ShareInput } from 'api/contracts'
import { ShareInputSchema } from 'api/contracts'
import { Result } from 'neverthrow'

const maxSharedTextCodeUnits = 8_192
const maxShareFragmentBytes = 16_384

const decodeComponent = Result.fromThrowable(
  (value: string) => decodeURIComponent(value),
  () => 'invalid encoding' as const,
)

const parseJson = Result.fromThrowable(
  (value: string) => JSON.parse(value) as unknown,
  () => 'invalid JSON' as const,
)

type ShareLocation =
  | { type: 'none' }
  | { type: 'valid'; input: ShareInput; cleanupUrl: string }
  | { type: 'invalid'; message: string }

type QueryEntry = { raw: string; key: string }

const invalid = (): ShareLocation => ({
  type: 'invalid',
  message:
    'This shared link is invalid or too large. Copy the article URL and try again.',
})

const queryPart = (value: string) => decodeComponent(value.replaceAll('+', ' '))

const readQueryEntries = (search: string): QueryEntry[] | undefined => {
  const rawSearch = search.startsWith('?') ? search.slice(1) : search
  const entries: QueryEntry[] = []

  for (const raw of rawSearch.split('&')) {
    if (raw === '') continue

    const separator = raw.indexOf('=')
    const rawKey = separator < 0 ? raw : raw.slice(0, separator)
    const key = queryPart(rawKey)
    if (key.isErr()) return undefined

    entries.push({ raw, key: key.value })
  }

  return entries
}

const readShareFragment = (
  hash: string,
): { rawValue: string; shareSegment: string } | undefined | null => {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  const segments = rawHash.split('&')
  let rawValue: string | undefined
  let shareSegment: string | undefined

  for (const segment of segments) {
    if (segment === '') continue

    const separator = segment.indexOf('=')
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    const key = decodeComponent(rawKey)

    if (key.isErr()) {
      if (rawKey.startsWith('share')) return null
      continue
    }
    if (key.value !== 'share') continue
    if (separator < 0 || rawValue !== undefined) return null

    rawValue = segment.slice(separator + 1)
    shareSegment = segment
  }

  if (rawValue === undefined || shareSegment === undefined) return undefined

  return { rawValue, shareSegment }
}

const removeShareParameters = (
  pathname: string,
  search: string,
  hash: string,
  queryEntries: QueryEntry[],
  shareFragment: { rawValue: string; shareSegment: string } | undefined,
) => {
  const rawSearch = search.startsWith('?') ? search.slice(1) : search
  const cleanedQuery = rawSearch
    .split('&')
    .filter((raw) => {
      if (raw === '') return false
      const entry = queryEntries.find((candidate) => candidate.raw === raw)
      return entry?.key !== 'url' && entry?.key !== 'draft'
    })
    .join('&')

  let cleanedHash = hash

  if (shareFragment !== undefined) {
    const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
    const cleanSegments = rawHash
      .split('&')
      .filter(
        (segment) => segment !== '' && segment !== shareFragment.shareSegment,
      )
    cleanedHash =
      cleanSegments.length === 0 ? '' : `#${cleanSegments.join('&')}`
  }

  return `${pathname}${cleanedQuery === '' ? '' : `?${cleanedQuery}`}${cleanedHash}`
}

export const parseShareLocation = (
  pathname: string,
  search: string,
  hash: string,
): ShareLocation => {
  const shareFragment = readShareFragment(hash)
  if (shareFragment === null) return invalid()

  const urlSearchParams = new URLSearchParams(search)
  const hasUrlQuery = urlSearchParams.has('url')
  if (shareFragment === undefined && !hasUrlQuery) return { type: 'none' }

  const queryEntries = readQueryEntries(search)
  if (queryEntries === undefined) return invalid()

  const rawUrlValues = queryEntries
    .filter((entry) => entry.key === 'url')
    .map((entry) => {
      const separator = entry.raw.indexOf('=')
      return separator < 0 ? '' : entry.raw.slice(separator + 1)
    })

  if (rawUrlValues.length !== urlSearchParams.getAll('url').length)
    return invalid()
  if (rawUrlValues.length > 1) return invalid()

  const queryUrlResult =
    rawUrlValues.length === 0 ? undefined : queryPart(rawUrlValues[0] ?? '')
  if (queryUrlResult !== undefined && queryUrlResult.isErr()) return invalid()
  const queryUrl = queryUrlResult?.match(
    (value) => value,
    () => undefined,
  )

  let input: ShareInput

  if (shareFragment !== undefined) {
    if (new TextEncoder().encode(hash).length > maxShareFragmentBytes) {
      return invalid()
    }

    const decoded = decodeComponent(shareFragment.rawValue)
    if (decoded.isErr()) return invalid()

    const json = parseJson(decoded.value)
    if (json.isErr()) return invalid()

    const parsed = ShareInputSchema.safeParse(json.value)
    if (!parsed.success) return invalid()
    if ((parsed.data.sharedText?.length ?? 0) > maxSharedTextCodeUnits) {
      return invalid()
    }
    if (queryUrl !== undefined && queryUrl !== parsed.data.url) return invalid()

    input = parsed.data
  } else {
    const parsed = ShareInputSchema.safeParse({
      version: 1,
      url: queryUrl,
      partial: false,
    })
    if (!parsed.success) return invalid()
    input = parsed.data
  }

  return {
    type: 'valid',
    input,
    cleanupUrl: removeShareParameters(
      pathname,
      search,
      hash,
      queryEntries,
      shareFragment,
    ),
  }
}
