import { Show, For, createSignal, createMemo } from "solid-js";
import { Portal } from "solid-js/web";
import { useKeymap } from "@/context/keymap";
import type { CommandBinding } from "@/context/keymap";
import { KeybindingRow } from "@/components/keyboard/KeybindingRow";
import { KeyRecorder } from "@/components/keyboard/KeyRecorder";
import { tokens } from "@/design-system/tokens";

type FilterMode = "all" | "with-shortcut" | "without-shortcut" | "conflicts-only";

const FILTER_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "with-shortcut", label: "With Shortcut" },
  { value: "without-shortcut", label: "Without Shortcut" },
  { value: "conflicts-only", label: "Conflicts Only" },
];

const CLOSE_ICON = "M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z";
const SEARCH_ICON = "M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z";

export interface KeyboardShortcutsEditorProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsEditor(props: KeyboardShortcutsEditorProps) {
  const keymap = useKeymap();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [filterMode, setFilterMode] = createSignal<FilterMode>("all");
  const [editingCommandId, setEditingCommandId] = createSignal<string | null>(null);

  const conflictCommandIds = createMemo(() => {
    const ids = new Set<string>();
    for (const c of keymap.conflicts()) {
      for (const cmd of c.commands) ids.add(cmd);
    }
    return ids;
  });

  const filteredBindings = createMemo(() => {
    let items = keymap.bindings();
    const query = searchQuery().toLowerCase();
    if (query) {
      items = items.filter((b: CommandBinding) => {
        const matchesName = b.label.toLowerCase().includes(query) ||
          b.commandId.toLowerCase().includes(query) ||
          b.category.toLowerCase().includes(query);
        const eff = b.customKeybinding ?? b.defaultKeybinding;
        return matchesName || (eff ? keymap.formatKeybinding(eff).toLowerCase().includes(query) : false);
      });
    }
    const mode = filterMode();
    if (mode === "with-shortcut") items = items.filter((b: CommandBinding) => !!(b.customKeybinding ?? b.defaultKeybinding));
    else if (mode === "without-shortcut") items = items.filter((b: CommandBinding) => !(b.customKeybinding ?? b.defaultKeybinding));
    else if (mode === "conflicts-only") items = items.filter((b: CommandBinding) => conflictCommandIds().has(b.commandId));
    return items;
  });

  const groupedBindings = createMemo(() => {
    const groups = new Map<string, CommandBinding[]>();
    for (const binding of filteredBindings()) {
      const existing = groups.get(binding.category) ?? [];
      existing.push(binding);
      groups.set(binding.category, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const handleStartRecording = (commandId: string) => {
    setEditingCommandId(commandId);
    keymap.startRecording(commandId);
  };

  const handleSaveBinding = () => {
    if (keymap.recordedKeystrokes().length > 0) keymap.saveRecordedBinding();
    setEditingCommandId(null);
  };

  const handleCancelRecording = () => {
    keymap.stopRecording();
    keymap.clearRecording();
    setEditingCommandId(null);
  };

  const handleExport = async () => {
    const json = keymap.exportCustomBindings();
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: "keybindings.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        await writeTextFile(filePath, json);
      }
    } catch {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "keybindings.json";
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath && typeof filePath === "string") {
        const json = await readTextFile(filePath);
        keymap.importCustomBindings(json);
      }
    } catch {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          keymap.importCustomBindings(text);
        }
      };
      input.click();
    }
  };

  const borderStyle = { "border-color": tokens.colors.border.default };
  const toolbarBtnStyle = { ...borderStyle, color: tokens.colors.text.secondary, "--hover-bg": tokens.colors.surface.hover };

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 flex items-center justify-center" style={{ "background-color": tokens.colors.surface.overlay }}>
          <div class="flex flex-col w-full max-w-4xl max-h-[85vh] rounded-xl border shadow-2xl"
            style={{ "background-color": tokens.colors.surface.card, ...borderStyle }}>
            {/* Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b" style={borderStyle}>
              <h2 class="text-lg font-semibold" style={{ color: tokens.colors.text.title }}>Keyboard Shortcuts</h2>
              <button onClick={() => props.onClose()} class="p-1.5 rounded-lg transition-colors hover:bg-[--hover-bg]"
                style={{ color: tokens.colors.text.muted, "--hover-bg": tokens.colors.surface.hover }}>
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d={CLOSE_ICON} /></svg>
              </button>
            </div>
            {/* Search & Filters */}
            <div class="px-6 py-3 space-y-3 border-b" style={borderStyle}>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: tokens.colors.text.muted }}
                  viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d={SEARCH_ICON} clip-rule="evenodd" /></svg>
                <input type="text" placeholder="Search by command name or key sequence…" value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="w-full rounded-lg border pl-10 pr-10 py-2 text-sm focus:outline-none"
                  style={{ "background-color": tokens.colors.surface.input, ...borderStyle, color: tokens.colors.text.primary }} />
                <Show when={searchQuery()}>
                  <button onClick={() => setSearchQuery("")} class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                    style={{ color: tokens.colors.text.muted }}>
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d={CLOSE_ICON} /></svg>
                  </button>
                </Show>
              </div>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <For each={FILTER_OPTIONS}>
                    {(opt) => (
                      <button onClick={() => setFilterMode(opt.value)} class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{ "background-color": filterMode() === opt.value ? tokens.colors.accent.muted : "transparent",
                          color: filterMode() === opt.value ? tokens.colors.accent.primary : tokens.colors.text.secondary }}>
                        {opt.label}
                        <Show when={opt.value === "conflicts-only" && keymap.conflicts().length > 0}>
                          <span class="ml-1 rounded-full px-1.5 text-[10px]"
                            style={{ "background-color": tokens.colors.state.errorBg, color: tokens.colors.state.error }}>
                            {keymap.conflicts().length}
                          </span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
                <div class="flex items-center gap-2">
                  <button onClick={() => keymap.resetAllToDefault()}
                    class="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[--hover-bg]" style={toolbarBtnStyle}>Reset All</button>
                  <button onClick={handleImport}
                    class="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[--hover-bg]" style={toolbarBtnStyle}>Import</button>
                  <button onClick={handleExport}
                    class="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[--hover-bg]" style={toolbarBtnStyle}>Export</button>
                </div>
              </div>
            </div>
            {/* Recording indicator */}
            <Show when={keymap.isRecording() && editingCommandId()}>
              <div class="px-6 py-3">
                <KeyRecorder commandId={editingCommandId()!} onSave={handleSaveBinding} onCancel={handleCancelRecording} />
              </div>
            </Show>
            {/* Bindings list */}
            <div class="flex-1 overflow-y-auto">
              <Show when={groupedBindings().length > 0}
                fallback={<div class="flex h-32 items-center justify-center text-sm" style={{ color: tokens.colors.text.muted }}>No keybindings found</div>}>
                <For each={groupedBindings()}>
                  {([category, bindings]) => (
                    <div>
                      <div class="sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase border-b"
                        style={{ "background-color": tokens.colors.surface.panel, ...borderStyle, color: tokens.colors.text.muted }}>
                        {category} ({bindings.length})
                      </div>
                      <For each={bindings}>
                        {(binding) => (
                          <KeybindingRow binding={binding} isEditing={editingCommandId() === binding.commandId}
                            onStartEdit={() => handleStartRecording(binding.commandId)} onReset={() => keymap.resetToDefault(binding.commandId)} />
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
            </div>
            {/* Footer */}
            <div class="flex items-center justify-between px-6 py-2 text-xs border-t" style={{ ...borderStyle, color: tokens.colors.text.muted }}>
              <span>{filteredBindings().length} of {keymap.bindings().length} keybindings</span>
              <Show when={keymap.conflicts().length > 0}>
                <span style={{ color: tokens.colors.state.warning }}>⚠ {keymap.conflicts().length} conflict(s) detected</span>
              </Show>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
