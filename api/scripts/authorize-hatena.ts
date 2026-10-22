import { fileURLToPath } from 'node:url'

import {
  authorizeHatena,
  resolveOutputPathOutsideRepository,
  writeCredentialsFile,
} from '#destinations/hatena/authorize'
import { promptHidden } from '#destinations/hatena/terminal'

const authorizationErrorMessages = {
  input_failed: 'Interactive input failed.',
  invalid_input: 'A required input was empty.',
  request_failed: 'Hatena could not be reached.',
  provider_rejected: 'Hatena rejected the authorization request.',
  invalid_response: 'Hatena returned an invalid response.',
  output_failed: 'The credentials file could not be created.',
} as const

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const [option, outputArgument, ...remainingArguments] = process.argv.slice(2)

if (
  option !== '--output' ||
  outputArgument === undefined ||
  remainingArguments.length > 0
) {
  process.stderr.write(
    'Usage: pnpm --filter api authorize:hatena -- --output <absolute-path>\n',
  )
  process.exitCode = 1
} else {
  const resolvedPath = await resolveOutputPathOutsideRepository(
    outputArgument,
    repositoryRoot,
  )

  if (resolvedPath.isErr()) {
    process.stderr.write(
      'Choose an absolute output file path outside the repository.\n',
    )
    process.exitCode = 1
  } else {
    const result = await authorizeHatena(resolvedPath.value, {
      fetch,
      prompt: promptHidden,
      writeLine: (line) => process.stdout.write(`${line}\n`),
      writeCredentials: writeCredentialsFile,
    })

    if (result.isErr()) {
      process.stderr.write(`${authorizationErrorMessages[result.error]}\n`)
      process.exitCode = 1
    } else {
      process.stdout.write(`Credentials saved to ${resolvedPath.value}\n`)
    }
  }
}
