/**
 * Safe JSON parsing utilities with validation and fallback support.
 */

/**
 * Safely parses a JSON string with fallback on error.
 * Unlike JSON.parse, this won't throw on invalid JSON.
 * 
 * @param json - The JSON string to parse
 * @param fallback - The fallback value to return if parsing fails
 * @returns The parsed value or the fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (e) {
    console.warn('[JSON] Failed to parse:', e);
    return fallback;
  }
}

/**
 * Safely parses a JSON string and validates the result with a type guard.
 * 
 * @param json - The JSON string to parse
 * @param validator - A function that validates the parsed result
 * @param fallback - The fallback value to return if parsing or validation fails
 * @returns The parsed and validated value or the fallback
 */
export function safeJsonParseValidated<T>(
  json: string,
  validator: (value: unknown) => value is T,
  fallback: T
): T {
  try {
    const parsed = JSON.parse(json);
    if (validator(parsed)) {
      return parsed;
    }
    console.warn('[JSON] Validation failed for parsed value');
    return fallback;
  } catch (e) {
    console.warn('[JSON] Failed to parse:', e);
    return fallback;
  }
}

/**
 * Type guard to check if a value is an array.
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a non-null object.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely stringifies a value to JSON with error handling.
 * 
 * @param value - The value to stringify
 * @param fallback - The fallback string to return if stringification fails
 * @returns The JSON string or the fallback
 */
export function safeJsonStringify(value: unknown, fallback: string = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.warn('[JSON] Failed to stringify:', e);
    return fallback;
  }
}
