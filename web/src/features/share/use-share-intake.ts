import { useEffect, useRef } from 'react'

import type { useComposeController } from '#features/editor/use-compose-controller'
import { parseShareLocation } from '#features/share/parse-share-location'

type ShareIntakeController = Pick<
  ReturnType<typeof useComposeController>,
  'openSource' | 'reportIntakeError'
>

type LocationSnapshot = {
  pathname: string
  search: string
  hash: string
  key: string
}

const readLocation = (): LocationSnapshot => {
  const pathname = window.location.pathname
  const search = window.location.search
  const hash = window.location.hash

  return {
    pathname,
    search,
    hash,
    key: `${pathname}${search}${hash}`,
  }
}

export function useShareIntake(controller: ShareIntakeController) {
  const lastProcessedLocationRef = useRef('')

  useEffect(() => {
    let active = true
    let queuedLocationKey: string | undefined

    const queueLocation = () => {
      const location = readLocation()
      if (queuedLocationKey === location.key) return
      queuedLocationKey = location.key

      queueMicrotask(() => {
        if (!active) return

        const currentLocation = readLocation()
        if (currentLocation.key !== location.key) {
          if (queuedLocationKey === location.key) queuedLocationKey = undefined
          queueLocation()
          return
        }
        if (queuedLocationKey === location.key) queuedLocationKey = undefined
        if (lastProcessedLocationRef.current === location.key) return
        lastProcessedLocationRef.current = location.key

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
}
