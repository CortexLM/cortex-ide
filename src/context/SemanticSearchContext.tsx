import { createContext, useContext, ParentProps, createEffect, onCleanup, onMount, batch as solidBatch } from "solid-js";
import { createStore } from "solid-js/store";
import { fsReadFile, fsListDirectory, type FileEntry } from "../utils/tauri-api";
import { getProjectPath } from "../utils/workspace";

/**
 * Embedding vector type - normalized float array
 */
export type EmbeddingVector = Float32Array;

/**
 * Result of a semantic search query
 */
export interface SemanticSearchResult {
  /** File path relative to project root */
  file: string;
  /** Matching content chunk */
  content: string;
  /** Similarity score (0-1, higher is better) */
  similarity: number;
  /** Start line number in file */
  startLine: number;
  /** End line number in file */
  endLine: number;
  /** Chunk ID for deduplication */
  chunkId: string;
}

/**
 * Chunk of indexed content
 */
interface IndexedChunk {
  id: string;
  file: string;
  content: string;
  startLine: number;
  endLine: number;
  embedding: EmbeddingVector;
  timestamp: number;
}

/**
 * File metadata in the index
 */
interface IndexedFile {
  path: string;
  lastModified: number;
  chunkIds: string[];
  indexedAt: number;
}

/**
 * Status of the indexing operation
 */
export type IndexingStatus = "idle" | "indexing" | "error";

/**
 * Semantic search state
 */
interface SemanticSearchState {
  /** Whether the index is ready for queries */
  indexReady: boolean;
  /** Current indexing status */
  indexingStatus: IndexingStatus;
  /** Progress of current indexing (0-100) */
  indexingProgress: number;
  /** Current file being indexed */
  indexingCurrentFile: string | null;
  /** Total files in project */
  totalFiles: number;
  /** Files indexed so far */
  indexedFilesCount: number;
  /** Last error message */
  lastError: string | null;
  /** Whether AI search mode is enabled */
  aiSearchEnabled: boolean;
  /** Embedding model being used */
  modelId: string;
}

/**
 * Context value for semantic search
 */
interface SemanticSearchContextValue {
  state: SemanticSearchState;
  /** Perform semantic search with natural language query */
  search: (query: string, maxResults?: number) => Promise<SemanticSearchResult[]>;
  /** Index a single file */
  indexFile: (path: string) => Promise<void>;
  /** Index entire workspace */
  indexWorkspace: () => Promise<void>;
  /** Cancel current indexing operation */
  cancelIndexing: () => void;
  /** Clear the entire index */
  clearIndex: () => void;
  /** Toggle AI search mode */
  setAISearchEnabled: (enabled: boolean) => void;
  /** Check if a file is indexed */
  isFileIndexed: (path: string) => boolean;
  /** Get index statistics */
  getIndexStats: () => { totalChunks: number; totalFiles: number; cacheSize: number };
  /** Remove file from index */
  removeFile: (path: string) => void;
}

const SemanticSearchContext = createContext<SemanticSearchContextValue>();

// Persistent storage keys
const EMBEDDING_CACHE_KEY = "orion:semantic:embeddings";
const SETTINGS_KEY = "orion:semantic:settings";

// Embedding model configuration
const EMBEDDING_DIMENSION = 384; // MiniLM dimension
const CHUNK_SIZE = 512; // Characters per chunk
const CHUNK_OVERLAP = 64; // Overlap between chunks
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max file size
const BATCH_SIZE = 5; // Files to process in parallel

// File extensions to index
const INDEXABLE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyw",
  ".rs",
  ".go",
  ".java", ".kt", ".kts",
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".scala",
  ".vue", ".svelte",
  ".html", ".css", ".scss", ".sass", ".less",
  ".json", ".yaml", ".yml", ".toml",
  ".md", ".mdx", ".txt",
  ".sql",
  ".sh", ".bash", ".zsh", ".fish",
  ".dockerfile",
  ".xml",
]);

// Directories to exclude from indexing
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  "__pycache__",
  ".pytest_cache",
  "venv",
  ".venv",
  "env",
  ".env",
  "target",
  "vendor",
  ".idea",
  ".vscode",
  "coverage",
  ".nyc_output",
]);

/**
 * Generate a unique chunk ID
 */
function generateChunkId(file: string, startLine: number, content: string): string {
  const hash = simpleHash(content);
  return `${file}:${startLine}:${hash}`;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Split content into overlapping chunks
 */
function chunkContent(content: string, filePath: string): Array<{
  content: string;
  startLine: number;
  endLine: number;
  id: string;
}> {
  const lines = content.split("\n");
  const chunks: Array<{ content: string; startLine: number; endLine: number; id: string }> = [];
  
  let currentChunk = "";
  let startLine = 0;
  let currentLine = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const newLength = currentChunk.length + line.length + 1;
    
    if (newLength > CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        startLine,
        endLine: currentLine,
        id: generateChunkId(filePath, startLine, currentChunk),
      });
      
      // Start new chunk with overlap
      const overlapLines = Math.ceil(CHUNK_OVERLAP / (currentChunk.length / (currentLine - startLine + 1)));
      const overlapStart = Math.max(0, currentLine - overlapLines);
      currentChunk = lines.slice(overlapStart, i).join("\n") + "\n";
      startLine = overlapStart;
    }
    
    currentChunk += line + "\n";
    currentLine = i;
  }
  
  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startLine,
      endLine: currentLine,
      id: generateChunkId(filePath, startLine, currentChunk),
    });
  }
  
  return chunks;
}

/**
 * Generate embedding using local computation
 * Uses a simplified TF-IDF style approach as a fallback when no external model is available
 */
function generateEmbeddingLocal(text: string): EmbeddingVector {
  const embedding = new Float32Array(EMBEDDING_DIMENSION);
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/).filter(w => w.length > 2);
  
  // Character n-gram features
  for (let i = 0; i < normalizedText.length - 2; i++) {
    const trigram = normalizedText.substring(i, i + 3);
    const hash = simpleHash(trigram);
    const index = parseInt(hash, 36) % EMBEDDING_DIMENSION;
    embedding[index] += 1;
  }
  
  // Word features
  for (const word of words) {
    const hash = simpleHash(word);
    const index = parseInt(hash, 36) % EMBEDDING_DIMENSION;
    embedding[index] += 2;
    
    // Word prefix features
    if (word.length > 3) {
      const prefixHash = simpleHash(word.substring(0, 3));
      const prefixIndex = parseInt(prefixHash, 36) % EMBEDDING_DIMENSION;
      embedding[prefixIndex] += 0.5;
    }
  }
  
  // Code-specific features
  const codePatterns = [
    /function\s+\w+/g,
    /class\s+\w+/g,
    /const\s+\w+/g,
    /let\s+\w+/g,
    /import\s+/g,
    /export\s+/g,
    /async\s+/g,
    /await\s+/g,
    /return\s+/g,
    /if\s*\(/g,
    /for\s*\(/g,
    /while\s*\(/g,
  ];
  
  codePatterns.forEach((pattern, idx) => {
    const matches = normalizedText.match(pattern);
    if (matches) {
      const featureIndex = (idx * 7) % EMBEDDING_DIMENSION;
      embedding[featureIndex] += matches.length * 3;
    }
  });
  
  // L2 normalize
  let magnitude = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    magnitude += embedding[i] * embedding[i];
  }
  magnitude = Math.sqrt(magnitude);
  
  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

/**
 * Compute cosine similarity between two embeddings
 */
function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude > 0 ? dot / magnitude : 0;
}

/**
 * Check if a file should be indexed based on extension
 */
function shouldIndexFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return INDEXABLE_EXTENSIONS.has(ext);
}

/**
 * Check if a path should be excluded
 */
function isExcludedPath(path: string): boolean {
  const parts = path.split(/[/\\]/);
  return parts.some(part => EXCLUDED_DIRS.has(part));
}

/**
 * Load cached index from localStorage
 */
function loadCachedIndex(): { chunks: Map<string, IndexedChunk>; files: Map<string, IndexedFile> } {
  try {
    const cached = localStorage.getItem(EMBEDDING_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const chunks = new Map<string, IndexedChunk>();
      const files = new Map<string, IndexedFile>();
      
      if (parsed.chunks) {
        for (const [id, chunk] of Object.entries(parsed.chunks)) {
          const c = chunk as IndexedChunk & { embedding: number[] };
          chunks.set(id, {
            ...c,
            embedding: new Float32Array(c.embedding),
          });
        }
      }
      
      if (parsed.files) {
        for (const [path, file] of Object.entries(parsed.files)) {
          files.set(path, file as IndexedFile);
        }
      }
      
      return { chunks, files };
    }
  } catch (e) {
    console.warn("Failed to load semantic search cache:", e);
  }
  return { chunks: new Map(), files: new Map() };
}

/**
 * Save index to localStorage
 */
function saveIndex(chunks: Map<string, IndexedChunk>, files: Map<string, IndexedFile>): void {
  try {
    const chunksObj: Record<string, unknown> = {};
    for (const [id, chunk] of chunks) {
      chunksObj[id] = {
        ...chunk,
        embedding: Array.from(chunk.embedding),
      };
    }
    
    const filesObj: Record<string, IndexedFile> = {};
    for (const [path, file] of files) {
      filesObj[path] = file;
    }
    
    const data = JSON.stringify({ chunks: chunksObj, files: filesObj });
    
    // Check size limit (5MB for localStorage)
    if (data.length < 5 * 1024 * 1024) {
      localStorage.setItem(EMBEDDING_CACHE_KEY, data);
    } else {
      console.warn("Semantic search index too large for localStorage, skipping cache");
    }
  } catch (e) {
    console.warn("Failed to save semantic search cache:", e);
  }
}

export function SemanticSearchProvider(props: ParentProps) {
  // Load cached data
  const cached = loadCachedIndex();
  const chunksIndex = cached.chunks;
  const filesIndex = cached.files;
  
  // Cancellation token for indexing
  let indexingCancelled = false;
  
  // Load persisted settings
  let initialAIEnabled = false;
  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (settings) {
      const parsed = JSON.parse(settings);
      initialAIEnabled = parsed.aiSearchEnabled ?? false;
    }
  } catch (err) {
    console.debug("[SemanticSearch] Parse settings failed:", err);
  }
  
  const [state, setState] = createStore<SemanticSearchState>({
    indexReady: chunksIndex.size > 0,
    indexingStatus: "idle",
    indexingProgress: 0,
    indexingCurrentFile: null,
    totalFiles: 0,
    indexedFilesCount: filesIndex.size,
    lastError: null,
    aiSearchEnabled: initialAIEnabled,
    modelId: "local-tfidf",
  });
  
  // Persist AI search enabled setting
  createEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        aiSearchEnabled: state.aiSearchEnabled,
      }));
    } catch (err) {
      console.debug("[SemanticSearch] Save settings failed:", err);
    }
  });
  
  // Save index periodically when indexing
  let saveTimeout: number | undefined;
  const scheduleSave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = window.setTimeout(() => {
      saveIndex(chunksIndex, filesIndex);
    }, 5000);
  };
  
  // Wrap cleanup in onMount for proper reactive context
  onMount(() => {
    onCleanup(() => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      // Final save on unmount
      saveIndex(chunksIndex, filesIndex);
    });
  });
  
  /**
   * Read file content via Tauri
   */
  async function readFileContent(path: string): Promise<string | null> {
    try {
      return await fsReadFile(path);
    } catch (e) {
      console.warn(`Failed to read file ${path}:`, e);
    }
    return null;
  }
  
  /**
   * List files in directory via Tauri
   */
  async function listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fsListDirectory(dirPath);
      return entries
        .filter((f: FileEntry) => f.isFile)
        .map((f: FileEntry) => f.path);
    } catch (e) {
      console.warn(`Failed to list files in ${dirPath}:`, e);
    }
    return [];
  }
  
  /**
   * Index a single file
   */
  async function indexFile(path: string): Promise<void> {
    if (!shouldIndexFile(path) || isExcludedPath(path)) {
      return;
    }
    
    setState("indexingCurrentFile", path);
    
    try {
      const content = await readFileContent(path);
      if (!content || content.length > MAX_FILE_SIZE) {
        return;
      }
      
      // Remove old chunks for this file
      const existingFile = filesIndex.get(path);
      if (existingFile) {
        for (const chunkId of existingFile.chunkIds) {
          chunksIndex.delete(chunkId);
        }
      }
      
      // Create new chunks
      const chunks = chunkContent(content, path);
      const chunkIds: string[] = [];
      const now = Date.now();
      
      for (const chunk of chunks) {
        const embedding = generateEmbeddingLocal(chunk.content);
        const indexedChunk: IndexedChunk = {
          id: chunk.id,
          file: path,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          embedding,
          timestamp: now,
        };
        chunksIndex.set(chunk.id, indexedChunk);
        chunkIds.push(chunk.id);
      }
      
      // Update file index
      filesIndex.set(path, {
        path,
        lastModified: now,
        chunkIds,
        indexedAt: now,
      });
      
      scheduleSave();
    } catch (e) {
      console.warn(`Failed to index file ${path}:`, e);
    }
  }
  
  /**
   * Index entire workspace
   */
  async function indexWorkspace(): Promise<void> {
    if (state.indexingStatus === "indexing") {
      return;
    }
    
    indexingCancelled = false;
    
    solidBatch(() => {
      setState("indexingStatus", "indexing");
      setState("indexingProgress", 0);
      setState("lastError", null);
    });
    
    try {
      const projectPath = getProjectPath();
      
      if (!projectPath) {
        solidBatch(() => {
          setState("indexingStatus", "error");
          setState("lastError", "No project open");
        });
        return;
      }
      
      // Get all files
      const allFiles = await listFiles(projectPath);
      const filesToIndex = allFiles.filter(f => shouldIndexFile(f) && !isExcludedPath(f));
      
      setState("totalFiles", filesToIndex.length);
      
      // Index in batches
      let processed = 0;
      for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
        if (indexingCancelled) {
          break;
        }
        
        const fileBatch = filesToIndex.slice(i, i + BATCH_SIZE);
        await Promise.all(fileBatch.map(file => indexFile(file)));
        
        processed += fileBatch.length;
        solidBatch(() => {
          setState("indexingProgress", Math.round((processed / filesToIndex.length) * 100));
          setState("indexedFilesCount", filesIndex.size);
        });
      }
      
      // Save final state
      saveIndex(chunksIndex, filesIndex);
      
      solidBatch(() => {
        setState("indexingStatus", "idle");
        setState("indexReady", true);
        setState("indexingCurrentFile", null);
        setState("indexingProgress", 100);
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      solidBatch(() => {
        setState("indexingStatus", "error");
        setState("lastError", errorMessage);
      });
    }
  }
  
  /**
   * Cancel ongoing indexing
   */
  function cancelIndexing(): void {
    indexingCancelled = true;
    solidBatch(() => {
      setState("indexingStatus", "idle");
      setState("indexingCurrentFile", null);
    });
  }
  
  /**
   * Perform semantic search
   */
  async function search(query: string, maxResults: number = 20): Promise<SemanticSearchResult[]> {
    if (chunksIndex.size === 0) {
      return [];
    }
    
    // Generate query embedding
    const queryEmbedding = generateEmbeddingLocal(query);
    
    // Calculate similarity for all chunks
    const results: Array<{ chunk: IndexedChunk; similarity: number }> = [];
    
    for (const chunk of chunksIndex.values()) {
      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity > 0.1) { // Minimum threshold
        results.push({ chunk, similarity });
      }
    }
    
    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    
    // Take top results and deduplicate by file
    const seen = new Set<string>();
    const finalResults: SemanticSearchResult[] = [];
    
    for (const { chunk, similarity } of results) {
      if (finalResults.length >= maxResults) {
        break;
      }
      
      // Allow multiple results per file but limit
      const fileKey = `${chunk.file}:${Math.floor(chunk.startLine / 50)}`;
      if (seen.has(fileKey)) {
        continue;
      }
      seen.add(fileKey);
      
      // Get relative path
      const projectPath = getProjectPath();
      let relativePath = chunk.file;
      if (projectPath && chunk.file.startsWith(projectPath)) {
        relativePath = chunk.file.substring(projectPath.length + 1);
      }
      
      finalResults.push({
        file: relativePath,
        content: chunk.content,
        similarity: Math.round(similarity * 100) / 100,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkId: chunk.id,
      });
    }
    
    return finalResults;
  }
  
  /**
   * Clear the entire index
   */
  function clearIndex(): void {
    chunksIndex.clear();
    filesIndex.clear();
    localStorage.removeItem(EMBEDDING_CACHE_KEY);
    
    solidBatch(() => {
      setState("indexReady", false);
      setState("indexedFilesCount", 0);
      setState("indexingProgress", 0);
    });
  }
  
  /**
   * Toggle AI search mode
   */
  function setAISearchEnabled(enabled: boolean): void {
    setState("aiSearchEnabled", enabled);
  }
  
  /**
   * Check if a file is indexed
   */
  function isFileIndexed(path: string): boolean {
    return filesIndex.has(path);
  }
  
  /**
   * Get index statistics
   */
  function getIndexStats(): { totalChunks: number; totalFiles: number; cacheSize: number } {
    let cacheSize = 0;
    try {
      const cached = localStorage.getItem(EMBEDDING_CACHE_KEY);
      if (cached) {
        cacheSize = cached.length;
      }
    } catch (err) {
      console.debug("[SemanticSearch] Load cache failed:", err);
    }
    
    return {
      totalChunks: chunksIndex.size,
      totalFiles: filesIndex.size,
      cacheSize,
    };
  }
  
  /**
   * Remove file from index
   */
  function removeFile(path: string): void {
    const file = filesIndex.get(path);
    if (file) {
      for (const chunkId of file.chunkIds) {
        chunksIndex.delete(chunkId);
      }
      filesIndex.delete(path);
      scheduleSave();
      setState("indexedFilesCount", filesIndex.size);
    }
  }
  
  const contextValue: SemanticSearchContextValue = {
    state,
    search,
    indexFile,
    indexWorkspace,
    cancelIndexing,
    clearIndex,
    setAISearchEnabled,
    isFileIndexed,
    getIndexStats,
    removeFile,
  };
  
  return (
    <SemanticSearchContext.Provider value={contextValue}>
      {props.children}
    </SemanticSearchContext.Provider>
  );
}

export function useSemanticSearch(): SemanticSearchContextValue {
  const context = useContext(SemanticSearchContext);
  if (!context) {
    throw new Error("useSemanticSearch must be used within SemanticSearchProvider");
  }
  return context;
}
