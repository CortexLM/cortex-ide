import { Show, For, createEffect, onMount, onCleanup, JSX } from "solid-js";
import { Icon } from "../ui/Icon";
import { useTabSwitcher, TabHistoryEntry } from "@/context/TabSwitcherContext";
import { useEditor } from "@/context/EditorContext";

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    ts: "🔷",
    tsx: "⚛️",
    mts: "🔷",
    cts: "🔷",
    js: "🟨",
    jsx: "⚛️",
    mjs: "🟨",
    cjs: "🟨",
    json: "📋",
    jsonc: "📋",
    json5: "📋",
    md: "📝",
    mdx: "📝",
    css: "🎨",
    scss: "🎨",
    sass: "🎨",
    less: "🎨",
    html: "🌐",
    htm: "🌐",
    xml: "🌐",
    svg: "🎨",
    py: "🐍",
    pyw: "🐍",
    pyi: "🐍",
    rs: "🦀",
    go: "🐹",
    java: "☕",
    kt: "🟣",
    kts: "🟣",
    scala: "🔴",
    swift: "🍎",
    c: "🔵",
    h: "🔵",
    cpp: "🔵",
    cc: "🔵",
    cxx: "🔵",
    hpp: "🔵",
    cs: "🟢",
    rb: "💎",
    php: "🐘",
    sh: "📜",
    bash: "📜",
    zsh: "📜",
    fish: "📜",
    ps1: "📜",
    bat: "📜",
    cmd: "📜",
    yaml: "⚙️",
    yml: "⚙️",
    toml: "⚙️",
    ini: "⚙️",
    conf: "⚙️",
    cfg: "⚙️",
    sql: "🗄️",
    graphql: "◼️",
    gql: "◼️",
    vue: "💚",
    svelte: "🧡",
    astro: "🚀",
    lock: "🔒",
    dockerfile: "🐳",
    makefile: "🔨",
    gitignore: "📝",
    env: "🔐",
  };
  
  const basename = name.toLowerCase();
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) return "🐳";
  if (basename === "makefile" || basename === "gnumakefile") return "🔨";
  if (basename.startsWith(".env")) return "🔐";
  if (basename === ".gitignore" || basename === ".dockerignore") return "📝";
  
  return icons[ext] || "📄";
}

function highlightMatches(text: string, query: string): JSX.Element {
  if (!query.trim()) {
    return <span>{text}</span>;
  }

  const result: JSX.Element[] = [];
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  let queryIndex = 0;
  let lastIndex = 0;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      if (i > lastIndex) {
        result.push(<span>{text.slice(lastIndex, i)}</span>);
      }
      result.push(
        <span style={{ color: "var(--accent-primary)", "font-weight": "600" }}>
          {text[i]}
        </span>
      );
      lastIndex = i + 1;
      queryIndex++;
    }
  }

  if (lastIndex < text.length) {
    result.push(<span>{text.slice(lastIndex)}</span>);
  }

  return <>{result}</>;
}

function getParentPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  if (lastSlash <= 0) return "";
  return normalized.slice(0, lastSlash);
}

interface TabItemProps {
  entry: TabHistoryEntry;
  index: number;
  isSelected: boolean;
  isModified: boolean;
  onSelect: () => void;
  onClose: (e: MouseEvent) => void;
  query: string;
}

function TabItem(props: TabItemProps) {
  let itemRef: HTMLButtonElement | undefined;

  createEffect(() => {
    if (props.isSelected && itemRef) {
      itemRef.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  return (
    <button
      ref={itemRef}
      class="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group"
      style={{
        background: props.isSelected ? "var(--surface-active)" : "transparent",
        color: "var(--text-base)",
      }}
      onMouseEnter={props.onSelect}
      onClick={() => {
        const { confirm } = useTabSwitcher();
        confirm();
      }}
    >
      <span class="text-base shrink-0">{getFileIcon(props.entry.name)}</span>

      <div class="flex-1 min-w-0 flex flex-col">
        <div class="flex items-center gap-2">
          <span class="text-sm truncate">
            {highlightMatches(props.entry.name, props.query)}
          </span>
          <Show when={props.isModified}>
<Icon name="circle"
              class="w-2 h-2 shrink-0"
              style={{ color: "var(--accent-primary)" }}
            />
          </Show>
        </div>
        <Show when={getParentPath(props.entry.path)}>
          <span
            class="text-xs truncate"
            style={{ color: "var(--text-weak)" }}
          >
            {getParentPath(props.entry.path)}
          </span>
        </Show>
      </div>

      <button
        class="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          color: "var(--text-weak)",
          background: "transparent",
        }}
        classList={{
          "hover:bg-[var(--surface-raised)]": true,
          "!opacity-100": props.isSelected,
        }}
        onClick={props.onClose}
        title="Close file"
      >
        <Icon name="xmark" class="w-4 h-4" />
      </button>
    </button>
  );
}

export function TabSwitcher() {
  const tabSwitcher = useTabSwitcher();
  const editor = useEditor();
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (tabSwitcher.state.isOpen) {
      setTimeout(() => inputRef?.focus(), 10);
    }
  });

  onMount(() => {
    const handleSelectEvent = (e: CustomEvent<{ fileId: string; path: string }>) => {
      const { fileId, path } = e.detail;
      const existingFile = editor.state.openFiles.find((f) => f.id === fileId);
      if (existingFile) {
        editor.setActiveFile(fileId);
      } else {
        editor.openFile(path);
      }
    };

    window.addEventListener("tab-switcher:select", handleSelectEvent as EventListener);
    onCleanup(() => {
      window.removeEventListener("tab-switcher:select", handleSelectEvent as EventListener);
    });
  });

  createEffect(() => {
    const activeFile = editor.state.openFiles.find(
      (f) => f.id === editor.state.activeFileId
    );
    if (activeFile && !tabSwitcher.state.isOpen) {
      tabSwitcher.recordTabAccess(activeFile.id, activeFile.path, activeFile.name);
    }
  });

  const filteredHistory = () => {
    const allHistory = tabSwitcher.getFilteredHistory();
    const openFileIds = new Set(editor.state.openFiles.map((f) => f.id));
    return allHistory.filter((h) => openFileIds.has(h.fileId));
  };

  const handleClose = (e: MouseEvent, entry: TabHistoryEntry) => {
    e.stopPropagation();
    editor.closeFile(entry.fileId);
    tabSwitcher.removeFromHistory(entry.fileId);
  };

  const isFileModified = (fileId: string): boolean => {
    const file = editor.state.openFiles.find((f) => f.id === fileId);
    return file?.modified ?? false;
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Backspace" && !tabSwitcher.state.query) {
      return;
    }
  };

  return (
    <Show when={tabSwitcher.state.isOpen}>
      <div
        class="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
        onClick={() => tabSwitcher.close()}
      >
        <div class="absolute inset-0 bg-black/50" />

        <div
          class="relative w-[500px] max-h-[400px] rounded-lg shadow-2xl overflow-hidden flex flex-col"
          style={{ background: "var(--surface-raised)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            class="flex items-center gap-3 px-4 py-3 border-b shrink-0"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <Icon name="file" class="w-5 h-5 shrink-0" style={{ color: "var(--text-weak)" }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search open files..."
              class="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--text-base)" }}
              value={tabSwitcher.state.query}
              onInput={(e) => tabSwitcher.setQuery(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <div class="flex items-center gap-1.5 shrink-0">
              <kbd
                class="text-xs px-1.5 py-0.5 rounded"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                ↑↓
              </kbd>
              <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                navigate
              </span>
              <kbd
                class="text-xs px-1.5 py-0.5 rounded ml-2"
                style={{
                  background: "var(--background-base)",
                  color: "var(--text-weak)",
                }}
              >
                esc
              </kbd>
            </div>
          </div>

          <div class="overflow-y-auto flex-1">
            <Show
              when={filteredHistory().length > 0}
              fallback={
                <div class="px-4 py-8 text-center">
                  <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                    {tabSwitcher.state.query
                      ? "No matching open files"
                      : "No open files"}
                  </p>
                </div>
              }
            >
              <For each={filteredHistory()}>
                {(entry, index) => (
                  <TabItem
                    entry={entry}
                    index={index()}
                    isSelected={index() === tabSwitcher.state.selectedIndex}
                    isModified={isFileModified(entry.fileId)}
                    onSelect={() => tabSwitcher.selectIndex(index())}
                    onClose={(e) => handleClose(e, entry)}
                    query={tabSwitcher.state.query}
                  />
                )}
              </For>
            </Show>
          </div>

          <div
            class="flex items-center justify-between px-4 py-2 border-t shrink-0"
            style={{
              "border-color": "var(--border-weak)",
              background: "var(--background-base)",
            }}
          >
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              {filteredHistory().length} open file{filteredHistory().length !== 1 ? "s" : ""}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                <kbd
                  class="text-xs px-1 py-0.5 rounded mr-1"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-weak)",
                  }}
                >
                  Ctrl+Tab
                </kbd>
                cycle
              </span>
              <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                <kbd
                  class="text-xs px-1 py-0.5 rounded mr-1"
                  style={{
                    background: "var(--surface-raised)",
                    color: "var(--text-weak)",
                  }}
                >
                  Enter
                </kbd>
                select
              </span>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
