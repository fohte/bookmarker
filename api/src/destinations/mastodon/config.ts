export type MastodonConfig = {
  configured: boolean
  baseUrl?: URL
  accessToken?: string
}

const parseBaseUrl = (value: string | undefined): URL | undefined => {
  if (
    value === undefined ||
    value.length === 0 ||
    value.trim() !== value ||
    !URL.canParse(value)
  ) {
    return undefined
  }

  const url = new URL(value)
  if (
    url.protocol !== 'https:' ||
    url.hostname.length === 0 ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    (url.pathname !== '' && url.pathname !== '/') ||
    value.includes('?') ||
    value.includes('#') ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    return undefined
  }

  return new URL(url.origin)
}

const parseAccessToken = (value: string | undefined): string | undefined => {
  if (
    value === undefined ||
    value.length === 0 ||
    value.trim() !== value ||
    /\s/.test(value)
  ) {
    return undefined
  }

  return value
}

export const readMastodonConfig = (
  env: NodeJS.ProcessEnv = process.env,
): MastodonConfig => {
  const rawBaseUrl = env['MASTODON_BASE_URL']
  const rawAccessToken = env['MASTODON_ACCESS_TOKEN']
  const configured =
    rawBaseUrl !== undefined &&
    rawBaseUrl.trim().length > 0 &&
    rawAccessToken !== undefined &&
    rawAccessToken.trim().length > 0
  const baseUrl = parseBaseUrl(rawBaseUrl)
  const accessToken = parseAccessToken(rawAccessToken)

  return {
    configured,
    ...(baseUrl !== undefined ? { baseUrl } : {}),
    ...(accessToken !== undefined ? { accessToken } : {}),
  }
}
