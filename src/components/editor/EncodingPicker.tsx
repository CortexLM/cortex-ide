import { createSignal, createEffect, Show, For, onMount, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { useEncoding, getCategoryLabel, type EncodingInfo, type EncodingCategory } from "@/context/EncodingContext";
import { useEditor } from "@/context/EditorContext";

// ============================================================================
// Types
// ============================================================================

interface EncodingPickerProps {
  fileId?: string;
  filePath?: string;
  mode?: "reopen" | "save";
  onClose?: () => void;
}

// ============================================================================
// Main Component
// ============================================================================

export function EncodingPicker(props: EncodingPickerProps) {
  const encodingCtx = useEncoding();
  const { state: editorState, updateFileContent } = useEditor();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const currentFileId = () => props.fileId || encodingCtx.state.currentFileId;
  const currentFilePath = () => props.filePath || encodingCtx.state.currentFilePath;
  const mode = () => props.mode || encodingCtx.state.pickerMode || "reopen";

  const currentFile = createMemo(() => {
    const fileId = currentFileId();
    if (!fileId) return null;
    return editorState.openFiles.find((f) => f.id === fileId);
  });

  const currentEncoding = createMemo(() => {
    const fileId = currentFileId();
    if (!fileId) return "UTF-8";
    return encodingCtx.getFileEncoding(fileId);
  });

  const filteredEncodings = createMemo(() => {
    const query = searchQuery();
    return encodingCtx.searchEncodings(query);
  });

  const groupedEncodings = createMemo(() => {
    if (searchQuery()) {
      return null; // Don't group when searching
    }
    
    const encodings = filteredEncodings();
    const groups: Record<EncodingCategory, EncodingInfo[]> = {
      unicode: [],
      western: [],
      eastAsian: [],
      cyrillic: [],
      other: [],
    };

    encodings.forEach((enc) => {
      groups[enc.category].push(enc);
    });

    return groups;
  });

  const flatEncodings = createMemo(() => {
    if (searchQuery()) {
      return filteredEncodings();
    }

    const groups = groupedEncodings();
    if (!groups) return filteredEncodings();

    const result: EncodingInfo[] = [];
    const categories: EncodingCategory[] = ["unicode", "western", "eastAsian", "cyrillic", "other"];
    
    categories.forEach((cat) => {
      result.push(...groups[cat]);
    });

    return result;
  });

  // Reset selection when encodings change
  createEffect(() => {
    flatEncodings();
    setSelectedIndex(0);
  });

  // Auto-focus input
  onMount(() => {
    inputRef?.focus();
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const encodings = flatEncodings();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, encodings.length - 1));
        scrollToSelected();
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        scrollToSelected();
        break;
      case "Enter":
        e.preventDefault();
        if (encodings[selectedIndex()]) {
          selectEncoding(encodings[selectedIndex()]);
        }
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
    }
  };

  const scrollToSelected = () => {
    if (listRef) {
      const selected = listRef.querySelector(`[data-index="${selectedIndex()}"]`);
      selected?.scrollIntoView({ block: "nearest" });
    }
  };

  const selectEncoding = async (enc: EncodingInfo) => {
    const fileId = currentFileId();
    const filePath = currentFilePath();
    
    if (!fileId || !filePath) {
      setError("No file selected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (mode() === "reopen") {
        // Reopen file with new encoding
        const content = await encodingCtx.reopenWithEncoding(fileId, filePath, enc.id);
        // Update the file content in the editor
        updateFileContent(fileId, content);
      } else {
        // Save file with new encoding
        const file = currentFile();
        if (file) {
          await encodingCtx.saveWithEncoding(fileId, filePath, file.content, enc.id);
        }
      }
      handleClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    encodingCtx.closePicker();
    props.onClose?.();
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
        class="w-[480px] max-h-[60vh] flex flex-col rounded-lg shadow-2xl overflow-hidden"
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
{mode() === "reopen" ? (
            <Icon name="rotate" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          ) : (
            <Icon name="floppy-disk" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
          )}
          <span class="font-medium" style={{ color: "var(--text-strong)" }}>
            {mode() === "reopen" ? "Reopen with Encoding" : "Save with Encoding"}
          </span>
          <div class="flex-1" />
          <button
            onClick={handleClose}
            class="p-1.5 rounded hover:bg-[var(--surface-hover)]"
          >
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          </button>
        </div>

        {/* Current File Info */}
        <Show when={currentFile()}>
          <div
            class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
            style={{
              "border-color": "var(--border-base)",
              background: "var(--surface-raised)",
            }}
          >
            <Icon name="file-lines" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
            <span class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
              {currentFile()?.name}
            </span>
            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>•</span>
            <span class="text-xs" style={{ color: "var(--accent)" }}>
              {encodingCtx.getEncodingDisplayName(currentEncoding())}
            </span>
          </div>
        </Show>

        {/* Error Message */}
        <Show when={error()}>
          <div
            class="flex items-center gap-2 px-4 py-2 border-b shrink-0"
            style={{
              "border-color": "var(--error)",
              background: "rgba(255, 77, 77, 0.1)",
            }}
          >
            <span class="text-xs" style={{ color: "var(--error)" }}>
              {error()}
            </span>
          </div>
        </Show>

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
            placeholder="Search encodings..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            disabled={isLoading()}
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

        {/* Encoding List */}
        <div ref={listRef} class="flex-1 overflow-auto">
          <Show
            when={flatEncodings().length > 0}
            fallback={
              <div class="flex flex-col items-center justify-center py-12 gap-3">
                <Icon name="file-lines" class="w-8 h-8" style={{ color: "var(--text-weak)" }} />
                <span style={{ color: "var(--text-weak)" }}>
                  No encodings found matching "{searchQuery()}"
                </span>
              </div>
            }
          >
            <Show
              when={!searchQuery() && groupedEncodings()}
              fallback={
                <For each={flatEncodings()}>
                  {(enc, index) => (
                    <EncodingItem
                      encoding={enc}
                      isSelected={selectedIndex() === index()}
                      isCurrent={enc.id.toLowerCase() === currentEncoding().toLowerCase()}
                      dataIndex={index()}
                      onClick={() => selectEncoding(enc)}
                      onHover={() => setSelectedIndex(index())}
                      disabled={isLoading()}
                    />
                  )}
                </For>
              }
            >
              {(groups) => {
                let currentIndex = 0;
                const categories: EncodingCategory[] = ["unicode", "western", "eastAsian", "cyrillic", "other"];
                
                return (
                  <For each={categories}>
                    {(category) => {
                      const categoryEncodings = groups()[category];
                      if (!categoryEncodings || categoryEncodings.length === 0) return null;

                      const startIndex = currentIndex;
                      currentIndex += categoryEncodings.length;

                      return (
                        <div>
                          <div
                            class="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider sticky top-0"
                            style={{
                              color: "var(--text-weaker)",
                              background: "var(--surface-base)",
                            }}
                          >
                            {getCategoryLabel(category)}
                          </div>
                          <For each={categoryEncodings}>
                            {(enc, i) => {
                              const absoluteIndex = startIndex + i();
                              return (
                                <EncodingItem
                                  encoding={enc}
                                  isSelected={selectedIndex() === absoluteIndex}
                                  isCurrent={enc.id.toLowerCase() === currentEncoding().toLowerCase()}
                                  dataIndex={absoluteIndex}
                                  onClick={() => selectEncoding(enc)}
                                  onHover={() => setSelectedIndex(absoluteIndex)}
                                  disabled={isLoading()}
                                />
                              );
                            }}
                          </For>
                        </div>
                      );
                    }}
                  </For>
                );
              }}
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
                Enter
              </kbd>{" "}
              Select
            </span>
            <span>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--surface-base)" }}>
                Esc
              </kbd>{" "}
              Close
            </span>
          </div>
          <Show when={isLoading()}>
            <span class="text-xs" style={{ color: "var(--accent)" }}>
              Loading...
            </span>
          </Show>
          <Show when={!isLoading()}>
            <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
              {flatEncodings().length} encodings
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Encoding Item
// ============================================================================

interface EncodingItemProps {
  encoding: EncodingInfo;
  isSelected: boolean;
  isCurrent: boolean;
  dataIndex: number;
  onClick: () => void;
  onHover: () => void;
  disabled?: boolean;
}

function EncodingItem(props: EncodingItemProps) {
  return (
    <button
      data-index={props.dataIndex}
      class="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-hover)" : "transparent",
        opacity: props.disabled ? 0.5 : 1,
      }}
      onClick={props.onClick}
      onMouseEnter={props.onHover}
      disabled={props.disabled}
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="font-medium truncate text-sm"
            style={{ color: props.isCurrent ? "var(--accent)" : "var(--text-strong)" }}
          >
            {props.encoding.name}
          </span>
          <Show when={props.isCurrent}>
            <span
              class="text-[10px] px-1.5 py-0.5 rounded font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              CURRENT
            </span>
          </Show>
        </div>
        <div class="text-xs" style={{ color: "var(--text-weak)" }}>
          {props.encoding.id}
        </div>
      </div>

      <Show when={props.isCurrent}>
        <Icon name="check" class="w-4 h-4 shrink-0" style={{ color: "var(--success)" }} />
      </Show>
    </button>
  );
}

// ============================================================================
// Modal Wrapper
// ============================================================================

export function EncodingPickerModal() {
  const encodingCtx = useEncoding();

  return (
    <Show when={encodingCtx.state.showPicker}>
      <EncodingPicker />
    </Show>
  );
}
