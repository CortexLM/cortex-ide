/**
 * Settings Search with TF-IDF ranking for Cortex IDE
 */

// Search result
export interface SettingSearchResult {
  settingId: string;
  score: number;
  matchType: 'id' | 'title' | 'description' | 'enum' | 'tag';
  highlights: Array<{ start: number; end: number; field: string }>;
}

// Searchable setting
export interface SearchableSetting {
  id: string;
  title: string;
  description: string;
  enumValues?: string[];
  tags?: string[];
  category?: string;
}

// TF-IDF index
interface TFIDFIndex {
  documents: Map<string, TermFrequencies>;
  idf: Map<string, number>;
  totalDocuments: number;
}

interface TermFrequencies {
  [term: string]: number;
}

export interface SearchOptions {
  maxResults?: number;
  minScore?: number;
  boostId?: number;
  boostTitle?: number;
  boostDescription?: number;
  matchMode?: 'fuzzy' | 'contiguous' | 'word';
}

export interface SearchFilter {
  type: 'modified' | 'id' | 'ext' | 'lang' | 'tag' | 'hasPolicy' | 'feature';
  value?: string;
  negate?: boolean;
}

export interface FilterContext {
  modifiedSettings: Set<string>;
  extensionSettings: Map<string, string[]>;
  languageSettings: Map<string, string[]>;
  policySettings: Set<string>;
}

/**
 * Tokenize text into terms
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  
  // Convert to lowercase and split on non-alphanumeric characters
  const normalized = text.toLowerCase();
  
  // Split on whitespace, punctuation, and camelCase boundaries
  const tokens: string[] = [];
  
  // First split on whitespace and punctuation
  const parts = normalized.split(/[\s\-_.,;:!?'"()\[\]{}|\\/<>@#$%^&*+=~`]+/);
  
  for (const part of parts) {
    if (!part) continue;
    
    // Handle camelCase and PascalCase
    const camelSplit = part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
    
    for (const token of camelSplit) {
      if (token.length > 0) {
        tokens.push(token);
      }
    }
  }
  
  // Filter out very short tokens and stopwords
  const stopwords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
    'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
    'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
    'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just']);
  
  return tokens.filter(t => t.length > 1 && !stopwords.has(t));
}

/**
 * Calculate term frequency
 */
function calculateTF(terms: string[]): TermFrequencies {
  const tf: TermFrequencies = {};
  const totalTerms = terms.length;
  
  if (totalTerms === 0) return tf;
  
  // Count occurrences
  for (const term of terms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  
  // Normalize by total terms (augmented frequency to prevent bias toward longer documents)
  const maxFreq = Math.max(...Object.values(tf));
  for (const term of Object.keys(tf)) {
    tf[term] = 0.5 + 0.5 * (tf[term] / maxFreq);
  }
  
  return tf;
}

/**
 * Calculate inverse document frequency
 */
function calculateIDF(documents: Map<string, TermFrequencies>): Map<string, number> {
  const idf = new Map<string, number>();
  const totalDocs = documents.size;
  const termDocCount = new Map<string, number>();
  
  // Count how many documents contain each term
  for (const [, tf] of documents) {
    const seenTerms = new Set<string>();
    for (const term of Object.keys(tf)) {
      if (!seenTerms.has(term)) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
        seenTerms.add(term);
      }
    }
  }
  
  // Calculate IDF with smoothing
  for (const [term, count] of termDocCount) {
    // Using smoothed IDF: log((N + 1) / (df + 1)) + 1
    idf.set(term, Math.log((totalDocs + 1) / (count + 1)) + 1);
  }
  
  return idf;
}

/**
 * Build TF-IDF index from settings
 */
export function buildSearchIndex(settings: SearchableSetting[]): TFIDFIndex {
  const documents = new Map<string, TermFrequencies>();
  
  for (const setting of settings) {
    // Combine all searchable text for this setting
    const textParts: string[] = [
      setting.id,
      setting.title,
      setting.description,
      ...(setting.enumValues || []),
      ...(setting.tags || []),
      setting.category || ''
    ];
    
    const combinedText = textParts.join(' ');
    const terms = tokenize(combinedText);
    const tf = calculateTF(terms);
    
    documents.set(setting.id, tf);
  }
  
  const idf = calculateIDF(documents);
  
  return {
    documents,
    idf,
    totalDocuments: settings.length
  };
}

/**
 * Word-based matching (for typos)
 */
function wordBasedMatch(query: string, text: string): { score: number; highlights: Array<{ start: number; end: number }> } {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const highlights: Array<{ start: number; end: number }> = [];
  
  // Split query into words
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return { score: 0, highlights: [] };
  
  let totalScore = 0;
  let matchedWords = 0;
  
  for (const word of queryWords) {
    // Find best match for this word in text
    let bestMatchScore = 0;
    let bestMatchStart = -1;
    let bestMatchEnd = -1;
    
    // Try exact substring match first
    const exactIndex = textLower.indexOf(word);
    if (exactIndex !== -1) {
      bestMatchScore = 1.0;
      bestMatchStart = exactIndex;
      bestMatchEnd = exactIndex + word.length;
    } else {
      // Try Levenshtein-based matching for words in text
      const textWords = textLower.split(/[\s\-_.,;:]+/);
      let currentPos = 0;
      
      for (const textWord of textWords) {
        const wordStart = textLower.indexOf(textWord, currentPos);
        if (wordStart === -1) continue;
        
        const distance = levenshteinDistance(word, textWord);
        const maxLen = Math.max(word.length, textWord.length);
        const similarity = 1 - distance / maxLen;
        
        if (similarity > bestMatchScore && similarity > 0.6) {
          bestMatchScore = similarity;
          bestMatchStart = wordStart;
          bestMatchEnd = wordStart + textWord.length;
        }
        
        currentPos = wordStart + textWord.length;
      }
    }
    
    if (bestMatchScore > 0) {
      matchedWords++;
      totalScore += bestMatchScore;
      if (bestMatchStart !== -1) {
        highlights.push({ start: bestMatchStart, end: bestMatchEnd });
      }
    }
  }
  
  // Score based on percentage of query words matched
  const score = queryWords.length > 0 ? (totalScore / queryWords.length) * (matchedWords / queryWords.length) : 0;
  
  return { score, highlights: mergeHighlights(highlights) };
}

/**
 * Levenshtein distance calculation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Contiguous matching
 */
function contiguousMatch(query: string, text: string): { score: number; highlights: Array<{ start: number; end: number }> } {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const highlights: Array<{ start: number; end: number }> = [];
  
  if (!queryLower || !textLower) return { score: 0, highlights: [] };
  
  // Find all contiguous matches
  let searchStart = 0;
  let totalMatchLength = 0;
  
  while (searchStart < textLower.length) {
    const index = textLower.indexOf(queryLower, searchStart);
    if (index === -1) break;
    
    highlights.push({ start: index, end: index + queryLower.length });
    totalMatchLength += queryLower.length;
    searchStart = index + 1;
  }
  
  if (highlights.length === 0) {
    // Try partial contiguous match (prefix matching)
    for (let len = queryLower.length; len >= Math.min(3, queryLower.length); len--) {
      const partial = queryLower.substring(0, len);
      const index = textLower.indexOf(partial);
      if (index !== -1) {
        highlights.push({ start: index, end: index + len });
        // Score based on how much of the query matched
        const score = (len / queryLower.length) * 0.8; // 0.8 penalty for partial match
        return { score, highlights };
      }
    }
    return { score: 0, highlights: [] };
  }
  
  // Score based on match coverage and position (earlier matches score higher)
  const positionBonus = 1 - (highlights[0].start / textLower.length) * 0.2;
  const score = Math.min(1, (totalMatchLength / textLower.length) * 2) * positionBonus;
  
  return { score, highlights };
}

/**
 * Fuzzy matching (allows gaps)
 */
function fuzzyMatch(query: string, text: string): { score: number; highlights: Array<{ start: number; end: number }> } {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const highlights: Array<{ start: number; end: number }> = [];
  
  if (!queryLower || !textLower) return { score: 0, highlights: [] };
  
  let queryIndex = 0;
  let textIndex = 0;
  let consecutiveMatches = 0;
  let totalConsecutiveBonus = 0;
  let lastMatchIndex = -2;
  
  while (queryIndex < queryLower.length && textIndex < textLower.length) {
    if (queryLower[queryIndex] === textLower[textIndex]) {
      // Check if this is consecutive
      if (textIndex === lastMatchIndex + 1) {
        consecutiveMatches++;
        totalConsecutiveBonus += consecutiveMatches * 0.1;
        
        // Extend last highlight
        if (highlights.length > 0) {
          highlights[highlights.length - 1].end = textIndex + 1;
        }
      } else {
        consecutiveMatches = 1;
        highlights.push({ start: textIndex, end: textIndex + 1 });
      }
      
      lastMatchIndex = textIndex;
      queryIndex++;
    }
    textIndex++;
  }
  
  // All query characters must be found
  if (queryIndex < queryLower.length) {
    return { score: 0, highlights: [] };
  }
  
  // Calculate score based on:
  // 1. How compact the match is (less gap = better)
  // 2. Consecutive character bonus
  // 3. Position bonus (earlier = better)
  const matchSpan = highlights.length > 0 
    ? highlights[highlights.length - 1].end - highlights[0].start 
    : 0;
  const compactness = queryLower.length / Math.max(matchSpan, queryLower.length);
  const positionBonus = highlights.length > 0 
    ? 1 - (highlights[0].start / textLower.length) * 0.3 
    : 0;
  
  const score = (compactness * 0.6 + Math.min(totalConsecutiveBonus, 0.3) + positionBonus * 0.1);
  
  return { score: Math.min(1, score), highlights: mergeHighlights(highlights) };
}

/**
 * Merge overlapping highlights
 */
function mergeHighlights(highlights: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (highlights.length === 0) return [];
  
  // Sort by start position
  const sorted = [...highlights].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    if (current.start <= last.end) {
      // Overlapping or adjacent, merge
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Search settings using TF-IDF
 */
export function searchSettings(
  query: string,
  index: TFIDFIndex,
  settings: SearchableSetting[],
  options: SearchOptions = {}
): SettingSearchResult[] {
  const {
    maxResults = 50,
    minScore = 0.01,
    boostId = 2.0,
    boostTitle = 1.5,
    boostDescription = 1.0,
    matchMode = 'fuzzy'
  } = options;
  
  if (!query.trim()) return [];
  
  const queryTerms = tokenize(query);
  const queryTF = calculateTF(queryTerms);
  const results: SettingSearchResult[] = [];
  
  // Choose matching function based on mode
  const matchFn = matchMode === 'word' ? wordBasedMatch
    : matchMode === 'contiguous' ? contiguousMatch
    : fuzzyMatch;
  
  // Create settings map for quick lookup
  const settingsMap = new Map<string, SearchableSetting>();
  for (const setting of settings) {
    settingsMap.set(setting.id, setting);
  }
  
  for (const [settingId, docTF] of index.documents) {
    const setting = settingsMap.get(settingId);
    if (!setting) continue;
    
    // Calculate TF-IDF score
    let tfidfScore = 0;
    for (const term of Object.keys(queryTF)) {
      if (docTF[term]) {
        const idf = index.idf.get(term) || 1;
        tfidfScore += queryTF[term] * docTF[term] * idf;
      }
    }
    
    // Calculate direct match scores for different fields
    const idMatch = matchFn(query, setting.id);
    const titleMatch = matchFn(query, setting.title);
    const descMatch = matchFn(query, setting.description);
    
    // Check enum values
    let enumMatch = { score: 0, highlights: [] as Array<{ start: number; end: number }> };
    let bestEnumValue = '';
    if (setting.enumValues) {
      for (const enumVal of setting.enumValues) {
        const match = matchFn(query, enumVal);
        if (match.score > enumMatch.score) {
          enumMatch = match;
          bestEnumValue = enumVal;
        }
      }
    }
    
    // Check tags
    let tagMatch = { score: 0, highlights: [] as Array<{ start: number; end: number }> };
    let bestTag = '';
    if (setting.tags) {
      for (const tag of setting.tags) {
        const match = matchFn(query, tag);
        if (match.score > tagMatch.score) {
          tagMatch = match;
          bestTag = tag;
        }
      }
    }
    
    // Combine scores with boosts
    const combinedScore = 
      tfidfScore * 0.3 +
      idMatch.score * boostId +
      titleMatch.score * boostTitle +
      descMatch.score * boostDescription +
      enumMatch.score * 1.2 +
      tagMatch.score * 1.3;
    
    if (combinedScore < minScore) continue;
    
    // Determine best match type and highlights
    let matchType: 'id' | 'title' | 'description' | 'enum' | 'tag' = 'description';
    let highlights: Array<{ start: number; end: number; field: string }> = [];
    
    const scores = [
      { type: 'id' as const, score: idMatch.score * boostId, match: idMatch, field: 'id' },
      { type: 'title' as const, score: titleMatch.score * boostTitle, match: titleMatch, field: 'title' },
      { type: 'description' as const, score: descMatch.score * boostDescription, match: descMatch, field: 'description' },
      { type: 'enum' as const, score: enumMatch.score * 1.2, match: enumMatch, field: `enum:${bestEnumValue}` },
      { type: 'tag' as const, score: tagMatch.score * 1.3, match: tagMatch, field: `tag:${bestTag}` }
    ];
    
    scores.sort((a, b) => b.score - a.score);
    
    if (scores[0].score > 0) {
      matchType = scores[0].type;
      highlights = scores[0].match.highlights.map(h => ({ ...h, field: scores[0].field }));
    }
    
    // Add highlights from other significant matches
    for (let i = 1; i < scores.length; i++) {
      if (scores[i].score > minScore) {
        highlights.push(...scores[i].match.highlights.map(h => ({ ...h, field: scores[i].field })));
      }
    }
    
    results.push({
      settingId,
      score: combinedScore,
      matchType,
      highlights
    });
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  
  // Return top results
  return results.slice(0, maxResults);
}

/**
 * Parse search filters (@modified, @id:, @ext:, @lang:, @tag:)
 */
export function parseSearchFilters(query: string): {
  text: string;
  filters: SearchFilter[];
} {
  const filters: SearchFilter[] = [];
  let text = query;
  
  // Regex patterns for different filter types
  const filterPatterns = [
    { regex: /@modified\b/gi, type: 'modified' as const },
    { regex: /@hasPolicy\b/gi, type: 'hasPolicy' as const },
    { regex: /!@id:(\S+)/gi, type: 'id' as const, negate: true },
    { regex: /@id:(\S+)/gi, type: 'id' as const },
    { regex: /!@ext:(\S+)/gi, type: 'ext' as const, negate: true },
    { regex: /@ext:(\S+)/gi, type: 'ext' as const },
    { regex: /!@lang:(\S+)/gi, type: 'lang' as const, negate: true },
    { regex: /@lang:(\S+)/gi, type: 'lang' as const },
    { regex: /!@tag:(\S+)/gi, type: 'tag' as const, negate: true },
    { regex: /@tag:(\S+)/gi, type: 'tag' as const },
    { regex: /!@feature:(\S+)/gi, type: 'feature' as const, negate: true },
    { regex: /@feature:(\S+)/gi, type: 'feature' as const }
  ];
  
  for (const pattern of filterPatterns) {
    let match;
    while ((match = pattern.regex.exec(query)) !== null) {
      const filter: SearchFilter = {
        type: pattern.type,
        negate: pattern.negate || false
      };
      
      if (match[1]) {
        filter.value = match[1];
      }
      
      filters.push(filter);
      text = text.replace(match[0], '');
    }
  }
  
  // Clean up remaining text
  text = text.replace(/\s+/g, ' ').trim();
  
  return { text, filters };
}

/**
 * Apply filters to settings
 */
export function applyFilters(
  settings: SearchableSetting[],
  filters: SearchFilter[],
  context: FilterContext
): SearchableSetting[] {
  if (filters.length === 0) return settings;
  
  return settings.filter(setting => {
    for (const filter of filters) {
      let matches = false;
      
      switch (filter.type) {
        case 'modified':
          matches = context.modifiedSettings.has(setting.id);
          break;
          
        case 'id':
          if (filter.value) {
            matches = setting.id.toLowerCase().includes(filter.value.toLowerCase());
          }
          break;
          
        case 'ext':
          if (filter.value) {
            const extSettings = context.extensionSettings.get(filter.value.toLowerCase());
            matches = extSettings ? extSettings.includes(setting.id) : false;
          }
          break;
          
        case 'lang':
          if (filter.value) {
            const langSettings = context.languageSettings.get(filter.value.toLowerCase());
            matches = langSettings ? langSettings.includes(setting.id) : false;
          }
          break;
          
        case 'tag':
          if (filter.value && setting.tags) {
            matches = setting.tags.some(tag => 
              tag.toLowerCase().includes(filter.value!.toLowerCase())
            );
          }
          break;
          
        case 'hasPolicy':
          matches = context.policySettings.has(setting.id);
          break;
          
        case 'feature':
          if (filter.value) {
            // Check if setting is related to a feature (in id, category, or tags)
            const featureLower = filter.value.toLowerCase();
            matches = setting.id.toLowerCase().includes(featureLower) ||
              (setting.category?.toLowerCase().includes(featureLower) ?? false) ||
              (setting.tags?.some(t => t.toLowerCase().includes(featureLower)) ?? false);
          }
          break;
      }
      
      // Handle negation
      if (filter.negate) {
        if (matches) return false;
      } else {
        if (!matches) return false;
      }
    }
    
    return true;
  });
}

/**
 * Get search suggestions
 */
export function getSearchSuggestions(
  partial: string,
  index: TFIDFIndex,
  limit: number = 10
): string[] {
  if (!partial || partial.length < 2) return [];
  
  const partialLower = partial.toLowerCase();
  const suggestions: Array<{ term: string; score: number }> = [];
  
  // Collect all unique terms from the index
  const allTerms = new Set<string>();
  for (const [, tf] of index.documents) {
    for (const term of Object.keys(tf)) {
      allTerms.add(term);
    }
  }
  
  // Find terms that match the partial query
  for (const term of allTerms) {
    let score = 0;
    
    // Prefix match (highest priority)
    if (term.startsWith(partialLower)) {
      score = 1.0 - (term.length - partialLower.length) * 0.01;
    }
    // Contains match
    else if (term.includes(partialLower)) {
      score = 0.5 - term.indexOf(partialLower) * 0.01;
    }
    // Fuzzy match for short partials
    else if (partialLower.length >= 3) {
      const distance = levenshteinDistance(partialLower, term.substring(0, partialLower.length + 2));
      if (distance <= 2) {
        score = 0.3 - distance * 0.1;
      }
    }
    
    if (score > 0) {
      // Boost by IDF (more unique terms are more interesting)
      const idf = index.idf.get(term) || 1;
      score *= Math.min(idf, 2);
      
      suggestions.push({ term, score });
    }
  }
  
  // Sort by score and return top suggestions
  suggestions.sort((a, b) => b.score - a.score);
  
  return suggestions.slice(0, limit).map(s => s.term);
}

/**
 * Highlight matches in text
 */
export function highlightMatches(
  text: string,
  highlights: Array<{ start: number; end: number }>
): Array<{ text: string; highlighted: boolean }> {
  if (!text || highlights.length === 0) {
    return [{ text, highlighted: false }];
  }
  
  // Merge and sort highlights
  const merged = mergeHighlights(highlights);
  const result: Array<{ text: string; highlighted: boolean }> = [];
  
  let currentIndex = 0;
  
  for (const highlight of merged) {
    // Validate highlight bounds
    const start = Math.max(0, Math.min(highlight.start, text.length));
    const end = Math.max(start, Math.min(highlight.end, text.length));
    
    // Add non-highlighted text before this highlight
    if (currentIndex < start) {
      result.push({
        text: text.substring(currentIndex, start),
        highlighted: false
      });
    }
    
    // Add highlighted text
    if (start < end) {
      result.push({
        text: text.substring(start, end),
        highlighted: true
      });
    }
    
    currentIndex = end;
  }
  
  // Add remaining non-highlighted text
  if (currentIndex < text.length) {
    result.push({
      text: text.substring(currentIndex),
      highlighted: false
    });
  }
  
  return result;
}

/**
 * Create an empty filter context
 */
export function createEmptyFilterContext(): FilterContext {
  return {
    modifiedSettings: new Set(),
    extensionSettings: new Map(),
    languageSettings: new Map(),
    policySettings: new Set()
  };
}

/**
 * Quick search without building full index (for small datasets)
 */
export function quickSearch(
  query: string,
  settings: SearchableSetting[],
  options: SearchOptions = {}
): SettingSearchResult[] {
  const index = buildSearchIndex(settings);
  return searchSettings(query, index, settings, options);
}
