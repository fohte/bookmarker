import { err, ok, type Result as ResultType, ResultAsync } from 'neverthrow'

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

const requestParsedCompletion = <Output>(
  config: AnalysisConfig,
  messages: ReturnType<typeof createSummaryMessages>,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  parse: (content: string) => ResultType<Output, AnalysisFailure>,
): ResultAsync<Output, AnalysisFailure> =>
  requestCompletion(config, messages, fetchImpl, timeoutMs).andThen(
    (content) => {
      const parsed = parse(content)
      if (parsed.isErr() && parsed.error.kind === 'invalid-response') {
        return requestCompletion(
          config,
          messages,
          fetchImpl,
          timeoutMs,
        ).andThen(parse)
      }

      return parsed
    },
  )

export const summarizeArticle = (
  article: Article,
  config: AnalysisConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): ResultAsync<Summary, AnalysisFailure> => {
  return requestParsedCompletion(
    config,
    createSummaryMessages(article),
    fetchImpl,
    timeoutMs,
    parseSummaryModelResponse,
  ).andThen((parsed) => {
    if (parsed.status === 'insufficient') {
      return err({ kind: 'insufficient' } as const)
    }

    return ok({ summary: parsed.summary, partial: article.partial })
  })
}

export const verifyComment = (
  article: Article,
  comment: string,
  config: AnalysisConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): ResultAsync<Verification, AnalysisFailure> => {
  return requestParsedCompletion(
    config,
    createVerificationMessages(article, comment),
    fetchImpl,
    timeoutMs,
    parseVerificationModelResponse,
  ).andThen((parsed) => {
    if (parsed.status === 'insufficient') {
      return err({ kind: 'insufficient' } as const)
    }

    const issues = parsed.issues.filter(
      (issue) =>
        citationMatches(comment, issue.quote) &&
        (issue.evidence === undefined ||
          citationMatches(article.text, issue.evidence)),
    )
    const omittedIssueCount = parsed.issues.length - issues.length

    return ok({
      issues,
      partial: article.partial,
      ...(omittedIssueCount > 0 ? { omittedIssueCount } : {}),
    })
  })
}
