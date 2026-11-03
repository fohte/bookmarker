import { fileURLToPath } from 'node:url'

import {
  authorizeHatena,
  prepareOutputPathOutsideRepository,
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

const outputPathErrorMessages = {
  invalid_output_path:
    'Choose an absolute output file path outside the repository.',
  output_path_resolution_failed:
    'The output path could not be resolved because of a filesystem error.',
  output_directory_failed: 'The output directory could not be created.',
} as const

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const commandArguments = process.argv.slice(2)
const [option, outputArgument, ...remainingArguments] =
  commandArguments[0] === '--' ? commandArguments.slice(1) : commandArguments

if (
  option !== '--output' ||
  outputArgument === undefined ||
  remainingArguments.length > 0
) {
  process.stderr.write(
    'Usage: pnpm --filter api authorize:hatena --output <absolute-path>\n',
  )
  process.exitCode = 1
} else {
  const resolvedPath = await prepareOutputPathOutsideRepository(
    outputArgument,
    repositoryRoot,
  )

  if (resolvedPath.isErr()) {
    process.stderr.write(`${outputPathErrorMessages[resolvedPath.error]}\n`)
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
