import type { IncomingHttpHeaders } from 'node:http'
import type { LookupFunction } from 'node:net'

import type { ResultAsync } from 'neverthrow'

import type { ArticleExtractionError } from '#articles/errors'
import type { Article, ShareInput } from '#contracts/index'

export const ARTICLE_TEXT_LIMIT = 100_000
export const HTML_RESPONSE_LIMIT = 2 * 1024 * 1024
export const ARTICLE_FETCH_TIMEOUT_MS = 10_000
export const ARTICLE_REDIRECT_LIMIT = 5
export const READABILITY_ELEMENT_LIMIT = 50_000

export type ResolvedAddress = {
  address: string
  family: 4 | 6
}

export type ArticleDnsResolver = {
  resolve4: (hostname: string) => Promise<string[]>
  resolve6: (hostname: string) => Promise<string[]>
  cancel: () => void
}

export type ArticleRequestOptions = {
  protocol: 'http:' | 'https:'
  hostname: string
  port: number
  path: string
  method: 'GET'
  headers: Record<string, string>
  agent: false
  signal: AbortSignal
  servername?: string
  lookup: LookupFunction
}

export type ArticleHttpResponse = {
  statusCode: number | undefined
  headers: IncomingHttpHeaders
  body: AsyncIterable<Uint8Array>
  isComplete?: () => boolean
  destroy: () => void
}

export type ArticleHttpRequest = (
  options: ArticleRequestOptions,
) => Promise<ArticleHttpResponse>

export type ArticleExtractorOptions = {
  createResolver?: () => ArticleDnsResolver
  request?: ArticleHttpRequest
  timeoutMs?: number
  maximumHtmlBytes?: number
}

export type ArticleExtractor = (
  input: ShareInput,
  signal: AbortSignal,
) => ResultAsync<Article, ArticleExtractionError>
