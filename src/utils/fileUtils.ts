/**
 * File utility functions for path manipulation and unique name generation
 */

import { fsExists } from "./tauri-api";

// ============================================================================
// Path Manipulation Utilities
// ============================================================================

/**
 * Get the directory name from a path (everything before the last separator)
 */
export function dirname(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const lastSlash = normalizedPath.lastIndexOf("/");
  if (lastSlash === -1) return ".";
  if (lastSlash === 0) return "/";
  return normalizedPath.slice(0, lastSlash);
}

/**
 * Get the base name from a path (last component)
 * Optionally strip the extension if provided
 */
export function basename(path: string, ext?: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  let name = normalizedPath.split("/").pop() || "";
  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length);
  }
  return name;
}

/**
 * Get the extension from a filename (including the dot)
 * Returns empty string if no extension
 */
export function extname(path: string): string {
  const name = basename(path);
  const dotIndex = name.lastIndexOf(".");
  // Ensure we don't treat dotfiles (like .gitignore) as having no name and only extension
  return dotIndex > 0 ? name.slice(dotIndex) : "";
}

/**
 * Join directory and filename with the appropriate separator
 * Preserves the separator style of the directory path
 */
export function joinPath(dir: string, name: string): string {
  // Use forward slash if dir contains forward slashes, otherwise use backslash for Windows paths
  const sep = dir.includes("/") ? "/" : "\\";
  // Remove trailing separator from dir if present
  const cleanDir = dir.replace(/[/\\]$/, "");
  return `${cleanDir}${sep}${name}`;
}

// ============================================================================
// Unique Path Generation
// ============================================================================

const MAX_COUNTER = 1000;

/**
 * Generate a unique path by appending incrementing numbers like "file (1).txt"
 * if the original path already exists.
 * 
 * @param basePath - The desired file path
 * @returns A unique path that doesn't exist yet
 * @throws Error if unable to generate unique filename after MAX_COUNTER attempts
 * 
 * @example
 * // If "document.txt" exists, returns "document (1).txt"
 * // If "document (1).txt" also exists, returns "document (2).txt"
 * const uniquePath = await generateUniquePath("/path/to/document.txt");
 */
export async function generateUniquePath(basePath: string): Promise<string> {
  // Check if path exists
  try {
    const exists = await fsExists(basePath);
    if (!exists) {
      return basePath;
    }
  } catch {
    // If we can't check existence, assume it doesn't exist
    return basePath;
  }

  const dir = dirname(basePath);
  const ext = extname(basePath);
  const nameWithoutExt = basename(basePath, ext);

  // Try incrementing numbers
  let counter = 1;
  let newPath: string;

  do {
    newPath = joinPath(dir, `${nameWithoutExt} (${counter})${ext}`);
    counter++;
    
    try {
      const exists = await fsExists(newPath);
      if (!exists) {
        return newPath;
      }
    } catch {
      // If we can't check existence, return this path
      return newPath;
    }
  } while (counter < MAX_COUNTER);

  throw new Error(`Could not generate unique filename after ${MAX_COUNTER} attempts`);
}

/**
 * Generate a unique path for multiple source files being copied to a target directory.
 * Useful for batch copy operations.
 * 
 * @param sourcePaths - Array of source file paths
 * @param targetDir - Target directory path
 * @returns Map of source paths to unique destination paths
 */
export async function generateUniquePathsForBatch(
  sourcePaths: string[],
  targetDir: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  // Track paths we've already allocated to avoid conflicts within the batch
  const allocatedPaths = new Set<string>();
  
  for (const sourcePath of sourcePaths) {
    const fileName = basename(sourcePath);
    let targetPath = joinPath(targetDir, fileName);
    
    // Check if already allocated in this batch
    if (allocatedPaths.has(targetPath.toLowerCase())) {
      targetPath = await generateUniquePathWithExclusions(targetPath, allocatedPaths);
    } else {
      targetPath = await generateUniquePath(targetPath);
    }
    
    result.set(sourcePath, targetPath);
    allocatedPaths.add(targetPath.toLowerCase());
  }
  
  return result;
}

/**
 * Generate a unique path while also excluding paths that are already allocated
 * (useful for batch operations where we need to track what we've already used)
 */
async function generateUniquePathWithExclusions(
  basePath: string,
  excludedPaths: Set<string>
): Promise<string> {
  // First check if the base path works
  const baseExists = await fsExists(basePath).catch(() => false);
  const baseExcluded = excludedPaths.has(basePath.toLowerCase());
  
  if (!baseExists && !baseExcluded) {
    return basePath;
  }

  const dir = dirname(basePath);
  const ext = extname(basePath);
  const nameWithoutExt = basename(basePath, ext);

  let counter = 1;
  let newPath: string;

  do {
    newPath = joinPath(dir, `${nameWithoutExt} (${counter})${ext}`);
    counter++;
    
    const exists = await fsExists(newPath).catch(() => false);
    const excluded = excludedPaths.has(newPath.toLowerCase());
    
    if (!exists && !excluded) {
      return newPath;
    }
  } while (counter < MAX_COUNTER);

  throw new Error(`Could not generate unique filename after ${MAX_COUNTER} attempts`);
}
