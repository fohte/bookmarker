import { errAsync, okAsync, Result, ResultAsync } from 'neverthrow'

import {
  ARTICLE_FETCH_FAILED,
  ARTICLE_FETCH_TIMEOUT,
  ARTICLE_INVALID_INPUT,
  type ArticleExtractionError,
} from '#articles/errors'
import { fetchArticleHtml, nodeArticleRequest } from '#articles/fetch-html'
import { createFetchedArticle } from '#articles/parse-html'
import {
  ARTICLE_FETCH_TIMEOUT_MS,
  type ArticleExtractor,
  type ArticleExtractorOptions,
  HTML_RESPONSE_LIMIT,
} from '#articles/types'
import { createDnsResolver, validateArticleUrl } from '#articles/url-policy'
import {
  type Article,
  ArticleSchema,
  type ShareInput,
  ShareInputSchema,
} from '#contracts/index'

const fetchArticle = (
  input: ShareInput,
  url: URL,
  signal: AbortSignal,
  options: ArticleExtractorOptions,
): ResultAsync<Article, ArticleExtractionError> => {
  const resolverFactory = options.createResolver ?? createDnsResolver
  const resolverResult = Result.fromThrowable(
    resolverFactory,
    () => ARTICLE_FETCH_FAILED,
  )()
  if (resolverResult.isErr()) return errAsync(resolverResult.error)

  const resolver = resolverResult.value
  const controller = new AbortController()
  let timedOut = false
  const cancel = (): void => {
    controller.abort()
    resolver.cancel()
  }
  const handleCallerAbort = (): void => {
    cancel()
  }
  const timeout = setTimeout(() => {
    timedOut = true
    cancel()
  }, options.timeoutMs ?? ARTICLE_FETCH_TIMEOUT_MS)
  signal.addEventListener('abort', handleCallerAbort, { once: true })
  if (signal.aborted) handleCallerAbort()

  const finish = (): void => {
    clearTimeout(timeout)
    signal.removeEventListener('abort', handleCallerAbort)
  }

  return fetchArticleHtml(
    url,
    resolver,
    options.request ?? nodeArticleRequest,
    controller.signal,
    options.maximumHtmlBytes ?? HTML_RESPONSE_LIMIT,
  )
    .map((html) => {
      finish()
      return html
    })
    .mapErr((error) => {
      finish()
      return timedOut ? ARTICLE_FETCH_TIMEOUT : error
    })
    .andThen((html) => createFetchedArticle(input, html))
}

const createSharedArticle = (
  input: ShareInput,
): ResultAsync<Article, ArticleExtractionError> => {
  const text = input.sharedText
  if (text === undefined || text.trim().length === 0) {
    return errAsync(ARTICLE_INVALID_INPUT)
  }

  const url = Result.fromThrowable(
    () => new URL(input.url),
    () => ARTICLE_INVALID_INPUT,
  )()
  if (url.isErr()) return errAsync(ARTICLE_INVALID_INPUT)

  const inputTitle = input.title?.trim()
  const article = ArticleSchema.safeParse({
    url: input.url,
    title:
      inputTitle !== undefined && inputTitle.length > 0
        ? inputTitle
        : url.value.hostname,
    text,
    source: 'shared',
    partial: input.partial,
  })

  return article.success
    ? okAsync(article.data)
    : errAsync(ARTICLE_INVALID_INPUT)
}

export const createArticleExtractor =
  (options: ArticleExtractorOptions = {}): ArticleExtractor =>
  (input, signal) => {
    const parsedInput = ShareInputSchema.safeParse(input)
    if (!parsedInput.success) return errAsync(ARTICLE_INVALID_INPUT)

    const shareInput = parsedInput.data
    if (shareInput.sharedText !== undefined)
      return createSharedArticle(shareInput)

    const url = validateArticleUrl(shareInput.url)
    if (url.isErr()) return errAsync(url.error)

    return fetchArticle(shareInput, url.value, signal, options)
  }
