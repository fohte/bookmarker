export type QuoteMarkSegment = { text: string; marked: boolean }

export function markQuotes(
  comment: string,
  quotes: readonly string[],
): QuoteMarkSegment[] {
  const ranges = quotes
    .flatMap((quote) => {
      const start = quote === '' ? -1 : comment.indexOf(quote)
      return start === -1 ? [] : [{ start, end: start + quote.length }]
    })
    .sort((left, right) => left.start - right.start)

  const segments: QuoteMarkSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.end <= cursor) continue
    const start = Math.max(range.start, cursor)
    if (start > cursor) {
      segments.push({ text: comment.slice(cursor, start), marked: false })
    }
    segments.push({ text: comment.slice(start, range.end), marked: true })
    cursor = range.end
  }
  if (cursor < comment.length) {
    segments.push({ text: comment.slice(cursor), marked: false })
  }
  return segments
}
