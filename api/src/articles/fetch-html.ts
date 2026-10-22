import {
  type IncomingMessage,
  request as httpRequest,
  type RequestOptions,
} from 'node:http'
import {
  request as httpsRequest,
  type RequestOptions as HttpsRequestOptions,
} from 'node:https'

import ipaddr from 'ipaddr.js'
import { err, errAsync, ok, Result, ResultAsync } from 'neverthrow'

import {
  ARTICLE_FETCH_FAILED,
  ARTICLE_UNSAFE_URL,
  type ArticleExtractionError,
} from '#articles/errors'
import {
  ARTICLE_REDIRECT_LIMIT,
  type ArticleDnsResolver,
  type ArticleHttpRequest,
  type ArticleHttpResponse,
  type ArticleRequestOptions,
} from '#articles/types'
import {
  createPinnedLookup,
  hostnameFor,
  resolvePublicAddress,
  validateArticleUrl,
} from '#articles/url-policy'

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308])

export type DownloadedHtml = {
  bytes: Buffer
  contentType: string
  finalUrl: URL
}

const getHeader = (
  response: ArticleHttpResponse,
  name: string,
): string | undefined => {
  const value = response.headers[name]
  return typeof value === 'string' ? value : undefined
}

const createRequestOptions = (
  url: URL,
  address: { address: string; family: 4 | 6 },
  signal: AbortSignal,
): Result<ArticleRequestOptions, ArticleExtractionError> => {
  const hostname = hostnameFor(url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return err(ARTICLE_UNSAFE_URL)
  }

  const options: ArticleRequestOptions = {
    protocol: url.protocol,
    hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    path: `${url.pathname}${url.search}`,
    method: 'GET',
    headers: {
      'user-agent': 'bookmarker-article-extractor/1.0',
      accept: 'text/html, application/xhtml+xml',
      'accept-encoding': 'identity',
    },
    agent: false,
    signal,
    lookup: createPinnedLookup(address),
  }

  if (url.protocol === 'https:' && !ipaddr.isValid(hostname)) {
    options.servername = hostname
  }

  return ok(options)
}

export const nodeArticleRequest: ArticleHttpRequest = (options) =>
  new Promise((resolve, reject) => {
    const onResponse = (response: IncomingMessage): void => {
      resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        body: response,
        isComplete: () => response.complete,
        destroy: () => response.destroy(),
      })
    }

    const request =
      options.protocol === 'https:'
        ? httpsRequest(options as HttpsRequestOptions, onResponse)
        : httpRequest(options as RequestOptions, onResponse)

    request.once('error', reject)
    request.end()
  })

const collectBody = (
  response: ArticleHttpResponse,
  maximumBytes: number,
): ResultAsync<Buffer, ArticleExtractionError> => {
  const contentLength = getHeader(response, 'content-length')
  if (contentLength !== undefined) {
    if (!/^\d+$/.test(contentLength)) return errAsync(ARTICLE_FETCH_FAILED)
    if (Number(contentLength) > maximumBytes) {
      response.destroy()
      return errAsync(ARTICLE_FETCH_FAILED)
    }
  }

  const read = async () => {
    const chunks: Buffer[] = []
    let byteLength = 0

    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk)
      byteLength += bytes.byteLength
      if (byteLength > maximumBytes) {
        response.destroy()
        return err(ARTICLE_FETCH_FAILED)
      }
      chunks.push(bytes)
    }

    if (response.isComplete?.() === false) return err(ARTICLE_FETCH_FAILED)
    return ok(Buffer.concat(chunks, byteLength))
  }

  return ResultAsync.fromPromise(read(), () => ARTICLE_FETCH_FAILED).andThen(
    (result) => result,
  )
}

const readHtmlResponse = (
  response: ArticleHttpResponse,
  url: URL,
  maximumBytes: number,
): ResultAsync<DownloadedHtml, ArticleExtractionError> => {
  if (response.statusCode !== 200) {
    response.destroy()
    return errAsync(ARTICLE_FETCH_FAILED)
  }

  const contentEncoding = getHeader(response, 'content-encoding')
  if (
    contentEncoding !== undefined &&
    contentEncoding.trim().toLowerCase() !== 'identity'
  ) {
    response.destroy()
    return errAsync(ARTICLE_FETCH_FAILED)
  }

  const contentType = getHeader(response, 'content-type')
  if (contentType === undefined) {
    response.destroy()
    return errAsync(ARTICLE_FETCH_FAILED)
  }

  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'text/html' && mediaType !== 'application/xhtml+xml') {
    response.destroy()
    return errAsync(ARTICLE_FETCH_FAILED)
  }

  return collectBody(response, maximumBytes).map((bytes) => ({
    bytes,
    contentType,
    finalUrl: url,
  }))
}

const fetchRedirect = (
  url: URL,
  redirectsRemaining: number,
  resolver: ArticleDnsResolver,
  request: ArticleHttpRequest,
  signal: AbortSignal,
  maximumBytes: number,
): ResultAsync<DownloadedHtml, ArticleExtractionError> => {
  if (signal.aborted) return errAsync(ARTICLE_FETCH_FAILED)

  const validUrl = validateArticleUrl(url.href)
  if (validUrl.isErr()) return errAsync(validUrl.error)

  return resolvePublicAddress(validUrl.value, resolver).andThen((address) => {
    const options = createRequestOptions(validUrl.value, address, signal)
    if (options.isErr()) return errAsync(options.error)

    return ResultAsync.fromPromise(
      Promise.resolve().then(() => request(options.value)),
      () => ARTICLE_FETCH_FAILED,
    ).andThen((response) => {
      const statusCode = response.statusCode
      if (statusCode === undefined || !REDIRECT_STATUS_CODES.has(statusCode)) {
        return readHtmlResponse(response, validUrl.value, maximumBytes)
      }

      const location = getHeader(response, 'location')
      response.destroy()
      if (
        redirectsRemaining === 0 ||
        location === undefined ||
        location === ''
      ) {
        return errAsync(ARTICLE_FETCH_FAILED)
      }

      const nextUrl = Result.fromThrowable(
        (value: string) => new URL(value, validUrl.value),
        () => ARTICLE_UNSAFE_URL,
      )(location)
      if (nextUrl.isErr()) return errAsync(nextUrl.error)

      return fetchRedirect(
        nextUrl.value,
        redirectsRemaining - 1,
        resolver,
        request,
        signal,
        maximumBytes,
      )
    })
  })
}

export const fetchArticleHtml = (
  url: URL,
  resolver: ArticleDnsResolver,
  request: ArticleHttpRequest,
  signal: AbortSignal,
  maximumBytes: number,
) =>
  fetchRedirect(
    url,
    ARTICLE_REDIRECT_LIMIT,
    resolver,
    request,
    signal,
    maximumBytes,
  )
