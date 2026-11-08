import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: { BOOKMARKER_ORIGIN: 'https://bookmark-app.example.invalid' },
  },
})
