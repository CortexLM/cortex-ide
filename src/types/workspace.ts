/**
 * Workspace Types
 *
 * Centralized type definitions for workspace and project-related functionality
 * including folders, workspace files, and recent workspaces.
 */

// ============================================================================
// Workspace Folder Types
// ============================================================================

/**
 * Represents a folder within the workspace.
 */
export interface WorkspaceFolder {
  /** Absolute path to the folder */
  path: string;
  /** Display name for the folder */
  name: string;
  /** Custom color for the folder header */
  color?: string;
  /** Custom icon identifier */
  icon?: string;
}

/**
 * Represents a recent workspace entry.
 */
export interface RecentWorkspace {
  /** Unique identifier */
  id: string;
  /** Path to the workspace file (.cortex-workspace) or folder path for single-folder workspaces */
  path: string;
  /** Display name for the workspace */
  name: string;
  /** Timestamp of last opened */
  lastOpened: number;
  /** Whether this is a multi-folder workspace file */
  isWorkspaceFile: boolean;
  /** Number of folders in the workspace (for display) */
  folderCount: number;
}

// ============================================================================
// Workspace File Types
// ============================================================================

/**
 * User-defined settings for the workspace.
 */
export interface WorkspaceSettings {
  [key: string]: unknown;
}

/**
 * Cortex workspace file format (.cortex-workspace).
 */
export interface WorkspaceFile {
  /** Array of workspace folders */
  folders: Array<{
    path: string;
    name?: string;
    color?: string;
    icon?: string;
  }>;
  /** Workspace settings */
  settings: WorkspaceSettings;
}

/**
 * VS Code .code-workspace file format for compatibility.
 */
export interface CodeWorkspaceFile {
  /** Array of workspace folders in VS Code format */
  folders: Array<{ path: string; name?: string }>;
  /** VS Code settings */
  settings?: Record<string, unknown>;
  /** VS Code extensions recommendations */
  extensions?: {
    recommendations?: string[];
    unwantedRecommendations?: string[];
  };
  /** VS Code launch configurations */
  launch?: Record<string, unknown>;
  /** VS Code tasks */
  tasks?: Record<string, unknown>;
}

/**
 * Workspace format type.
 */
export type WorkspaceFormat = "cortex" | "vscode";

// ============================================================================
// File Tree Types
// ============================================================================

/**
 * Represents a file or folder in the file tree.
 */
export interface FileEntry {
  /** File or folder name */
  name: string;
  /** Full path */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Whether this is a symbolic link */
  isSymlink?: boolean;
  /** Children entries (for directories) */
  children?: FileEntry[];
  /** Whether children have been loaded */
  childrenLoaded?: boolean;
  /** File size in bytes */
  size?: number;
  /** Last modified timestamp */
  modifiedAt?: number;
}

/**
 * File metadata information.
 */
export interface FileMetadata {
  /** File size in bytes */
  size: number;
  /** Whether the path is a file */
  isFile: boolean;
  /** Whether the path is a directory */
  isDirectory: boolean;
  /** Whether the path is a symbolic link */
  isSymlink: boolean;
  /** Last modified time (Unix timestamp ms) */
  modified: number;
  /** Created time (Unix timestamp ms) */
  created: number;
  /** Whether the file is read-only */
  readonly: boolean;
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project configuration.
 */
export interface ProjectConfig {
  /** Project name */
  name: string;
  /** Root path */
  rootPath: string;
  /** Project description */
  description?: string;
  /** Associated git repository URL */
  repositoryUrl?: string;
  /** Project-specific settings */
  settings?: WorkspaceSettings;
}

/**
 * Predefined folder colors for multi-root workspaces.
 */
export interface FolderColor {
  /** Display name */
  name: string;
  /** Hex color value or undefined for default */
  value: string | undefined;
}

// ============================================================================
// Trust Types
// ============================================================================

/**
 * Workspace trust level.
 */
export type WorkspaceTrustLevel = "trusted" | "untrusted" | "unknown";

/**
 * Workspace trust state.
 */
export interface WorkspaceTrustState {
  /** Current trust level */
  level: WorkspaceTrustLevel;
  /** When trust was granted (if trusted) */
  trustedAt?: number;
  /** User who granted trust */
  trustedBy?: string;
}

// ============================================================================
// State Persistence Types
// ============================================================================

/**
 * Workspace state data for persistence (matches Rust WorkspaceStateData).
 */
export interface WorkspaceStateData {
  /** List of open editor entries */
  openEditors: EditorStateEntry[];
  /** URI of the active editor, or null */
  activeEditor: string | null;
  /** Layout configuration data */
  layout: Record<string, unknown> | null;
  /** Scroll positions keyed by editor URI */
  scrollPositions: Record<string, ScrollPosition>;
}

/**
 * Editor state entry for persistence.
 */
export interface EditorStateEntry {
  /** Editor document URI */
  uri: string;
  /** View column index */
  viewColumn: number;
  /** Whether the editor tab is pinned */
  isPinned: boolean;
  /** Whether the editor tab is in preview mode */
  isPreview: boolean;
}

/**
 * Scroll position for an editor.
 */
export interface ScrollPosition {
  /** 0-based line number */
  line: number;
  /** 0-based column number */
  column: number;
}

// ============================================================================
// Backend Communication Types
// ============================================================================

/**
 * Recent workspace entry from backend.
 */
export interface RecentWorkspaceBackend {
  /** Path to the workspace file or folder */
  path: string;
  /** Display name for the workspace */
  name: string;
  /** Timestamp of last opened */
  lastOpened: number;
  /** Whether this is a workspace file */
  isWorkspaceFile: boolean;
  /** Number of folders in the workspace */
  folderCount: number;
}

/**
 * Workspace file data from backend.
 */
export interface WorkspaceFileDataBackend {
  /** Array of workspace folder entries */
  folders: WorkspaceFolderEntryBackend[];
  /** Workspace settings */
  settings: Record<string, unknown>;
}

/**
 * Workspace folder entry from backend.
 */
export interface WorkspaceFolderEntryBackend {
  /** Absolute path to the folder */
  path: string;
  /** Optional display name */
  name?: string;
  /** Optional folder color */
  color?: string;
  /** Optional folder icon */
  icon?: string;
}

// ============================================================================
// Replace Preview Types
// ============================================================================

/**
 * Replace preview line (matches Rust ReplacePreviewLine).
 */
export interface ReplacePreviewLine {
  /** 1-based line number */
  lineNumber: number;
  /** Original line content */
  original: string;
  /** Replaced line content */
  replaced: string;
}

/**
 * Replace preview entry for a single file.
 */
export interface ReplacePreviewEntry {
  /** File URI */
  uri: string;
  /** Preview lines with replacements */
  lines: ReplacePreviewLine[];
  /** Total number of replacements in this file */
  totalReplacements: number;
}

/**
 * Full replace preview result.
 */
export interface ReplacePreviewResult {
  /** Array of per-file replace preview entries */
  entries: ReplacePreviewEntry[];
  /** Total number of files with replacements */
  totalFiles: number;
  /** Total number of replacements across all files */
  totalReplacements: number;
}

// ============================================================================
// Search History Persistence Types
// ============================================================================

/**
 * Search history persist entry (matches Rust SearchHistoryPersistEntry).
 */
export interface SearchHistoryPersistEntry {
  /** Unique identifier */
  id: string;
  /** Search pattern */
  pattern: string;
  /** Replace pattern, or null if not a replace operation */
  replacePattern: string | null;
  /** Whether the search is case sensitive */
  caseSensitive: boolean;
  /** Whether the pattern is a regular expression */
  useRegex: boolean;
  /** Whether to match whole words only */
  wholeWord: boolean;
  /** Timestamp of the search */
  timestamp: number;
  /** Number of results found */
  resultsCount: number;
}

// ============================================================================
// Display Types
// ============================================================================

/**
 * Folder display mode for workspace.
 */
export type FolderDisplayMode = "relative" | "absolute";
