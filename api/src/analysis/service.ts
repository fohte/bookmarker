import { err, ok, ResultAsync } from 'neverthrow'

import {
  parseSummaryModelResponse,
  parseVerificationModelResponse,
} from '#analysis/model-response'
import {
  createSummaryMessages,
  createVerificationMessages,
} from '#analysis/prompts'
import { requestCompletion } from '#analysis/provider'
import type { AnalysisConfig, AnalysisFailure } from '#analysis/types'
import type { Article, Summary, Verification } from '#contracts/article'

const normalizeCitation = (text: string): string =>
  text
    .normalize('NFKC')
    .replace(/[“”„‟«»「」『』]/gu, '"')
    .replace(/[‘’‚‛‹›]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()

const citationMatches = (source: string, citation: string): boolean => {
  const normalizedSource = normalizeCitation(source)
  const normalizedCitation = normalizeCitation(citation)
  const unwrappedCitation =
    normalizedCitation.length >= 2 &&
    ((normalizedCitation.startsWith('"') && normalizedCitation.endsWith('"')) ||
      (normalizedCitation.startsWith("'") && normalizedCitation.endsWith("'")))
      ? normalizedCitation.slice(1, -1)
      : undefined

  return [normalizedCitation, unwrappedCitation].some(
    (candidate) =>
      candidate !== undefined &&
      candidate.length > 0 &&
      normalizedSource.includes(candidate),
  )
}

export const summarizeArticle = (
  article: Article,
  config: AnalysisConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): ResultAsync<Summary, AnalysisFailure> => {
  return requestCompletion(
    config,
    createSummaryMessages(article),
    fetchImpl,
    timeoutMs,
  ).andThen((content) => {
    const parsed = parseSummaryModelResponse(content)
    if (parsed.isErr()) {
      return err(parsed.error)
    }
    if (parsed.value.status === 'insufficient') {
      return err({ kind: 'insufficient' } as const)
    }

    return ok({ summary: parsed.value.summary, partial: article.partial })
  })
}

export const verifyComment = (
  article: Article,
  comment: string,
  config: AnalysisConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): ResultAsync<Verification, AnalysisFailure> => {
  return requestCompletion(
    config,
    createVerificationMessages(article, comment),
    fetchImpl,
    timeoutMs,
  ).andThen((content) => {
    const parsed = parseVerificationModelResponse(content)
    if (parsed.isErr()) {
      return err(parsed.error)
    }
    if (parsed.value.status === 'insufficient') {
      return err({ kind: 'insufficient' } as const)
    }

    const issues = parsed.value.issues.filter(
      (issue) =>
        citationMatches(comment, issue.quote) &&
        (issue.evidence === undefined ||
          citationMatches(article.text, issue.evidence)),
    )

    return ok({ issues, partial: article.partial })
  })
}
