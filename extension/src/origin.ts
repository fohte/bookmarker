// Article URLs are sent to this origin, so plain http is limited to local development.
export const parseBookmarkerOrigin = (value: string): string | undefined => {
  const url = URL.parse(value)
  if (url === null) return undefined

  const isAllowed =
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && url.hostname === 'localhost')
  return isAllowed ? url.origin : undefined
}
