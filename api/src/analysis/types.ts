export type AnalysisFailure =
  | { kind: 'unavailable' }
  | { kind: 'insufficient' }
  | { kind: 'timeout' }
  | { kind: 'invalid-response' }
  | { kind: 'upstream-failure' }

export type AnalysisConfig = {
  baseUrl: string
  apiKey: string
  model: string
}
