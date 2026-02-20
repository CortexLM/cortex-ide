/**
 * Tauri API utilities
 * Replaces HTTP API calls with direct Tauri invoke commands
 * 
 * Performance optimizations:
 * - Batch IPC calls to reduce round-trip overhead
 * - Client-side caching with TTL for file stats and existence checks
 * - Request deduplication for concurrent identical requests
 * - Prefetching support for directory trees
 */

import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Performance: Client-side caching and batching
// ============================================================================

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

/** LRU cache with TTL for IPC results */
class IPCCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 500, defaultTTL = 5000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end for LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttl = this.defaultTTL): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    
    this.cache.set(key, { value, timestamp: Date.now(), ttl });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Request deduplication for concurrent identical IPC calls */
class RequestDeduplicator {
  private pending = new Map<string, Promise<unknown>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// Global caches for different data types
const existsCache = new IPCCache<boolean>(1000, 10000); // 10s TTL
const metadataCache = new IPCCache<FileMetadata>(500, 10000); // 10s TTL
const directoryCache = new IPCCache<FileEntry[]>(200, 5000); // 5s TTL
const deduplicator = new RequestDeduplicator();

// ============================================================================
// Batch IPC Types and Utilities
// ============================================================================

interface BatchCommand {
  type: string;
  params: Record<string, unknown>;
}

interface BatchResult {
  status: "ok" | "error";
  data?: unknown;
  cached?: boolean;
  message?: string;
}

/** Execute multiple IPC commands in a single batch */
export async function batchCommands(commands: BatchCommand[]): Promise<BatchResult[]> {
  return invoke<BatchResult[]>("batch_commands", { commands });
}

/** Batch read multiple files in one IPC call */
export async function batchReadFiles(paths: string[]): Promise<Map<string, string | Error>> {
  const results = await batchCommands(
    paths.map(path => ({ type: "fs_read_file", params: { path } }))
  );
  
  const map = new Map<string, string | Error>();
  paths.forEach((path, i) => {
    const result = results[i];
    if (result.status === "ok") {
      map.set(path, result.data as string);
    } else {
      map.set(path, new Error(result.message || "Unknown error"));
    }
  });
  
  return map;
}

/** Batch check existence of multiple paths */
export async function batchExists(paths: string[]): Promise<Map<string, boolean>> {
  // Check cache first
  const uncached: string[] = [];
  const results = new Map<string, boolean>();
  
  for (const path of paths) {
    const cached = existsCache.get(`exists:${path}`);
    if (cached !== undefined) {
      results.set(path, cached);
    } else {
      uncached.push(path);
    }
  }
  
  if (uncached.length === 0) return results;
  
  // Fetch uncached in batch
  const batchResults = await invoke<BatchResult[]>("batch_commands", {
    commands: [{ type: "fs_exists_batch", params: { paths: uncached } }]
  }).then(r => r[0].data as Record<string, boolean>);
  
  for (const [path, exists] of Object.entries(batchResults)) {
    results.set(path, exists);
    existsCache.set(`exists:${path}`, exists);
  }
  
  return results;
}

/** Batch get metadata for multiple files */
export async function batchGetMetadata(paths: string[]): Promise<Map<string, FileMetadata | Error>> {
  // Check cache first
  const uncached: string[] = [];
  const results = new Map<string, FileMetadata | Error>();
  
  for (const path of paths) {
    const cached = metadataCache.get(`metadata:${path}`);
    if (cached !== undefined) {
      results.set(path, cached);
    } else {
      uncached.push(path);
    }
  }
  
  if (uncached.length === 0) return results;
  
  // Fetch uncached in batch
  const batchResults = await batchCommands(
    uncached.map(path => ({ type: "fs_get_metadata", params: { path } }))
  );
  
  uncached.forEach((path, i) => {
    const result = batchResults[i];
    if (result.status === "ok") {
      const metadata = result.data as FileMetadata;
      results.set(path, metadata);
      metadataCache.set(`metadata:${path}`, metadata);
    } else {
      results.set(path, new Error(result.message || "Unknown error"));
    }
  });
  
  return results;
}

/** Prefetch directory contents into cache for faster subsequent access */
export async function prefetchDirectories(paths: string[]): Promise<void> {
  return invoke("fs_prefetch_directory", { 
    paths, 
    showHidden: false, 
    includeIgnored: false 
  });
}

/** Invalidate client-side caches for a path */
export function invalidateCache(path: string): void {
  existsCache.invalidate(`exists:${path}`);
  metadataCache.invalidate(`metadata:${path}`);
  directoryCache.invalidatePrefix(path);
  // Also invalidate parent directory
  const parentPath = path.substring(0, path.lastIndexOf('/'));
  if (parentPath) {
    directoryCache.invalidate(parentPath);
  }
}

/** Clear all client-side caches */
export function clearAllCaches(): void {
  existsCache.clear();
  metadataCache.clear();
  directoryCache.clear();
}

// ============================================================================
// File System API
// ============================================================================

export interface FileEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  size?: number;
  modified?: number;
}

export interface FileMetadata {
  size: number;
  modified: number;
  created: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  readonly: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

/** Read file content as string */
export async function fsReadFile(path: string): Promise<string> {
  return invoke<string>("fs_read_file", { path });
}

/** Read file content as base64 binary */
export async function fsReadFileBinary(path: string): Promise<string> {
  return invoke<string>("fs_read_file_binary", { path });
}

/** Write content to file (invalidates caches) */
export async function fsWriteFile(path: string, content: string): Promise<void> {
  await invoke("fs_write_file", { path, content });
  invalidateCache(path);
}

/** Write binary content (base64) to file (invalidates caches) */
export async function fsWriteFileBinary(path: string, content: string): Promise<void> {
  await invoke("fs_write_file_binary", { path, content });
  invalidateCache(path);
}

/** Delete a file (invalidates caches) */
export async function fsDeleteFile(path: string): Promise<void> {
  await invoke("fs_delete_file", { path });
  invalidateCache(path);
}

/** Create an empty file (invalidates caches) */
export async function fsCreateFile(path: string): Promise<void> {
  await invoke("fs_create_file", { path });
  invalidateCache(path);
}

/** Create a directory (invalidates caches) */
export async function fsCreateDirectory(path: string): Promise<void> {
  await invoke("fs_create_directory", { path });
  invalidateCache(path);
}

/** Delete a directory (invalidates caches) */
export async function fsDeleteDirectory(path: string, recursive?: boolean): Promise<void> {
  await invoke("fs_delete_directory", { path, recursive: recursive ?? false });
  invalidateCache(path);
}

/** Rename/move a file or directory (invalidates caches) */
export async function fsRename(oldPath: string, newPath: string): Promise<void> {
  await invoke("fs_rename", { oldPath, newPath });
  invalidateCache(oldPath);
  invalidateCache(newPath);
}

/** Copy a file (invalidates destination cache) */
export async function fsCopyFile(source: string, destination: string): Promise<void> {
  await invoke("fs_copy_file", { source, destination });
  invalidateCache(destination);
}

/** Move a file or directory (invalidates caches) */
export async function fsMove(source: string, destination: string): Promise<void> {
  await invoke("fs_move", { source, destination });
  invalidateCache(source);
  invalidateCache(destination);
}

/** List directory contents (with caching and deduplication) */
export async function fsListDirectory(path: string): Promise<FileEntry[]> {
  // Check cache first
  const cached = directoryCache.get(`dir:${path}`);
  if (cached !== undefined) return cached;
  
  // Deduplicate concurrent requests
  return deduplicator.dedupe(`dir:${path}`, async () => {
    const entries = await invoke<FileEntry[]>("fs_list_directory", { path });
    directoryCache.set(`dir:${path}`, entries);
    return entries;
  });
}

/** Get file tree */
export async function fsGetFileTree(path: string, depth?: number): Promise<FileTreeNode> {
  return invoke<FileTreeNode>("fs_get_file_tree", { path, depth: depth ?? 10, showHidden: false, includeIgnored: false });
}

/** Get shallow file tree (single level) */
export async function fsGetFileTreeShallow(path: string): Promise<FileTreeNode> {
  return invoke<FileTreeNode>("fs_get_file_tree_shallow", { path, showHidden: false, includeIgnored: false });
}

/** Get file metadata (with caching and deduplication) */
export async function fsGetMetadata(path: string): Promise<FileMetadata> {
  // Check cache first
  const cached = metadataCache.get(`metadata:${path}`);
  if (cached !== undefined) return cached;
  
  // Deduplicate concurrent requests
  return deduplicator.dedupe(`metadata:${path}`, async () => {
    const metadata = await invoke<FileMetadata>("fs_get_metadata", { path });
    metadataCache.set(`metadata:${path}`, metadata);
    return metadata;
  });
}

/** Check if path exists (with caching and deduplication) */
export async function fsExists(path: string): Promise<boolean> {
  // Check cache first
  const cached = existsCache.get(`exists:${path}`);
  if (cached !== undefined) return cached;
  
  // Deduplicate concurrent requests for the same path
  return deduplicator.dedupe(`exists:${path}`, async () => {
    const exists = await invoke<boolean>("fs_exists", { path });
    existsCache.set(`exists:${path}`, exists);
    return exists;
  });
}

/** Check if path is a file */
export async function fsIsFile(path: string): Promise<boolean> {
  return invoke<boolean>("fs_is_file", { path });
}

/** Check if path is a directory */
export async function fsIsDirectory(path: string): Promise<boolean> {
  return invoke<boolean>("fs_is_directory", { path });
}

/** Reveal file in system explorer */
export async function fsRevealInExplorer(path: string): Promise<void> {
  return invoke("fs_reveal_in_explorer", { path });
}

/** Open file with default application */
export async function fsOpenWithDefault(path: string): Promise<void> {
  return invoke("fs_open_with_default", { path });
}

/** Move file to trash (invalidates caches) */
export async function fsTrash(path: string): Promise<void> {
  await invoke("fs_trash", { path });
  invalidateCache(path);
}

// ============================================================================
// Line Ending Detection API
// ============================================================================

/** Line ending types */
export type LineEndingType = "LF" | "CRLF" | "CR" | "Mixed";

/** Detect line endings in a file */
export async function fsDetectEol(path: string): Promise<LineEndingType> {
  return invoke<LineEndingType>("fs_detect_eol", { path });
}

/** Convert line endings in a file to the specified type */
export async function fsConvertEol(path: string, targetEol: LineEndingType): Promise<void> {
  return invoke("fs_convert_eol", { path, targetEol });
}

// ============================================================================
// File Encoding API
// ============================================================================

/** Detect the encoding of a file */
export async function fsDetectEncoding(path: string): Promise<string> {
  return invoke<string>("fs_detect_encoding", { path });
}

/** Read file content with a specific encoding */
export async function fsReadFileWithEncoding(path: string, encoding: string): Promise<string> {
  return invoke<string>("fs_read_file_with_encoding", { path, encoding });
}

/** Write content to file with a specific encoding */
export async function fsWriteFileWithEncoding(path: string, content: string, encoding: string): Promise<void> {
  return invoke("fs_write_file_with_encoding", { path, content, encoding });
}

/** Get list of supported encodings */
export async function fsGetSupportedEncodings(): Promise<string[]> {
  return invoke<string[]>("fs_get_supported_encodings");
}

// ============================================================================
// Search & Replace API
// ============================================================================


/** Search for files by name pattern */
export interface SearchFilesOptions {
  path: string;
  pattern: string;
  maxResults?: number;
  includeHidden?: boolean;
}

export interface SearchFileResult {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export async function fsSearchFiles(options: SearchFilesOptions): Promise<SearchFileResult[]> {
  return invoke<FileEntry[]>("fs_search_files", {
    rootPath: options.path,
    query: options.pattern,
    maxResults: options.maxResults ?? 100,
  });
}

/** Search file contents */
export interface SearchContentOptions {
  path: string;
  pattern: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  maxResults?: number;
  includeHidden?: boolean;
  filePattern?: string;
}

export interface SearchContentMatch {
  path: string;
  line: number;
  column: number;
  content: string;
  beforeContext?: string[];
  afterContext?: string[];
}

export interface SearchMatchResult {
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchResultEntry {
  file: string;
  matches: SearchMatchResult[];
}

export interface ContentSearchResponse {
  results: SearchResultEntry[];
  totalMatches: number;
  filesSearched: number;
}

export async function fsSearchContent(options: SearchContentOptions): Promise<ContentSearchResponse> {
  return invoke<ContentSearchResponse>("fs_search_content", {
    path: options.path,
    query: options.pattern,
    caseSensitive: options.caseSensitive,
    regex: options.regex,
    wholeWord: options.wholeWord,
    include: options.filePattern,
    maxResults: options.maxResults,
  });
}

export interface ReplaceMatchRequest {
  uri: string;
  match: SearchMatchResult;
  replaceText: string;
  useRegex: boolean;
  preserveCase: boolean;
}

/** Replace all matches across multiple files */
export async function searchReplaceAll(
  results: SearchResultEntry[],
  replaceText: string,
  useRegex: boolean,
  preserveCase: boolean
): Promise<number> {
  return invoke<number>("search_replace_all", {
    results,
    replaceText,
    useRegex,
    preserveCase,
  });
}

/** Replace all matches within a single file */
export async function searchReplaceInFile(
  uri: string,
  matches: SearchMatchResult[],
  replaceText: string,
  useRegex: boolean,
  preserveCase: boolean
): Promise<number> {
  return invoke<number>("search_replace_in_file", {
    uri,
    matches,
    replaceText,
    useRegex,
    preserveCase,
  });
}

/** Replace a single match */
export async function searchReplaceMatch(request: ReplaceMatchRequest): Promise<void> {
  return invoke("search_replace_match", { request });
}

// ============================================================================
// Git API
// ============================================================================

export interface GitStatus {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
  branch: string;
  ahead: number;
  behind: number;
}

export interface GitFileChange {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied";
  oldPath?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  parents: string[];
}

export interface GitBranch {
  name: string;
  isHead: boolean;
  isRemote: boolean;
  upstream?: string;
  commit: string;
}

export interface GitBlameEntry {
  hash: string;
  author: string;
  authorEmail: string;
  date: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  message: string;
  timestamp: number;
}

export interface GitDiff {
  path: string;
  hunks: GitHunk[];
}

export interface GitHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

/** Initialize a new git repository */
export async function gitInit(path: string, defaultBranch?: string): Promise<void> {
  return invoke("git_init", { path, defaultBranch: defaultBranch ?? "main" });
}

/** Get git status */
export async function gitStatus(path: string): Promise<GitStatus> {
  return invoke<GitStatus>("git_status", { path });
}

/** Get current branch name */
export async function gitCurrentBranch(path: string): Promise<string> {
  return invoke<string>("git_current_branch", { path });
}

/** Get list of branches */
export async function gitBranches(path: string): Promise<GitBranch[]> {
  return invoke<GitBranch[]>("git_branches", { path });
}

/** Get commit log */
export async function gitLog(path: string, limit?: number, branch?: string): Promise<GitCommit[]> {
  return invoke<GitCommit[]>("git_log", { path, max_count: limit ?? 100, branch });
}

/** Get all refs (branches and tags) mapped to commit SHAs */
export async function gitGetRefs(path: string): Promise<Record<string, string[]>> {
  return invoke<Record<string, string[]>>("git_get_refs", { path });
}

/** Get file diff */
export async function gitDiff(path: string, file?: string, staged?: boolean): Promise<string> {
  return invoke<string>("git_diff", { path, file, staged: staged ?? false });
}

/** Get file diff for a specific commit */
export async function gitDiffCommit(path: string, file: string, commit: string): Promise<string> {
  return invoke<string>("git_diff_commit", { path, file, commit });
}

/** Get structured diff data with word-level highlighting */
export interface DiffWordSegment {
  text: string;
  highlight: boolean;
}

export interface DiffLineStructured {
  lineType: string;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  wordDiff: DiffWordSegment[] | null;
}

export interface DiffHunkStructured {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLineStructured[];
}

export interface DiffDataStructured {
  path: string;
  oldPath: string | null;
  binary: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunkStructured[];
}

export async function gitDiffStructured(path: string, filePath?: string): Promise<DiffDataStructured[]> {
  return invoke<DiffDataStructured[]>("git_diff_structured", { path, filePath: filePath ?? null });
}

/** Get file blame */
export async function gitBlame(path: string, file: string): Promise<GitBlameEntry[]> {
  return invoke<GitBlameEntry[]>("git_blame", { path, file });
}

/** Get file blame for a specific line range (partial blame for performance) */
export async function gitBlameLineRange(
  path: string,
  file: string,
  startLine: number,
  endLine: number
): Promise<GitBlameEntry[]> {
  return invoke<GitBlameEntry[]>("git_blame_line_range", {
    path,
    file,
    startLine,
    endLine,
  });
}

/** Stage a file */
export async function gitStage(path: string, filePath: string): Promise<void> {
  return invoke("git_stage", { path, filePath });
}

/** Unstage a file */
export async function gitUnstage(path: string, filePath: string): Promise<void> {
  return invoke("git_unstage", { path, filePath });
}

/** Stage all files */
export async function gitStageAll(path: string): Promise<void> {
  return invoke("git_stage_all", { path });
}

/** Unstage all files */
export async function gitUnstageAll(path: string): Promise<void> {
  return invoke("git_unstage_all", { path });
}

/** Commit staged changes */
export async function gitCommit(path: string, message: string, sign?: boolean): Promise<string> {
  return invoke<string>("git_commit", { path, message, sign });
}

/** Check if GPG signing is configured for the repository */
export async function gitIsGpgConfigured(path: string): Promise<boolean> {
  return invoke<boolean>("git_is_gpg_configured", { path });
}

/** Discard file changes */
export async function gitDiscard(path: string, filePath: string): Promise<void> {
  return invoke("git_discard", { path, filePath });
}

/** Get remote URL */
export async function gitRemoteUrl(path: string): Promise<string | null> {
  return invoke<string | null>("git_remote_url", { path });
}

/** Git remote information */
export interface GitRemote {
  name: string;
  url: string | null;
  fetchUrl: string | null;
  pushUrl: string | null;
}

/** Get list of remotes */
export async function gitRemotes(path: string): Promise<{ remotes: GitRemote[] }> {
  return invoke<{ remotes: GitRemote[] }>("git_remotes", { path });
}

/** Fetch from a remote */
export async function gitFetch(path: string, remote?: string): Promise<void> {
  return invoke("git_fetch", { path, remote: remote ?? "origin" });
}

/** Push to a remote */
export async function gitPush(path: string, remote?: string): Promise<void> {
  return invoke("git_push", { path, remote: remote ?? "origin" });
}

/** Pull from a remote */
export async function gitPull(path: string, remote?: string): Promise<void> {
  return invoke("git_pull", { path, remote: remote ?? "origin" });
}

// ============================================================================
// Git Stash API
// ============================================================================

export interface GitStash {
  index: number;
  message: string;
  branch: string | null;
}

/** Enhanced stash entry with date information */
export interface StashEntry {
  index: number;
  message: string;
  date: string;
  branch: string | null;
}

export interface GitStashesResponse {
  stashes: GitStash[];
}

/** List all stashes (legacy API using git_stashes) */
export async function gitStashList(path: string): Promise<GitStash[]> {
  const response = await invoke<GitStashesResponse>("git_stashes", { path });
  return response.stashes;
}

/** List all stashes with enhanced information */
export async function gitStashListEnhanced(path: string): Promise<StashEntry[]> {
  return invoke<StashEntry[]>("git_stash_list", { path });
}

/** Apply a stash (keeps stash in list) */
export async function gitStashApply(path: string, index: number): Promise<void> {
  return invoke("git_stash_apply", { path, index });
}

/** Pop a stash (applies and removes from list) */
export async function gitStashPop(path: string, index: number): Promise<void> {
  return invoke("git_stash_pop", { path, index });
}

/** Drop/delete a stash */
export async function gitStashDrop(path: string, index: number): Promise<void> {
  return invoke("git_stash_drop", { path, index });
}

/** Create a new stash */
export async function gitStashCreate(path: string, message: string, includeUntracked: boolean): Promise<void> {
  return invoke("git_stash_create", { path, message, includeUntracked });
}

// ============================================================================
// Git Hunk Staging API
// ============================================================================

/** Stage a single hunk from a file */
export async function gitStageHunk(path: string, file: string, hunkIndex: number): Promise<void> {
  return invoke("git_stage_hunk", { path, file, hunkIndex });
}

/** Unstage a single hunk from a file */
export async function gitUnstageHunk(path: string, file: string, hunkIndex: number): Promise<void> {
  return invoke("git_unstage_hunk", { path, file, hunkIndex });
}

/** Revert a single hunk in the working directory */
export async function gitRevertHunk(path: string, file: string, hunkIndex: number): Promise<void> {
  return invoke("git_revert_hunk", { path, file, hunkIndex });
}

// ============================================================================
// Git Structured Diff API
// ============================================================================

export interface DiffLine {
  changeType: "context" | "addition" | "deletion" | "header";
  oldLineNo: number | null;
  newLineNo: number | null;
  content: string;
}

export interface DiffHunkData {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface StructuredDiff {
  filePath: string;
  hunks: DiffHunkData[];
  additions: number;
  deletions: number;
}

export interface WordDiffSegment {
  segmentType: "equal" | "added" | "removed";
  content: string;
}

export interface WordDiffLine {
  oldLineNo: number | null;
  newLineNo: number | null;
  segments: WordDiffSegment[];
}

export interface WordDiffResult {
  filePath: string;
  lines: WordDiffLine[];
}

export interface HunkInfo {
  index: number;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  additions: number;
  deletions: number;
  contentPreview: string;
}

export interface HunkNavigationData {
  hunks: HunkInfo[];
  totalAdditions: number;
  totalDeletions: number;
}

// ============================================================================
// Git Word-Level Diff (Annotation-based)
// ============================================================================

export interface WordDiffAnnotation {
  value: string;
  added: boolean;
  removed: boolean;
}

// ============================================================================
// Git Blame Heatmap
// ============================================================================

export interface BlameHeatmapEntry {
  hash: string;
  author: string;
  authorEmail: string;
  date: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  message: string;
  timestamp: number;
  heatScore: number;
}

export interface GraphRef {
  name: string;
  refType: string;
}

export interface GraphCommitNode {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: number;
  parents: string[];
  refs: GraphRef[];
  x: number;
  y: number;
  colorIndex: number;
  isMerge: boolean;
}

/** Get staged diff as structured data */
export async function gitDiffStaged(path: string, filePath?: string): Promise<StructuredDiff[]> {
  return invoke<StructuredDiff[]>("git_diff_staged", { path, filePath });
}

/** Get word-level diff data */
export async function gitDiffWordLevel(path: string, filePath?: string): Promise<WordDiffResult[]> {
  return invoke<WordDiffResult[]>("git_diff_word_level", { path, filePath });
}

/** Get diff between two commits */
export async function gitDiffBetweenCommits(
  path: string,
  fromSha: string,
  toSha: string,
  filePath?: string
): Promise<StructuredDiff[]> {
  return invoke<StructuredDiff[]>("git_diff_between_commits", { path, fromSha, toSha, filePath });
}

/** Get blame data with heatmap scores */
export async function gitBlameWithHeatmap(path: string, file: string): Promise<BlameHeatmapEntry[]> {
  return invoke<BlameHeatmapEntry[]>("git_blame_with_heatmap", { path, file });
}

/** Get commit graph with layout data */
export async function gitLogGraph(
  path: string,
  maxCount?: number,
  branch?: string
): Promise<GraphCommitNode[]> {
  return invoke<GraphCommitNode[]>("git_log_graph", { path, maxCount, branch });
}

/** Get hunk navigation data for a file */
export async function gitGetHunks(
  path: string,
  file: string,
  staged?: boolean
): Promise<HunkNavigationData> {
  return invoke<HunkNavigationData>("git_get_hunks", { path, file, staged });
}

// ============================================================================
// Git Hunk Navigation
// ============================================================================

export interface HunkPosition {
  index: number;
  startLine: number;
  endLine: number;
  header: string;
}

/** Navigate to next/previous hunk */
export async function gitHunkNavigate(
  path: string,
  file: string,
  currentLine: number,
  direction: "next" | "previous"
): Promise<HunkPosition | null> {
  return invoke<HunkPosition | null>("git_hunk_navigate", { path, file, currentLine, direction });
}

// ============================================================================
// Git Annotated Tag Creation
// ============================================================================

/** Create an annotated tag with message and tagger info */
export async function gitCreateAnnotatedTag(
  path: string,
  name: string,
  message: string,
  taggerName?: string,
  taggerEmail?: string,
  target?: string
): Promise<void> {
  return invoke("git_create_annotated_tag", { path, name, message, taggerName, taggerEmail, target });
}

// ============================================================================
// Git Force Push Check
// ============================================================================

export interface ForcePushInfo {
  needed: boolean;
  commitsToOverwrite: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    authorEmail: string;
    date: number;
  }>;
  remoteBranch: string;
  localBranch: string;
  localAhead: number;
  remoteAhead: number;
}

/** Check if force push is needed and get info about commits that would be overwritten */
export async function gitForcePushCheck(
  path: string,
  remote?: string,
  branch?: string
): Promise<ForcePushInfo> {
  return invoke<ForcePushInfo>("git_force_push_check", { path, remote, branch });
}

/** Filter task problems by severity and/or file */
export async function tasksFilterProblems(
  severity?: string,
  filePath?: string
): Promise<TaskDiagnosticPayload[]> {
  return invoke<TaskDiagnosticPayload[]>("tasks_filter_problems", { severity, filePath });
}

/** Run a task with full dependency resolution */
export async function tasksRunWithDependencies(
  taskName: string,
  workspacePath?: string
): Promise<string> {
  return invoke<string>("tasks_run_with_dependencies", { taskName, workspacePath });
}

/** Resolve a task input definition */
export async function tasksResolveInput(
  inputId: string,
  workspacePath?: string
): Promise<unknown> {
  return invoke<unknown>("tasks_resolve_input", { inputId, workspacePath });
}

// ============================================================================
// Git Branch Comparison API
// ============================================================================

export interface GitCompareCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitCompareFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  oldPath?: string;
}

export interface GitCompareResult {
  ahead: number;
  behind: number;
  commits: GitCompareCommit[];
  files: GitCompareFile[];
  totalAdditions: number;
  totalDeletions: number;
}

/** Compare two branches */
export async function gitCompare(path: string, base: string, compare: string): Promise<GitCompareResult> {
  return invoke<GitCompareResult>("git_compare", { path, base, compare });
}

// ============================================================================
// Git Commit Comparison API
// ============================================================================

export interface CommitComparison {
  filesChanged: number;
  additions: number;
  deletions: number;
  files: Array<{
    path: string;
    status: string;
    additions: number;
    deletions: number;
  }>;
}

/** Compare two commits by SHA */
export async function gitCompareCommits(path: string, fromSha: string, toSha: string): Promise<CommitComparison> {
  return invoke<CommitComparison>("git_compare_commits", { path, fromSha, toSha });
}

// ============================================================================
// Git Structured Diff Hunks API
// ============================================================================

export interface DiffHunkLine {
  origin: string;
  content: string;
  oldLineno?: number;
  newLineno?: number;
}

export interface StructuredDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffHunkLine[];
}

export interface DiffHunksResult {
  path: string;
  hunks: StructuredDiffHunk[];
}

/** Get structured diff hunks with line numbers for both sides */
export async function gitDiffHunks(
  path: string,
  filePath?: string
): Promise<DiffHunksResult[]> {
  return invoke<DiffHunksResult[]>("git_diff_hunks", { path, filePath });
}

// ============================================================================
// Git Commit Graph API
// ============================================================================

export interface CommitGraphNode {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: number;
  parents: string[];
  refs: string[];
  column: number;
  color: string;
}

export interface CommitGraphOptions {
  path?: string;
  maxCount?: number;
  skip?: number;
  branch?: string;
  all?: boolean;
  firstParent?: boolean;
  since?: string;
  until?: string;
  author?: string;
  grep?: string;
}

export interface CommitGraphResult {
  nodes: CommitGraphNode[];
  totalCount: number;
  hasMore: boolean;
}

/** Get commit graph with column layout and parent connections */
export async function gitCommitGraph(
  path: string,
  options?: CommitGraphOptions
): Promise<CommitGraphResult> {
  return invoke<CommitGraphResult>("git_commit_graph", {
    path,
    options: {
      path: options?.path,
      max_count: options?.maxCount ?? 100,
      skip: options?.skip ?? 0,
      branch: options?.branch,
      all: options?.all ?? true,
      first_parent: options?.firstParent ?? false,
      since: options?.since,
      until: options?.until,
      author: options?.author,
      grep: options?.grep,
    },
  });
}

// ============================================================================
// Git Rebase Todo API
// ============================================================================

export interface RebaseTodoEntry {
  action: string;
  hash: string;
  shortHash: string;
  message: string;
}

/** Get the current interactive rebase todo list */
export async function gitRebaseTodo(path: string): Promise<RebaseTodoEntry[]> {
  return invoke<RebaseTodoEntry[]>("git_rebase_todo", { path });
}

// ============================================================================
// Tasks Problems API
// ============================================================================

export interface TaskDiagnostic {
  taskId: string;
  file: string;
  line: number;
  column: number;
  severity: string;
  message: string;
  code: string | null;
  source: string;
}

/** Get accumulated task problems */
export async function tasksGetProblems(): Promise<TaskDiagnostic[]> {
  return invoke<TaskDiagnostic[]>("tasks_get_problems");
}

/** Clear task problems, optionally filtered by task ID */
export async function tasksClearProblems(taskId?: string): Promise<void> {
  return invoke("tasks_clear_problems", { taskId: taskId ?? null });
}

/** Task diagnostic payload (alias for event payloads) */
export type TaskDiagnosticPayload = TaskDiagnostic;

// ============================================================================
// LSP API
// ============================================================================

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspSymbol {
  name: string;
  kind: number;
  location: LspLocation;
  containerName?: string;
  tags?: number[]; // LSP SymbolTag array (1 = Deprecated)
}

export interface LspCallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: LspRange;
  selectionRange: LspRange;
}

/** Prepare call hierarchy */
export async function lspPrepareCallHierarchy(
  path: string,
  line: number,
  character: number
): Promise<LspCallHierarchyItem[]> {
  return invoke<LspCallHierarchyItem[]>("lsp_prepare_call_hierarchy", { path, line, character });
}

/** Get incoming calls */
export async function lspIncomingCalls(item: LspCallHierarchyItem): Promise<LspCallHierarchyItem[]> {
  return invoke<LspCallHierarchyItem[]>("lsp_incoming_calls", { item });
}

/** Get outgoing calls */
export async function lspOutgoingCalls(item: LspCallHierarchyItem): Promise<LspCallHierarchyItem[]> {
  return invoke<LspCallHierarchyItem[]>("lsp_outgoing_calls", { item });
}

/** Get workspace symbols */
export async function lspWorkspaceSymbols(path: string, query: string): Promise<LspSymbol[]> {
  return invoke<LspSymbol[]>("lsp_workspace_symbols", { path, query });
}

/** Get document symbols */
export async function lspDocumentSymbols(path: string): Promise<LspSymbol[]> {
  return invoke<LspSymbol[]>("lsp_document_symbols", { path });
}

export interface LspTypeHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: LspRange;
  detail?: string;
}

/** Get type hierarchy (supertypes or subtypes) */
export async function lspTypeHierarchy(
  path: string,
  line: number,
  character: number,
  direction: "supertypes" | "subtypes"
): Promise<LspTypeHierarchyItem[]> {
  return invoke<LspTypeHierarchyItem[]>("lsp_type_hierarchy", { path, line, character, direction });
}

// ============================================================================
// Terminal API
// ============================================================================

export interface TerminalOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** Run a command in terminal */
export async function terminalRun(command: string, cwd?: string): Promise<TerminalOutput> {
  return invoke<TerminalOutput>("terminal_run_command", { command, cwd });
}

// ============================================================================
// AI API (via cortex-core SDK)
// ============================================================================

// AI operations should go through SDKContext which uses cortex-core
// These are just type definitions for reference

export interface AIPredictionRequest {
  prefix: string;
  suffix: string;
  language: string;
  path?: string;
}

export interface AIPrediction {
  text: string;
  confidence: number;
}

// ============================================================================
// Utility: Migrate from HTTP to Tauri
// ============================================================================

/**
 * Helper to handle errors consistently
 */
export async function tauriCall<T>(
  command: string,
  args: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`[Tauri] ${command} failed:`, error);
    throw error;
  }
}

// ============================================================================
// Git Bisect API
// ============================================================================

export interface BisectStatus {
  in_progress: boolean;
  current_commit: string | null;
  good_commits: string[];
  bad_commits: string[];
  remaining_steps: number;
}

export interface BisectResult {
  current_commit: string;
  remaining_steps: number;
  found_culprit: boolean;
  culprit_commit: string | null;
}

/** Get bisect status */
export async function gitBisectStatus(path: string): Promise<BisectStatus> {
  return invoke<BisectStatus>("git_bisect_status", { path });
}

/** Start a bisect session */
export async function gitBisectStart(path: string, bad: string, good: string): Promise<BisectResult> {
  return invoke<BisectResult>("git_bisect_start", { path, bad, good });
}

/** Mark current commit as good, bad, or skip */
export async function gitBisectMark(path: string, mark: "good" | "bad" | "skip"): Promise<BisectResult> {
  return invoke<BisectResult>("git_bisect_mark", { path, mark });
}

/** Reset/abort bisect session */
export async function gitBisectReset(path: string): Promise<void> {
  return invoke("git_bisect_reset", { path });
}

// ============================================================================
// Git Cherry-pick API
// ============================================================================

export interface CommitFile {
  path: string;
  status: string; // "added", "modified", "deleted", "renamed", "copied"
  additions: number;
  deletions: number;
}

export interface CherryPickStatus {
  in_progress: boolean;
  current_commit: string | null;
  has_conflicts: boolean;
}

/** Get files changed in a specific commit */
export async function gitCommitFiles(path: string, hash: string): Promise<CommitFile[]> {
  return invoke<CommitFile[]>("git_commit_files", { path, hash });
}

/** Get cherry-pick status */
export async function gitCherryPickStatus(path: string): Promise<CherryPickStatus> {
  return invoke<CherryPickStatus>("git_cherry_pick_status", { path });
}

/** Start a cherry-pick operation for one or more commits */
export async function gitCherryPickStart(path: string, commits: string[]): Promise<void> {
  return invoke("git_cherry_pick_start", { path, commits });
}

/** Continue the cherry-pick operation after resolving conflicts */
export async function gitCherryPickContinue(path: string): Promise<void> {
  return invoke("git_cherry_pick_continue", { path });
}

/** Skip the current commit during cherry-pick */
export async function gitCherryPickSkip(path: string): Promise<void> {
  return invoke("git_cherry_pick_skip", { path });
}

/** Abort the current cherry-pick operation */
export async function gitCherryPickAbort(path: string): Promise<void> {
  return invoke("git_cherry_pick_abort", { path });
}

// ============================================================================
// Interactive Rebase API
// ============================================================================

export interface RebaseCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface RebaseAction {
  hash: string;
  action: "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";
}

export interface RebaseStatus {
  inProgress: boolean;
  currentCommit: string | null;
  remaining: number;
  total: number;
  hasConflicts: boolean;
  conflictFiles: string[];
  pausedCommit: RebaseCommit | null;
}

/** Get commits that would be rebased onto a target */
export async function gitRebaseCommits(path: string, onto: string): Promise<RebaseCommit[]> {
  return invoke<RebaseCommit[]>("git_rebase_commits", { path, onto });
}

/** Check if a rebase is in progress and get its status */
export async function gitRebaseStatus(path: string): Promise<RebaseStatus> {
  const result = await invoke<{
    in_progress: boolean;
    current_commit: string | null;
    remaining: number;
    total: number;
    has_conflicts: boolean;
    conflict_files: string[];
    paused_commit: { hash: string; short_hash: string; message: string; author: string; date: string } | null;
  }>("git_rebase_status", { path });
  
  return {
    inProgress: result.in_progress,
    currentCommit: result.current_commit,
    remaining: result.remaining,
    total: result.total,
    hasConflicts: result.has_conflicts,
    conflictFiles: result.conflict_files,
    pausedCommit: result.paused_commit ? {
      hash: result.paused_commit.hash,
      shortHash: result.paused_commit.short_hash,
      message: result.paused_commit.message,
      author: result.paused_commit.author,
      date: result.paused_commit.date,
    } : null,
  };
}

/** Start an interactive rebase */
export async function gitRebaseStart(path: string, onto: string, commits: RebaseAction[]): Promise<RebaseStatus> {
  const result = await invoke<{
    in_progress: boolean;
    current_commit: string | null;
    remaining: number;
    total: number;
    has_conflicts: boolean;
    conflict_files: string[];
    paused_commit: { hash: string; short_hash: string; message: string; author: string; date: string } | null;
  }>("git_rebase_start", { path, onto, commits });
  
  return {
    inProgress: result.in_progress,
    currentCommit: result.current_commit,
    remaining: result.remaining,
    total: result.total,
    hasConflicts: result.has_conflicts,
    conflictFiles: result.conflict_files,
    pausedCommit: result.paused_commit ? {
      hash: result.paused_commit.hash,
      shortHash: result.paused_commit.short_hash,
      message: result.paused_commit.message,
      author: result.paused_commit.author,
      date: result.paused_commit.date,
    } : null,
  };
}

/** Continue rebase after resolving conflicts */
export async function gitRebaseContinue(path: string): Promise<RebaseStatus> {
  const result = await invoke<{
    in_progress: boolean;
    current_commit: string | null;
    remaining: number;
    total: number;
    has_conflicts: boolean;
    conflict_files: string[];
    paused_commit: { hash: string; short_hash: string; message: string; author: string; date: string } | null;
  }>("git_rebase_continue", { path });
  
  return {
    inProgress: result.in_progress,
    currentCommit: result.current_commit,
    remaining: result.remaining,
    total: result.total,
    hasConflicts: result.has_conflicts,
    conflictFiles: result.conflict_files,
    pausedCommit: result.paused_commit ? {
      hash: result.paused_commit.hash,
      shortHash: result.paused_commit.short_hash,
      message: result.paused_commit.message,
      author: result.paused_commit.author,
      date: result.paused_commit.date,
    } : null,
  };
}

/** Skip the current commit during rebase */
export async function gitRebaseSkip(path: string): Promise<RebaseStatus> {
  const result = await invoke<{
    in_progress: boolean;
    current_commit: string | null;
    remaining: number;
    total: number;
    has_conflicts: boolean;
    conflict_files: string[];
    paused_commit: { hash: string; short_hash: string; message: string; author: string; date: string } | null;
  }>("git_rebase_skip", { path });
  
  return {
    inProgress: result.in_progress,
    currentCommit: result.current_commit,
    remaining: result.remaining,
    total: result.total,
    hasConflicts: result.has_conflicts,
    conflictFiles: result.conflict_files,
    pausedCommit: result.paused_commit ? {
      hash: result.paused_commit.hash,
      shortHash: result.paused_commit.short_hash,
      message: result.paused_commit.message,
      author: result.paused_commit.author,
      date: result.paused_commit.date,
    } : null,
  };
}

/** Abort an in-progress rebase */
export async function gitRebaseAbort(path: string): Promise<void> {
  return invoke("git_rebase_abort", { path });
}

// ============================================================================
// Git Submodules
// ============================================================================

/** Submodule information */
export interface SubmoduleInfo {
  name: string;
  path: string;
  url: string;
  branch: string | null;
  head_id: string | null;
  status: "uninitialized" | "initialized" | "modified";
}

/** List all submodules in the repository */
export async function gitSubmoduleList(path: string): Promise<SubmoduleInfo[]> {
  return invoke<SubmoduleInfo[]>("git_submodule_list", { path });
}

/** Initialize a submodule (or all submodules if no path specified) */
export async function gitSubmoduleInit(path: string, submodulePath?: string): Promise<void> {
  return invoke("git_submodule_init", { path, submodulePath });
}

/** Update submodules */
export async function gitSubmoduleUpdate(path: string, init: boolean = false, recursive: boolean = false): Promise<void> {
  return invoke("git_submodule_update", { path, init, recursive });
}

/** Add a new submodule */
export async function gitSubmoduleAdd(path: string, url: string, submodulePath?: string): Promise<void> {
  return invoke("git_submodule_add", { path, url, submodulePath });
}

/** Sync submodule URLs from .gitmodules to .git/config */
export async function gitSubmoduleSync(path: string, recursive: boolean = false): Promise<void> {
  return invoke("git_submodule_sync", { path, recursive });
}

/** Deinitialize a submodule */
export async function gitSubmoduleDeinit(path: string, submodulePath: string, force: boolean = false): Promise<void> {
  return invoke("git_submodule_deinit", { path, submodulePath, force });
}

// ============================================================================
// Git Tags API
// ============================================================================

/** Git tag information */
export interface GitTag {
  /** Tag name */
  name: string;
  /** Full commit hash the tag points to */
  commit: string;
  /** Short commit hash (7 characters) */
  commitShort: string;
  /** Tag message (for annotated tags) */
  message?: string;
  /** Tagger name (for annotated tags) */
  tagger?: string;
  /** Tag creation date */
  date?: Date;
  /** Whether this is an annotated tag (vs lightweight) */
  isAnnotated: boolean;
  /** Whether the tag has been pushed to remote */
  isPushed: boolean;
}

/** Extended tag information with additional details */
export interface GitTagInfo extends GitTag {
  /** Tagger email */
  taggerEmail?: string;
  /** Full tag object hash (for annotated tags) */
  tagHash?: string;
}

/** List all tags in the repository */
export async function gitTagList(path: string): Promise<GitTag[]> {
  const result = await invoke<Array<{
    name: string;
    commit: string;
    commit_short: string;
    message: string | null;
    tagger: string | null;
    date: string | null;
    is_annotated: boolean;
    is_pushed: boolean;
  }>>("git_list_tags", { path });
  
  return result.map(tag => ({
    name: tag.name,
    commit: tag.commit,
    commitShort: tag.commit_short,
    message: tag.message || undefined,
    tagger: tag.tagger || undefined,
    date: tag.date ? new Date(tag.date) : undefined,
    isAnnotated: tag.is_annotated,
    isPushed: tag.is_pushed,
  }));
}

/** Get detailed information about a specific tag */
export async function gitTagInfo(path: string, tagName: string): Promise<GitTagInfo> {
  const result = await invoke<{
    name: string;
    commit: string;
    commit_short: string;
    message: string | null;
    tagger: string | null;
    tagger_email: string | null;
    date: string | null;
    is_annotated: boolean;
    is_pushed: boolean;
    tag_hash: string | null;
  }>("git_tag_info", { path, tagName });
  
  return {
    name: result.name,
    commit: result.commit,
    commitShort: result.commit_short,
    message: result.message || undefined,
    tagger: result.tagger || undefined,
    taggerEmail: result.tagger_email || undefined,
    date: result.date ? new Date(result.date) : undefined,
    isAnnotated: result.is_annotated,
    isPushed: result.is_pushed,
    tagHash: result.tag_hash || undefined,
  };
}

/** Create a new tag */
export async function gitTagCreate(
  path: string,
  tagName: string,
  target: string = "HEAD",
  annotated: boolean = true,
  message?: string,
  sign: boolean = false
): Promise<GitTag> {
  const result = await invoke<{
    name: string;
    commit: string;
    commit_short: string;
    message: string | null;
    tagger: string | null;
    date: string | null;
    is_annotated: boolean;
    is_pushed: boolean;
  }>("git_tag_create", { 
    path, 
    tagName, 
    target, 
    annotated, 
    message: message || null,
    sign 
  });
  
  return {
    name: result.name,
    commit: result.commit,
    commitShort: result.commit_short,
    message: result.message || undefined,
    tagger: result.tagger || undefined,
    date: result.date ? new Date(result.date) : undefined,
    isAnnotated: result.is_annotated,
    isPushed: result.is_pushed,
  };
}

/** Delete a tag (optionally from remote as well) */
export async function gitTagDelete(path: string, tagName: string, deleteRemote: boolean = false): Promise<void> {
  return invoke("git_delete_tag", { path, name: tagName, deleteRemote });
}

/** Push a specific tag to remote */
export async function gitTagPush(path: string, tagName: string, remote: string = "origin"): Promise<void> {
  return invoke("git_push_tag", { path, name: tagName, remote });
}

/** Push all tags to remote */
export async function gitTagPushAll(path: string, remote: string = "origin"): Promise<void> {
  return invoke("git_push_with_tags", { path, remote, branch: "HEAD", followTags: true });
}

/** Checkout a tag (creates detached HEAD state) */
export async function gitCheckoutTag(path: string, tagName: string): Promise<void> {
  return invoke("git_checkout_tag", { path, tagName });
}

/** Checkout a specific commit (creates detached HEAD state) */
export async function gitCheckoutCommit(path: string, commitHash: string): Promise<void> {
  return invoke("git_checkout_commit", { path, commitHash });
}

/** Create a new branch from a tag */
export async function gitCreateBranchFromTag(path: string, tagName: string, branchName: string): Promise<void> {
  // Uses git_branch with startPoint parameter to create branch from tag
  return invoke("git_branch", { path, name: branchName, startPoint: tagName });
}

/** Get diff between a tag and current HEAD */
export async function gitTagDiff(path: string, tagName: string): Promise<string> {
  return invoke<string>("git_tag_diff", { path, tagName });
}

// ============================================================================
// Git Worktree API
// ============================================================================

/**
 * Git worktree information
 */
export interface GitWorktree {
  /** Worktree directory path */
  path: string;
  /** Branch checked out (null if detached HEAD) */
  branch: string | null;
  /** Current commit SHA */
  commit: string;
  /** Is this the main worktree? */
  isMain: boolean;
  /** Is the worktree locked? */
  isLocked: boolean;
  /** Lock reason if locked */
  lockReason?: string;
  /** Can be pruned (directory missing or corrupt) */
  prunable: boolean;
  /** Prune reason if prunable */
  prunableReason?: string;
}

/**
 * Options for adding a new worktree
 */
export interface GitWorktreeAddOptions {
  /** Branch to checkout (null for detached HEAD) */
  branch?: string | null;
  /** Create a new branch with this name */
  createBranch?: boolean;
  /** Commit/branch/tag to checkout (for detached HEAD or new branch start point) */
  commitish?: string;
  /** Force creation even if directory exists */
  force?: boolean;
  /** Remote branch to track (for new branches) */
  track?: string;
}

/**
 * List all worktrees in the repository
 */
export async function gitWorktreeList(repoPath: string): Promise<GitWorktree[]> {
  const result = await invoke<Array<{
    path: string;
    branch: string | null;
    commit: string;
    is_main: boolean;
    is_locked: boolean;
    lock_reason: string | null;
    prunable: boolean;
    prunable_reason: string | null;
  }>>("git_worktree_list", { path: repoPath });
  
  return result.map(wt => ({
    path: wt.path,
    branch: wt.branch,
    commit: wt.commit,
    isMain: wt.is_main,
    isLocked: wt.is_locked,
    lockReason: wt.lock_reason || undefined,
    prunable: wt.prunable,
    prunableReason: wt.prunable_reason || undefined,
  }));
}

/**
 * Add a new worktree
 * @param repoPath - Path to the main repository
 * @param worktreePath - Path where the new worktree will be created
 * @param options - Options for creating the worktree
 */
export async function gitWorktreeAdd(
  repoPath: string,
  worktreePath: string,
  options?: GitWorktreeAddOptions
): Promise<void> {
  return invoke("git_worktree_add", {
    path: repoPath,
    worktreePath,
    branch: options?.branch,
    createBranch: options?.createBranch ?? false,
    commitish: options?.commitish,
    force: options?.force ?? false,
    track: options?.track,
  });
}

/**
 * Remove a worktree
 * @param repoPath - Path to the main repository
 * @param worktreePath - Path to the worktree to remove
 * @param force - Force removal even if worktree has modifications
 */
export async function gitWorktreeRemove(
  repoPath: string,
  worktreePath: string,
  force: boolean = false
): Promise<void> {
  return invoke("git_worktree_remove", { path: repoPath, worktreePath, force });
}

/**
 * Lock a worktree to prevent accidental pruning
 * @param repoPath - Path to the main repository
 * @param worktreePath - Path to the worktree to lock
 * @param reason - Optional reason for locking
 */
export async function gitWorktreeLock(
  repoPath: string,
  worktreePath: string,
  reason?: string
): Promise<void> {
  return invoke("git_worktree_lock", { path: repoPath, worktreePath, reason });
}

/**
 * Unlock a locked worktree
 * @param repoPath - Path to the main repository
 * @param worktreePath - Path to the worktree to unlock
 */
export async function gitWorktreeUnlock(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  return invoke("git_worktree_unlock", { path: repoPath, worktreePath });
}

/**
 * Move a worktree to a new location
 * @param repoPath - Path to the main repository
 * @param worktreePath - Current path of the worktree
 * @param newPath - New path for the worktree
 */
export async function gitWorktreeMove(
  repoPath: string,
  worktreePath: string,
  newPath: string
): Promise<void> {
  return invoke("git_worktree_move", { path: repoPath, worktreePath, newPath });
}

/**
 * Repair worktree administrative files if main or linked worktrees have been moved
 * @param repoPath - Path to the main repository
 * @param worktreePaths - Optional specific worktree paths to repair
 */
export async function gitWorktreeRepair(
  repoPath: string,
  worktreePaths?: string[]
): Promise<void> {
  return invoke("git_worktree_repair", { path: repoPath, worktreePaths });
}

/**
 * Prune stale worktree information
 * Removes worktrees where the working directory has been deleted or is inaccessible
 * @param repoPath - Path to the main repository
 * @param dryRun - If true, only reports what would be pruned without actually pruning
 */
export async function gitWorktreePrune(
  repoPath: string,
  dryRun: boolean = false
): Promise<string[]> {
  return invoke<string[]>("git_worktree_prune", { path: repoPath, dryRun });
}

// ============================================================================
// Git LFS (Large File Storage) API
// ============================================================================

/** LFS tracked file information */
export interface LFSFile {
  /** File path relative to repo root */
  path: string;
  /** .gitattributes pattern that matches this file */
  pattern: string;
  /** File size in bytes */
  size: number;
  /** True if file is a pointer (content not fetched) */
  isPointer: boolean;
  /** LFS object ID (SHA256) */
  oid: string;
}

/** LFS lock information */
export interface LFSLock {
  /** Lock ID */
  id: string;
  /** Locked file path */
  path: string;
  /** Lock owner */
  owner: string;
  /** Lock timestamp */
  lockedAt: string;
}

/** LFS storage quota information */
export interface LFSStorageInfo {
  /** Bytes used on remote */
  used: number;
  /** Storage limit (null if unlimited) */
  limit: number | null;
  /** Bandwidth used this period */
  bandwidthUsed: number;
  /** Bandwidth limit (null if unlimited) */
  bandwidthLimit: number | null;
}

/** Overall LFS status for a repository */
export interface LFSStatus {
  /** Whether Git LFS is installed on the system */
  installed: boolean;
  /** LFS version string */
  version: string | null;
  /** Whether LFS is initialized in this repo */
  initialized: boolean;
  /** Tracked file patterns from .gitattributes */
  trackedPatterns: string[];
  /** LFS tracked files */
  trackedFiles: LFSFile[];
  /** Large files not tracked by LFS */
  untrackedLargeFiles: string[];
  /** Current locks */
  locks: LFSLock[];
  /** Storage information */
  storage: LFSStorageInfo | null;
}

/** LFS file info for a single file */
export interface LFSFileInfo {
  /** Whether file is tracked by LFS */
  isTracked: boolean;
  /** Whether file is currently a pointer (not fetched) */
  isPointer: boolean;
  /** Whether file has local modifications */
  isModified: boolean;
  /** Lock information if file is locked */
  lock: {
    id: string;
    owner: string;
    isOurs: boolean;
  } | null;
}

/** Matching file for track preview */
export interface LFSTrackPreviewFile {
  path: string;
  size: number;
  alreadyTracked: boolean;
}

/**
 * Get LFS status for a repository
 */
export async function gitLFSStatus(repoPath: string): Promise<LFSStatus> {
  return invoke<LFSStatus>("git_lfs_status", { path: repoPath });
}

/**
 * Initialize Git LFS in a repository
 */
export async function gitLFSInit(repoPath: string): Promise<void> {
  return invoke("git_lfs_init", { path: repoPath });
}

/**
 * Track a file pattern with Git LFS
 */
export async function gitLFSTrack(
  repoPath: string,
  pattern: string,
  migrate: boolean = false
): Promise<void> {
  return invoke("git_lfs_track", { path: repoPath, pattern, migrate });
}

/**
 * Untrack a file pattern from Git LFS
 */
export async function gitLFSUntrack(repoPath: string, pattern: string): Promise<void> {
  return invoke("git_lfs_untrack", { path: repoPath, pattern });
}

/**
 * Preview files that would be tracked by a pattern
 */
export async function gitLFSTrackPreview(
  repoPath: string,
  pattern: string
): Promise<LFSTrackPreviewFile[]> {
  return invoke<LFSTrackPreviewFile[]>("git_lfs_track_preview", { path: repoPath, pattern });
}

/**
 * Fetch LFS files from remote
 */
export async function gitLFSFetch(
  repoPath: string,
  include?: string[],
  exclude?: string[]
): Promise<void> {
  return invoke("git_lfs_fetch", { path: repoPath, include, exclude });
}

/**
 * Pull (fetch + checkout) LFS files
 */
export async function gitLFSPull(
  repoPath: string,
  include?: string[],
  exclude?: string[]
): Promise<void> {
  return invoke("git_lfs_pull", { path: repoPath, include, exclude });
}

/**
 * Push LFS files to remote
 */
export async function gitLFSPush(repoPath: string): Promise<void> {
  return invoke("git_lfs_push", { path: repoPath });
}

/**
 * Prune old LFS files from local storage
 */
export async function gitLFSPrune(
  repoPath: string,
  dryRun: boolean = false
): Promise<string[]> {
  return invoke<string[]>("git_lfs_prune", { path: repoPath, dryRun });
}

/**
 * Lock a file to prevent concurrent edits
 */
export async function gitLFSLock(repoPath: string, filePath: string): Promise<void> {
  return invoke("git_lfs_lock", { path: repoPath, filePath });
}

/**
 * Unlock a file
 */
export async function gitLFSUnlock(
  repoPath: string,
  filePath: string,
  force: boolean = false
): Promise<void> {
  return invoke("git_lfs_unlock", { path: repoPath, filePath, force });
}

/**
 * Get all LFS locks for the repository
 */
export async function gitLFSLocks(repoPath: string): Promise<LFSLock[]> {
  return invoke<LFSLock[]>("git_lfs_locks", { path: repoPath });
}

/**
 * Get LFS info for a specific file
 */
export async function gitLFSFileInfo(repoPath: string, filePath: string): Promise<LFSFileInfo> {
  return invoke<LFSFileInfo>("git_lfs_file_info", { path: repoPath, filePath });
}

/**
 * Get LFS summary for a directory
 */
export async function gitLFSDirSummary(
  repoPath: string,
  dirPath: string
): Promise<{ totalFiles: number; pointerFiles: number; lockedFiles: number }> {
  return invoke("git_lfs_dir_summary", { path: repoPath, dirPath });
}

// ============================================================================
// Git Clone Commands
// ============================================================================

export interface CloneProgress {
  stage: "starting" | "counting" | "compressing" | "receiving" | "resolving" | "checking_out" | "updating" | "complete" | "error" | "unknown";
  current: number;
  total: number;
  bytesReceived?: number;
  message?: string;
}

/**
 * Clone a git repository with progress events
 * Listen to "git:clone-progress" event for progress updates
 */
export async function gitClone(url: string, targetDir: string): Promise<string> {
  return invoke<string>("git_clone", { url, targetDir });
}

/**
 * Clone a git repository with submodules recursively
 * Listen to "git:clone-progress" event for progress updates
 */
export async function gitCloneRecursive(url: string, targetDir: string): Promise<string> {
  return invoke<string>("git_clone_recursive", { url, targetDir });
}

// ============================================================================
// Git Merge Commands
// ============================================================================

export interface MergeResult {
  success: boolean;
  fastForward: boolean;
  conflicts: string[];
  message?: string;
}

/**
 * Merge a branch into the current branch
 */
export async function gitMerge(
  repoPath: string,
  branch: string,
  options?: { noFf?: boolean; message?: string }
): Promise<MergeResult> {
  return invoke<MergeResult>("git_merge", {
    path: repoPath,
    branch,
    noFf: options?.noFf,
    message: options?.message,
  });
}

/**
 * Abort an in-progress merge
 */
export async function gitMergeAbort(repoPath: string): Promise<void> {
  return invoke("git_merge_abort", { path: repoPath });
}

/**
 * Continue a merge after resolving conflicts
 */
export async function gitMergeContinue(repoPath: string): Promise<MergeResult> {
  return invoke<MergeResult>("git_merge_continue", { path: repoPath });
}

// ============================================================================
// Git Merge Editor Commands
// ============================================================================

export interface MergeConflictFile {
  path: string;
  conflictCount: number;
  hasBaseContent: boolean;
  oursLabel: string;
  theirsLabel: string;
}

export interface MergeConflictRegion {
  id: string;
  index: number;
  startLine: number;
  endLine: number;
  separatorLine: number;
  baseMarkerLine?: number;
  oursContent: string[];
  theirsContent: string[];
  baseContent?: string[];
  oursLabel: string;
  theirsLabel: string;
}

export interface ThreeWayDiffResult {
  filePath: string;
  conflicts: MergeConflictRegion[];
  oursFullContent: string;
  theirsFullContent: string;
  baseFullContent?: string;
  hasBaseContent: boolean;
  rawContent: string;
}

/** Get list of conflicted files during a merge */
export async function gitGetMergeConflicts(repoPath: string): Promise<MergeConflictFile[]> {
  return invoke<MergeConflictFile[]>("git_get_merge_conflicts", { path: repoPath });
}

/** Get three-way diff data for a specific conflicted file */
export async function gitGetThreeWayDiff(repoPath: string, filePath: string): Promise<ThreeWayDiffResult> {
  return invoke<ThreeWayDiffResult>("git_get_three_way_diff", { path: repoPath, filePath });
}

/** Resolve a conflict by writing resolved content and staging the file */
export async function gitResolveConflict(repoPath: string, filePath: string, resolvedContent: string): Promise<void> {
  return invoke("git_resolve_conflict", { path: repoPath, filePath, resolvedContent });
}

/** Abort the current merge operation (merge editor variant) */
export async function gitAbortMergeEditor(repoPath: string): Promise<void> {
  return invoke("git_abort_merge", { path: repoPath });
}

// ============================================================================
// Git Enhanced Graph Commands
// ============================================================================

export interface GraphNodeRef {
  name: string;
  refType: string;
  isHead: boolean;
}

export interface EnhancedGraphCommitNode {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  authorEmail: string;
  date: number;
  parents: string[];
  refs: GraphNodeRef[];
  column: number;
  colorIndex: number;
  isMerge: boolean;
}

export interface GraphEdgeData {
  fromHash: string;
  toHash: string;
  fromColumn: number;
  toColumn: number;
  colorIndex: number;
}

export interface CommitGraphFullResult {
  nodes: EnhancedGraphCommitNode[];
  edges: GraphEdgeData[];
  totalCount: number;
  hasMore: boolean;
  maxColumn: number;
}

export interface GraphOptions {
  maxCount?: number;
  skip?: number;
  branch?: string;
  all?: boolean;
  since?: string;
  until?: string;
  author?: string;
  grep?: string;
}

/** Get enhanced commit graph with edges and column layout */
export async function gitGetCommitGraphEnhanced(
  repoPath: string,
  options?: GraphOptions
): Promise<CommitGraphFullResult> {
  return invoke<CommitGraphFullResult>("git_get_commit_graph", {
    path: repoPath,
    options: {
      max_count: options?.maxCount ?? 150,
      skip: options?.skip ?? 0,
      branch: options?.branch,
      all: options?.all ?? true,
      since: options?.since,
      until: options?.until,
      author: options?.author,
      grep: options?.grep,
    },
  });
}

// ============================================================================
// Git Branch Publishing Commands
// ============================================================================

/**
 * Publish a local branch to a remote (git push -u)
 */
export async function gitPublishBranch(
  repoPath: string,
  options?: { branch?: string; remote?: string }
): Promise<void> {
  return invoke("git_publish_branch", {
    path: repoPath,
    branch: options?.branch,
    remote: options?.remote,
  });
}

/**
 * Set upstream branch for current or specified branch
 */
export async function gitSetUpstream(
  repoPath: string,
  upstream: string,
  branch?: string
): Promise<void> {
  return invoke("git_set_upstream", {
    path: repoPath,
    branch,
    upstream,
  });
}

// ============================================================================
// Git Stash Show Commands
// ============================================================================

export interface StashDiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
}

export interface StashDiff {
  index: number;
  message: string;
  diff: string;
  files: StashDiffFile[];
}

/**
 * Show the contents of a stash (git stash show -p)
 */
export async function gitStashShow(repoPath: string, index: number): Promise<StashDiff> {
  return invoke<StashDiff>("git_stash_show", { path: repoPath, index });
}

// ============================================================================
// Git Branch Comparison Commands
// ============================================================================

export interface BranchComparison {
  ahead: number;
  behind: number;
  commitsAhead: GitCommit[];
  commitsBehind: GitCommit[];
  canFastForward: boolean;
}

/**
 * Compare current branch with another branch
 */
export async function gitCompareBranches(
  repoPath: string,
  baseBranch: string,
  compareBranch?: string
): Promise<BranchComparison> {
  return invoke<BranchComparison>("git_compare_branches", {
    path: repoPath,
    baseBranch,
    compareBranch,
  });
}

// ============================================================================
// Workspace Settings Commands
// ============================================================================

/** Settings scope enumeration */
export type SettingsScope = "default" | "user" | "workspace" | "folder" | "language";

/** Information about where a setting value comes from */
export interface SettingInfo {
  key: string;
  value: unknown;
  scope: SettingsScope;
  scopePath?: string;
  defaultValue?: unknown;
  isModified: boolean;
}

/**
 * Get workspace settings from .vscode/settings.json or .cortex/settings.json
 */
export async function getWorkspaceSettings(workspacePath: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("settings_get_workspace", { workspacePath });
}

/**
 * Set a single setting in workspace settings
 */
export async function setWorkspaceSetting(
  workspacePath: string,
  key: string,
  value: unknown
): Promise<void> {
  return invoke("settings_set_workspace", { workspacePath, key, value });
}

/**
 * Remove a setting from workspace settings
 */
export async function removeWorkspaceSetting(workspacePath: string, key: string): Promise<void> {
  return invoke("settings_remove_workspace", { workspacePath, key });
}

/**
 * Write complete workspace settings file
 */
export async function setWorkspaceSettingsFile(
  workspacePath: string,
  content: Record<string, unknown>
): Promise<void> {
  return invoke("settings_set_workspace_file", { workspacePath, content });
}

/**
 * Get folder-specific settings (for multi-root workspaces)
 */
export async function getFolderSettings(folderPath: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("settings_get_folder", { folderPath });
}

/**
 * Set folder-specific setting
 */
export async function setFolderSetting(
  folderPath: string,
  key: string,
  value: unknown
): Promise<void> {
  return invoke("settings_set_folder", { folderPath, key, value });
}

/**
 * Write complete folder settings file
 */
export async function setFolderSettingsFile(
  folderPath: string,
  content: Record<string, unknown>
): Promise<void> {
  return invoke("settings_set_folder_file", { folderPath, content });
}

/**
 * Get language-specific settings
 */
export async function getLanguageSettings(
  languageId: string,
  workspacePath?: string
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("settings_get_language", { languageId, workspacePath });
}

/**
 * Set language-specific setting
 */
export async function setLanguageSetting(
  languageId: string,
  key: string,
  value: unknown,
  workspacePath?: string
): Promise<void> {
  return invoke("settings_set_language", { languageId, key, value, workspacePath });
}

/**
 * Get effective setting value considering all hierarchy levels
 */
export async function getEffectiveSetting(
  key: string,
  options?: {
    workspacePath?: string;
    folderPath?: string;
    languageId?: string;
  }
): Promise<SettingInfo> {
  return invoke<SettingInfo>("settings_get_effective", {
    key,
    workspacePath: options?.workspacePath,
    folderPath: options?.folderPath,
    languageId: options?.languageId,
  });
}

/**
 * Check if .vscode folder exists in workspace
 */
export async function hasVSCodeFolder(workspacePath: string): Promise<boolean> {
  return invoke<boolean>("settings_has_vscode_folder", { workspacePath });
}

/**
 * Create .vscode folder if it doesn't exist
 */
export async function ensureVSCodeFolder(workspacePath: string): Promise<string> {
  return invoke<string>("settings_ensure_vscode_folder", { workspacePath });
}

/**
 * Get the settings file path for a workspace
 */
export async function getWorkspaceSettingsPath(workspacePath: string): Promise<string> {
  return invoke<string>("settings_get_workspace_path", { workspacePath });
}

/** Code workspace file structure */
export interface CodeWorkspaceFile {
  folders: Array<{ path: string; name?: string }>;
  settings?: Record<string, unknown>;
  extensions?: { recommendations?: string[] };
  [key: string]: unknown;
}

/**
 * Load settings from a *.code-workspace file
 */
export async function loadCodeWorkspaceSettings(filePath: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("settings_load_code_workspace", { filePath });
}

/**
 * Save settings to a *.code-workspace file
 */
export async function saveCodeWorkspaceSettings(
  filePath: string,
  settings: Record<string, unknown>
): Promise<void> {
  return invoke("settings_save_code_workspace", { filePath, settings });
}

/**
 * Merge settings from multiple sources with proper priority
 * Priority: language > folder > workspace > user
 */
export async function mergeSettingsHierarchy(
  userSettings: Record<string, unknown>,
  workspaceSettings?: Record<string, unknown>,
  folderSettings?: Record<string, unknown>,
  languageSettings?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>("settings_merge_hierarchy", {
    userSettings,
    workspaceSettings,
    folderSettings,
    languageSettings,
  });
}
