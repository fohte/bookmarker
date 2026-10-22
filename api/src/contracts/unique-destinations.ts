export function findDuplicateDestinationIndexes(
  destinations: readonly { destination: string }[],
): number[] {
  const seen = new Set<string>()
  const duplicates: number[] = []

  for (const [index, { destination }] of destinations.entries()) {
    if (seen.has(destination)) duplicates.push(index)
    seen.add(destination)
  }

  return duplicates
}
