import { Show, For, createSignal, createMemo, createEffect, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useKeymap, type Keystroke } from "@/context/KeymapContext";
import { buildConflictsMap, buildTableItems } from "./keybindings/keybindingsHelpers";

interface KeybindingEditorProps {
  onClose?: () => void;
}

const ALTERNATIVE_MODIFIERS = ["Ctrl+Shift+", "Ctrl+Alt+", "Alt+Shift+", "Meta+Shift+", "Ctrl+Meta+"];

function suggestAlternatives(currentKey: string, usedKeys: Set<string>): string[] {
  const base = currentKey.replace(/^(Ctrl|Alt|Shift|Meta)\+/g, "").split("+").pop() ?? "";
  if (!base) return [];
  return ALTERNATIVE_MODIFIERS
    .map((mod) => `${mod}${base}`)
    .filter((k) => k !== currentKey && !usedKeys.has(k.toLowerCase()))
    .slice(0, 3);
}

export function KeybindingEditor(props: KeybindingEditorProps) {
  const keymap = useKeymap();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchByKey, setSearchByKey] = createSignal(false);
  const [collapsedCategories, setCollapsedCategories] = createSignal<Set<string>>(new Set());
  const [editingCommandId, setEditingCommandId] = createSignal<string | null>(null);

  const conflictsMap = createMemo(() => buildConflictsMap(keymap.bindings(), keymap.formatKeybinding));
  const tableItems = createMemo(() => buildTableItems(keymap.bindings(), conflictsMap(), keymap.formatKeybinding));

  const usedKeysSet = createMemo(() => {
    const s = new Set<string>();
    for (const item of tableItems()) {
      if (item.keybinding) s.add(item.keybinding.toLowerCase());
    }
    return s;
  });

  const conflictCommandIds = createMemo(() => {
    const ids = new Set<string>();
    for (const c of keymap.conflicts()) {
      for (const cmd of c.commands) ids.add(cmd);
    }
    return ids;
  });

  const filteredItems = createMemo(() => {
    const query = searchQuery().toLowerCase();
    if (!query) return tableItems();
    return tableItems().filter((item) =>
      searchByKey()
        ? item.keybinding.toLowerCase().includes(query)
        : item.commandTitle.toLowerCase().includes(query) ||
          item.command.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
    );
  });

  const groupedItems = createMemo(() => {
    const groups = new Map<string, typeof filteredItems extends () => (infer T)[] ? T[] : never>();
    for (const item of filteredItems()) {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

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

  const handleExport = () => {
    const json = keymap.exportCustomBindings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keybindings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        keymap.importCustomBindings(text);
      }
    };
    input.click();
  };

  createEffect(() => {
    if (!keymap.isRecording()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleCancelRecording(); return; }
      if (e.key === "Enter" && keymap.recordedKeystrokes().length > 0) { e.preventDefault(); handleSaveBinding(); }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const formatKeystroke = (ks: Keystroke): string => {
    const parts: string[] = [];
    if (ks.modifiers.ctrl) parts.push("Ctrl");
    if (ks.modifiers.alt) parts.push("Alt");
    if (ks.modifiers.shift) parts.push("Shift");
    if (ks.modifiers.meta) parts.push("Meta");
    const keyMap: Record<string, string> = {
      ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
      Escape: "Esc", Backspace: "Backspace", Delete: "Del", Enter: "Enter", Tab: "Tab", " ": "Space",
    };
    parts.push(keyMap[ks.key] ?? (ks.key.length === 1 ? ks.key.toUpperCase() : ks.key));
    return parts.join("+");
  };

  return (
    <div class="h-full flex flex-col" style={{ padding: "11px 0 0 27px" }}>
      <div class="mb-4 space-y-3" style={{ padding: "0 10px 11px 0" }}>
        <div class="relative">
          <Icon name="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder={searchByKey() ? "Search by key sequence..." : "Search commands..."}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-background pl-10 pr-10 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <Show when={searchQuery()}>
            <button onClick={() => setSearchQuery("")} class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-background-tertiary">
              <Icon name="xmark" class="h-4 w-4 text-foreground-muted" />
            </button>
          </Show>
        </div>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <button
              onClick={() => setSearchByKey((p) => !p)}
              class={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${searchByKey() ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-border-active"}`}
            >
              <Icon name="keyboard" class="h-3.5 w-3.5" />
              By Key
            </button>
            <button
              onClick={() => { /* show conflicts only by setting search */ setSearchQuery(""); }}
              class={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${keymap.conflicts().length > 0 ? "border-warning text-warning" : "border-border"}`}
            >
              <Icon name="triangle-exclamation" class="h-3.5 w-3.5" />
              Conflicts ({keymap.conflicts().length})
            </button>
          </div>
          <div class="flex items-center gap-2">
            <button onClick={() => keymap.resetAllToDefault()} class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active">
              <Icon name="rotate-left" class="h-3.5 w-3.5" />
              Reset All
            </button>
            <button onClick={handleImport} class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active">
              <Icon name="upload" class="h-3.5 w-3.5" />
              Import
            </button>
            <button onClick={handleExport} class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active">
              <Icon name="download" class="h-3.5 w-3.5" />
              Export
            </button>
            <Show when={props.onClose}>
              <button onClick={props.onClose} class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active">
                <Icon name="xmark" class="h-3.5 w-3.5" />
              </button>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-4 px-4 py-2 text-xs font-semibold uppercase text-foreground-muted border-b border-border bg-background-secondary">
        <div class="flex-[2] min-w-0">Command</div>
        <div class="w-[180px]">Keybinding</div>
        <div class="flex-1 min-w-[120px]">When</div>
        <div class="w-[80px] text-right">Actions</div>
      </div>

      <div class="flex-1 overflow-y-auto border-x border-b border-border rounded-b-lg">
        <Show when={groupedItems().length > 0} fallback={<div class="flex h-32 items-center justify-center text-foreground-muted">No keybindings found</div>}>
          <For each={groupedItems()}>
            {([category, items]) => (
              <div>
                <button
                  onClick={() => toggleCategory(category)}
                  class="sticky top-0 z-10 flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold uppercase text-foreground-muted border-b border-border cursor-pointer hover:bg-background-tertiary/50"
                  style={{ "background-color": "var(--vscode-keybindingTable-headerBackground, var(--surface-raised))" }}
                >
                  <Icon name={collapsedCategories().has(category) ? "chevron-right" : "chevron-down"} class="h-3 w-3" />
                  {category} ({items.length})
                </button>
                <Show when={!collapsedCategories().has(category)}>
                  <For each={items}>
                    {(item, idx) => {
                      const isEditing = () => editingCommandId() === item.command;
                      const hasConflict = () => conflictCommandIds().has(item.command);
                      const isModified = () => item.isUserDefined;
                      const effectiveBinding = () => item.binding.customKeybinding ?? item.binding.defaultKeybinding;
                      const alternatives = () => hasConflict() && item.keybinding ? suggestAlternatives(item.keybinding, usedKeysSet()) : [];

                      return (
                        <div
                          class={`group flex items-center gap-4 px-4 py-2.5 border-b border-border/50 transition-colors hover:bg-background-tertiary/50 ${isEditing() ? "bg-primary/5" : ""} ${hasConflict() ? "bg-warning/5" : ""}`}
                          style={{ "background-color": idx() % 2 === 1 && !isEditing() && !hasConflict() ? "var(--vscode-keybindingTable-rowsBackground, rgba(130,130,130,0.04))" : undefined, "padding-left": "10px" }}
                        >
                          <div class="flex-[2] min-w-0">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-sm truncate">{item.commandTitle}</span>
                              <Show when={isModified()}><span class="text-[10px] rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">Modified</span></Show>
                              <Show when={hasConflict()}>
                                <span class="text-[10px] rounded-full bg-warning/20 px-1.5 py-0.5 text-warning cursor-help" title={`Conflicts with: ${item.conflictsWith.join(", ")}`}>
                                  <Icon name="triangle-exclamation" class="inline h-3 w-3" /> Conflict
                                </span>
                              </Show>
                            </div>
                            <div class="text-xs text-foreground-muted truncate">{item.command}</div>
                            <Show when={hasConflict() && alternatives().length > 0}>
                              <div class="mt-1 text-[10px] text-foreground-muted">
                                Try: {alternatives().map((a) => <kbd class="mx-0.5 px-1 py-0.5 rounded border border-border bg-background-tertiary font-mono text-[10px]">{a}</kbd>)}
                              </div>
                            </Show>
                          </div>

                          <div class="w-[180px] flex items-center">
                            <Show when={!isEditing()} fallback={
                              <div class="flex items-center gap-2">
                                <Show when={keymap.recordedKeystrokes().length > 0} fallback={<span class="text-sm text-foreground-muted italic">Press keys...</span>}>
                                  <div class="flex items-center gap-1" style={{ "font-family": "var(--font-code, monospace)", "font-size": "90%" }}>
                                    <For each={keymap.recordedKeystrokes()}>
                                      {(ks, i) => (<><Show when={i() > 0}><span class="text-foreground-muted text-xs mx-0.5">then</span></Show><kbd class="px-2 py-0.5 text-xs font-mono rounded border border-primary bg-primary/10">{formatKeystroke(ks)}</kbd></>)}
                                    </For>
                                  </div>
                                </Show>
                                <button onClick={handleSaveBinding} disabled={keymap.recordedKeystrokes().length === 0} class="p-1 rounded hover:bg-green-500/20 text-green-500 disabled:opacity-50" title="Save (Enter)">
                                  <Icon name="check" class="h-3.5 w-3.5" />
                                </button>
                                <button onClick={handleCancelRecording} class="p-1 rounded hover:bg-red-500/20 text-red-500" title="Cancel (Escape)">
                                  <Icon name="xmark" class="h-3.5 w-3.5" />
                                </button>
                              </div>
                            }>
                              <button onClick={() => handleStartRecording(item.command)} class="text-left" title="Click to record keybinding">
                                <Show when={effectiveBinding()} fallback={<span class="text-sm text-foreground-muted italic px-2 py-1 border border-dashed border-border rounded hover:border-primary hover:text-primary transition-colors">Record</span>}>
                                  <div class={`flex items-center gap-1 ${hasConflict() ? "border-warning" : ""}`} style={{ "font-family": "var(--font-code, monospace)", "font-size": "90%" }}>
                                    <For each={effectiveBinding()!.keystrokes}>
                                      {(ks, i) => (<><Show when={i() > 0}><span class="text-foreground-muted text-xs mx-0.5">then</span></Show><kbd class="px-2 py-0.5 text-xs font-mono rounded border border-border bg-background-tertiary hover:border-primary transition-colors" style={{ padding: "1px 4px", "background-color": "rgba(128,128,128,0.17)", "border-radius": "var(--cortex-radius-sm)" }}>{formatKeystroke(ks)}</kbd></>)}
                                    </For>
                                  </div>
                                </Show>
                              </button>
                            </Show>
                          </div>

                          <div class="flex-1 min-w-[120px] text-xs text-foreground-muted truncate font-mono">{item.when || "-"}</div>

                          <div class="w-[80px] flex items-center justify-end">
                            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Show when={isModified()}>
                                <button onClick={() => keymap.resetToDefault(item.command)} class="p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground" title="Reset to default">
                                  <Icon name="rotate-left" class="h-3.5 w-3.5" />
                                </button>
                              </Show>
                              <Show when={effectiveBinding()}>
                                <button onClick={() => keymap.setCustomBinding(item.command, null)} class="p-1 rounded hover:bg-red-500/10 text-foreground-muted hover:text-red-500" title="Remove keybinding">
                                  <Icon name="xmark" class="h-3.5 w-3.5" />
                                </button>
                              </Show>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>

      <Show when={keymap.isRecording()}>
        <div class="mt-3 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-primary">Recording keybinding...</span>
              <span class="ml-2 text-foreground-muted">Press keys to record, Enter to save, Escape to cancel</span>
            </div>
            <Show when={keymap.recordedKeystrokes().length > 0} fallback={<span class="text-foreground-muted italic">Waiting for input...</span>}>
              <div class="flex items-center gap-1" style={{ "font-family": "var(--font-code, monospace)" }}>
                <For each={keymap.recordedKeystrokes()}>
                  {(ks, i) => (<><Show when={i() > 0}><span class="text-foreground-muted text-xs mx-0.5">then</span></Show><kbd class="px-2 py-0.5 text-xs font-mono rounded border border-primary bg-primary/20">{formatKeystroke(ks)}</kbd></>)}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      <div class="flex items-center justify-between px-4 py-2 text-xs text-foreground-muted border-t border-border">
        <span>{filteredItems().length} of {tableItems().length} keybindings</span>
        <Show when={keymap.conflicts().length > 0}>
          <span class="text-warning">⚠ {keymap.conflicts().length} conflict(s) detected</span>
        </Show>
      </div>
    </div>
  );
}

export default KeybindingEditor;
