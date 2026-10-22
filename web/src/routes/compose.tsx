import { ShareInputSchema } from 'api/contracts'
import { useEffect, useRef, useState } from 'react'

import { ComposeScreen } from '#components/compose-screen'
import { currentUrlWithoutDraft } from '#features/editor/compose-history'
import { useComposeController } from '#features/editor/use-compose-controller'
import { parseShareLocation } from '#features/share/parse-share-location'

export function ComposeRoute() {
  const [sourceUrl, setSourceUrl] = useState('')
  const controller = useComposeController()
  const lastProcessedLocationRef = useRef('')

  useEffect(() => {
    let active = true
    let queuedLocationKey: string | undefined

    const queueLocation = () => {
      const location = {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      }
      const locationKey = `${location.pathname}${location.search}${location.hash}`
      if (queuedLocationKey === locationKey) return
      queuedLocationKey = locationKey

      queueMicrotask(() => {
        if (!active) return
        if (queuedLocationKey === locationKey) queuedLocationKey = undefined

        const currentLocation = {
          pathname: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
        }
        const currentLocationKey = `${currentLocation.pathname}${currentLocation.search}${currentLocation.hash}`
        if (currentLocationKey !== locationKey) {
          queueLocation()
          return
        }
        if (lastProcessedLocationRef.current === locationKey) return
        lastProcessedLocationRef.current = locationKey

        const parsed = parseShareLocation(
          location.pathname,
          location.search,
          location.hash,
        )
        if (parsed.type === 'none') return
        if (parsed.type === 'invalid') {
          controller.reportIntakeError(parsed.message)
          return
        }

        void controller
          .openSource(parsed.input, {
            cleanupUrl: parsed.cleanupUrl,
            intake: 'share',
          })
          .then((result) => {
            result.match(
              () => undefined,
              (error) => {
                controller.reportIntakeError(error.message)
              },
            )
          })
      })
    }

    const onLocationChange = () => {
      queueLocation()
    }

    queueLocation()
    window.addEventListener('popstate', onLocationChange)
    window.addEventListener('hashchange', onLocationChange)

    return () => {
      active = false
      window.removeEventListener('popstate', onLocationChange)
      window.removeEventListener('hashchange', onLocationChange)
    }
  }, [controller.openSource, controller.reportIntakeError])

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
      onRetrySave={() => void controller.retrySave()}
      onRetryLock={() => void controller.retryLock()}
      onRequestDiscard={controller.requestDiscard}
      onCancelDiscard={controller.cancelDiscard}
      onConfirmDiscard={() => void controller.discardDraft()}
    />
  )
}
