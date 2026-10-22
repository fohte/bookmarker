import type { ReactNode } from 'react'

import { ComposeRoute } from '#routes/compose'

export function App({ children }: { children?: ReactNode }) {
  return children ?? <ComposeRoute />
}
