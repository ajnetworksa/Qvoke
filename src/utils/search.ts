/**
 * Advanced multi-word tokenized, normalized search matching.
 * Returns true if all search terms in searchQuery are matched within the targetStrings.
 */
export const matchSearchQuery = (searchQuery: string, targetStrings: (any)[]): boolean => {
  const trimmed = searchQuery.trim();
  if (!trimmed) return true;
  
  // Split search query into individual words/tokens
  const terms = trimmed.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return true;

  // Normalizes string by lowercase and keeping letters (both English, Arabic, etc.) and digits.
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') : '';

  // Combine target strings and prepare their lowercase and normalized versions
  const lowerTargets = targetStrings.map(s => s !== null && s !== undefined ? String(s).toLowerCase() : '');
  const normTargets = targetStrings.map(s => s !== null && s !== undefined ? normalize(String(s)) : '');

  // Every search term must be matched in at least one of the targets (or combinations)
  return terms.every(term => {
    const nTerm = normalize(term);
    return lowerTargets.some((lower, idx) => {
      const norm = normTargets[idx];
      return lower.includes(term) || (nTerm && norm.includes(nTerm));
    });
  });
};
