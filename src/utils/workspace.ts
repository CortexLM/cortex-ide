/**
 * Workspace utilities for consistent project path handling
 * 
 * This module provides a unified way to access the current project path
 * from localStorage, handling the multiple key names that have been used
 * historically (projectPath and cortex_current_project).
 */

const PROJECT_PATH_KEY = "projectPath";
const cortex_PROJECT_KEY = "cortex_current_project";

/**
 * Get the current project path from localStorage.
 * Checks both "projectPath" and "cortex_current_project" keys for compatibility.
 * 
 * @returns The current project path, or empty string if not set
 */
export function getProjectPath(): string {
  return (
    localStorage.getItem(PROJECT_PATH_KEY) ||
    localStorage.getItem(cortex_PROJECT_KEY) ||
    ""
  );
}

/**
 * Set the current project path in localStorage.
 * Sets both keys for compatibility with existing code.
 * 
 * @param path - The project path to set
 */
export function setProjectPath(path: string): void {
  localStorage.setItem(PROJECT_PATH_KEY, path);
  localStorage.setItem(cortex_PROJECT_KEY, path);
}

/**
 * Clear the current project path from localStorage.
 * Removes both keys for full cleanup.
 */
export function clearProjectPath(): void {
  localStorage.removeItem(PROJECT_PATH_KEY);
  localStorage.removeItem(cortex_PROJECT_KEY);
}
