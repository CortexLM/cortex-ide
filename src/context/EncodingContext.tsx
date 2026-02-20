import { createContext, useContext, ParentComponent, onMount, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Types
// ============================================================================

export interface EncodingInfo {
  id: string;
  name: string;
  category: EncodingCategory;
}

export type EncodingCategory = "unicode" | "western" | "eastAsian" | "cyrillic" | "other";

// ============================================================================
// Encoding Registry
// ============================================================================

const ENCODINGS: EncodingInfo[] = [
  // Unicode
  { id: "UTF-8", name: "UTF-8", category: "unicode" },
  { id: "UTF-16LE", name: "UTF-16 LE", category: "unicode" },
  { id: "UTF-16BE", name: "UTF-16 BE", category: "unicode" },
  
  // Western European
  { id: "windows-1252", name: "Windows 1252", category: "western" },
  { id: "ISO-8859-1", name: "ISO-8859-1 (Latin-1)", category: "western" },
  { id: "ISO-8859-2", name: "ISO-8859-2 (Latin-2)", category: "western" },
  { id: "ISO-8859-15", name: "ISO-8859-15 (Latin-9)", category: "western" },
  { id: "macintosh", name: "macintosh", category: "western" },
  
  // East Asian
  { id: "Shift_JIS", name: "Shift JIS (Japanese)", category: "eastAsian" },
  { id: "EUC-JP", name: "EUC-JP (Japanese)", category: "eastAsian" },
  { id: "ISO-2022-JP", name: "ISO-2022-JP (Japanese)", category: "eastAsian" },
  { id: "GBK", name: "GBK (Chinese Simplified)", category: "eastAsian" },
  { id: "gb18030", name: "GB18030 (Chinese)", category: "eastAsian" },
  { id: "Big5", name: "Big5 (Chinese Traditional)", category: "eastAsian" },
  { id: "EUC-KR", name: "EUC-KR (Korean)", category: "eastAsian" },
  
  // Cyrillic
  { id: "KOI8-R", name: "KOI8-R (Russian)", category: "cyrillic" },
  { id: "KOI8-U", name: "KOI8-U (Ukrainian)", category: "cyrillic" },
  { id: "windows-1251", name: "Windows 1251 (Cyrillic)", category: "cyrillic" },
  { id: "IBM866", name: "IBM866 (DOS Cyrillic)", category: "cyrillic" },
  
  // Other Windows code pages
  { id: "windows-1250", name: "Windows 1250 (Central European)", category: "other" },
  { id: "windows-1253", name: "Windows 1253 (Greek)", category: "other" },
  { id: "windows-1254", name: "Windows 1254 (Turkish)", category: "other" },
  { id: "windows-1255", name: "Windows 1255 (Hebrew)", category: "other" },
  { id: "windows-1256", name: "Windows 1256 (Arabic)", category: "other" },
  { id: "windows-1257", name: "Windows 1257 (Baltic)", category: "other" },
  { id: "windows-1258", name: "Windows 1258 (Vietnamese)", category: "other" },
];

// ============================================================================
// State
// ============================================================================

interface EncodingState {
  isLoading: boolean;
  error: string | null;
  encodings: EncodingInfo[];
  fileEncodings: Record<string, string>; // fileId -> encoding
  showPicker: boolean;
  currentFileId: string | null;
  currentFilePath: string | null;
  pickerMode: "reopen" | "save" | null;
}

interface EncodingContextValue {
  state: EncodingState;

  // Encoding detection
  detectEncoding: (path: string) => Promise<string>;

  // File operations
  reopenWithEncoding: (fileId: string, path: string, encoding: string) => Promise<string>;
  saveWithEncoding: (fileId: string, path: string, content: string, encoding: string) => Promise<void>;

  // Encoding management
  getFileEncoding: (fileId: string) => string;
  setFileEncoding: (fileId: string, encoding: string) => void;
  clearFileEncoding: (fileId: string) => void;

  // Encoding info
  getEncodingById: (id: string) => EncodingInfo | undefined;
  getAllEncodings: () => EncodingInfo[];
  searchEncodings: (query: string) => EncodingInfo[];
  getEncodingDisplayName: (encodingId: string) => string;

  // UI
  openPicker: (fileId: string, path: string, mode: "reopen" | "save") => void;
  closePicker: () => void;
}

const EncodingContext = createContext<EncodingContextValue>();

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY_FILE_ENCODINGS = "cortex_file_encodings";

// ============================================================================
// Provider
// ============================================================================

export const EncodingProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<EncodingState>({
    isLoading: false,
    error: null,
    encodings: ENCODINGS,
    fileEncodings: {},
    showPicker: false,
    currentFileId: null,
    currentFilePath: null,
    pickerMode: null,
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  onMount(() => {
    // Load saved encodings
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILE_ENCODINGS);
      if (saved) {
        const encodings = JSON.parse(saved);
        setState("fileEncodings", encodings);
      }
    } catch (err) {
      console.debug("[Encoding] Parse encodings failed:", err);
    }

    // Listen for encoding picker events
    const handleOpenPicker = (e: CustomEvent<{ fileId: string; path: string; mode: "reopen" | "save" }>) => {
      if (e.detail?.fileId && e.detail?.path) {
        openPicker(e.detail.fileId, e.detail.path, e.detail.mode);
      }
    };

    window.addEventListener("encoding-picker:open", handleOpenPicker as EventListener);

    onCleanup(() => {
      window.removeEventListener("encoding-picker:open", handleOpenPicker as EventListener);
    });
  });

  // ============================================================================
  // Encoding Detection
  // ============================================================================

  const detectEncoding = async (path: string): Promise<string> => {
    try {
      const encoding = await invoke<string>("fs_detect_encoding", { path });
      return encoding || "UTF-8";
    } catch (e) {
      console.error("Failed to detect encoding:", e);
      return "UTF-8";
    }
  };

  // ============================================================================
  // File Operations
  // ============================================================================

  const reopenWithEncoding = async (fileId: string, path: string, encoding: string): Promise<string> => {
    try {
      const content = await invoke<string>("fs_read_file_with_encoding", { path, encoding });
      setFileEncoding(fileId, encoding);
      
      // Emit event for the editor to update
      window.dispatchEvent(new CustomEvent("encoding:file-reloaded", {
        detail: { fileId, content, encoding },
      }));
      
      return content;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to reopen file with encoding ${encoding}: ${msg}`);
    }
  };

  const saveWithEncoding = async (fileId: string, path: string, content: string, encoding: string): Promise<void> => {
    try {
      await invoke("fs_write_file_with_encoding", { path, content, encoding });
      setFileEncoding(fileId, encoding);
      
      // Emit event
      window.dispatchEvent(new CustomEvent("encoding:file-saved", {
        detail: { fileId, path, encoding },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to save file with encoding ${encoding}: ${msg}`);
    }
  };

  // ============================================================================
  // Encoding Management
  // ============================================================================

  const getFileEncoding = (fileId: string): string => {
    return state.fileEncodings[fileId] || "UTF-8";
  };

  const setFileEncoding = (fileId: string, encoding: string) => {
    setState("fileEncodings", fileId, encoding);
    
    // Persist to storage
    const encodings = { ...state.fileEncodings, [fileId]: encoding };
    localStorage.setItem(STORAGE_KEY_FILE_ENCODINGS, JSON.stringify(encodings));
    
    // Emit event
    window.dispatchEvent(new CustomEvent("encoding:changed", {
      detail: { fileId, encoding },
    }));
  };

  const clearFileEncoding = (fileId: string) => {
    const newEncodings = { ...state.fileEncodings };
    delete newEncodings[fileId];
    setState("fileEncodings", newEncodings);
    localStorage.setItem(STORAGE_KEY_FILE_ENCODINGS, JSON.stringify(newEncodings));
  };

  // ============================================================================
  // Encoding Info
  // ============================================================================

  const getEncodingById = (id: string): EncodingInfo | undefined => {
    return state.encodings.find((e) => e.id.toLowerCase() === id.toLowerCase());
  };

  const getAllEncodings = (): EncodingInfo[] => {
    return [...state.encodings];
  };

  const searchEncodings = (query: string): EncodingInfo[] => {
    if (!query) return getAllEncodings();
    
    const lowerQuery = query.toLowerCase();
    return state.encodings.filter((enc) =>
      enc.id.toLowerCase().includes(lowerQuery) ||
      enc.name.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.id.toLowerCase() === lowerQuery || a.name.toLowerCase() === lowerQuery;
      const bExact = b.id.toLowerCase() === lowerQuery || b.name.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;
      
      // Then prioritize starts-with matches
      const aStarts = a.id.toLowerCase().startsWith(lowerQuery) || a.name.toLowerCase().startsWith(lowerQuery);
      const bStarts = b.id.toLowerCase().startsWith(lowerQuery) || b.name.toLowerCase().startsWith(lowerQuery);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
      
      return a.name.localeCompare(b.name);
    });
  };

  const getEncodingDisplayName = (encodingId: string): string => {
    const enc = getEncodingById(encodingId);
    return enc?.name || encodingId;
  };

  // ============================================================================
  // UI
  // ============================================================================

  const openPicker = (fileId: string, path: string, mode: "reopen" | "save") => {
    setState({
      currentFileId: fileId,
      currentFilePath: path,
      showPicker: true,
      pickerMode: mode,
    });
  };

  const closePicker = () => {
    setState({
      showPicker: false,
      currentFileId: null,
      currentFilePath: null,
      pickerMode: null,
    });
  };

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: EncodingContextValue = {
    state,
    detectEncoding,
    reopenWithEncoding,
    saveWithEncoding,
    getFileEncoding,
    setFileEncoding,
    clearFileEncoding,
    getEncodingById,
    getAllEncodings,
    searchEncodings,
    getEncodingDisplayName,
    openPicker,
    closePicker,
  };

  return (
    <EncodingContext.Provider value={value}>
      {props.children}
    </EncodingContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useEncoding() {
  const ctx = useContext(EncodingContext);
  if (!ctx) throw new Error("useEncoding must be used within EncodingProvider");
  return ctx;
}

// ============================================================================
// Helper: Get category label
// ============================================================================

export function getCategoryLabel(category: EncodingCategory): string {
  switch (category) {
    case "unicode": return "Unicode";
    case "western": return "Western European";
    case "eastAsian": return "East Asian";
    case "cyrillic": return "Cyrillic";
    case "other": return "Other";
  }
}
