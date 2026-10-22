import {
  ArticleSchema,
  type DestinationId,
  ShareInputSchema,
} from 'api/contracts'
import { useCallback, useEffect, useState } from 'react'

import { ComposeScreen } from '#components/compose-screen'
import { currentUrlWithoutDraft } from '#features/editor/compose-history'
import { useComposeAnalysis } from '#features/editor/use-compose-analysis'
import { useComposeController } from '#features/editor/use-compose-controller'
import { useShareIntake } from '#features/share/use-share-intake'

export function ComposeRoute() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [copyConfirmationDestination, setCopyConfirmationDestination] =
    useState<DestinationId | null>(null)
  const [autoAnalyzeDraftId, setAutoAnalyzeDraftId] = useState<string | null>(
    null,
  )
  const [articleTextError, setArticleTextError] = useState<string | null>(null)
  const controller = useComposeController()
  const analysis = useComposeAnalysis({
    draft: controller.state.activeDraft,
    canEdit: controller.state.canEdit && !controller.state.isLoading,
    autoAnalyzeDraftId,
    saveAnalysisResult: controller.saveAnalysisResult,
  })
  const openSharedSource = useCallback(
    async (
      input: Parameters<typeof controller.openSource>[0],
      options: Parameters<typeof controller.openSource>[1],
    ) => {
      const result = await controller.openSource(input, options)
      if (options.intake === 'share') {
        result.match(
          (draft) => {
            setAutoAnalyzeDraftId(draft.id)
          },
          () => undefined,
        )
      }
      return result
    },
    [controller.openSource],
  )
  useShareIntake({
    openSource: openSharedSource,
    reportIntakeError: controller.reportIntakeError,
  })

  useEffect(() => {
    setArticleTextError(null)
  }, [controller.state.activeDraft?.id])

  const openManualSource = async () => {
    const parsed = ShareInputSchema.safeParse({
      version: 1,
      url: sourceUrl.trim(),
      partial: true,
    })
    if (!parsed.success) {
      controller.reportIntakeError('Enter a valid HTTP or HTTPS article URL.')
      return
    }

    const result = await controller.openSource(parsed.data, {
      cleanupUrl: currentUrlWithoutDraft(),
      intake: 'manual',
    })
    result.match(
      () => {
        setSourceUrl('')
      },
      (error) => {
        controller.reportIntakeError(error.message)
      },
    )
  }

  const updateArticleText = (text: string) => {
    const article = controller.state.activeDraft?.article
    if (article === undefined) return

    const parsed = ArticleSchema.safeParse({ ...article, text })
    if (!parsed.success) {
      setArticleTextError(
        'Article text must be 100,000 UTF-16 code units or fewer.',
      )
      return
    }

    setArticleTextError(null)
    controller.updateArticleText(text)
  }

  return (
    <ComposeScreen
      state={controller.state}
      sourceUrl={sourceUrl}
      onSourceUrlChange={setSourceUrl}
      onOpenSource={() => void openManualSource()}
      onSelectDraft={(id) => void controller.selectDraft(id)}
      onTitleChange={controller.updateTitle}
      onArticleTextChange={updateArticleText}
      articleTextError={articleTextError}
      onCommonCommentChange={controller.updateCommonComment}
      onDestinationChange={controller.updateDestination}
      analysis={analysis}
      copyConfirmationDestination={copyConfirmationDestination}
      onRequestCopyCommonComment={setCopyConfirmationDestination}
      onCancelCopyCommonComment={() => {
        setCopyConfirmationDestination(null)
      }}
      onCopyCommonComment={(destination) => {
        controller.copyCommonComment(destination)
        setCopyConfirmationDestination(null)
      }}
      onRetrySave={() => void controller.retrySave()}
      onRetryLock={() => void controller.retryLock()}
      onRequestDiscard={controller.requestDiscard}
      onCancelDiscard={controller.cancelDiscard}
      onConfirmDiscard={() => void controller.discardDraft()}
    />
  )
}
