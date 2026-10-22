import type {
  Article,
  BookmarkDraft,
  ShareInput,
  Summary,
  Verification,
} from 'api/contracts'

import { updateDraftArticle } from '#features/editor/compose-draft'

export type ComposeAnalysisSaveCommand =
  | {
      kind: 'article'
      expectedDraftId: string
      expectedArticle: Article
      expectedSource: ShareInput
      article: Article
    }
  | {
      kind: 'summary'
      expectedDraftId: string
      expectedArticle: Article
      summary: Summary
    }
  | {
      kind: 'verification'
      expectedDraftId: string
      expectedArticle: Article
      expectedComment: { id: string; value: string }
      verification: Verification
    }

const sameArticle = (left: Article, right: Article): boolean =>
  left.url === right.url &&
  left.title === right.title &&
  left.text === right.text &&
  left.source === right.source &&
  left.partial === right.partial

const sameShareInput = (left: ShareInput, right: ShareInput): boolean =>
  left.url === right.url &&
  left.title === right.title &&
  left.sharedText === right.sharedText &&
  left.partial === right.partial

export function matchesAnalysisSaveCommand(
  draft: BookmarkDraft,
  command: ComposeAnalysisSaveCommand,
): boolean {
  if (
    draft.id !== command.expectedDraftId ||
    draft.article === undefined ||
    !sameArticle(draft.article, command.expectedArticle)
  ) {
    return false
  }

  switch (command.kind) {
    case 'article':
      return sameShareInput(draft.source, command.expectedSource)
    case 'summary':
      return true
    case 'verification':
      return (
        command.expectedComment.id === 'common' &&
        draft.commonComment === command.expectedComment.value
      )
  }
}

export function applyAnalysisSaveCommand(
  draft: BookmarkDraft,
  command: ComposeAnalysisSaveCommand,
): BookmarkDraft {
  switch (command.kind) {
    case 'article':
      return updateDraftArticle(draft, command.article)
    case 'summary':
      return {
        ...draft,
        analysis: { ...draft.analysis, summary: command.summary },
      }
    case 'verification':
      return {
        ...draft,
        analysis: { ...draft.analysis, verification: command.verification },
      }
  }
}
