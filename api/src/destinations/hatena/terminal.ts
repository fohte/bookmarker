import { errAsync, ResultAsync } from 'neverthrow'

type HiddenInputStream = {
  isTTY?: boolean
  setRawMode?: (mode: boolean) => unknown
  resume: () => unknown
  pause: () => unknown
  on: (event: 'data', listener: (chunk: Buffer | string) => void) => unknown
  off: (event: 'data', listener: (chunk: Buffer | string) => void) => unknown
}

type PromptOutput = { write: (text: string) => unknown }

export const promptHidden = (
  label: string,
  input: HiddenInputStream = process.stdin,
  output: PromptOutput = process.stdout,
): ResultAsync<string, 'input_failed'> => {
  if (input.isTTY !== true || input.setRawMode === undefined) {
    return errAsync('input_failed')
  }

  return ResultAsync.fromPromise(
    new Promise<string>((resolvePrompt) => {
      let value = ''
      let completed = false

      const finish = (result: string) => {
        if (completed) return
        completed = true
        input.off('data', onData)
        input.setRawMode?.(false)
        input.pause()
        output.write('\n')
        resolvePrompt(result)
      }

      const onData = (chunk: Buffer | string) => {
        for (const character of chunk.toString()) {
          if (character === '\r' || character === '\n') {
            finish(value)
            return
          }
          if (character === '\u0003' || character === '\u0004') {
            finish('')
            return
          }
          if (character === '\u007f' || character === '\b') {
            value = Array.from(value).slice(0, -1).join('')
            continue
          }
          value += character
        }
      }

      output.write(label)
      input.on('data', onData)
      input.setRawMode?.(true)
      input.resume()
    }),
    () => 'input_failed' as const,
  )
}
