import type { AnalysisClientError } from '#features/analysis/index'

export const commentCheckErrorMessage = (
  error: AnalysisClientError,
): string => {
  if (error.kind === 'authentication-required') {
    return 'Sign in to use comment checking.'
  }
  if (error.kind === 'invalid-response') {
    return 'The AI check could not return a usable result.'
  }
  if (error.kind !== 'http') return error.message
  if (error.status === 503) {
    return 'The comment check service is temporarily unavailable.'
  }
  if (error.code === 'ARTICLE_INSUFFICIENT') {
    return 'The article does not contain enough information for comment checking.'
  }
  if (
    error.code === 'ANALYSIS_TIMEOUT' ||
    error.code === 'ARTICLE_FETCH_TIMEOUT'
  ) {
    return 'The comment check timed out. Try again.'
  }
  if (
    error.code === 'INVALID_ANALYSIS_RESPONSE' ||
    error.code === 'ANALYSIS_UPSTREAM_FAILURE'
  ) {
    return 'The AI check could not return a usable result.'
  }
  return error.message
}
