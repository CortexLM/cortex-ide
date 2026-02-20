import { createSignal, createEffect, Show, For, onMount, createMemo } from "solid-js";
import { Icon } from "./ui/Icon";
import { useToolchain, type ToolchainKind, type ToolchainInfo } from "@/context/ToolchainContext";

// ============================================================================
// Types
// ============================================================================

interface ToolchainSelectorProps {
  initialKind?: ToolchainKind;
  onClose?: () => void;
}

// ============================================================================
// Icons for each toolchain type
// ============================================================================

function NodeIcon() {
  return (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
      <path d="M12 1.85c-.27 0-.55.07-.78.2l-7.44 4.3c-.48.28-.78.8-.78 1.36v8.58c0 .56.3 1.08.78 1.36l1.95 1.12c.95.46 1.27.47 1.71.47 1.4 0 2.2-.85 2.2-2.33V8.44c0-.12-.1-.22-.22-.22H8.5c-.13 0-.23.1-.23.22v8.47c0 .66-.68 1.31-1.77.76L4.45 16.5a.26.26 0 01-.12-.21V7.71c0-.09.04-.17.12-.21l7.44-4.29c.08-.04.17-.04.25 0l7.44 4.29c.07.04.12.12.12.21v8.58c0 .08-.05.17-.12.21l-7.44 4.29c-.08.05-.17.05-.25 0l-1.89-1.12c-.08-.05-.18-.06-.27-.03-.7.31-.84.35-1.5.53-.17.04-.42.12.08.35l2.47 1.46c.24.14.5.21.78.21.27 0 .54-.07.78-.2l7.44-4.3c.48-.28.78-.8.78-1.36V7.71c0-.56-.3-1.08-.78-1.36l-7.44-4.3c-.24-.13-.5-.2-.78-.2z"/>
      <path d="M14.52 8.13c-2.13 0-3.39 1.35-3.39 2.75 0 1.87 1.44 2.38 3.28 2.61 2.21.28 2.39.69 2.39 1.24 0 .96-.77 1.37-2.58 1.37-2.27 0-2.77-.57-2.94-1.7-.02-.1-.1-.18-.21-.18h-.98c-.12 0-.21.1-.21.22 0 1.22.66 2.68 4.33 2.68 2.59 0 4.09-.102 4.09-2.8 0-1.75-1.19-2.22-3.69-2.55-2.53-.34-2.78-.51-2.78-1.12 0-.5.22-1.16 2.15-1.16 1.72 0 2.36.37 2.62 1.53.02.1.1.16.2.16h1c.06 0 .11-.02.15-.06a.2.2 0 00.06-.16c-.16-1.92-1.43-2.82-4.03-2.82l.54-.01z"/>
    </svg>
  );
}

function PythonIcon() {
  return (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
      <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.9S0 5.789 0 11.969c0 6.18 3.403 5.96 3.403 5.96h2.03v-2.867s-.109-3.42 3.35-3.42h5.766s3.24.052 3.24-3.148V3.202S18.28 0 11.913 0zM8.708 1.85c.578 0 1.046.47 1.046 1.052 0 .58-.468 1.051-1.046 1.051-.578 0-1.046-.47-1.046-1.051 0-.581.468-1.052 1.046-1.052z"/>
      <path d="M12.087 24c6.093 0 5.713-2.656 5.713-2.656l-.007-2.752h-5.814v-.826h8.121s3.9.445 3.9-5.735c0-6.18-3.403-5.96-3.403-5.96h-2.03v2.867s.109 3.42-3.35 3.42H9.45s-3.24-.052-3.24 3.148v5.292S5.72 24 12.087 24zm3.206-1.85c-.578 0-1.046-.47-1.046-1.052 0-.58.468-1.051 1.046-1.051.578 0 1.046.47 1.046 1.051 0 .581-.468 1.052-1.046 1.052z"/>
    </svg>
  );
}

function RustIcon() {
  return (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="currentColor">
      <path d="M23.835 11.703l-1.008-.623-.028-.228.741-.855a.35.35 0 00-.107-.514l-.993-.557-.057-.224.572-.964a.35.35 0 00-.192-.494l-1.09-.373-.084-.213.387-1.047a.35.35 0 00-.27-.461l-1.138-.172-.109-.196.19-1.095a.35.35 0 00-.343-.411l-1.144.033-.131-.173-.015-1.108a.35.35 0 00-.406-.342l-1.106.236-.148-.144-.219-1.083a.35.35 0 00-.457-.258l-1.025.432-.161-.11-.413-1.018a.35.35 0 00-.495-.164l-.906.615-.168-.071-.593-.915a.35.35 0 00-.517-.061l-.753.779-.17-.031-.75-.778a.35.35 0 00-.517.061l-.593.915-.168.07-.906-.614a.35.35 0 00-.495.164l-.413 1.018-.161.11-1.025-.432a.35.35 0 00-.457.258l-.219 1.083-.148.144-1.106-.236a.35.35 0 00-.406.342l-.015 1.108-.131.173-1.144-.033a.35.35 0 00-.343.411l.19 1.095-.109.196-1.138.172a.35.35 0 00-.27.461l.387 1.047-.084.213-1.09.373a.35.35 0 00-.192.494l.572.964-.057.224-.993.557a.35.35 0 00-.107.514l.741.855-.028.228-1.008.623a.35.35 0 000 .594l1.008.623.028.228-.741.855a.35.35 0 00.107.514l.993.557.057.224-.572.964a.35.35 0 00.192.494l1.09.373.084.213-.387 1.047a.35.35 0 00.27.461l1.138.172.109.196-.19 1.095a.35.35 0 00.343.411l1.144-.033.131.173.015 1.108a.35.35 0 00.406.342l1.106-.236.148.144.219 1.083a.35.35 0 00.457.258l1.025-.432.161.11.413 1.018a.35.35 0 00.495.164l.906-.615.168.071.593.915a.35.35 0 00.517.061l.753-.779.17.031.75.778a.35.35 0 00.517-.061l.593-.915.168-.07.906.614a.35.35 0 00.495-.164l.413-1.018.161-.11 1.025.432a.35.35 0 00.457-.258l.219-1.083.148-.144 1.106.236a.35.35 0 00.406-.342l.015-1.108.131-.173 1.144.033a.35.35 0 00.343-.411l-.19-1.095.109-.196 1.138-.172a.35.35 0 00.27-.461l-.387-1.047.084-.213 1.09-.373a.35.35 0 00.192-.494l-.572-.964.057-.224.993-.557a.35.35 0 00.107-.514l-.741-.855.028-.228 1.008-.623a.35.35 0 000-.594zM12 4.21a7.79 7.79 0 110 15.58 7.79 7.79 0 010-15.58zM8.284 10.95h1.145l.142.915h.972l-.18-1.02h1.29l.18 1.02h.971l-.141-.915h1.145v-.971h-1.26l.069-.506h1.191v-.971h-1.08l.142-.916h-.971l-.181 1.021h-1.29l.18-1.02h-.972l-.142.915H8.284v.97h1.26l-.07.507H8.284zm1.367-.506l.069-.506h1.29l-.069.506z"/>
    </svg>
  );
}

function getToolchainIcon(kind: ToolchainKind) {
  switch (kind) {
    case "node":
      return <NodeIcon />;
    case "python":
      return <PythonIcon />;
    case "rust":
      return <RustIcon />;
  }
}

function getToolchainLabel(kind: ToolchainKind) {
  switch (kind) {
    case "node":
      return "Node.js";
    case "python":
      return "Python";
    case "rust":
      return "Rust";
  }
}

function getToolchainColor(kind: ToolchainKind) {
  switch (kind) {
    case "node":
      return "var(--cortex-success)";
    case "python":
      return "var(--cortex-info)";
    case "rust":
      return "var(--cortex-warning)";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ToolchainSelector(props: ToolchainSelectorProps) {
  const toolchain = useToolchain();
  const [selectedKind, setSelectedKind] = createSignal<ToolchainKind>(props.initialKind || "node");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const currentToolchains = createMemo(() => {
    const kind = selectedKind();
    return toolchain.getToolchainsByKind(kind);
  });

  const filteredToolchains = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const toolchains = currentToolchains();

    if (!query) return toolchains;

    return toolchains.filter((t) =>
      t.name.toLowerCase().includes(query) ||
      t.version.toLowerCase().includes(query) ||
      t.path.toLowerCase().includes(query)
    );
  });

  const activeToolchain = createMemo(() => {
    return toolchain.getActiveToolchain(selectedKind());
  });

  // Reset selection when toolchains change
  createEffect(() => {
    filteredToolchains();
    setSelectedIndex(0);
  });

  // Auto-focus input
  onMount(() => {
    inputRef?.focus();
    
    // Set initial kind from context if selector is open
    if (toolchain.state.selectorKind) {
      setSelectedKind(toolchain.state.selectorKind);
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const toolchains = filteredToolchains();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, toolchains.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (toolchains[selectedIndex()]) {
          selectToolchain(toolchains[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "Tab":
        e.preventDefault();
        // Cycle through kinds
        const kinds: ToolchainKind[] = ["node", "python", "rust"];
        const currentIndex = kinds.indexOf(selectedKind());
        const nextIndex = e.shiftKey
          ? (currentIndex - 1 + kinds.length) % kinds.length
          : (currentIndex + 1) % kinds.length;
        setSelectedKind(kinds[nextIndex]);
        setSearchQuery("");
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector(`[data-index="${selectedIndex()}"]`);
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  const selectToolchain = (tc: ToolchainInfo) => {
    toolchain.setProjectToolchain(selectedKind(), tc.path);
    handleClose();
  };

  const handleClose = () => {
    toolchain.closeSelector();
    props.onClose?.();
  };

  const handleRefresh = async () => {
    await toolchain.refreshToolchains();
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        class="w-[560px] max-h-[70vh] flex flex-col rounded-lg shadow-2xl overflow-hidden"
        style={{
          background: "var(--surface-base)",
          border: "1px solid var(--border-base)",
        }}
      >
        {/* Header */}
        <div
          class="flex items-center gap-3 px-4 py-3 border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <Icon name="gear" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          <span class="font-medium" style={{ color: "var(--text-strong)" }}>
            Select Toolchain
          </span>
          <div class="flex-1" />
          <button
            onClick={handleRefresh}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
            title="Refresh toolchains"
          >
<Icon
              name="rotate"
              class="w-4 h-4"
              style={{ color: "var(--text-weak)" }}
              classList={{ "animate-spin": toolchain.state.isLoading }}
            />
          </button>
          <button
            onClick={handleClose}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
          >
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* Toolchain Type Tabs */}
        <div
          class="flex items-center border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <For each={["node", "python", "rust"] as ToolchainKind[]}>
            {(kind) => (
              <button
                class="flex items-center gap-2 px-4 py-2.5 transition-colors relative"
                style={{
                  color: selectedKind() === kind ? getToolchainColor(kind) : "var(--text-weak)",
                }}
                onClick={() => {
                  setSelectedKind(kind);
                  setSearchQuery("");
                  inputRef?.focus();
                }}
              >
                {getToolchainIcon(kind)}
                <span class="text-sm font-medium">{getToolchainLabel(kind)}</span>
                <Show when={toolchain.getToolchainsByKind(kind).length > 0}>
                  <span
                    class="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: selectedKind() === kind ? `${getToolchainColor(kind)}20` : "var(--surface-hover)",
                    }}
                  >
                    {toolchain.getToolchainsByKind(kind).length}
                  </span>
                </Show>
                <Show when={selectedKind() === kind}>
                  <div
                    class="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: getToolchainColor(kind) }}
                  />
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* Search Input */}
        <div
          class="flex items-center gap-2 px-4 py-3 border-b shrink-0"
          style={{ "border-color": "var(--border-base)" }}
        >
          <Icon name="magnifying-glass" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <input
            ref={inputRef}
            type="text"
            class="flex-1 bg-transparent outline-none text-sm"
            style={{ color: "var(--text-base)" }}
            placeholder={`Search ${getToolchainLabel(selectedKind())} installations...`}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="p-1 rounded hover:bg-[var(--surface-hover)]"
            >
              <Icon name="xmark" class="w-3 h-3" style={{ color: "var(--text-weak)" }} />
            </button>
          </Show>
        </div>

        {/* Active Toolchain */}
        <Show when={activeToolchain()}>
          <div
            class="px-4 py-2 border-b shrink-0"
            style={{
              "border-color": "var(--border-base)",
              background: "var(--surface-raised)",
            }}
          >
            <div class="flex items-center gap-2">
              <Icon name="check" class="w-4 h-4" style={{ color: "var(--success)" }} />
              <span class="text-xs font-medium" style={{ color: "var(--text-weak)" }}>
                Active:
              </span>
              <span class="text-xs" style={{ color: "var(--text-base)" }}>
                {activeToolchain()?.name}
              </span>
            </div>
          </div>
        </Show>

        {/* Toolchain List */}
        <div ref={listRef} class="flex-1 overflow-auto">
          <Show
            when={!toolchain.state.isLoading}
            fallback={
              <div class="flex items-center justify-center py-12">
                <div class="flex items-center gap-3" style={{ color: "var(--text-weak)" }}>
                  <Icon name="rotate" class="w-5 h-5 animate-spin" />
                  <span>Detecting toolchains...</span>
                </div>
              </div>
            }
          >
            <Show
              when={filteredToolchains().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-12 gap-3">
                  <div
                    class="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "var(--surface-hover)" }}
                  >
                    {getToolchainIcon(selectedKind())}
                  </div>
                  <span style={{ color: "var(--text-weak)" }}>
                    {searchQuery()
                      ? `No ${getToolchainLabel(selectedKind())} found matching "${searchQuery()}"`
                      : `No ${getToolchainLabel(selectedKind())} installations detected`}
                  </span>
                  <Show when={!searchQuery()}>
                    <button
                      class="text-sm px-3 py-1.5 rounded"
                      style={{
                        background: getToolchainColor(selectedKind()),
                        color: "white",
                      }}
                      onClick={handleRefresh}
                    >
                      Scan Again
                    </button>
                  </Show>
                </div>
              }
            >
              <For each={filteredToolchains()}>
                {(tc, index) => (
                  <ToolchainItem
                    toolchain={tc}
                    isSelected={selectedIndex() === index()}
                    isActive={activeToolchain()?.path === tc.path}
                    dataIndex={index()}
                    onClick={() => selectToolchain(tc)}
                    onHover={() => setSelectedIndex(index())}
                  />
                )}
              </For>
            </Show>
          </Show>
        </div>

        {/* Footer */}
        <div
          class="flex items-center justify-between px-4 py-2 border-t shrink-0"
          style={{
            "border-color": "var(--border-base)",
            background: "var(--surface-raised)",
          }}
        >
          <div class="flex items-center gap-3 text-xs" style={{ color: "var(--text-weak)" }}>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                Tab
              </kbd>{" "}
              Switch Type
            </span>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                Enter
              </kbd>{" "}
              Select
            </span>
          </div>
          <Show when={toolchain.state.error}>
            <span class="text-xs text-red-400">{toolchain.state.error}</span>
          </Show>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Toolchain Item
// ============================================================================

interface ToolchainItemProps {
  toolchain: ToolchainInfo;
  isSelected: boolean;
  isActive: boolean;
  dataIndex: number;
  onClick: () => void;
  onHover: () => void;
}

function ToolchainItem(props: ToolchainItemProps) {
  return (
    <button
      data-index={props.dataIndex}
      class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-hover)" : "transparent",
      }}
      onClick={props.onClick}
      onMouseEnter={props.onHover}
    >
      <div
        class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: `${getToolchainColor(props.toolchain.kind)}20`,
          color: getToolchainColor(props.toolchain.kind),
        }}
      >
        {getToolchainIcon(props.toolchain.kind)}
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="font-medium truncate"
            style={{ color: "var(--text-strong)" }}
          >
            {props.toolchain.name}
          </span>
          <Show when={props.toolchain.isDefault}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              DEFAULT
            </span>
          </Show>
          <Show when={props.isActive}>
            <Icon name="check" class="w-4 h-4" style={{ color: "var(--success)" }} />
          </Show>
        </div>
        <div
          class="text-xs truncate mt-0.5"
          style={{ color: "var(--text-weak)" }}
        >
          {props.toolchain.path}
        </div>
        <Show when={Object.keys(props.toolchain.extra).length > 0}>
          <div class="flex items-center gap-2 mt-1">
            <For each={Object.entries(props.toolchain.extra).slice(0, 3)}>
              {([key, value]) => (
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--surface-hover)",
                    color: "var(--text-weak)",
                  }}
                >
                  {key}: {value}
                </span>
              )}
            </For>
          </div>
        </Show>
      </div>

<Icon
        name="chevron-right"
        class="w-4 h-4 shrink-0 opacity-0 transition-opacity"
        style={{
          color: "var(--text-weak)",
          opacity: props.isSelected ? "1" : "0",
        }}
      />
    </button>
  );
}

// ============================================================================
// Compact Toolchain Display (for StatusBar)
// ============================================================================

interface ToolchainStatusProps {
  kind: ToolchainKind;
  showLabel?: boolean;
}

export function ToolchainStatus(props: ToolchainStatusProps) {
  const toolchain = useToolchain();

  const active = createMemo(() => toolchain.getActiveToolchain(props.kind));

  const handleClick = () => {
    toolchain.openSelector(props.kind);
  };

  return (
    <Show when={active()}>
      <button
        class="flex items-center gap-1.5 hover:text-white transition-colors"
        onClick={handleClick}
        title={`${getToolchainLabel(props.kind)}: ${active()?.name}\nClick to change`}
      >
        <span style={{ color: getToolchainColor(props.kind) }}>
          {getToolchainIcon(props.kind)}
        </span>
        <Show when={props.showLabel !== false}>
          <span>{active()?.version || active()?.name}</span>
        </Show>
      </button>
    </Show>
  );
}

// ============================================================================
// Wrapper that shows selector when context says to
// ============================================================================

export function ToolchainSelectorModal() {
  const toolchain = useToolchain();

  return (
    <Show when={toolchain.state.showSelector}>
      <ToolchainSelector initialKind={toolchain.state.selectorKind || "node"} />
    </Show>
  );
}

