import type { ComposeState } from '#features/editor/compose-state'
import { initialComposeState } from '#features/editor/compose-state'

export class ComposeStateStore {
  #state = initialComposeState
  #listeners = new Set<(state: ComposeState) => void>()

  get state(): ComposeState {
    return this.#state
  }

  subscribe(listener: (state: ComposeState) => void): () => void {
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  update(patch: Partial<ComposeState>): void {
    this.#state = { ...this.#state, ...patch }
    for (const listener of this.#listeners) listener(this.#state)
  }

  clearListeners(): void {
    this.#listeners.clear()
  }
}
