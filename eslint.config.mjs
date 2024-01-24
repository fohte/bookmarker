import { mainConfig, typescriptConfig } from '@fohte/eslint-config'

export default [
  ...mainConfig,
  ...typescriptConfig,
  {
    ignores: [
      // ignore build files
      'out/**/*',
      '.next/**/*',
    ],
  },
]
