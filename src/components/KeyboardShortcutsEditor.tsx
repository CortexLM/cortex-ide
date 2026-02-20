import { createSignal, createMemo, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { useCommands, type Command } from "@/context/CommandContext";
import { useKeymap, type Keystroke } from "@/context/KeymapContext";
import { Icon } from "./ui/Icon";
import { Input, Text, EmptyState, IconButton, Button } from "@/components/ui";
import { KeyCap, CategorySection } from "@/components/KeyboardShortcutsEditorRow";

const CATEGORY_ORDER = [
  "General", "Navigation", "Editor", "Search",
  "View", "Debug", "Git", "Terminal", "Extension", "Other",
];

export function KeyboardShortcutsEditor() {
  const { commands } = useCommands();
  const keymap = useKeymap();
  const [isOpen, setIsOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(
    new Set(["General", "Navigation", "Editor", "Search"])
  );
  const [filterMode, setFilterMode] = createSignal<"all" | "with-shortcut" | "without-shortcut">("all");
  const [editingCommandId, setEditingCommandId] = createSignal<string | null>(null);
  let inputRef: HTMLInputElement | undefined;

  const conflictCommandIds = createMemo(() => {
    const ids = new Set<string>();
    for (const c of keymap.conflicts()) for (const cmd of c.commands) ids.add(cmd);
    return ids;
  });

  const filteredCommands = createMemo(() => {
    let cmds = commands();
    const query = searchQuery().toLowerCase().trim();
    if (filterMode() === "with-shortcut") cmds = cmds.filter(c => c.shortcut);
    else if (filterMode() === "without-shortcut") cmds = cmds.filter(c => !c.shortcut);
    if (query) {
      cmds = cmds.filter(c =>
        c.label.toLowerCase().includes(query) || c.id.toLowerCase().includes(query) ||
        (c.shortcut && c.shortcut.toLowerCase().includes(query)) ||
        (c.category && c.category.toLowerCase().includes(query))
      );
    }
    return cmds;
  });

  const groupedCommands = createMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands()) {
      const cat = cmd.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(cmd);
    }
    for (const cat of Object.keys(groups)) {
      groups[cat].sort((a, b) => {
        if (a.shortcut && !b.shortcut) return -1;
        if (!a.shortcut && b.shortcut) return 1;
        return a.label.localeCompare(b.label);
      });
    }
    return groups;
  });

  const sortedCategories = createMemo(() =>
    Object.keys(groupedCommands()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
  );

  const totalCommands = () => commands().length;
  const totalWithShortcuts = () => commands().filter(c => c.shortcut).length;
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const expandAll = () => setExpandedCategories(new Set<string>(sortedCategories()));
  const collapseAll = () => setExpandedCategories(new Set<string>());

  const formatKeystroke = (ks: Keystroke): string => {
    const parts: string[] = [];
    if (ks.modifiers.ctrl) parts.push("Ctrl");
    if (ks.modifiers.alt) parts.push("Alt");
    if (ks.modifiers.shift) parts.push("Shift");
    if (ks.modifiers.meta) parts.push("Meta");
    const km: Record<string, string> = {
      ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
      Escape: "Esc", Backspace: "Backspace", Delete: "Del", Enter: "Enter", Tab: "Tab", " ": "Space",
    };
    parts.push(km[ks.key] ?? (ks.key.length === 1 ? ks.key.toUpperCase() : ks.key));
    return parts.join("+");
  };

  const handleStartRecording = (commandId: string) => { setEditingCommandId(commandId); keymap.startRecording(commandId); };
  const handleStopRecording = () => { keymap.stopRecording(); keymap.clearRecording(); setEditingCommandId(null); };
  const handleSaveRecording = () => { if (keymap.recordedKeystrokes().length > 0) keymap.saveRecordedBinding(); setEditingCommandId(null); };
  const handleResetBinding = (commandId: string) => keymap.resetToDefault(commandId);
  const handleResetAll = () => keymap.resetAllToDefault();
  const handleExport = () => { keymap.exportBindingsToFile(); };
  const handleImport = () => { keymap.importBindingsFromFile(); };

  createEffect(() => {
    if (!keymap.isRecording()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleStopRecording(); return; }
      if (e.key === "Enter" && keymap.recordedKeystrokes().length > 0) { e.preventDefault(); handleSaveRecording(); }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  const handleOpen = () => { setIsOpen(true); setSearchQuery(""); setTimeout(() => inputRef?.focus(), 50); };
  const handleClose = () => { if (keymap.isRecording()) handleStopRecording(); setIsOpen(false); };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen() && !keymap.isRecording()) { e.preventDefault(); handleClose(); }
  };

  onMount(() => {
    const handleShowShortcuts = () => handleOpen();
    window.addEventListener("keyboard-shortcuts:show", handleShowShortcuts);
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      window.removeEventListener("keyboard-shortcuts:show", handleShowShortcuts);
      window.removeEventListener("keydown", handleKeyDown);
    });
  });

  return (
    <Show when={isOpen()}>
      <Portal>
        <div class="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.6)" }} onClick={handleClose}>
          <div class="w-full max-w-4xl h-[80vh] mx-4 flex flex-col overflow-hidden" style={{
            background: "var(--jb-canvas)", border: "1px solid var(--jb-border-default)",
            "border-radius": "var(--cortex-radius-lg)", "box-shadow": "0 16px 48px rgba(0, 0, 0, 0.4)",
          }} onClick={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between px-6 py-4 border-b" style={{ "border-color": "var(--jb-border-default)" }}>
              <div class="flex items-center gap-3">
                <Icon name="keyboard" class="w-5 h-5" style={{ color: "var(--jb-border-focus)" }} />
                <Text variant="header" size="lg">Keyboard Shortcuts</Text>
                <span class="text-xs px-2 py-0.5 rounded" style={{ background: "var(--jb-surface-active)", color: "var(--jb-text-muted-color)" }}>
                  {totalCommands()} commands • {totalWithShortcuts()} with shortcuts
                </span>
              </div>
              <IconButton icon="x" size="sm" variant="ghost" title="Close (Esc)" onClick={handleClose} />
            </div>
            <div class="flex items-center gap-4 px-6 py-3 border-b" style={{ "border-color": "var(--jb-border-default)" }}>
              <div class="flex-1">
                <Input ref={inputRef} value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Search commands, shortcuts, or categories..." icon="search" />
              </div>
              <div class="flex items-center gap-2">
                <select class="px-3 py-1.5 text-sm rounded" style={{
                  background: "var(--jb-surface-active)", border: "1px solid var(--jb-border-default)", color: "var(--jb-text-body-color)",
                }} value={filterMode()} onChange={(e) => setFilterMode(e.currentTarget.value as typeof filterMode extends () => infer T ? T : never)}>
                  <option value="all">All Commands</option>
                  <option value="with-shortcut">With Shortcut</option>
                  <option value="without-shortcut">Without Shortcut</option>
                </select>
                <IconButton icon="chevrons-down" size="sm" variant="ghost" title="Expand All" onClick={expandAll} />
                <IconButton icon="chevrons-up" size="sm" variant="ghost" title="Collapse All" onClick={collapseAll} />
              </div>
            </div>
            <div class="flex-1 overflow-y-auto relative">
              <Show when={sortedCategories().length > 0} fallback={
                <div class="flex items-center justify-center h-full">
                  <EmptyState icon="search" title="No commands found" description={`No commands match "${searchQuery()}"`} />
                </div>
              }>
                <For each={sortedCategories()}>
                  {(category) => (
                    <CategorySection category={category} commands={groupedCommands()[category]}
                      isExpanded={expandedCategories().has(category)} onToggle={() => toggleCategory(category)}
                      onRecord={handleStartRecording} onReset={handleResetBinding} conflictIds={conflictCommandIds()} />
                  )}
                </For>
              </Show>
              <Show when={keymap.isRecording()}>
                <div class="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "rgba(0, 0, 0, 0.75)" }}>
                  <div class="flex flex-col items-center gap-4 p-8 rounded-lg" style={{
                    background: "var(--jb-canvas)", border: "1px solid var(--jb-border-focus)", "box-shadow": "0 8px 32px rgba(0, 0, 0, 0.5)",
                  }}>
                    <Icon name="keyboard" class="w-8 h-8" style={{ color: "var(--jb-border-focus)" }} />
                    <Text variant="header" size="lg">Press key combination...</Text>
                    <Show when={editingCommandId()}>
                      <Text variant="muted" size="sm">Recording for: {editingCommandId()}</Text>
                    </Show>
                    <Show when={keymap.recordedKeystrokes().length > 0}>
                      <div class="flex items-center gap-2 mt-2">
                        <For each={keymap.recordedKeystrokes()}>{(ks) => <KeyCap keys={formatKeystroke(ks)} />}</For>
                      </div>
                    </Show>
                    <div class="flex items-center gap-4 mt-4">
                      <div class="flex items-center gap-2">
                        <KeyCap keys="Escape" /><Text variant="muted" size="sm">Cancel</Text>
                      </div>
                      <Show when={keymap.recordedKeystrokes().length > 0}>
                        <div class="flex items-center gap-2">
                          <KeyCap keys="Enter" /><Text variant="muted" size="sm">Save</Text>
                        </div>
                      </Show>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
            <div class="flex items-center justify-between px-6 py-3 border-t" style={{ "border-color": "var(--jb-border-default)" }}>
              <div class="flex items-center gap-4">
                <div class="flex items-center gap-2">
                  <KeyCap keys="Escape" /><Text variant="muted" size="sm">Close</Text>
                </div>
                <Text variant="muted" size="sm">Double-click a row to record</Text>
              </div>
              <div class="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleImport}>Import Keybindings</Button>
                <Button variant="ghost" size="sm" onClick={handleExport}>Export Keybindings</Button>
                <Button variant="ghost" size="sm" onClick={handleResetAll}>Reset All</Button>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
}

export default KeyboardShortcutsEditor;
