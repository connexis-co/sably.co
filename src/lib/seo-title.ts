/** Choose complete editorial phrases; never cut a course name mid-word. */
export function conciseTitle(preferred: string, alternatives: string[] = []): string {
  const options = [preferred, ...alternatives].map(value => value.trim()).filter(Boolean);
  const chosen = options.find(value => [...value].length <= 60)
    ?? options.reduce((shortest, value) => value.length < shortest.length ? value : shortest);
  if (/\bsably\b/i.test(chosen)) return chosen;
  return [...`${chosen} | Sably`].length <= 60 ? `${chosen} | Sably` : chosen;
}
