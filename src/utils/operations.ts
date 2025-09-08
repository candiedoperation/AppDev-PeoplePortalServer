export function computeStringArrStateDiff(finalState: string[], currentState: string[]) {
  const finalSet = new Set(finalState);
  const currentSet = new Set(currentState);

  const additions = Array.from(finalSet).filter(user => !currentSet.has(user));
  const deletions = Array.from(currentSet).filter(user => !finalSet.has(user));
  
  return { additions, deletions };
}