import type { BookmarkDraft } from 'api/contracts'

import type { DraftSaveState } from '#features/drafts/draft-save-queue'

export type ComposeLockState =
  'loading' | 'available' | 'owned' | 'locked' | 'unsupported'

export type ComposeState = {
  drafts: BookmarkDraft[]
  unreadableDraftCount: number
  activeDraft: BookmarkDraft | null
  isLoading: boolean
  canEdit: boolean
  lockState: ComposeLockState
  saveState: DraftSaveState | 'saved'
  errorMessage: string | null
  intakeError: string | null
  discardOpen: boolean
}

export const initialComposeState: ComposeState = {
  drafts: [],
  unreadableDraftCount: 0,
  activeDraft: null,
  isLoading: true,
  canEdit: false,
  lockState: 'loading',
  saveState: 'saved',
  errorMessage: null,
  intakeError: null,
  discardOpen: false,
}
