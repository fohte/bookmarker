import type { BookmarkDraft } from 'api/contracts'

export function getComposeDraftTitle(
  draft: BookmarkDraft,
  fallback: string,
): string {
  const articleTitle = draft.article?.title
  if (articleTitle !== undefined && articleTitle.length > 0) return articleTitle

  const sourceTitle = draft.source.title
  return sourceTitle !== undefined && sourceTitle.length > 0
    ? sourceTitle
    : fallback
}
