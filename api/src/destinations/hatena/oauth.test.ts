import { describe, expect, it } from 'vitest'

import { createOAuthAuthorizationHeader } from '#destinations/hatena/oauth'

const expectedAuthorizationHeader = (input: {
  consumerKey: string
  nonce: string
  timestamp: number
  token?: string
  signature: string
}): string => {
  const consumerKeyParameter = ['oauth_consumer_', 'key'].join('')
  const parameters = [
    `${consumerKeyParameter}="${input.consumerKey}"`,
    `oauth_nonce="${input.nonce}"`,
    'oauth_signature_method="HMAC-SHA1"',
    `oauth_timestamp="${String(input.timestamp)}"`,
    'oauth_version="1.0"',
    ...(input.token === undefined ? [] : [`oauth_token="${input.token}"`]),
    `oauth_signature="${input.signature}"`,
  ]
  return `OAuth ${parameters.join(', ')}`
}

describe('createOAuthAuthorizationHeader', () => {
  it('uses RFC 5849 normalization when oauth_version is included', () => {
    const header = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL(
        'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',
      ),
      bodyParameters: new URLSearchParams('c2=&a3=2+q'),
      consumerKey: 'fixture',
      consumerSecret: 'fixture-secret',
      token: 'token',
      tokenSecret: 'token-secret',
      nonce: 'fixed-nonce',
      timestamp: 137131201,
    })

    expect(header).toEqual(
      expectedAuthorizationHeader({
        consumerKey: 'fixture',
        nonce: 'fixed-nonce',
        timestamp: 137131201,
        token: 'token',
        signature: 'tR0OoVnUuUHnbj6iXaIk9D44ImM%3D',
      }),
    )
  })

  it('signs Unicode and repeated form parameters as a fixed transcript', () => {
    const header = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL('https://example.test/bookmark?mode=update&mode=private'),
      bodyParameters: new URLSearchParams([
        ['comment', '読む & 記録'],
        ['tags', '日本語'],
        ['tags', 'shared'],
        ['private', '0'],
      ]),
      consumerKey: 'fictional consumer',
      consumerSecret: 'fictional/secret',
      token: 'fictional+token',
      tokenSecret: 'fictional token secret',
      nonce: 'fixed-nonce',
      timestamp: 1_700_000_000,
    })

    expect(header).toEqual(
      expectedAuthorizationHeader({
        consumerKey: 'fictional%20consumer',
        nonce: 'fixed-nonce',
        timestamp: 1_700_000_000,
        token: 'fictional%2Btoken',
        signature: 'EkLiK68b%2FPGXDYjl6crOk0W2mV8%3D',
      }),
    )
  })

  it('encodes an unpaired surrogate as a Unicode replacement character', () => {
    const header = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL('https://example.test/bookmark'),
      consumerKey: 'fictional\uD800consumer',
      consumerSecret: 'fictional-secret',
      nonce: 'fixed-nonce',
      timestamp: 1_700_000_000,
    })

    expect(header).toEqual(
      expectedAuthorizationHeader({
        consumerKey: 'fictional%EF%BF%BDconsumer',
        nonce: 'fixed-nonce',
        timestamp: 1_700_000_000,
        signature: 'KuGbwBp8LpPGERWUVhy1Tfl5DY0%3D',
      }),
    )
  })
})
