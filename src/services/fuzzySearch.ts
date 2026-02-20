/**
 * High-performance fuzzy matching algorithm with scoring and highlighting.
 *
 * Scoring bonuses:
 * - Consecutive character matches (exponential)
 * - Word boundary matches (path separators, camelCase, underscores)
 * - Start-of-string matches
 * - Exact case matches
 * - Shorter text bonus (prefer concise results)
 *
 * Penalties:
 * - Distance gaps between matched characters
 */

export interface FuzzyResult {
  score: number;
  matches: number[];
}

export interface FuzzyHighlightSegment {
  text: string;
  highlighted: boolean;
}

/**
 * Perform fuzzy matching of a query against text.
 * Returns a score (0 = no match) and matched character indices.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { score: 0, matches: [] };

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) qi++;
  }
  if (qi !== query.length) return { score: 0, matches: [] };

  const matches: number[] = [];
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;

  qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      matches.push(ti);

      let charScore = 1;

      if (lastMatchIndex === ti - 1) {
        consecutiveBonus++;
        charScore += consecutiveBonus * 5;
      } else {
        consecutiveBonus = 0;
      }

      if (ti === 0) {
        charScore += 10;
      } else {
        const prevChar = text[ti - 1];
        if (prevChar === "/" || prevChar === "\\") {
          charScore += 15;
        } else if (prevChar === "-" || prevChar === "_" || prevChar === "." || prevChar === " ") {
          charScore += 8;
        } else if (prevChar.toLowerCase() === prevChar && text[ti].toLowerCase() !== text[ti]) {
          charScore += 6;
        }
      }

      if (query[qi] === text[ti]) {
        charScore += 2;
      }

      if (lastMatchIndex >= 0 && ti - lastMatchIndex > 1) {
        charScore -= Math.min(ti - lastMatchIndex - 1, 3);
      }

      score += charScore;
      lastMatchIndex = ti;
      qi++;
    }
  }

  score = score * (1 + 10 / (text.length + 10));

  return { score, matches };
}

/**
 * Build highlight segments from text and matched indices.
 * Returns an array of segments with highlighted flag.
 */
export function fuzzyHighlight(text: string, matches: number[]): FuzzyHighlightSegment[] {
  if (!matches || matches.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments: FuzzyHighlightSegment[] = [];
  const matchSet = new Set(matches);
  let lastIndex = 0;

  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      if (i > lastIndex) {
        segments.push({ text: text.slice(lastIndex, i), highlighted: false });
      }
      segments.push({ text: text[i], highlighted: true });
      lastIndex = i + 1;
    }
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), highlighted: false });
  }

  return segments;
}

/**
 * Filter and sort items by fuzzy match score.
 * Items with score 0 are excluded.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  accessor: (item: T) => string,
  maxResults = 100,
): Array<T & { score: number; matches: number[] }> {
  if (!query.trim()) {
    return items.slice(0, maxResults).map(item => ({
      ...item,
      score: 0,
      matches: [] as number[],
    }));
  }

  return items
    .map(item => {
      const result = fuzzyMatch(query, accessor(item));
      return { ...item, score: result.score, matches: result.matches };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Multi-field fuzzy match: returns the best score across multiple fields.
 */
export function fuzzyMatchMulti(
  query: string,
  fields: string[],
): FuzzyResult {
  let best: FuzzyResult = { score: 0, matches: [] };
  for (const field of fields) {
    const result = fuzzyMatch(query, field);
    if (result.score > best.score) {
      best = result;
    }
  }
  return best;
}
