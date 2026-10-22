import { type DestinationId, ShareInputSchema } from 'api/contracts'
import { useState } from 'react'

import { ComposeScreen } from '#components/compose-screen'
import { currentUrlWithoutDraft } from '#features/editor/compose-history'
import { useComposeController } from '#features/editor/use-compose-controller'
import { useShareIntake } from '#features/share/use-share-intake'

export function ComposeRoute() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [copyConfirmationDestination, setCopyConfirmationDestination] =
    useState<DestinationId | null>(null)
  const controller = useComposeController()
  useShareIntake(controller)

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

  return (
    <ComposeScreen
      state={controller.state}
      sourceUrl={sourceUrl}
      onSourceUrlChange={setSourceUrl}
      onOpenSource={() => void openManualSource()}
      onSelectDraft={(id) => void controller.selectDraft(id)}
      onTitleChange={controller.updateTitle}
      onArticleTextChange={controller.updateArticleText}
      onCommonCommentChange={controller.updateCommonComment}
      onDestinationChange={controller.updateDestination}
      analysisSummaryState="unavailable"
      analysisVerificationState="unavailable"
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
