import { createSignal, createEffect, Show, onMount, onCleanup, createMemo, JSX } from "solid-js";
import { useCommands } from "@/context/CommandContext";
import { useEditor } from "@/context/EditorContext";
import { useSettings } from "@/context/SettingsContext";
import { Icon } from "./ui/Icon";

// ============================================================================
// Types
// ============================================================================

type CommandCenterMode = "idle" | "files" | "commands" | "symbols" | "workspace-symbols" | "goto-line";

interface ModeConfig {
  prefix: string;
  placeholder: string;
  icon: string;
  hint: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_CONFIGS: Record<CommandCenterMode, ModeConfig> = {
  idle: {
    prefix: "",
    placeholder: "Search or type a command",
    icon: "magnifying-glass",
    hint: "Ctrl+Shift+P for commands",
  },
  files: {
    prefix: "",
    placeholder: "Type to search files...",
    icon: "file",
    hint: "Ctrl+P",
  },
  commands: {
    prefix: ">",
    placeholder: "Type a command...",
    icon: "command",
    hint: "Ctrl+Shift+P",
  },
  symbols: {
    prefix: "@",
    placeholder: "Go to symbol in editor...",
    icon: "at",
    hint: "Ctrl+Shift+O",
  },
  "workspace-symbols": {
    prefix: "#",
    placeholder: "Go to symbol in workspace...",
    icon: "hashtag",
    hint: "Ctrl+T",
  },
  "goto-line": {
    prefix: ":",
    placeholder: "Go to line...",
    icon: "hashtag",
    hint: "Ctrl+G",
  },
};

// Recent items storage
const RECENT_ITEMS_KEY = "command-center-recent";
const MAX_RECENT_ITEMS = 5;

interface RecentItem {
  type: "file" | "command" | "symbol";
  id: string;
  label: string;
  detail?: string;
  timestamp: number;
}

function getRecentItems(): RecentItem[] {
  try {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/** Add item to recent items storage (exported for future use) */
export function addRecentItem(item: Omit<RecentItem, "timestamp">): void {
  try {
    const recent = getRecentItems().filter(r => !(r.type === item.type && r.id === item.id));
    recent.unshift({ ...item, timestamp: Date.now() });
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_ITEMS)));
  } catch {
    // Ignore localStorage errors
  }
}

// ============================================================================
// Command Center Component
// ============================================================================

export function CommandCenter() {
  const { 
    setShowCommandPalette, 
    setShowFileFinder, 
    setShowDocumentSymbolPicker,
    setShowWorkspaceSymbolPicker,
    setShowGoToLine 
  } = useCommands();
  const { state: editorState } = useEditor();
  const { settings } = useSettings();
  
  const [isFocused, setIsFocused] = createSignal(false);
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [_recentItems, setRecentItems] = createSignal<RecentItem[]>([]);
  
  let inputRef: HTMLInputElement | undefined;
  let containerRef: HTMLDivElement | undefined;
  
  // Check if command center is enabled
  const isEnabled = createMemo(() => {
    // Default to true if setting is not defined
    return settings().theme?.commandCenterEnabled !== false;
  });
  
  // Determine current mode based on query prefix
  const currentMode = createMemo<CommandCenterMode>(() => {
    const q = query();
    if (!isFocused() && !q) return "idle";
    if (q.startsWith(">")) return "commands";
    if (q.startsWith("@")) return "symbols";
    if (q.startsWith("#")) return "workspace-symbols";
    if (q.startsWith(":")) return "goto-line";
    return "files";
  });
  
  const modeConfig = createMemo(() => MODE_CONFIGS[currentMode()]);
  
  // Get current file info for idle display
  const currentFileInfo = createMemo(() => {
    if (!editorState.activeFileId) {
      return { name: "No file open", path: "" };
    }
    
    const activeFile = editorState.openFiles.find(f => f.id === editorState.activeFileId);
    if (!activeFile) {
      return { name: "No file open", path: "" };
    }
    
    const pathParts = activeFile.path.replace(/\\/g, "/").split("/");
    const fileName = pathParts[pathParts.length - 1];
    const directory = pathParts.slice(0, -1).join("/");
    
    return {
      name: fileName,
      path: directory,
      fullPath: activeFile.path,
      isModified: activeFile.modified,
    };
  });
  
  // Load recent items on mount
  onMount(() => {
    setRecentItems(getRecentItems());
  });
  
  // Handle focus and expansion
  createEffect(() => {
    if (isFocused()) {
      setIsExpanded(true);
    } else {
      // Delay collapse to allow for click handling
      const timer = setTimeout(() => {
        if (!isFocused()) {
          setIsExpanded(false);
          setQuery("");
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  });
  
  // Handle keyboard shortcuts globally
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (!isEnabled()) return;
    
    // Ctrl+E or Ctrl+Shift+. to focus command center
    if ((e.ctrlKey || e.metaKey) && e.key === "e" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      inputRef?.focus();
      return;
    }
  };
  
  onMount(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
  });
  
  onCleanup(() => {
    window.removeEventListener("keydown", handleGlobalKeyDown);
  });
  
  // Handle input changes
  const handleInput = (e: InputEvent) => {
    const target = e.currentTarget as HTMLInputElement;
    setQuery(target.value);
  };
  
  // Handle keyboard navigation within command center
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef?.blur();
      setIsFocused(false);
      return;
    }
    
    if (e.key === "Enter") {
      e.preventDefault();
      handleAction();
      return;
    }
    
    // Mode switching shortcuts
    if (query() === "" || query() === ">") {
      if (e.key === ">" || (e.shiftKey && e.key === ".")) {
        // Prevent duplicate if already typed
        if (!query().startsWith(">")) {
          setQuery(">");
        }
      }
    }
  };
  
  // Execute the appropriate action based on current mode
  const handleAction = () => {
    const mode = currentMode();
    const q = query();
    
    inputRef?.blur();
    setIsFocused(false);
    
    switch (mode) {
      case "commands":
        setShowCommandPalette(true);
        // Dispatch event to pre-fill command palette with query (minus prefix)
        window.dispatchEvent(new CustomEvent("command-palette:prefill", {
          detail: { query: q.slice(1) }
        }));
        break;
        
      case "files":
        setShowFileFinder(true);
        if (q) {
          window.dispatchEvent(new CustomEvent("file-finder:prefill", {
            detail: { query: q }
          }));
        }
        break;
        
      case "symbols":
        setShowDocumentSymbolPicker(true);
        window.dispatchEvent(new CustomEvent("symbol-picker:prefill", {
          detail: { query: q.slice(1) }
        }));
        break;
        
      case "workspace-symbols":
        setShowWorkspaceSymbolPicker(true);
        window.dispatchEvent(new CustomEvent("workspace-symbol:prefill", {
          detail: { query: q.slice(1) }
        }));
        break;
        
      case "goto-line":
        const lineMatch = q.match(/^:(\d+)(?::(\d+))?$/);
        if (lineMatch) {
          const line = parseInt(lineMatch[1], 10);
          const column = lineMatch[2] ? parseInt(lineMatch[2], 10) : 1;
          window.dispatchEvent(new CustomEvent("editor:goto-line", {
            detail: { line, column }
          }));
        } else {
          setShowGoToLine(true);
        }
        break;
        
      case "idle":
      default:
        // If idle, open file finder
        setShowFileFinder(true);
        break;
    }
  };
  
  // Handle click on the command center container
  const handleContainerClick = () => {
    inputRef?.focus();
  };
  
  // Handle focus
  const handleFocus = () => {
    setIsFocused(true);
    setRecentItems(getRecentItems());
  };
  
  // Handle blur
  const handleBlur = (e: FocusEvent) => {
    // Check if focus is moving to a child element
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (containerRef?.contains(relatedTarget)) {
      return;
    }
    setIsFocused(false);
  };
  
  // Click outside handler
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setIsFocused(false);
    }
  };
  
  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
  });
  
  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
  });
  
  // Styles
  const containerStyle = createMemo<JSX.CSSProperties>(() => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: "6px",
    height: "24px",
    padding: "0 10px",
    "min-width": isExpanded() ? "340px" : "200px",
    "max-width": isExpanded() ? "500px" : "300px",
    width: isExpanded() ? "100%" : "auto",
    background: isFocused() ? "var(--jb-canvas)" : "rgba(255, 255, 255, 0.06)",
    border: isFocused() ? "1px solid var(--jb-border-focus)" : "1px solid transparent",
    "border-radius": "var(--cortex-radius-md)",
    cursor: "text",
    transition: "all 150ms ease-out",
    "-webkit-app-region": "no-drag",
    position: "relative",
    overflow: "hidden",
  }));
  
  const inputStyle: JSX.CSSProperties = {
    flex: "1",
    height: "100%",
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--jb-text-body-color)",
    "font-size": "12px",
    "font-family": "inherit",
    "min-width": "0",
  };
  
  const iconStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    color: "var(--jb-text-muted-color)",
    "flex-shrink": "0",
  };
  
  const idleDisplayStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    overflow: "hidden",
    "white-space": "nowrap",
    flex: "1",
  };
  
  const fileNameStyle: JSX.CSSProperties = {
    color: "var(--jb-text-body-color)",
    "font-size": "12px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  };
  
  const filePathStyle: JSX.CSSProperties = {
    color: "var(--jb-text-muted-color)",
    "font-size": "11px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    opacity: "0.8",
  };
  
  const modifiedIndicatorStyle: JSX.CSSProperties = {
    width: "6px",
    height: "6px",
    "border-radius": "var(--cortex-radius-full)",
    background: "var(--jb-border-focus)",
    "flex-shrink": "0",
  };
  
  const shortcutHintStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
    color: "var(--jb-text-muted-color)",
    "font-size": "10px",
    "flex-shrink": "0",
    opacity: "0.7",
  };
  
  const kbdStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    padding: "1px 4px",
    "font-size": "10px",
    "font-family": "'SF Mono', 'JetBrains Mono', monospace",
    background: "rgba(255, 255, 255, 0.08)",
    "border-radius": "var(--cortex-radius-sm)",
    color: "var(--jb-text-muted-color)",
  };
  
  const modeIndicatorStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "min-width": "16px",
    height: "16px",
    "border-radius": "var(--cortex-radius-sm)",
    background: "rgba(255, 255, 255, 0.1)",
    color: "var(--jb-border-focus)",
    "font-size": "11px",
    "font-weight": "600",
    "flex-shrink": "0",
  };
  
  return (
    <Show when={isEnabled()}>
      <div
        ref={containerRef}
        style={containerStyle()}
        onClick={handleContainerClick}
        role="button"
        aria-label="Command Center - Search files, commands, and symbols"
        tabIndex={-1}
      >
      {/* Mode Icon */}
      <Show 
        when={!isFocused() && currentMode() === "idle"}
        fallback={
          <Show when={query() && currentMode() !== "files" && currentMode() !== "idle"}>
            <div style={modeIndicatorStyle}>
              {modeConfig().prefix || <Icon name={modeConfig().icon} style={iconStyle} />}
            </div>
          </Show>
        }
      >
        <Icon name="magnifying-glass" style={iconStyle} />
      </Show>
      
      {/* Idle Display - Current File */}
      <Show when={!isFocused() && !isExpanded()}>
        <div style={idleDisplayStyle}>
          <span style={fileNameStyle}>{currentFileInfo().name}</span>
          <Show when={currentFileInfo().path}>
            <Icon name="chevron-right" style={{ ...iconStyle, width: "10px", height: "10px" }} />
            <span style={filePathStyle}>{currentFileInfo().path}</span>
          </Show>
          <Show when={currentFileInfo().isModified}>
            <div style={modifiedIndicatorStyle} title="Modified" />
          </Show>
        </div>
      </Show>
      
      {/* Input Field */}
      <Show when={isFocused() || isExpanded()}>
        <input
          ref={inputRef}
          type="text"
          value={query()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={modeConfig().placeholder}
          style={inputStyle}
          aria-label="Search input"
          spellcheck={false}
          autocomplete="off"
        />
      </Show>
      
      {/* Shortcut Hints */}
      <Show when={!isFocused()}>
        <div style={shortcutHintStyle}>
          <kbd style={kbdStyle}>Ctrl</kbd>
          <kbd style={kbdStyle}>E</kbd>
        </div>
      </Show>
      
      <Show when={isFocused() && query() === ""}>
        <div style={shortcutHintStyle}>
          <span style={{ opacity: "0.6" }}>
            <kbd style={kbdStyle}>&gt;</kbd> commands
          </span>
          <span style={{ "margin-left": "6px", opacity: "0.6" }}>
            <kbd style={kbdStyle}>@</kbd> symbols
          </span>
          <span style={{ "margin-left": "6px", opacity: "0.6" }}>
            <kbd style={kbdStyle}>#</kbd> workspace
          </span>
          <span style={{ "margin-left": "6px", opacity: "0.6" }}>
            <kbd style={kbdStyle}>:</kbd> line
          </span>
        </div>
      </Show>
      
      {/* Mode-specific hint when typing */}
      <Show when={isFocused() && query() && currentMode() !== "files"}>
        <div style={shortcutHintStyle}>
          <span style={{ opacity: "0.6" }}>{modeConfig().hint}</span>
        </div>
      </Show>
      </div>
    </Show>
  );
}

// ============================================================================
// Command Center Dropdown (for recent items and quick actions)
// ============================================================================

export function CommandCenterDropdown(props: {
  isOpen: boolean;
  onClose: () => void;
  recentItems: RecentItem[];
  onSelectItem: (item: RecentItem) => void;
}) {
  if (!props.isOpen) return null;
  
  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "100%",
    left: "0",
    right: "0",
    "margin-top": "4px",
    background: "var(--ui-panel-bg)",
    border: "1px solid var(--jb-border-default)",
    "border-radius": "var(--cortex-radius-md)",
    "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.3)",
    "max-height": "300px",
    overflow: "auto",
    "z-index": "2550",
  };
  
  const itemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    padding: "6px 10px",
    cursor: "pointer",
    "font-size": "12px",
    color: "var(--jb-text-body-color)",
    transition: "background 100ms ease",
  };
  
  const sectionHeaderStyle: JSX.CSSProperties = {
    padding: "6px 10px",
    "font-size": "10px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: "var(--jb-text-muted-color)",
    "border-bottom": "1px solid var(--jb-border-default)",
  };
  
  return (
    <div style={dropdownStyle}>
      <Show when={props.recentItems.length > 0}>
        <div style={sectionHeaderStyle}>Recent</div>
        {props.recentItems.map((item) => (
          <div
            style={itemStyle}
            onClick={() => props.onSelectItem(item)}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--jb-surface-hover)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <Show when={item.type === "file"}>
              <Icon name="file" style={{ width: "12px", height: "12px", color: "var(--jb-text-muted-color)" }} />
            </Show>
            <Show when={item.type === "command"}>
              <Icon name="command" style={{ width: "12px", height: "12px", color: "var(--jb-text-muted-color)" }} />
            </Show>
            <span>{item.label}</span>
            <Show when={item.detail}>
              <span style={{ color: "var(--jb-text-muted-color)", "font-size": "11px" }}>
                {item.detail}
              </span>
            </Show>
          </div>
        ))}
      </Show>
      
      <Show when={props.recentItems.length === 0}>
        <div style={{ padding: "16px", "text-align": "center", color: "var(--jb-text-muted-color)", "font-size": "12px" }}>
          No recent items
        </div>
      </Show>
    </div>
  );
}

export default CommandCenter;

