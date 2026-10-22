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

type QueryEntry = { raw: string; key: string | undefined; value: string }
type QueryRead = { entries: QueryEntry[]; hasInvalidKeyEncoding: boolean }

type ShareFragmentRead =
  | { type: 'absent' }
  | { type: 'malformed' }
  | { type: 'found'; rawValue: string; segment: string }

const invalid = (): ShareLocation => ({
  type: 'invalid',
  message:
    'This shared link is invalid or too large. Copy the article URL and try again.',
})

const queryPart = (value: string) => decodeComponent(value.replaceAll('+', ' '))

const readQueryEntries = (search: string): QueryRead => {
  const rawSearch = search.startsWith('?') ? search.slice(1) : search
  const entries: QueryEntry[] = []
  let hasInvalidKeyEncoding = false

  for (const raw of rawSearch.split('&')) {
    if (raw === '') continue

    const separator = raw.indexOf('=')
    const rawKey = separator < 0 ? raw : raw.slice(0, separator)
    const key = queryPart(rawKey)
    if (key.isErr()) hasInvalidKeyEncoding = true

    entries.push({
      raw,
      key: key.match(
        (value) => value,
        () => undefined,
      ),
      value: separator < 0 ? '' : raw.slice(separator + 1),
    })
  }

  return { entries, hasInvalidKeyEncoding }
}

const readShareFragment = (hash: string): ShareFragmentRead => {
  const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
  let found: ShareFragmentRead | undefined

  for (const segment of rawHash.split('&')) {
    if (segment === '') continue

    const separator = segment.indexOf('=')
    const rawKey = separator < 0 ? segment : segment.slice(0, separator)
    const key = decodeComponent(rawKey)

    if (key.isErr()) {
      if (rawKey.startsWith('share')) return { type: 'malformed' }
      continue
    }
    if (key.value !== 'share') continue
    if (separator < 0 || found !== undefined) return { type: 'malformed' }

    found = {
      type: 'found',
      rawValue: segment.slice(separator + 1),
      segment,
    }
  }

  return found ?? { type: 'absent' }
}

const createCleanupUrl = (
  pathname: string,
  hash: string,
  queryEntries: QueryEntry[],
  shareFragment: ShareFragmentRead,
) => {
  const cleanedQuery = queryEntries
    .filter((entry) => entry.key !== 'url' && entry.key !== 'draft')
    .map((entry) => entry.raw)
    .join('&')

  let cleanedHash = hash

  if (shareFragment.type === 'found') {
    const rawHash = hash.startsWith('#') ? hash.slice(1) : hash
    const cleanSegments = rawHash
      .split('&')
      .filter((segment) => segment !== '' && segment !== shareFragment.segment)
    cleanedHash =
      cleanSegments.length === 0 ? '' : `#${cleanSegments.join('&')}`
  }

  const hasQuery = cleanedQuery !== ''
  return `${pathname}${hasQuery ? `?${cleanedQuery}` : ''}${cleanedHash}`
}

export const parseShareLocation = (
  pathname: string,
  search: string,
  hash: string,
): ShareLocation => {
  const shareFragment = readShareFragment(hash)
  if (shareFragment.type === 'malformed') return invalid()

  const query = readQueryEntries(search)
  const hasUrlQuery = query.entries.some((entry) => entry.key === 'url')
  if (shareFragment.type === 'absent' && !hasUrlQuery) return { type: 'none' }
  if (query.hasInvalidKeyEncoding) return invalid()

  const urlEntries = query.entries.filter((entry) => entry.key === 'url')
  if (urlEntries.length > 1) return invalid()

  const queryUrlResult =
    urlEntries.length === 0 ? undefined : queryPart(urlEntries[0]?.value ?? '')
  if (queryUrlResult !== undefined && queryUrlResult.isErr()) return invalid()

  const queryUrl = queryUrlResult?.match(
    (value) => value,
    () => undefined,
  )

  let input: ShareInput

  if (shareFragment.type === 'found') {
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
    cleanupUrl: createCleanupUrl(pathname, hash, query.entries, shareFragment),
  }
}
