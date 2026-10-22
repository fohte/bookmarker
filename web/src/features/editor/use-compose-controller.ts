import type { BookmarkDraft, ShareInput } from 'api/contracts'
import { err } from 'neverthrow'
import { useCallback, useEffect, useRef, useState } from 'react'

import { DraftError } from '#features/drafts/draft-error'
import { ComposeController } from '#features/editor/compose-controller'
import { initialComposeState } from '#features/editor/compose-state'

export function useComposeController() {
  const [state, setState] = useState(initialComposeState)
  const controllerRef = useRef<ComposeController | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    const controller = new ComposeController()
    const generation = ++generationRef.current
    controllerRef.current = controller
    const unsubscribe = controller.subscribe((nextState) => {
      if (generationRef.current === generation) setState(nextState)
    })

    const draftId = new URLSearchParams(window.location.search).get('draft')
    void controller.start(draftId)

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
      unsubscribe()
      if (controllerRef.current === controller) controllerRef.current = null
      void controller.dispose()
    }
  }, [])

  const openSource = useCallback(
    (
      input: ShareInput,
      options: { cleanupUrl: string; intake: 'manual' | 'share' },
    ) => {
      const controller = controllerRef.current
      return controller === null
        ? Promise.resolve(
            err<BookmarkDraft, DraftError>(
              new DraftError(
                'controller-unavailable',
                'The editor is not ready yet.',
              ),
            ),
          )
        : controller.openSource(input, options)
    },
    [],
  )

  const reportIntakeError = useCallback((message: string) => {
    controllerRef.current?.reportIntakeError(message)
  }, [])

  const updateTitle = useCallback((title: string) => {
    controllerRef.current?.updateTitle(title)
  }, [])

  const updateArticleText = useCallback((text: string) => {
    controllerRef.current?.updateArticleText(text)
  }, [])

  const updateCommonComment = useCallback((comment: string) => {
    controllerRef.current?.updateCommonComment(comment)
  }, [])

  const selectDraft = useCallback((draftId: string) => {
    const controller = controllerRef.current
    if (controller !== null) return controller.selectDraft(draftId)
    return Promise.resolve()
  }, [])

  const retryLock = useCallback(() => {
    const controller = controllerRef.current
    if (controller !== null) return controller.retryLock()
    return Promise.resolve()
  }, [])

  const retrySave = useCallback(() => {
    const controller = controllerRef.current
    if (controller !== null) return controller.retrySave()
    return Promise.resolve()
  }, [])

  const requestDiscard = useCallback(() => {
    controllerRef.current?.requestDiscard()
  }, [])

  const cancelDiscard = useCallback(() => {
    controllerRef.current?.cancelDiscard()
  }, [])

  const discardDraft = useCallback(() => {
    const controller = controllerRef.current
    if (controller !== null) return controller.discardDraft()
    return Promise.resolve()
  }, [])

  return {
    state,
    openSource,
    reportIntakeError,
    updateTitle,
    updateArticleText,
    updateCommonComment,
    selectDraft,
    retryLock,
    retrySave,
    requestDiscard,
    cancelDiscard,
    discardDraft,
  }
}
