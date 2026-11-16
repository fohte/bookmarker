export type AnalysisDiagnosticIssue = {
  path: readonly (string | number)[]
  code: string
}

export type AnalysisDiagnosticDetails = Readonly<
  Record<string, string | number | boolean | readonly AnalysisDiagnosticIssue[]>
>

export type InvalidResponseReason =
  | 'content-type'
  | 'sse-parser'
  | 'chunk-json'
  | 'chunk-schema'
  | 'upstream-error-field'
  | 'unexpected-event'
  | 'empty-choices'
  | 'choice-shape'
  | 'refusal'
  | 'tool-call'
  | 'finish-reason'
  | 'content-limit'
  | 'stream-limit'
  | 'invalid-utf8'
  | 'missing-completion'
  | 'missing-body'
  | 'model-json'
  | 'model-schema'

export type AnalysisFailure =
  | { kind: 'unavailable' }
  | { kind: 'insufficient' }
  | { kind: 'timeout'; reason: 'request-timeout' | 'stream-timeout' }
  | {
      kind: 'invalid-response'
      reason: InvalidResponseReason
      details?: AnalysisDiagnosticDetails
    }
  | {
      kind: 'upstream-failure'
      reason: 'fetch-rejected' | 'http-error' | 'stream-read-failed'
      details?: AnalysisDiagnosticDetails
    }

export type AnalysisConfig = {
  baseUrl: string
  apiKey: string
  model: string
}
