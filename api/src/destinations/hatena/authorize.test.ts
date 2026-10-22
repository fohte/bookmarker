import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { okAsync } from 'neverthrow'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  authorizeHatena,
  resolveOutputPathOutsideRepository,
  writeCredentialsFile,
} from '#destinations/hatena/authorize'
import { createOAuthAuthorizationHeader } from '#destinations/hatena/oauth'

const temporaryDirectories: string[] = []

const makeTemporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmarker-hatena-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('authorizeHatena', () => {
  it('exchanges an out-of-band verifier and writes credentials without logging them', async () => {
    const directory = await makeTemporaryDirectory()
    const outputPath = join(directory, 'hatena.json')
    const prompts: string[] = []
    const output: string[] = []
    const requests: Array<{
      url: string
      method: string
      authorization: string
      contentType: string
      body: string
      redirect: NonNullable<RequestInit['redirect']>
    }> = []
    let fetchCount = 0
    const result = await authorizeHatena(outputPath, {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        requests.push({
          url:
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url,
          method: init?.method ?? '',
          authorization: headers.get('authorization') ?? '',
          contentType: headers.get('content-type') ?? '',
          body: typeof init?.body === 'string' ? init.body : '',
          redirect: init?.redirect ?? 'follow',
        })
        fetchCount += 1
        return Promise.resolve(
          fetchCount === 1
            ? new Response(
                'oauth_token=fictional-request-token&oauth_token_secret=fictional-request-secret&oauth_callback_confirmed=true',
                { status: 200 },
              )
            : new Response(
                'oauth_token=fictional-access-token&oauth_token_secret=fictional-access-secret',
                { status: 200 },
              ),
        )
      },
      prompt: (label) => {
        prompts.push(label)
        const value =
          prompts.length === 1
            ? 'fictional-consumer-key'
            : prompts.length === 2
              ? 'fictional-consumer-secret'
              : 'fictional-verifier'
        return okAsync(value)
      },
      writeLine: (line) => output.push(line),
      writeCredentials: writeCredentialsFile,
      nonce: (() => {
        let count = 0
        return () => `fictional-nonce-${String(++count)}`
      })(),
      timestamp: () => 1_700_000_000,
    }).match(
      () => ({ kind: 'success' as const }),
      (error) => ({ kind: 'error' as const, error }),
    )
    const savedCredentials = z
      .object({
        consumerKey: z.string(),
        consumerSecret: z.string(),
        accessToken: z.string(),
        accessTokenSecret: z.string(),
      })
      .parse(JSON.parse(await readFile(outputPath, 'utf8')))
    const fileMode = (await stat(outputPath)).mode & 0o777
    const requestToken = {
      consumerKey: 'fictional-consumer-key',
      consumerSecret: 'fictional-consumer-secret',
    }
    const initiateBody = new URLSearchParams([
      ['scope', 'read_public,read_private,write_public,write_private'],
    ])
    const initiateAuthorization = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL('https://www.hatena.com/oauth/initiate'),
      bodyParameters: initiateBody,
      ...requestToken,
      callback: 'oob',
      nonce: 'fictional-nonce-1',
      timestamp: 1_700_000_000,
    })
    const exchangeAuthorization = createOAuthAuthorizationHeader({
      method: 'POST',
      url: new URL('https://www.hatena.com/oauth/token'),
      bodyParameters: new URLSearchParams(),
      ...requestToken,
      token: 'fictional-request-token',
      tokenSecret: 'fictional-request-secret',
      verifier: 'fictional-verifier',
      nonce: 'fictional-nonce-2',
      timestamp: 1_700_000_000,
    })

    const summarizeAuthorization = () => ({
      result,
      prompts,
      output,
      requests,
      savedCredentials,
      fileMode,
    })
    expect(summarizeAuthorization()).toEqual({
      result: { kind: 'success' },
      prompts: ['Consumer key: ', 'Consumer secret: ', 'OAuth verifier: '],
      output: [
        'Approve Hatena access in a browser: https://www.hatena.ne.jp/oauth/authorize?oauth_token=fictional-request-token',
      ],
      requests: [
        {
          url: 'https://www.hatena.com/oauth/initiate',
          method: 'POST',
          authorization: initiateAuthorization,
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          body: 'scope=read_public%2Cread_private%2Cwrite_public%2Cwrite_private',
          redirect: 'error',
        },
        {
          url: 'https://www.hatena.com/oauth/token',
          method: 'POST',
          authorization: exchangeAuthorization,
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          body: '',
          redirect: 'error',
        },
      ],
      savedCredentials: {
        consumerKey: 'fictional-consumer-key',
        consumerSecret: 'fictional-consumer-secret',
        accessToken: 'fictional-access-token',
        accessTokenSecret: 'fictional-access-secret',
      },
      fileMode: 0o600,
    })
  })

  it('rejects malformed request-token responses before prompting for a verifier or writing credentials', async () => {
    const prompts: string[] = []
    const output: string[] = []
    const credentialWrites: Array<{
      path: string
      credentials: {
        consumerKey: string
        consumerSecret: string
        accessToken: string
        accessTokenSecret: string
      }
    }> = []
    let fetchCount = 0
    const result = await authorizeHatena('/outside/credentials.json', {
      fetch: () => {
        fetchCount += 1
        return Promise.resolve(
          new Response(
            'oauth_token=fictional-token&oauth_token=duplicate-token&oauth_token_secret=fictional-secret&oauth_callback_confirmed=true',
            { status: 200 },
          ),
        )
      },
      prompt: (label) => {
        prompts.push(label)
        return okAsync(
          prompts.length === 1
            ? 'fictional-consumer-key'
            : 'fictional-consumer-secret',
        )
      },
      writeLine: (line) => output.push(line),
      writeCredentials: (path, credentials) => {
        credentialWrites.push({ path, credentials })
        return okAsync(undefined)
      },
      nonce: () => 'fictional-nonce',
      timestamp: () => 1_700_000_000,
    }).match(
      () => ({ kind: 'success' as const }),
      (error) => ({ kind: 'error' as const, error }),
    )

    const summarizeMalformedResponse = () => ({
      result,
      fetchCount,
      prompts,
      output,
      credentialWrites,
    })
    expect(summarizeMalformedResponse()).toEqual({
      result: { kind: 'error', error: 'invalid_response' },
      fetchCount: 1,
      prompts: ['Consumer key: ', 'Consumer secret: '],
      output: [],
      credentialWrites: [],
    })
  })

  it('refuses to replace an existing credentials file', async () => {
    const directory = await makeTemporaryDirectory()
    const outputPath = join(directory, 'credentials.json')
    await writeFile(outputPath, 'fictional-existing-content', 'utf8')
    const writeResult = await writeCredentialsFile(outputPath, {
      consumerKey: 'fictional-key',
      consumerSecret: 'fictional-secret',
      accessToken: 'fictional-token',
      accessTokenSecret: 'fictional-token-secret',
    }).match(
      () => ({ kind: 'success' as const }),
      (error) => ({ kind: 'error' as const, error }),
    )

    const summarizeFileSafety = async () => ({
      writeResult,
      existingFile: await readFile(outputPath, 'utf8'),
    })
    expect(await summarizeFileSafety()).toEqual({
      writeResult: { kind: 'error', error: 'output_failed' },
      existingFile: 'fictional-existing-content',
    })
  })

  it('rejects repository-local output paths and resolves external paths', async () => {
    const directory = await makeTemporaryDirectory()
    const repository = join(directory, 'repository')
    const outside = join(directory, 'outside')
    await mkdir(repository)
    await mkdir(outside)
    const outputPath = join(outside, 'credentials.json')
    const resolvedOutputPath = join(await realpath(outside), 'credentials.json')
    const localPathResult = await resolveOutputPathOutsideRepository(
      join(repository, 'credentials.json'),
      repository,
    ).match(
      (path) => ({ kind: 'success' as const, path }),
      (error) => ({ kind: 'error' as const, error }),
    )
    const outsidePathResult = await resolveOutputPathOutsideRepository(
      outputPath,
      repository,
    ).match(
      (path) => ({ kind: 'success' as const, path }),
      (error) => ({ kind: 'error' as const, error }),
    )

    const summarizePathResults = () => ({ localPathResult, outsidePathResult })
    expect(summarizePathResults()).toEqual({
      localPathResult: { kind: 'error', error: 'invalid_output_path' },
      outsidePathResult: { kind: 'success', path: resolvedOutputPath },
    })
  })

  it('does not replace credentials when creating the output file fails', async () => {
    const directory = await makeTemporaryDirectory()
    const outputPath = join(directory, 'missing', 'credentials.json')
    const result = await writeCredentialsFile(outputPath, {
      consumerKey: 'fictional-key',
      consumerSecret: 'fictional-secret',
      accessToken: 'fictional-token',
      accessTokenSecret: 'fictional-token-secret',
    }).match(
      () => ({ kind: 'success' as const }),
      (error) => ({ kind: 'error' as const, error }),
    )

    expect(result).toEqual({ kind: 'error', error: 'output_failed' })
  })
})
