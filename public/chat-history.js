export function mergeChatEvents(existing, incoming) {
 const bySequence = new Map();
 for (const event of [...(existing || []), ...(incoming || [])]) {
  if (!event || event.sequence === undefined || event.sequence === null) continue;
  const sequence = Number(event.sequence);
  if (!Number.isFinite(sequence)) continue;
  bySequence.set(sequence, {...event, sequence});
 }
 return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}
