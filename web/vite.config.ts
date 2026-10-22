import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  optimizeDeps: {
    include: [
      '@base-ui/react',
      '@base-ui/react > use-sync-external-store/shim',
      '@base-ui/react > use-sync-external-store/shim/with-selector',
      '@fohte/storybook-addon/preview',
      '@storybook/addon-themes',
      '@storybook/react-vite',
      'api > zod',
      'msw-storybook-addon/csf3',
      'neverthrow',
    ],
  },
})
