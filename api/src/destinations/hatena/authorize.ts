import { open, realpath, unlink } from 'node:fs/promises'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path'

import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow'

import {
  discardResponseBody,
  readResponseText,
  REQUEST_TIMEOUT_MS,
  sendOAuthForm,
} from '#destinations/hatena/http'
import type { HatenaCredentials } from '#destinations/hatena/types'

const HATENA_INITIATE_URL = new URL('https://www.hatena.com/oauth/initiate')
const HATENA_TOKEN_URL = new URL('https://www.hatena.com/oauth/token')
const HATENA_AUTHORIZE_URL = new URL('https://www.hatena.ne.jp/oauth/authorize')
const OAUTH_SCOPE = 'read_public,read_private,write_public,write_private'
const MAX_RESPONSE_BYTES = 16_384

export type HatenaAuthorizationError =
  | 'input_failed'
  | 'invalid_input'
  | 'request_failed'
  | 'provider_rejected'
  | 'invalid_response'
  | 'output_failed'

export type HatenaAuthorizationDependencies = {
  fetch: typeof fetch
  prompt: (label: string) => ResultAsync<string, 'input_failed'>
  writeLine: (line: string) => void
  writeCredentials: (
    path: string,
    credentials: HatenaCredentials,
  ) => ResultAsync<undefined, 'output_failed'>
  nonce?: () => string
  timestamp?: () => number
  timeoutMs?: number
}

const readSingleValue = (
  parameters: URLSearchParams,
  name: string,
): string | undefined => {
  const values = parameters.getAll(name)
  return values.length === 1 && values[0] !== '' ? values[0] : undefined
}

const readOAuthForm = (
  response: Response,
): ResultAsync<URLSearchParams, 'provider_rejected' | 'invalid_response'> => {
  if (!response.ok) {
    discardResponseBody(response)
    return errAsync('provider_rejected')
  }

  return readResponseText(response, MAX_RESPONSE_BYTES)
    .map((text) => new URLSearchParams(text))
    .mapErr(() => 'invalid_response' as const)
}

const parseRequestToken = (
  parameters: URLSearchParams,
): Result<{ token: string; secret: string }, 'invalid_response'> => {
  const token = readSingleValue(parameters, 'oauth_token')
  const secret = readSingleValue(parameters, 'oauth_token_secret')
  const confirmed = readSingleValue(parameters, 'oauth_callback_confirmed')

  return token !== undefined && secret !== undefined && confirmed === 'true'
    ? ok({ token, secret })
    : err('invalid_response')
}

const parseAccessToken = (
  parameters: URLSearchParams,
): Result<
  { accessToken: string; accessTokenSecret: string },
  'invalid_response'
> => {
  const accessToken = readSingleValue(parameters, 'oauth_token')
  const accessTokenSecret = readSingleValue(parameters, 'oauth_token_secret')

  return accessToken !== undefined && accessTokenSecret !== undefined
    ? ok({ accessToken, accessTokenSecret })
    : err('invalid_response')
}

const promptNonEmpty = (
  dependencies: HatenaAuthorizationDependencies,
  label: string,
): ResultAsync<string, 'input_failed' | 'invalid_input'> =>
  dependencies
    .prompt(label)
    .andThen((value) =>
      value.length === 0
        ? errAsync<string, 'invalid_input'>('invalid_input')
        : okAsync<string, 'input_failed' | 'invalid_input'>(value),
    )

const promptConsumerCredentials = (
  dependencies: HatenaAuthorizationDependencies,
): ResultAsync<
  { consumerKey: string; consumerSecret: string },
  'input_failed' | 'invalid_input'
> =>
  promptNonEmpty(dependencies, 'Consumer key: ').andThen((consumerKey) =>
    promptNonEmpty(dependencies, 'Consumer secret: ').map((consumerSecret) => ({
      consumerKey,
      consumerSecret,
    })),
  )

const buildSigningOptions = (
  dependencies: HatenaAuthorizationDependencies,
) => ({
  ...(dependencies.nonce === undefined ? {} : { nonce: dependencies.nonce() }),
  ...(dependencies.timestamp === undefined
    ? {}
    : { timestamp: dependencies.timestamp() }),
  timeoutMs: dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS,
})

const requestRequestToken = (
  dependencies: HatenaAuthorizationDependencies,
  consumerKey: string,
  consumerSecret: string,
): ResultAsync<{ token: string; secret: string }, HatenaAuthorizationError> =>
  sendOAuthForm({
    fetch: dependencies.fetch,
    url: HATENA_INITIATE_URL,
    body: new URLSearchParams([['scope', OAUTH_SCOPE]]),
    credentials: { consumerKey, consumerSecret },
    callback: 'oob',
    ...buildSigningOptions(dependencies),
  })
    .mapErr(() => 'request_failed' as const)
    .andThen(readOAuthForm)
    .andThen(parseRequestToken)

const exchangeAccessToken = (
  dependencies: HatenaAuthorizationDependencies,
  consumerKey: string,
  consumerSecret: string,
  token: string,
  tokenSecret: string,
  verifier: string,
): ResultAsync<
  { accessToken: string; accessTokenSecret: string },
  HatenaAuthorizationError
> =>
  sendOAuthForm({
    fetch: dependencies.fetch,
    url: HATENA_TOKEN_URL,
    body: new URLSearchParams(),
    credentials: { consumerKey, consumerSecret, token, tokenSecret },
    verifier,
    ...buildSigningOptions(dependencies),
  })
    .mapErr(() => 'request_failed' as const)
    .andThen(readOAuthForm)
    .andThen(parseAccessToken)

const authorizeWithConsumerCredentials = (
  outputPath: string,
  dependencies: HatenaAuthorizationDependencies,
  consumerKey: string,
  consumerSecret: string,
): ResultAsync<undefined, HatenaAuthorizationError> =>
  requestRequestToken(dependencies, consumerKey, consumerSecret).andThen(
    ({ token, secret }) => {
      const authorizationUrl = new URL(HATENA_AUTHORIZE_URL)
      authorizationUrl.searchParams.set('oauth_token', token)
      dependencies.writeLine(
        `Approve Hatena access in a browser: ${authorizationUrl.toString()}`,
      )

      return promptNonEmpty(dependencies, 'OAuth verifier: ').andThen(
        (verifier) =>
          exchangeAccessToken(
            dependencies,
            consumerKey,
            consumerSecret,
            token,
            secret,
            verifier,
          ).andThen(({ accessToken, accessTokenSecret }) =>
            dependencies
              .writeCredentials(outputPath, {
                consumerKey,
                consumerSecret,
                accessToken,
                accessTokenSecret,
              })
              .mapErr(() => 'output_failed' as const),
          ),
      )
    },
  )

export const authorizeHatena = (
  outputPath: string,
  dependencies: HatenaAuthorizationDependencies,
): ResultAsync<undefined, HatenaAuthorizationError> =>
  promptConsumerCredentials(dependencies).andThen(
    ({ consumerKey, consumerSecret }) =>
      authorizeWithConsumerCredentials(
        outputPath,
        dependencies,
        consumerKey,
        consumerSecret,
      ),
  )

export const writeCredentialsFile = (
  path: string,
  credentials: HatenaCredentials,
): ResultAsync<undefined, 'output_failed'> =>
  ResultAsync.fromPromise(
    open(path, 'wx', 0o600).then(async (file) => {
      const writeResult = await ResultAsync.fromPromise(
        file
          .writeFile(`${JSON.stringify(credentials, null, 2)}\n`, 'utf8')
          .then(() => file.chmod(0o600)),
        () => 'output_failed' as const,
      )
      const closeResult = await ResultAsync.fromPromise(
        file.close(),
        () => 'output_failed' as const,
      )
      const result = writeResult.andThen(() => closeResult)

      if (result.isErr()) {
        await unlink(path).catch(() => undefined)
        return err('output_failed')
      }

      return ok(undefined)
    }),
    () => 'output_failed' as const,
  ).andThen((result) => result)

const isWithinDirectory = (directory: string, path: string): boolean => {
  const relativePath = relative(directory, path)
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${sep}`) &&
      !isAbsolute(relativePath))
  )
}

export const resolveOutputPathOutsideRepository = (
  outputPath: string,
  repositoryRoot: string,
): ResultAsync<string, 'invalid_output_path'> => {
  if (!isAbsolute(outputPath)) {
    return errAsync<string, 'invalid_output_path'>('invalid_output_path')
  }

  const absoluteOutputPath = resolve(outputPath)
  return ResultAsync.fromPromise(
    Promise.all([
      realpath(dirname(absoluteOutputPath)),
      realpath(repositoryRoot),
    ]),
    () => 'invalid_output_path' as const,
  ).andThen(([outputDirectory, absoluteRepositoryRoot]) => {
    const resolvedPath = join(outputDirectory, basename(absoluteOutputPath))
    return isWithinDirectory(absoluteRepositoryRoot, resolvedPath)
      ? errAsync<string, 'invalid_output_path'>('invalid_output_path')
      : okAsync(resolvedPath)
  })
}
