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

    const hasInvalidCitation = parsed.value.issues.some(
      (issue) =>
        !comment.includes(issue.quote) ||
        (issue.kind === 'error' && !article.text.includes(issue.evidence)) ||
        (issue.kind !== 'error' &&
          issue.evidence !== undefined &&
          !article.text.includes(issue.evidence)),
    )
    if (hasInvalidCitation) {
      return err({ kind: 'invalid-response' } as const)
    }

    return ok({ issues: parsed.value.issues, partial: article.partial })
  })
}
