import { ShareInputSchema } from 'api/contracts'
import { useState } from 'react'

import { ComposeScreen } from '#features/editor/compose-screen'
import { useComposeController } from '#features/editor/use-compose-controller'

function cleanupUrlWithoutDraft(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('draft')
  return `${url.pathname}${url.search}${url.hash}`
}

export function ComposeRoute() {
  const [sourceUrl, setSourceUrl] = useState('')
  const controller = useComposeController()

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
      cleanupUrl: cleanupUrlWithoutDraft(),
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
      onRetrySave={() => void controller.retrySave()}
      onRetryLock={() => void controller.retryLock()}
      onRequestDiscard={controller.requestDiscard}
      onCancelDiscard={controller.cancelDiscard}
      onConfirmDiscard={() => void controller.discardDraft()}
    />
  )
}
