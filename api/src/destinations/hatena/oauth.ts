import { createHmac, randomBytes } from 'node:crypto'

type OAuthHeaderParameters = {
  method: string
  url: URL
  bodyParameters?: URLSearchParams
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
  callback?: string
  verifier?: string
  nonce?: string
  timestamp?: number
}

const percentEncode = (value: string): string =>
  Array.from(Buffer.from(value, 'utf8'))
    .map((byte) => {
      const character = String.fromCharCode(byte)
      return /^[A-Za-z0-9._~-]$/.test(character)
        ? character
        : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`
    })
    .join('')

const normalizedBaseUrl = (url: URL): string =>
  `${url.origin}${url.pathname === '' ? '/' : url.pathname}`

export const createOAuthAuthorizationHeader = ({
  method,
  url,
  bodyParameters,
  consumerKey,
  consumerSecret,
  token,
  tokenSecret,
  callback,
  verifier,
  nonce = randomBytes(16).toString('hex'),
  timestamp = Math.floor(Date.now() / 1000),
}: OAuthHeaderParameters): string => {
  const oauthParameters: Array<[string, string]> = [
    ['oauth_consumer_key', consumerKey],
    ['oauth_nonce', nonce],
    ['oauth_signature_method', 'HMAC-SHA1'],
    ['oauth_timestamp', String(timestamp)],
    ['oauth_version', '1.0'],
  ]

  if (token !== undefined) {
    oauthParameters.push(['oauth_token', token])
  }
  if (callback !== undefined) {
    oauthParameters.push(['oauth_callback', callback])
  }
  if (verifier !== undefined) {
    oauthParameters.push(['oauth_verifier', verifier])
  }

  const signatureParameters: Array<[string, string]> = [
    ...url.searchParams.entries(),
    ...(bodyParameters?.entries() ?? []),
    ...oauthParameters,
  ]
  const normalizedParameters = signatureParameters
    .map(([key, value]) => [percentEncode(key), percentEncode(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey < rightKey) return -1
      if (leftKey > rightKey) return 1
      if (leftValue < rightValue) return -1
      if (leftValue > rightValue) return 1
      return 0
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(normalizedBaseUrl(url)),
    percentEncode(normalizedParameters),
  ].join('&')
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret ?? '')}`
  const signature = createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64')

  const headerParameters: Array<[string, string]> = [
    ...oauthParameters,
    ['oauth_signature', signature],
  ]

  return `OAuth ${headerParameters
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(', ')}`
}
