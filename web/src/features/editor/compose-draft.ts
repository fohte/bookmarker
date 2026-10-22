import {
  type Article,
  ArticleSchema,
  type BookmarkDraft,
  BookmarkDraftSchema,
  type ShareInput,
} from 'api/contracts'
import { err, ok } from 'neverthrow'

import { DraftError } from '#features/drafts/draft-error'

export function recoverPendingDeliveries(draft: BookmarkDraft): BookmarkDraft {
  const delivery = draft.delivery.map((snapshot) => {
    if (snapshot.result !== undefined) {
      return snapshot
    }

    return {
      ...snapshot,
      result: {
        destination: snapshot.target.destination,
        operationId: snapshot.target.operationId,
        status: 'unknown' as const,
        retryable: false as const,
      },
    }
  })

  if (delivery.every((snapshot, index) => snapshot === draft.delivery[index])) {
    return draft
  }

  return { ...draft, delivery, updatedAt: new Date().toISOString() }
}

export function clearDraftAnalysis(draft: BookmarkDraft): BookmarkDraft {
  if (draft.analysis === undefined) return draft
  const updated = { ...draft }
  delete updated.analysis
  return updated
}

export function updateDraftArticle(
  draft: BookmarkDraft,
  patch: Partial<Article>,
): BookmarkDraft {
  const current: Article = draft.article ?? {
    url: draft.source.url,
    title: draft.source.title ?? '',
    text: draft.source.sharedText ?? '',
    source: 'manual',
    partial: true,
  }
  const article = ArticleSchema.safeParse({ ...current, ...patch })
  if (!article.success) return draft
  const updated = { ...draft, article: article.data }
  const articleChanged =
    article.data.url !== current.url ||
    article.data.title !== current.title ||
    article.data.text !== current.text ||
    article.data.source !== current.source ||
    article.data.partial !== current.partial
  return articleChanged ? clearDraftAnalysis(updated) : updated
}

export function clearDraftVerification(draft: BookmarkDraft): BookmarkDraft {
  const analysis = draft.analysis
  if (analysis?.verification === undefined) return draft
  if (analysis.summary === undefined) return clearDraftAnalysis(draft)
  return { ...draft, analysis: { summary: analysis.summary } }
}

export function updateDraftArticleText(
  draft: BookmarkDraft,
  text: string,
): BookmarkDraft {
  return updateDraftArticle(draft, { text })
}

export function createNewDraft(source: ShareInput, intake: 'manual' | 'share') {
  if (
    typeof crypto === 'undefined' ||
    typeof crypto.randomUUID !== 'function'
  ) {
    return err(
      new DraftError(
        'lock-unavailable',
        'This browser cannot safely create a local draft.',
      ),
    )
  }

  const article = ArticleSchema.safeParse({
    url: source.url,
    title: source.title ?? '',
    text: source.sharedText ?? '',
    source: intake === 'manual' ? 'manual' : 'shared',
    partial: source.partial || source.sharedText === undefined,
  })
  if (!article.success) {
    return err(
      new DraftError(
        'invalid-source',
        'This URL could not be used to create a draft.',
      ),
    )
  }

  const draft = BookmarkDraftSchema.safeParse({
    version: 1,
    id: crypto.randomUUID(),
    source,
    article: article.data,
    commonComment: '',
    destinations: [],
    delivery: [],
    updatedAt: new Date().toISOString(),
  })
  if (!draft.success) {
    return err(
      new DraftError(
        'invalid-source',
        'This URL could not be used to create a draft.',
      ),
    )
  }

  return ok(draft.data)
}
