/**
 * Application configuration for API connections
 */

// Default API base URL for the Cortex SDK connection
// This can be updated at runtime if needed
let apiBaseUrl = "http://localhost:3000";

/**
 * Get the current API base URL
 */
export const API_BASE_URL = apiBaseUrl;

/**
 * Update the API base URL at runtime
 * @param newUrl - The new base URL to use for API connections
 */
export function updateApiBaseUrl(newUrl: string): void {
  apiBaseUrl = newUrl;
}

/**
 * Get WebSocket URL for a given path
 * Converts HTTP URL to WebSocket URL (http -> ws, https -> wss)
 * @param path - The path to append to the WebSocket base URL
 * @returns The full WebSocket URL
 */
export function getWsUrl(path: string): string {
  // Convert http(s) to ws(s)
  const wsBase = apiBaseUrl.replace(/^http/, "ws");
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsBase}${normalizedPath}`;
}
