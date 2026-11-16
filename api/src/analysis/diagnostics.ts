import type { AnalysisDiagnosticIssue } from '#analysis/types'

const SAFE_PATH_SEGMENTS = new Set([
  'status',
  'summary',
  'issues',
  'kind',
  'quote',
  'reason',
  'evidence',
  'choices',
  'index',
  'delta',
  'finish_reason',
  'content',
  'refusal',
  'tool_calls',
  'function_call',
])

const MAX_REPORTED_ISSUES = 20

export const summarizeZodIssues = (
  issues: readonly { path: readonly PropertyKey[]; code: string }[],
): {
  issues: readonly AnalysisDiagnosticIssue[]
  issueCount: number
  omittedIssueCount: number
} => ({
  issues: issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === 'number'
        ? segment
        : typeof segment === 'string' && SAFE_PATH_SEGMENTS.has(segment)
          ? segment
          : '<unknown>',
    ),
    code: issue.code,
  })),
  issueCount: issues.length,
  omittedIssueCount: Math.max(0, issues.length - MAX_REPORTED_ISSUES),
})
