import { Resolver } from 'node:dns/promises'
import type { LookupFunction } from 'node:net'

import ipaddr from 'ipaddr.js'
import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'

import {
  ARTICLE_FETCH_FAILED,
  ARTICLE_UNSAFE_URL,
  type ArticleExtractionError,
} from '#articles/errors'
import type { ArticleDnsResolver, ResolvedAddress } from '#articles/types'

const NO_DNS_RECORD = { kind: 'no-dns-record' } as const

const getErrorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined

export const hostnameFor = (url: URL): string =>
  url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1, -1)
    : url.hostname

const isPublicUnicast = (address: string): boolean => {
  const parsedAddress = Result.fromThrowable(ipaddr.parse, () => null)(address)
  if (parsedAddress.isErr()) return false

  const value = parsedAddress.value
  if ('isIPv4MappedAddress' in value && value.isIPv4MappedAddress()) {
    return value.toIPv4Address().range() === 'unicast'
  }
  return value.range() === 'unicast'
}

export const validateArticleUrl = (
  value: string,
): Result<URL, typeof ARTICLE_UNSAFE_URL> => {
  const parsed = Result.fromThrowable(
    (url: string) => new URL(url),
    () => ARTICLE_UNSAFE_URL,
  )(value)
  if (parsed.isErr()) return err(parsed.error)

  const url = parsed.value
  const expectedPort = url.protocol === 'https:' ? '443' : '80'
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    (url.port !== '' && url.port !== expectedPort) ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return err(ARTICLE_UNSAFE_URL)
  }

  const hostname = hostnameFor(url)
  if (ipaddr.isValid(hostname) && !isPublicUnicast(hostname)) {
    return err(ARTICLE_UNSAFE_URL)
  }

  return ok(url)
}

const resolveFamily = (
  resolve: () => Promise<string[]>,
): ResultAsync<string[], ArticleExtractionError> =>
  ResultAsync.fromPromise(
    Promise.resolve().then(resolve),
    (error): ArticleExtractionError | typeof NO_DNS_RECORD =>
      getErrorCode(error) === 'ENODATA' ? NO_DNS_RECORD : ARTICLE_FETCH_FAILED,
  ).orElse((error) =>
    error.kind === 'no-dns-record' ? okAsync([]) : errAsync(error),
  )

export const resolvePublicAddress = (
  url: URL,
  resolver: ArticleDnsResolver,
): ResultAsync<ResolvedAddress, ArticleExtractionError> => {
  const hostname = hostnameFor(url)
  if (ipaddr.isValid(hostname)) {
    if (!isPublicUnicast(hostname)) return errAsync(ARTICLE_UNSAFE_URL)
    return okAsync({
      address: hostname,
      family: hostname.includes(':') ? 6 : 4,
    })
  }

  return resolveFamily(() => resolver.resolve4(hostname)).andThen((ipv4) =>
    resolveFamily(() => resolver.resolve6(hostname)).andThen((ipv6) => {
      const addresses: ResolvedAddress[] = [
        ...ipv4.map((address) => ({ address, family: 4 as const })),
        ...ipv6.map((address) => ({ address, family: 6 as const })),
      ]

      const firstAddress = addresses[0]
      if (firstAddress === undefined) return errAsync(ARTICLE_FETCH_FAILED)
      if (addresses.some(({ address }) => !isPublicUnicast(address))) {
        return errAsync(ARTICLE_UNSAFE_URL)
      }
      return okAsync(firstAddress)
    }),
  )
}

export const createPinnedLookup =
  (address: ResolvedAddress): LookupFunction =>
  (_hostname, options, callback) => {
    callback(
      null,
      options.all === true
        ? [{ address: address.address, family: address.family }]
        : address.address,
      address.family,
    )
  }

export const createDnsResolver = (): ArticleDnsResolver => {
  const resolver = new Resolver()
  return {
    resolve4: (hostname) => resolver.resolve4(hostname),
    resolve6: (hostname) => resolver.resolve6(hostname),
    cancel: () => {
      resolver.cancel()
    },
  }
}
