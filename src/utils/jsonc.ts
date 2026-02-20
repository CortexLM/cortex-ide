/**
 * JSONC (JSON with Comments) parser utility
 * Handles VS Code style JSON files that may contain:
 * - Single-line comments (starting with //)
 * - Multi-line comments (starting with slash-star and ending with star-slash)
 * - Trailing commas
 */

/**
 * Parses JSONC (JSON with comments) content into a JavaScript object.
 * Removes comments and trailing commas before parsing.
 * 
 * @param content - The JSONC string to parse
 * @returns The parsed JavaScript object
 * @throws SyntaxError if the content cannot be parsed as JSON
 */
export function parseJsonc<T = unknown>(content: string): T {
  // Remove single-line comments (// ...) but not within strings
  // This regex is conservative - it only removes // comments that:
  // - Start at the beginning of a line (after whitespace)
  // - Or follow a comma, colon, bracket, or brace
  let result = content;
  
  // Step 1: Remove multi-line comments /* ... */
  // Be careful not to match inside strings
  result = removeMultiLineComments(result);
  
  // Step 2: Remove single-line comments // ...
  result = removeSingleLineComments(result);
  
  // Step 3: Remove trailing commas before } or ]
  result = removeTrailingCommas(result);
  
  // Parse the cleaned JSON
  return JSON.parse(result);
}

/**
 * Removes multi-line comments from JSONC content.
 * Handles nested strings properly.
 */
function removeMultiLineComments(content: string): string {
  const result: string[] = [];
  let i = 0;
  let inString = false;
  let stringChar = '';
  
  while (i < content.length) {
    // Track string boundaries to avoid removing comments inside strings
    if (!inString && (content[i] === '"' || content[i] === "'")) {
      inString = true;
      stringChar = content[i];
      result.push(content[i]);
      i++;
      continue;
    }
    
    if (inString) {
      // Check for escape sequence
      if (content[i] === '\\' && i + 1 < content.length) {
        result.push(content[i], content[i + 1]);
        i += 2;
        continue;
      }
      // Check for end of string
      if (content[i] === stringChar) {
        inString = false;
        stringChar = '';
      }
      result.push(content[i]);
      i++;
      continue;
    }
    
    // Check for multi-line comment start
    if (content[i] === '/' && i + 1 < content.length && content[i + 1] === '*') {
      // Skip until we find */
      i += 2;
      while (i < content.length) {
        if (content[i] === '*' && i + 1 < content.length && content[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      // Add a space to prevent token concatenation
      result.push(' ');
      continue;
    }
    
    result.push(content[i]);
    i++;
  }
  
  return result.join('');
}

/**
 * Removes single-line comments (// ...) from JSONC content.
 * Handles strings properly.
 */
function removeSingleLineComments(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (const line of lines) {
    let processedLine = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    
    while (i < line.length) {
      // Track string boundaries
      if (!inString && (line[i] === '"' || line[i] === "'")) {
        inString = true;
        stringChar = line[i];
        processedLine += line[i];
        i++;
        continue;
      }
      
      if (inString) {
        // Check for escape sequence
        if (line[i] === '\\' && i + 1 < line.length) {
          processedLine += line[i] + line[i + 1];
          i += 2;
          continue;
        }
        // Check for end of string
        if (line[i] === stringChar) {
          inString = false;
          stringChar = '';
        }
        processedLine += line[i];
        i++;
        continue;
      }
      
      // Check for single-line comment
      if (line[i] === '/' && i + 1 < line.length && line[i + 1] === '/') {
        // Rest of line is a comment, stop processing
        break;
      }
      
      processedLine += line[i];
      i++;
    }
    
    result.push(processedLine);
  }
  
  return result.join('\n');
}

/**
 * Removes trailing commas before closing brackets/braces.
 */
function removeTrailingCommas(content: string): string {
  // Match comma followed by optional whitespace/newlines and then } or ]
  return content.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Safely parses JSONC content, returning a default value on error.
 * 
 * @param content - The JSONC string to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed object or the default value
 */
export function parseJsoncSafe<T>(content: string, defaultValue: T): T {
  try {
    return parseJsonc<T>(content);
  } catch (error) {
    console.warn('[JSONC] Failed to parse content:', error);
    return defaultValue;
  }
}

/**
 * Checks if a string is valid JSONC.
 * 
 * @param content - The content to validate
 * @returns true if the content is valid JSONC
 */
export function isValidJsonc(content: string): boolean {
  try {
    parseJsonc(content);
    return true;
  } catch {
    return false;
  }
}
