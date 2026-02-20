/**
 * =============================================================================
 * QUICK ACCESS CONTEXT - Unified Prefix Router System
 * =============================================================================
 * 
 * Central router that dispatches based on input prefix for unified quick access:
 * 
 * Built-in prefixes:
 * - '>' - Commands (CommandPalette)
 * - '@' - Document symbols
 * - '#' - Workspace symbols
 * - ':' - Go to line
 * - '?' - Help (show available prefixes)
 * - 'view ' - Views
 * - 'term ' - Terminal (open/create terminals)
 * - 'task ' - Tasks (run/manage tasks)
 * - 'debug ' - Debug (start/manage debug sessions)
 * - 'ext ' - Extensions (manage installed extensions)
 * - (no prefix) - Files (FileFinder)
 * 
 * Features:
 * - Configurable history per provider (default 50, max 200)
 * - Pin items to top of results
 * - Provider registration API
 * 
 * @example
 * ```tsx
 * const { show, registerProvider, pinItem } = useQuickAccess();
 * 
 * // Show with initial prefix
 * show('>'); // Opens command mode
 * show('@'); // Opens document symbols
 * 
 * // Register custom provider
 * registerProvider({
 *   prefix: '!',
 *   placeholder: 'Run script...',
 *   provideItems: async (query) => [...],
 *   onAccept: (item) => { ... },
 * });
 * 
 * // Pin frequently used items
 * pinItem('commands', commandItem);
 * ```
 */

import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  createMemo,
  JSX,
  onMount,
  onCleanup,
  batch,
  For,
  Show,
  Component,
} from "solid-js";
import { Dynamic, Portal } from "solid-js/web";
import { Icon } from "../components/ui/Icon";
import { useCommands } from "./CommandContext";
import { useEditor } from "./EditorContext";
import { useSettings } from "./SettingsContext";
import { useTerminals } from "./TerminalsContext";
import { useTasks } from "./TasksContext";
import { useDebug } from "./DebugContext";
import { useExtensions } from "./ExtensionsContext";
import { lspDocumentSymbols, lspWorkspaceSymbols, type LspSymbol } from "../utils/tauri-api";

// =============================================================================
// Types
// =============================================================================

/** Disposable for cleanup */
export interface Disposable {
  dispose(): void;
}

/** A single item in the quick access list */
export interface QuickPickItem<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Primary label text */
  label: string;
  /** Secondary description (shown after label) */
  description?: string;
  /** Detailed information (shown on second line) */
  detail?: string;
  /** Icon component to render */
  icon?: Component<{ style?: JSX.CSSProperties }>;
  /** Icon color */
  iconColor?: string;
  /** The underlying data associated with this item */
  data?: T;
  /** Whether this item should always be shown (bypass filtering) */
  alwaysShow?: boolean;
  /** Score for sorting (higher = better match) */
  score?: number;
  /** Match indices for highlighting */
  matches?: number[];
}

/** Quick access provider interface */
export interface QuickAccessProvider {
  /** Unique prefix (e.g., '>', '@', '#', ':', '?') */
  prefix: string;
  /** Placeholder text when this provider is active */
  placeholder: string;
  /** Provide items based on query (without prefix) */
  provideItems: (query: string) => Promise<QuickPickItem[]>;
  /** Handle item selection */
  onAccept: (item: QuickPickItem) => void;
  /** Provider display name (for help) */
  name?: string;
  /** Provider description (for help) */
  description?: string;
  /** Optional icon for the provider */
  icon?: Component<{ style?: JSX.CSSProperties }>;
}

/** Pinned item storage */
export interface PinnedItem {
  /** Provider ID (e.g., 'commands', 'files', 'symbols') */
  providerId: string;
  /** Item ID (unique within provider) */
  itemId: string;
  /** Display label */
  label: string;
  /** When the item was pinned */
  pinnedAt: Date;
  /** Optional description */
  description?: string;
  /** Full item data for restoration */
  data?: unknown;
}

/** History entry */
export interface HistoryEntry {
  providerId: string;
  itemId: string;
  label: string;
  usedAt: Date;
  description?: string;
  data?: unknown;
}

/** Quick access context value */
export interface QuickAccessContextValue {
  // Provider management
  registerProvider(provider: QuickAccessProvider): Disposable;
  providers: Map<string, QuickAccessProvider>;
  
  // Core API
  show(initialValue?: string): void;
  hide(): void;
  isVisible: () => boolean;
  
  // Pinned items
  pinnedItems: PinnedItem[];
  pinItem(providerId: string, item: QuickPickItem): void;
  unpinItem(providerId: string, itemId: string): void;
  isPinned(providerId: string, itemId: string): boolean;
  
  // History
  getHistory(providerId: string): HistoryEntry[];
  clearHistory(providerId?: string): void;
}

// =============================================================================
// Storage Keys
// =============================================================================

const PINNED_ITEMS_KEY = "cortex-pinned-items";
const HISTORY_KEY_PREFIX = "cortex-quick-access-history-";

// =============================================================================
// Fuzzy Matching
// =============================================================================

interface FuzzyResult {
  score: number;
  matches: number[];
}

function fuzzyMatch(query: string, text: string): FuzzyResult {
  if (!query) return { score: 0, matches: [] };
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Quick rejection
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) qi++;
  }
  if (qi !== query.length) return { score: 0, matches: [] };
  
  // Full scoring
  const matches: number[] = [];
  let score = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;
  
  qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (textLower[ti] === queryLower[qi]) {
      matches.push(ti);
      let charScore = 1;
      
      if (lastMatchIndex === ti - 1) {
        consecutiveBonus++;
        charScore += consecutiveBonus * 5;
      } else {
        consecutiveBonus = 0;
      }
      
      if (ti === 0) {
        charScore += 10;
      } else {
        const prevChar = text[ti - 1];
        if (/[\s_\-./\\]/.test(prevChar)) {
          charScore += 8;
        } else if (prevChar.toLowerCase() === prevChar && text[ti].toLowerCase() !== text[ti]) {
          charScore += 6;
        }
      }
      
      if (query[qi] === text[ti]) {
        charScore += 2;
      }
      
      if (lastMatchIndex >= 0 && ti - lastMatchIndex > 1) {
        charScore -= Math.min(ti - lastMatchIndex - 1, 3);
      }
      
      score += charScore;
      lastMatchIndex = ti;
      qi++;
    }
  }
  
  score = score * (1 + 10 / (text.length + 10));
  
  return { score, matches };
}

function highlightMatches(text: string, matches?: number[]): JSX.Element {
  if (!matches || matches.length === 0) {
    return <span>{text}</span>;
  }
  
  const result: JSX.Element[] = [];
  let lastIndex = 0;
  const matchSet = new Set(matches);
  
  for (let i = 0; i < text.length; i++) {
    if (matchSet.has(i)) {
      if (i > lastIndex) {
        result.push(<span>{text.slice(lastIndex, i)}</span>);
      }
      result.push(
        <span style={{
          color: "var(--jb-border-focus)",
          "font-weight": "600",
        }}>{text[i]}</span>
      );
      lastIndex = i + 1;
    }
  }
  
  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }
  
  return <>{result}</>;
}

// =============================================================================
// Storage Helpers
// =============================================================================

function loadPinnedItems(): PinnedItem[] {
  try {
    const stored = localStorage.getItem(PINNED_ITEMS_KEY);
    if (!stored) return [];
    const items = JSON.parse(stored);
    return items.map((item: PinnedItem) => ({
      ...item,
      pinnedAt: new Date(item.pinnedAt),
    }));
  } catch (err) {
    console.debug("[QuickAccess] Load pinned failed:", err);
    return [];
  }
}

function savePinnedItems(items: PinnedItem[]): void {
  try {
    localStorage.setItem(PINNED_ITEMS_KEY, JSON.stringify(items));
  } catch (err) {
    console.debug("[QuickAccess] Save pinned failed:", err);
  }
}

function loadHistory(providerId: string, limit: number): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY_PREFIX + providerId);
    if (!stored) return [];
    const items = JSON.parse(stored);
    return items.slice(0, limit).map((item: HistoryEntry) => ({
      ...item,
      usedAt: new Date(item.usedAt),
    }));
  } catch (err) {
    console.debug("[QuickAccess] Load history failed:", err);
    return [];
  }
}

function saveHistory(providerId: string, entries: HistoryEntry[], limit: number): void {
  try {
    const limited = entries.slice(0, limit);
    localStorage.setItem(HISTORY_KEY_PREFIX + providerId, JSON.stringify(limited));
  } catch (err) {
    console.debug("[QuickAccess] Save history failed:", err);
  }
}

function addToHistory(providerId: string, item: QuickPickItem, limit: number): void {
  const history = loadHistory(providerId, limit);
  const filtered = history.filter(h => h.itemId !== item.id);
  const entry: HistoryEntry = {
    providerId,
    itemId: item.id,
    label: item.label,
    usedAt: new Date(),
    description: item.description,
    data: item.data,
  };
  filtered.unshift(entry);
  saveHistory(providerId, filtered, limit);
}

// =============================================================================
// Context
// =============================================================================

const QuickAccessContext = createContext<QuickAccessContextValue>();

// =============================================================================
// Provider Component
// =============================================================================

export function QuickAccessProvider(props: { children: JSX.Element }) {
  const commands = useCommands();
  const editor = useEditor();
  const settings = useSettings();
  
  // State
  const [isVisible, setIsVisible] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [items, setItems] = createSignal<QuickPickItem[]>([]);
  const [isLoading, setIsLoading] = createSignal(false);
  const [providers, setProviders] = createSignal<Map<string, QuickAccessProvider>>(new Map());
  const [pinnedItems, setPinnedItems] = createSignal<PinnedItem[]>(loadPinnedItems());
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);
  
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;
  
  // Get history length from settings (default 50, max 200)
  const historyLength = createMemo(() => {
    const effectiveSettings = settings.effectiveSettings();
    const commandPalette = effectiveSettings.commandPalette;
    const len = commandPalette?.historyLength ?? 50;
    return Math.min(Math.max(len, 1), 200);
  });
  
  // Detect active provider based on query prefix
  const activeProvider = createMemo(() => {
    const q = query();
    const providerMap = providers();
    
    // Check each provider's prefix
    for (const [prefix, provider] of providerMap.entries()) {
      if (q.startsWith(prefix)) {
        return { provider, prefix, query: q.slice(prefix.length) };
      }
    }
    
    // Default to files provider (empty prefix)
    const filesProvider = providerMap.get("");
    if (filesProvider) {
      return { provider: filesProvider, prefix: "", query: q };
    }
    
    return null;
  });
  
  // Get provider ID for history/pinning
  const getProviderId = (prefix: string): string => {
    switch (prefix) {
      case ">": return "commands";
      case "@": return "document-symbols";
      case "#": return "workspace-symbols";
      case ":": return "go-to-line";
      case "?": return "help";
      case "view ": return "views";
      case "term ": return "terminal";
      case "task ": return "task";
      case "debug ": return "debug";
      case "ext ": return "extension";
      default: return "files";
    }
  };
  
  // ==========================================================================
  // Built-in Providers
  // ==========================================================================
  
  // Helper to create icon component
  const createIcon = (name: string) => {
    return (props: { style?: JSX.CSSProperties }) => Icon({ name, style: props.style });
  };

  // Commands Provider (>)
  const commandsProvider: QuickAccessProvider = {
    prefix: ">",
    placeholder: "Type a command...",
    name: "Commands",
    description: "Run a command",
    icon: createIcon("command"),
    provideItems: async (q) => {
      const cmds = commands.commands();
      const history = loadHistory("commands", historyLength());
      const pinned = pinnedItems().filter(p => p.providerId === "commands");
      
      let results: QuickPickItem[] = cmds.map(cmd => ({
        id: cmd.id,
        label: cmd.label,
        description: cmd.shortcut,
        detail: cmd.category,
        data: cmd,
      }));
      
      if (q) {
        results = results
          .map(item => {
            const result = fuzzyMatch(q, item.label);
            const categoryResult = item.detail ? fuzzyMatch(q, item.detail) : { score: 0, matches: [] };
            return {
              ...item,
              score: Math.max(result.score, categoryResult.score),
              matches: result.score >= categoryResult.score ? result.matches : [],
            };
          })
          .filter(item => (item.score ?? 0) > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      } else {
        // Show pinned first, then recent, then rest
        const pinnedSet = new Set(pinned.map(p => p.itemId));
        const historySet = new Set(history.map(h => h.itemId));
        
        const pinnedItems = results.filter(r => pinnedSet.has(r.id));
        const recentItems = results.filter(r => historySet.has(r.id) && !pinnedSet.has(r.id));
        const restItems = results.filter(r => !pinnedSet.has(r.id) && !historySet.has(r.id));
        
        results = [...pinnedItems, ...recentItems, ...restItems];
      }
      
      return results.slice(0, 100);
    },
    onAccept: (item) => {
      addToHistory("commands", item, historyLength());
      commands.executeCommand(item.id);
    },
  };
  
  // Document Symbols Provider (@)
  const documentSymbolsProvider: QuickAccessProvider = {
    prefix: "@",
    placeholder: "Go to symbol in current file...",
    name: "Document Symbols",
    description: "Go to symbol in current file",
    icon: createIcon("at"),
    provideItems: async (q) => {
      const state = editor.state;
      if (!state.activeFileId) return [];
      
      const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
      if (!activeFile?.path) return [];
      
      try {
        const symbols = await lspDocumentSymbols(activeFile.path);
        let results: QuickPickItem[] = (symbols || []).map((sym: LspSymbol) => ({
          id: `${sym.name}-${sym.location?.range?.start?.line ?? 0}`,
          label: sym.name,
          description: sym.containerName,
          detail: `Line ${(sym.location?.range?.start?.line ?? 0) + 1}`,
          data: sym,
        }));
        
        if (q) {
          results = results
            .map(item => {
              const result = fuzzyMatch(q, item.label);
              return { ...item, score: result.score, matches: result.matches };
            })
            .filter(item => (item.score ?? 0) > 0)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        }
        
        return results.slice(0, 100);
      } catch (err) {
        console.debug("[QuickAccess] Symbol query failed:", err);
        return [];
      }
    },
    onAccept: (item) => {
      const sym = item.data as LspSymbol;
      if (sym?.location?.range?.start) {
        window.dispatchEvent(new CustomEvent("editor:goto-line", {
          detail: {
            line: sym.location.range.start.line + 1,
            column: (sym.location.range.start.character ?? 0) + 1,
          },
        }));
      }
    },
  };
  
  // Workspace Symbols Provider (#)
  const workspaceSymbolsProvider: QuickAccessProvider = {
    prefix: "#",
    placeholder: "Go to symbol in workspace...",
    name: "Workspace Symbols",
    description: "Go to symbol in workspace",
    icon: createIcon("hashtag"),
    provideItems: async (q) => {
      if (!q || q.length < 2) {
        return [{
          id: "hint",
          label: "Type at least 2 characters to search...",
          alwaysShow: true,
        }];
      }
      
      try {
        // Get workspace path for LSP workspace symbols search
        const state = editor.state;
        const activeFile = state.openFiles.find(f => f.id === state.activeFileId);
        const workspacePath = activeFile?.path ? activeFile.path.split(/[/\\]/).slice(0, -1).join("/") : ".";
        
        const symbols = await lspWorkspaceSymbols(workspacePath, q);
        const results: QuickPickItem[] = (symbols || []).map((sym: LspSymbol) => {
          const location = sym.location;
          const filePath = location?.uri?.replace("file://", "") ?? "";
          const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
          
          return {
            id: `${sym.name}-${filePath}-${location?.range?.start?.line ?? 0}`,
            label: sym.name,
            description: fileName,
            detail: `Line ${(location?.range?.start?.line ?? 0) + 1}`,
            data: { sym, filePath },
          };
        });
        
        return results.slice(0, 100);
      } catch (err) {
        console.debug("[QuickAccess] Symbol query failed:", err);
        return [];
      }
    },
    onAccept: async (item) => {
      const data = item.data as { sym: LspSymbol; filePath: string };
      if (data?.filePath) {
        await editor.openFile(data.filePath);
        if (data.sym?.location?.range?.start) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("editor:goto-line", {
              detail: {
                line: data.sym.location!.range!.start!.line + 1,
                column: (data.sym.location!.range!.start!.character ?? 0) + 1,
              },
            }));
          }, 100);
        }
      }
    },
  };
  
  // Go to Line Provider (:)
  const goToLineProvider: QuickAccessProvider = {
    prefix: ":",
    placeholder: "Go to line (e.g., :10 or :10:5 for column)...",
    name: "Go to Line",
    description: "Go to a specific line",
    icon: createIcon("hashtag"),
    provideItems: async (q) => {
      const match = q.match(/^(\d+)(?::(\d+))?$/);
      if (!match) {
        return [{
          id: "hint",
          label: "Enter line number (e.g., 10 or 10:5 for column)",
          alwaysShow: true,
        }];
      }
      
      const line = parseInt(match[1], 10);
      const column = match[2] ? parseInt(match[2], 10) : 1;
      
      return [{
        id: `goto-${line}-${column}`,
        label: `Go to line ${line}${column > 1 ? `, column ${column}` : ""}`,
        data: { line, column },
      }];
    },
    onAccept: (item) => {
      const data = item.data as { line: number; column: number };
      if (data) {
        window.dispatchEvent(new CustomEvent("editor:goto-line", {
          detail: { line: data.line, column: data.column },
        }));
      }
    },
  };
  
  // Help Provider (?)
  const helpProvider: QuickAccessProvider = {
    prefix: "?",
    placeholder: "Show available prefixes...",
    name: "Help",
    description: "Show available quick access prefixes",
    icon: createIcon("circle-question"),
    provideItems: async () => {
      const providerMap = providers();
      const helpItems: QuickPickItem[] = [];
      
      for (const [prefix, provider] of providerMap.entries()) {
        if (prefix === "?") continue; // Skip help itself
        helpItems.push({
          id: `help-${prefix || "files"}`,
          label: `${prefix || "(no prefix)"} - ${provider.name || "Unknown"}`,
          description: provider.description || provider.placeholder,
          icon: provider.icon,
          data: prefix,
        });
      }
      
      return helpItems;
    },
    onAccept: (item) => {
      const prefix = item.data as string;
      setQuery(prefix);
      inputRef?.focus();
    },
  };
  
  // Views Provider (view )
  const viewsProvider: QuickAccessProvider = {
    prefix: "view ",
    placeholder: "Open view...",
    name: "Views",
    description: "Open a specific view",
    icon: createIcon("grid"),
    provideItems: async (q) => {
      const views: QuickPickItem[] = [
        { id: "explorer", label: "Explorer", description: "File explorer" },
        { id: "search", label: "Search", description: "Search in files" },
        { id: "scm", label: "Source Control", description: "Git changes" },
        { id: "debug", label: "Debug", description: "Debug console" },
        { id: "extensions", label: "Extensions", description: "Manage extensions" },
        { id: "terminal", label: "Terminal", description: "Integrated terminal" },
        { id: "problems", label: "Problems", description: "Errors and warnings" },
        { id: "output", label: "Output", description: "Output panel" },
        { id: "chat", label: "Chat", description: "AI chat assistant" },
        { id: "outline", label: "Outline", description: "Document outline" },
        { id: "timeline", label: "Timeline", description: "File history" },
      ];
      
      if (q) {
        return views
          .map(view => {
            const result = fuzzyMatch(q, view.label);
            const descResult = view.description ? fuzzyMatch(q, view.description) : { score: 0, matches: [] };
            return {
              ...view,
              score: Math.max(result.score, descResult.score),
              matches: result.score >= descResult.score ? result.matches : [],
            };
          })
          .filter(v => (v.score ?? 0) > 0)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      }
      
      return views;
    },
    onAccept: (item) => {
      window.dispatchEvent(new CustomEvent("layout:show-view", {
        detail: { viewId: item.id },
      }));
    },
  };
  
  // Files Provider (no prefix)
  const filesProvider: QuickAccessProvider = {
    prefix: "",
    placeholder: "Search files by name...",
    name: "Files",
    description: "Go to file",
    icon: createIcon("magnifying-glass"),
    provideItems: async (q) => {
      // This will be delegated to FileFinder's existing logic
      // For now, return empty and let FileFinder handle it
      const history = loadHistory("files", historyLength());
      const pinned = pinnedItems().filter(p => p.providerId === "files");
      
      if (!q) {
        // Return recent files
        const recentItems: QuickPickItem[] = history.slice(0, 15).map(h => ({
          id: h.itemId,
          label: h.label,
          description: h.description,
          data: h.data,
        }));
        
        const pinnedSet = new Set(pinned.map(p => p.itemId));
        const pinnedItemsList: QuickPickItem[] = pinned.map(p => ({
          id: p.itemId,
          label: p.label,
          description: p.description,
          data: p.data,
        }));
        
        return [...pinnedItemsList, ...recentItems.filter(r => !pinnedSet.has(r.id))];
      }
      
      // For actual file search, we'd integrate with the file tree
      // This is a simplified version - in production, use fsGetFileTree
      return [];
    },
    onAccept: async (item) => {
      if (item.data) {
        addToHistory("files", item, historyLength());
        const filePath = (item.data as { path?: string }).path || item.id;
        await editor.openFile(filePath);
      }
    },
  };
  
  // ==========================================================================
  // Terminal Provider (term )
  // ==========================================================================
  
  const terminals = useTerminals();
  
  const terminalProvider: QuickAccessProvider = {
    prefix: "term ",
    placeholder: "Search terminals or create new...",
    name: "Terminal",
    description: "Open or create terminals",
    icon: createIcon("terminal"),
    provideItems: async (q) => {
      const items: QuickPickItem[] = [];
      const trimmedQuery = q.trim().toLowerCase();
      const terminalList = terminals.state.terminals;
      const profiles = terminals.getProfiles();
      
      // Add existing terminals
      const terminalItems = terminalList
        .filter(t => {
          if (!trimmedQuery) return true;
          const name = (t.name || "").toLowerCase();
          const shell = (t.shell || "").toLowerCase();
          return name.includes(trimmedQuery) || shell.includes(trimmedQuery);
        })
        .map(terminal => ({
          id: `terminal-${terminal.id}`,
          label: terminal.name || `Terminal ${terminal.id.slice(0, 8)}`,
          description: terminal.type === "ssh" ? "SSH" : "Local",
          detail: terminal.cwd,
          icon: createIcon("terminal"),
          data: { type: "focus" as const, terminalId: terminal.id },
        }));
      
      if (terminalItems.length > 0) {
        items.push(...terminalItems);
      }
      
      // Add profile options for creating new terminals
      const profileItems = profiles
        .filter(profile => {
          if (!trimmedQuery) return true;
          const name = (profile.name || "").toLowerCase();
          return name.includes(trimmedQuery);
        })
        .map(profile => ({
          id: `profile-${profile.id}`,
          label: `New ${profile.name}`,
          description: profile.isDefault ? "Default" : undefined,
          icon: createIcon("terminal"),
          data: { type: "create" as const, profileId: profile.id },
        }));
      
      items.push(...profileItems);
      
      // If no profiles, add a generic "New Terminal" option
      if (profiles.length === 0 && (!trimmedQuery || "new terminal".includes(trimmedQuery))) {
        items.push({
          id: "new-terminal",
          label: "New Terminal",
          description: "Create a new terminal",
          icon: createIcon("terminal"),
          data: { type: "create" as const },
        });
      }
      
      return items;
    },
    onAccept: (item) => {
      const data = item.data as { type: string; terminalId?: string; profileId?: string };
      if (!data) return;
      
      switch (data.type) {
        case "focus":
          if (data.terminalId) {
            terminals.openTerminal(data.terminalId);
          }
          break;
        case "create":
          if (data.profileId) {
            terminals.createTerminalWithProfile(data.profileId);
          } else {
            terminals.createTerminal();
          }
          break;
      }
    },
  };
  
  // ==========================================================================
  // Task Provider (task )
  // ==========================================================================
  
  const tasks = useTasks();
  
  const taskProvider: QuickAccessProvider = {
    prefix: "task ",
    placeholder: "Search tasks to run...",
    name: "Tasks",
    description: "Run or manage tasks",
    icon: createIcon("play"),
    provideItems: async (q) => {
      const items: QuickPickItem[] = [];
      const trimmedQuery = q.trim().toLowerCase();
      const taskList = tasks.allTasks();
      const runningTasks = tasks.state.runningTasks;
      
      // Filter tasks by query
      const filterTask = (task: { label: string; command?: string }): boolean => {
        if (!trimmedQuery) return true;
        const label = task.label.toLowerCase();
        const command = (task.command || "").toLowerCase();
        return label.includes(trimmedQuery) || command.includes(trimmedQuery);
      };
      
      // Running tasks first
      const runningItems = runningTasks
        .filter(run => {
          if (!trimmedQuery) return true;
          return run.taskLabel.toLowerCase().includes(trimmedQuery);
        })
        .map(run => ({
          id: `running-${run.id}`,
          label: run.taskLabel,
          description: "Running",
          detail: run.config.command,
          icon: createIcon("spinner"),
          iconColor: "#f59e0b",
          data: { type: "stop" as const, runId: run.id },
        }));
      
      if (runningItems.length > 0) {
        items.push(...runningItems);
      }
      
      // Group available tasks by group
      const buildTasks = taskList.filter(t => t.group === "build" && filterTask(t));
      const testTasks = taskList.filter(t => t.group === "test" && filterTask(t));
      const runTasks = taskList.filter(t => t.group === "run" && filterTask(t));
      const otherTasks = taskList.filter(t => (!t.group || t.group === "none" || t.group === "clean" || t.group === "deploy") && filterTask(t));
      
      // Helper to convert task to item
      const toQuickPickItem = (task: typeof taskList[0], groupColor?: string): QuickPickItem => {
        const isRunning = runningTasks.some(r => r.taskLabel === task.label);
        return {
          id: `task-${task.label}`,
          label: task.label,
          description: task.source === "auto-detected" ? "Auto-detected" : task.isDefault ? "Default" : undefined,
          detail: task.command + (task.args?.length ? ` ${task.args.join(" ")}` : ""),
          icon: isRunning ? createIcon("spinner") : createIcon("play"),
          iconColor: isRunning ? "#f59e0b" : groupColor,
          data: { type: "run" as const, taskLabel: task.label },
        };
      };
      
      // Add grouped tasks
      if (buildTasks.length > 0) items.push(...buildTasks.map(t => toQuickPickItem(t, "#22c55e")));
      if (testTasks.length > 0) items.push(...testTasks.map(t => toQuickPickItem(t, "#f59e0b")));
      if (runTasks.length > 0) items.push(...runTasks.map(t => toQuickPickItem(t, "#3b82f6")));
      if (otherTasks.length > 0) items.push(...otherTasks.map(t => toQuickPickItem(t)));
      
      return items;
    },
    onAccept: (item) => {
      const data = item.data as { type: string; taskLabel?: string; runId?: string };
      if (!data) return;
      
      switch (data.type) {
        case "run":
          if (data.taskLabel) {
            const task = tasks.allTasks().find(t => t.label === data.taskLabel);
            if (task) {
              tasks.runTask(task);
            }
          }
          break;
        case "stop":
          if (data.runId) {
            tasks.cancelTask(data.runId);
          }
          break;
      }
    },
  };
  
  // ==========================================================================
  // Debug Provider (debug )
  // ==========================================================================
  
  const debug = useDebug();
  
  const debugProvider: QuickAccessProvider = {
    prefix: "debug ",
    placeholder: "Search debug configurations...",
    name: "Debug",
    description: "Start debugging or manage sessions",
    icon: createIcon("bug"),
    provideItems: async (q) => {
      const items: QuickPickItem[] = [];
      const trimmedQuery = q.trim().toLowerCase();
      const configs = debug.state.savedConfigurations;
      const activeSession = debug.getActiveSession();
      
      // Active session controls first
      if (activeSession) {
        const matchesQuery = !trimmedQuery || activeSession.name.toLowerCase().includes(trimmedQuery);
        if (matchesQuery) {
          items.push({
            id: `active-${activeSession.id}`,
            label: activeSession.name,
            description: "Active",
            detail: `Type: ${activeSession.type}`,
            icon: createIcon("bug"),
            iconColor: "#22c55e",
            data: { type: "stop" as const, sessionId: activeSession.id },
          });
        }
      }
      
      // Filter configs by query
      const filteredConfigs = configs.filter(config => {
        if (!trimmedQuery) return true;
        const name = config.name.toLowerCase();
        const type = (config.type || "").toLowerCase();
        return name.includes(trimmedQuery) || type.includes(trimmedQuery);
      });
      
      // Add launch configs
      const configItems = filteredConfigs.map(config => ({
        id: `config-${config.name}`,
        label: config.name,
        description: [config.type, config.request].filter(Boolean).join(" - "),
        detail: config.program || config.cwd,
        icon: createIcon("bug"),
        data: { type: "launch" as const, configName: config.name },
      }));
      
      items.push(...configItems);
      
      // Add configuration action
      if (!trimmedQuery || "add configuration".includes(trimmedQuery) || "create".includes(trimmedQuery)) {
        items.push({
          id: "add-config",
          label: "Add Configuration...",
          description: "Create a new launch configuration",
          icon: createIcon("bug"),
          data: { type: "add" as const },
        });
      }
      
      return items;
    },
    onAccept: (item) => {
      const data = item.data as { type: string; configName?: string; sessionId?: string };
      if (!data) return;
      
      switch (data.type) {
        case "launch":
          if (data.configName) {
            const config = debug.state.savedConfigurations.find(c => c.name === data.configName);
            if (config) {
              debug.startSession(config);
            }
          }
          break;
        case "stop":
          debug.stopSession(data.sessionId);
          break;
        case "add":
          window.dispatchEvent(new CustomEvent("debug:add-configuration"));
          break;
      }
    },
  };
  
  // ==========================================================================
  // Extension Provider (ext )
  // ==========================================================================
  
  const extensions = useExtensions();
  
  const extensionProvider: QuickAccessProvider = {
    prefix: "ext ",
    placeholder: "Search extensions...",
    name: "Extensions",
    description: "Manage installed extensions",
    icon: createIcon("box"),
    provideItems: async (q) => {
      const items: QuickPickItem[] = [];
      const trimmedQuery = q.trim().toLowerCase();
      const extensionList = extensions.extensions();
      
      // Filter extensions by query
      const filteredExtensions = extensionList.filter(ext => {
        if (!trimmedQuery) return true;
        const name = ext.manifest.name.toLowerCase();
        const displayName = (ext.manifest.description || "").toLowerCase();
        return name.includes(trimmedQuery) || displayName.includes(trimmedQuery);
      });
      
      // Add installed extensions
      const extensionItems = filteredExtensions.map(ext => ({
        id: `ext-${ext.manifest.name}`,
        label: ext.manifest.name,
        description: ext.enabled ? "Enabled" : "Disabled",
        detail: ext.manifest.description,
        icon: createIcon("box"),
        iconColor: ext.enabled ? "#22c55e" : "#6b7280",
        data: {
          type: "show" as const,
          extensionId: ext.manifest.name,
          extensionName: ext.manifest.name,
          enabled: ext.enabled,
        },
      }));
      
      items.push(...extensionItems);
      
      // Add actions section
      const showActions = !trimmedQuery || 
        "install".includes(trimmedQuery) || 
        "marketplace".includes(trimmedQuery) ||
        "refresh".includes(trimmedQuery);
      
      if (showActions) {
        if (!trimmedQuery || "install".includes(trimmedQuery) || "marketplace".includes(trimmedQuery)) {
          items.push({
            id: "install-extension",
            label: "Install Extension...",
            description: "Browse and install extensions from marketplace",
            icon: createIcon("box"),
            data: { type: "install" as const },
          });
        }
        
        if (!trimmedQuery || "refresh".includes(trimmedQuery) || "reload".includes(trimmedQuery)) {
          items.push({
            id: "refresh-extensions",
            label: "Refresh Extensions",
            description: "Reload extension list",
            icon: createIcon("rotate"),
            data: { type: "refresh" as const },
          });
        }
      }
      
      return items;
    },
    onAccept: (item) => {
      const data = item.data as { type: string; extensionId?: string; extensionName?: string; enabled?: boolean };
      if (!data) return;
      
      switch (data.type) {
        case "show":
          if (data.extensionId) {
            // Toggle enable/disable
            if (data.enabled) {
              extensions.disableExtension(data.extensionName!);
            } else {
              extensions.enableExtension(data.extensionName!);
            }
          }
          break;
        case "install":
          window.dispatchEvent(new CustomEvent("view:focus", { 
            detail: { view: "extensions", type: "sidebar" } 
          }));
          break;
        case "refresh":
          extensions.loadExtensions();
          break;
      }
    },
  };
  
  // Register built-in providers
  onMount(() => {
    const providerMap = new Map<string, QuickAccessProvider>();
    providerMap.set(">", commandsProvider);
    providerMap.set("@", documentSymbolsProvider);
    providerMap.set("#", workspaceSymbolsProvider);
    providerMap.set(":", goToLineProvider);
    providerMap.set("?", helpProvider);
    providerMap.set("view ", viewsProvider);
    providerMap.set("term ", terminalProvider);
    providerMap.set("task ", taskProvider);
    providerMap.set("debug ", debugProvider);
    providerMap.set("ext ", extensionProvider);
    providerMap.set("", filesProvider);
    setProviders(providerMap);
  });
  
  // ==========================================================================
  // Item Loading
  // ==========================================================================
  
  createEffect(async () => {
    const active = activeProvider();
    if (!active || !isVisible()) {
      setItems([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const providerItems = await active.provider.provideItems(active.query);
      setItems(providerItems);
      setSelectedIndex(0);
    } catch (err) {
      console.error("QuickAccess: Error loading items", err);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  });
  
  // ==========================================================================
  // Navigation
  // ==========================================================================
  
  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef && isVisible()) {
      const itemElements = listRef.querySelectorAll("[data-quick-access-item]");
      const selectedItem = itemElements[index] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  });
  
  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });
  
  // Focus input when visible
  createEffect(() => {
    if (isVisible()) {
      setTimeout(() => inputRef?.focus(), 10);
    }
  });
  
  // ==========================================================================
  // Keyboard Handling
  // ==========================================================================
  
  const handleKeyDown = (e: KeyboardEvent) => {
    const currentItems = items();
    
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, currentItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const selected = currentItems[selectedIndex()];
        if (selected && !selected.alwaysShow) {
          handleAccept(selected);
        }
        break;
      case "Escape":
        e.preventDefault();
        hide();
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex(i => Math.max(i - 1, 0));
        } else {
          setSelectedIndex(i => Math.min(i + 1, currentItems.length - 1));
        }
        break;
      case "Home":
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setSelectedIndex(currentItems.length - 1);
        break;
    }
  };
  
  const handleAccept = (item: QuickPickItem) => {
    const active = activeProvider();
    if (active) {
      active.provider.onAccept(item);
    }
    hide();
  };
  
  // Global escape handler
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isVisible()) {
      e.preventDefault();
      e.stopPropagation();
      hide();
    }
  };
  
  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown, true);
  });
  
  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown, true);
  });
  
  // ==========================================================================
  // Public API
  // ==========================================================================
  
  const show = (initialValue?: string) => {
    batch(() => {
      setQuery(initialValue ?? "");
      setSelectedIndex(0);
      setIsVisible(true);
    });
  };
  
  const hide = () => {
    setIsVisible(false);
    setQuery("");
    setItems([]);
  };
  
  const registerProvider = (provider: QuickAccessProvider): Disposable => {
    setProviders(map => {
      const newMap = new Map(map);
      newMap.set(provider.prefix, provider);
      return newMap;
    });
    
    return {
      dispose: () => {
        setProviders(map => {
          const newMap = new Map(map);
          newMap.delete(provider.prefix);
          return newMap;
        });
      },
    };
  };
  
  const pinItem = (providerId: string, item: QuickPickItem) => {
    const currentPinned = pinnedItems();
    const existing = currentPinned.find(p => p.providerId === providerId && p.itemId === item.id);
    if (existing) return; // Already pinned
    
    const newPin: PinnedItem = {
      providerId,
      itemId: item.id,
      label: item.label,
      pinnedAt: new Date(),
      description: item.description,
      data: item.data,
    };
    
    const updated = [...currentPinned, newPin];
    setPinnedItems(updated);
    savePinnedItems(updated);
  };
  
  const unpinItem = (providerId: string, itemId: string) => {
    const updated = pinnedItems().filter(
      p => !(p.providerId === providerId && p.itemId === itemId)
    );
    setPinnedItems(updated);
    savePinnedItems(updated);
  };
  
  const isPinnedCheck = (providerId: string, itemId: string): boolean => {
    return pinnedItems().some(p => p.providerId === providerId && p.itemId === itemId);
  };
  
  const getHistory = (providerId: string): HistoryEntry[] => {
    return loadHistory(providerId, historyLength());
  };
  
  const clearHistory = (providerId?: string) => {
    if (providerId) {
      localStorage.removeItem(HISTORY_KEY_PREFIX + providerId);
    } else {
      // Clear all history
      const keys = Object.keys(localStorage).filter(k => k.startsWith(HISTORY_KEY_PREFIX));
      keys.forEach(k => localStorage.removeItem(k));
    }
  };
  
  // ==========================================================================
  // Context Value
  // ==========================================================================
  
  const contextValue: QuickAccessContextValue = {
    registerProvider,
    get providers() { return providers(); },
    show,
    hide,
    isVisible,
    get pinnedItems() { return pinnedItems(); },
    pinItem,
    unpinItem,
    isPinned: isPinnedCheck,
    getHistory,
    clearHistory,
  };
  
  // ==========================================================================
  // Render
  // ==========================================================================
  
  return (
    <QuickAccessContext.Provider value={contextValue}>
      {props.children}
      
      <Show when={isVisible()}>
        <Portal>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              inset: "0",
              "z-index": "2549",
              background: "rgba(0, 0, 0, 0.5)",
            }}
            onClick={() => hide()}
          />
          
          {/* Quick Access Widget */}
          <div
            style={{
              position: "fixed",
              top: "12vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: "600px",
              "max-width": "calc(100vw - 32px)",
              "z-index": "2550",
              background: "var(--ui-panel-bg)",
              "border-radius": "8px",
              "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
              "-webkit-app-region": "no-drag",
            }}
            role="dialog"
            aria-label="Quick Access"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "12px",
                height: "48px",
                padding: "0 16px",
                background: "var(--jb-canvas)",
                "border-bottom": "1px solid var(--jb-border-default)",
              }}
            >
              <Show when={activeProvider()?.provider.icon} fallback={Icon({ name: "magnifying-glass", style: { width: "18px", height: "18px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" } })}>
                <Dynamic
                  component={activeProvider()!.provider.icon!}
                  style={{ width: "18px", height: "18px", color: "var(--jb-text-muted-color)", "flex-shrink": "0" }}
                />
              </Show>
              <input
                ref={inputRef}
                type="text"
                placeholder={activeProvider()?.provider.placeholder ?? "Type to search..."}
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: "1",
                  height: "100%",
                  background: "transparent",
                  border: "none",
                  "font-size": "16px",
                  color: "var(--jb-text-body-color)",
                  outline: "none",
                }}
              />
              <Show when={isLoading()}>
                {Icon({
                  name: "spinner",
                  style: {
                    width: "16px",
                    height: "16px",
                    color: "var(--jb-text-muted-color)",
                    "flex-shrink": "0",
                    animation: "spin 1s linear infinite",
                  },
                })}
              </Show>
            </div>
            
            {/* Provider indicator */}
            <Show when={activeProvider()?.provider.name}>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "6px 16px",
                  "border-bottom": "1px solid var(--jb-border-default)",
                  background: "var(--jb-canvas)",
                  "font-size": "12px",
                }}
              >
                <span style={{ color: "var(--jb-border-focus)", "font-weight": "500" }}>
                  {activeProvider()!.prefix || "(files)"}
                </span>
                <span style={{ color: "var(--jb-text-muted-color)" }}>
                  {activeProvider()!.provider.name}
                </span>
              </div>
            </Show>
            
            {/* Results list */}
            <div
              ref={listRef}
              style={{
                "max-height": "400px",
                overflow: "auto",
                "overscroll-behavior": "contain",
              }}
            >
              <Show
                when={items().length > 0}
                fallback={
                  <div style={{ padding: "24px 16px", "text-align": "center" }}>
                    <p style={{ "font-size": "14px", color: "var(--jb-text-muted-color)", margin: "0" }}>
                      {isLoading() ? "Loading..." : "No results found"}
                    </p>
                  </div>
                }
              >
                <For each={items()}>
                  {(item, index) => {
                    const isSelected = () => index() === selectedIndex();
                    const isHovered = () => hoveredIndex() === index();
                    const providerId = () => getProviderId(activeProvider()?.prefix ?? "");
                    const itemIsPinned = () => isPinnedCheck(providerId(), item.id);
                    
                    return (
                      <div
                        data-quick-access-item
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "12px",
                          padding: "10px 16px",
                          cursor: item.alwaysShow ? "default" : "pointer",
                          transition: "background-color 0.1s ease",
                          background: isSelected() ? "rgba(59, 130, 246, 0.2)" : "transparent",
                          "border-left": isSelected() ? "2px solid var(--jb-border-focus)" : "2px solid transparent",
                        }}
                        onMouseEnter={() => {
                          if (!item.alwaysShow) {
                            setSelectedIndex(index());
                            setHoveredIndex(index());
                          }
                        }}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => {
                          if (!item.alwaysShow) {
                            handleAccept(item);
                          }
                        }}
                      >
                        {/* Icon */}
                        <Show when={item.icon}>
                          <Dynamic
                            component={item.icon!}
                            style={{
                              width: "16px",
                              height: "16px",
                              color: item.iconColor || "var(--jb-text-muted-color)",
                              "flex-shrink": "0",
                            }}
                          />
                        </Show>
                        
                        {/* Content */}
                        <div style={{ flex: "1", "min-width": "0" }}>
                          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                            <span
                              style={{
                                "font-size": "14px",
                                color: "var(--jb-text-body-color)",
                                overflow: "hidden",
                                "text-overflow": "ellipsis",
                                "white-space": "nowrap",
                              }}
                            >
                              {highlightMatches(item.label, item.matches)}
                            </span>
                            <Show when={item.description}>
                              <span
                                style={{
                                  "font-size": "12px",
                                  color: "var(--jb-text-muted-color)",
                                  overflow: "hidden",
                                  "text-overflow": "ellipsis",
                                  "white-space": "nowrap",
                                }}
                              >
                                {item.description}
                              </span>
                            </Show>
                          </div>
                          <Show when={item.detail}>
                            <div
                              style={{
                                "font-size": "12px",
                                color: "var(--jb-text-muted-color)",
                                "margin-top": "2px",
                              }}
                            >
                              {item.detail}
                            </div>
                          </Show>
                        </div>
                        
                        {/* Pin button */}
                        <Show when={!item.alwaysShow && (isHovered() || isSelected())}>
                          <button
                            type="button"
                            title={itemIsPinned() ? "Unpin" : "Pin"}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (itemIsPinned()) {
                                unpinItem(providerId(), item.id);
                              } else {
                                pinItem(providerId(), item);
                              }
                            }}
                            style={{
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              width: "24px",
                              height: "24px",
                              background: "transparent",
                              border: "none",
                              "border-radius": "4px",
                              color: itemIsPinned() ? "var(--jb-border-focus)" : "var(--jb-text-muted-color)",
                              cursor: "pointer",
                            }}
                          >
                            <Show when={itemIsPinned()} fallback={Icon({ name: "thumbtack", style: { width: "14px", height: "14px" } })}>
                              {Icon({ name: "thumbtack", style: { width: "14px", height: "14px" } })}
                            </Show>
                          </button>
                        </Show>
                        
                        {/* Pinned indicator */}
                        <Show when={itemIsPinned() && !(isHovered() || isSelected())}>
                          {Icon({
                            name: "thumbtack",
                            style: {
                              width: "14px",
                              height: "14px",
                              color: "var(--jb-border-focus)",
                              "flex-shrink": "0",
                            },
                          })}
                        </Show>
                      </div>
                    );
                  }}
                </For>
              </Show>
            </div>
            
            {/* Footer */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                padding: "8px 16px",
                "font-size": "11px",
                "border-top": "1px solid var(--jb-border-default)",
                color: "var(--jb-text-muted-color)",
                background: "var(--jb-canvas)",
              }}
            >
              <div style={{ display: "flex", gap: "12px", "align-items": "center" }}>
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <kbd style={{
                    background: "var(--ui-panel-bg)",
                    padding: "2px 6px",
                    "border-radius": "4px",
                    "font-size": "11px",
                    color: "var(--jb-text-muted-color)",
                    border: "1px solid var(--jb-border-default)",
                  }}>↑</kbd>
                  <kbd style={{
                    background: "var(--ui-panel-bg)",
                    padding: "2px 6px",
                    "border-radius": "4px",
                    "font-size": "11px",
                    color: "var(--jb-text-muted-color)",
                    border: "1px solid var(--jb-border-default)",
                  }}>↓</kbd>
                  <span>navigate</span>
                </span>
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <kbd style={{
                    background: "var(--ui-panel-bg)",
                    padding: "2px 6px",
                    "border-radius": "4px",
                    "font-size": "11px",
                    color: "var(--jb-text-muted-color)",
                    border: "1px solid var(--jb-border-default)",
                  }}>Enter</kbd>
                  <span>select</span>
                </span>
                <span style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <kbd style={{
                    background: "var(--ui-panel-bg)",
                    padding: "2px 6px",
                    "border-radius": "4px",
                    "font-size": "11px",
                    color: "var(--jb-text-muted-color)",
                    border: "1px solid var(--jb-border-default)",
                  }}>?</kbd>
                  <span>help</span>
                </span>
              </div>
              <span>
                {items().filter(i => !i.alwaysShow).length} result{items().filter(i => !i.alwaysShow).length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Portal>
        
        {/* Spinner animation */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Show>
    </QuickAccessContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useQuickAccess() {
  const context = useContext(QuickAccessContext);
  if (!context) {
    throw new Error("useQuickAccess must be used within a QuickAccessProvider");
  }
  return context;
}

export default QuickAccessProvider;
