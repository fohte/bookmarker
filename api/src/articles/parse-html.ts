import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { err, ok, Result } from 'neverthrow'

import { ARTICLE_FETCH_FAILED } from '#articles/errors'
import type { DownloadedHtml } from '#articles/fetch-html'
import { ARTICLE_TEXT_LIMIT, READABILITY_ELEMENT_LIMIT } from '#articles/types'
import { type Article, ArticleSchema, type ShareInput } from '#contracts/index'

export const createFetchedArticle = (
  input: ShareInput,
  downloaded: DownloadedHtml,
): Result<Article, typeof ARTICLE_FETCH_FAILED> => {
  const parsed = Result.fromThrowable(
    (html: DownloadedHtml) => {
      const document = new JSDOM(html.bytes, {
        url: html.finalUrl.href,
        contentType: html.contentType,
      })
      const article = new Readability(document.window.document, {
        maxElemsToParse: READABILITY_ELEMENT_LIMIT,
      }).parse()
      document.window.close()
      return article
    },
    () => ARTICLE_FETCH_FAILED,
  )(downloaded)

  if (parsed.isErr()) return err(ARTICLE_FETCH_FAILED)

  const extractedText = parsed.value?.textContent?.trim()
  if (extractedText === undefined || extractedText.length === 0) {
    return err(ARTICLE_FETCH_FAILED)
  }

  const url = new URL(input.url)
  const readabilityTitle = parsed.value?.title?.trim()
  const inputTitle = input.title?.trim()
  const title =
    readabilityTitle !== undefined && readabilityTitle.length > 0
      ? readabilityTitle
      : inputTitle !== undefined && inputTitle.length > 0
        ? inputTitle
        : url.hostname
  const truncated = extractedText.length > ARTICLE_TEXT_LIMIT
  const article = ArticleSchema.safeParse({
    url: input.url,
    title,
    text: truncated
      ? extractedText.slice(0, ARTICLE_TEXT_LIMIT)
      : extractedText,
    source: 'fetched',
    partial: input.partial || truncated,
  })

  return article.success ? ok(article.data) : err(ARTICLE_FETCH_FAILED)
}
