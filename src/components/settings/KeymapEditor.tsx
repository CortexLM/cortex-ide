import { Show, For, createSignal, createMemo, createEffect, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useKeymap, type CommandBinding, type Keystroke } from "@/context/KeymapContext";
import { WhenClauseInput, WhenClauseDisplay, validateWhenClause } from "./WhenClauseInput";

interface KeymapEditorProps {
  onClose?: () => void;
}

/** VS Code Keybindings Editor - follows keybindingsEditor.css spec */
export function KeymapEditor(_props: KeymapEditorProps) {
  const keymap = useKeymap();
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);
  const [showConflictsOnly, setShowConflictsOnly] = createSignal(false);
  const [editingCommandId, setEditingCommandId] = createSignal<string | null>(null);
  const [editingWhenCommandId, setEditingWhenCommandId] = createSignal<string | null>(null);
  const [editingWhenValue, setEditingWhenValue] = createSignal("");

  // Get unique categories
  const categories = createMemo(() => {
    const cats = new Set<string>();
    for (const binding of keymap.bindings()) {
      cats.add(binding.category);
    }
    return Array.from(cats).sort();
  });

  // Filter bindings based on search and category
  const filteredBindings = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const category = selectedCategory();
    const conflictsOnly = showConflictsOnly();
    const conflictCommandIds = new Set(
      keymap.conflicts().flatMap(c => c.commands)
    );

    return keymap.bindings().filter(binding => {
      // Filter by category
      if (category && binding.category !== category) {
        return false;
      }

      // Filter by conflicts
      if (conflictsOnly && !conflictCommandIds.has(binding.commandId)) {
        return false;
      }

      // Filter by search query
      if (query) {
        const matchesLabel = binding.label.toLowerCase().includes(query);
        const matchesCommand = binding.commandId.toLowerCase().includes(query);
        const effectiveBinding = binding.customKeybinding ?? binding.defaultKeybinding;
        const matchesKeybinding = effectiveBinding 
          ? keymap.formatKeybinding(effectiveBinding).toLowerCase().includes(query)
          : false;
        const effectiveWhen = binding.customWhen ?? binding.when ?? "";
        const matchesWhen = effectiveWhen.toLowerCase().includes(query);
        
        return matchesLabel || matchesCommand || matchesKeybinding || matchesWhen;
      }

      return true;
    });
  });

  // Group bindings by category for display
  const groupedBindings = createMemo(() => {
    const groups = new Map<string, CommandBinding[]>();
    
    for (const binding of filteredBindings()) {
      const existing = groups.get(binding.category) || [];
      existing.push(binding);
      groups.set(binding.category, existing);
    }
    
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  });

  // Check if a command has a conflict
  const hasConflict = (commandId: string): boolean => {
    return keymap.conflicts().some(c => c.commands.includes(commandId));
  };

  // Get conflicting commands for a command
  const getConflictingCommands = (commandId: string): string[] => {
    const conflict = keymap.conflicts().find(c => c.commands.includes(commandId));
    if (!conflict) return [];
    return conflict.commands.filter(id => id !== commandId);
  };

  // Check if a binding is modified from default
  const isModified = (binding: CommandBinding): boolean => {
    return binding.customKeybinding !== null;
  };

  // Check if when clause is modified
  const isWhenModified = (binding: CommandBinding): boolean => {
    return binding.customWhen !== undefined && binding.customWhen !== binding.when;
  };

  // Handle starting recording for a command
  const handleStartRecording = (commandId: string) => {
    setEditingCommandId(commandId);
    keymap.startRecording(commandId);
  };

  // Handle saving the recorded binding
  const handleSaveBinding = () => {
    if (keymap.recordedKeystrokes().length > 0) {
      keymap.saveRecordedBinding();
    }
    setEditingCommandId(null);
  };

  // Handle canceling recording
  const handleCancelRecording = () => {
    keymap.stopRecording();
    keymap.clearRecording();
    setEditingCommandId(null);
  };

  // Handle resetting a binding to default
  const handleResetBinding = (commandId: string) => {
    keymap.resetToDefault(commandId);
  };

  // Handle removing a binding (set to no keybinding)
  const handleRemoveBinding = (commandId: string) => {
    keymap.setCustomBinding(commandId, null);
  };

  // Handle starting when clause editing
  const handleStartEditingWhen = (commandId: string, currentWhen: string) => {
    setEditingWhenCommandId(commandId);
    setEditingWhenValue(currentWhen);
  };

  // Handle saving when clause
  const handleSaveWhen = () => {
    const commandId = editingWhenCommandId();
    if (commandId) {
      const validation = validateWhenClause(editingWhenValue());
      if (validation.isValid) {
        keymap.setCustomWhen(commandId, editingWhenValue() || null);
        setEditingWhenCommandId(null);
        setEditingWhenValue("");
      }
    }
  };

  // Handle canceling when clause editing
  const handleCancelEditingWhen = () => {
    setEditingWhenCommandId(null);
    setEditingWhenValue("");
  };

  // Handle resetting when clause to default
  const handleResetWhen = (commandId: string) => {
    keymap.setCustomWhen(commandId, null);
  };

  // Handle exporting bindings
  const handleExport = () => {
    const json = keymap.exportCustomBindings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cortex-keybindings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle importing bindings
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        if (keymap.importCustomBindings(text)) {
          if (import.meta.env.DEV) console.log("[KeymapEditor] Successfully imported keybindings");
        } else {
          console.error("[KeymapEditor] Failed to import keybindings");
        }
      }
    };
    input.click();
  };

  // Handle keyboard events during recording
  createEffect(() => {
    if (!keymap.isRecording()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape cancels recording
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelRecording();
        return;
      }

      // Enter saves the recording
      if (event.key === "Enter" && keymap.recordedKeystrokes().length > 0) {
        event.preventDefault();
        handleSaveBinding();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Handle keyboard events during when clause editing
  createEffect(() => {
    if (!editingWhenCommandId()) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelEditingWhen();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <div class="keybindings-editor h-full flex flex-col" style={{ padding: "11px 0px 0px 27px" }}>
      {/* Header with search and filters - VS Code: padding 0px 10px 11px 0 */}
      <div class="keybindings-header mb-4 space-y-3" style={{ padding: "0px 10px 11px 0" }}>
        {/* Search bar with actions container - VS Code keybindings search */}
        <div class="relative">
          <Icon name="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search commands, keybindings, or when clauses..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-background pl-10 pr-10 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <Show when={searchQuery()}>
            <button
              onClick={() => setSearchQuery("")}
              class="keybindings-search-actions-container absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-background-tertiary"
            >
              <Icon name="xmark" class="h-4 w-4 text-foreground-muted" />
            </button>
          </Show>
        </div>

        {/* Filters and actions */}
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            {/* Category filter */}
            <select
              value={selectedCategory() || ""}
              onChange={(e) => setSelectedCategory(e.currentTarget.value || null)}
              class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Categories</option>
              <For each={categories()}>
                {(category) => (
                  <option value={category}>{category}</option>
                )}
              </For>
            </select>

            {/* Show conflicts only */}
            <button
              onClick={() => setShowConflictsOnly(!showConflictsOnly())}
              class={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                showConflictsOnly()
                  ? "border-warning bg-warning/10 text-warning"
                  : "border-border hover:border-border-active"
              }`}
            >
              <Icon name="triangle-exclamation" class="h-3.5 w-3.5" />
              Conflicts ({keymap.conflicts().length})
            </button>
          </div>

          <div class="flex items-center gap-2">
            {/* Reset all */}
            <button
              onClick={() => keymap.resetAllToDefault()}
              class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active"
            >
              <Icon name="rotate-left" class="h-3.5 w-3.5" />
              Reset All
            </button>

            {/* Import */}
            <button
              onClick={handleImport}
              class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active"
            >
              <Icon name="upload" class="h-3.5 w-3.5" />
              Import
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active"
            >
              <Icon name="download" class="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div class="keybindings-column-headers flex items-center gap-4 px-4 py-2 text-xs font-semibold uppercase text-foreground-muted border-b border-border bg-background-secondary">
        <div class="flex-[2] min-w-0">Command</div>
        <div class="w-[160px]">Keybinding</div>
        <div class="flex-1 min-w-[200px]">When</div>
        <div class="w-[60px]">Actions</div>
      </div>

      {/* Keybindings list - VS Code keybindings table container */}
      <div class="keybindings-table-container flex-1 overflow-y-auto rounded-b-lg border-x border-b border-border">
        <Show
          when={groupedBindings().length > 0}
          fallback={
            <div class="flex h-32 items-center justify-center text-foreground-muted">
              No commands found
            </div>
          }
        >
          <For each={groupedBindings()}>
            {([category, bindings]) => (
              <div>
                {/* Category header - VS Code table header with background */}
                <div 
                  class="keybindings-table-header sticky top-0 z-10 px-4 py-2 text-xs font-semibold uppercase text-foreground-muted border-b border-border"
                  style={{ "background-color": "var(--vscode-keybindingTable-headerBackground, var(--surface-raised))", "padding-left": "10px" }}
                >
                  {category}
                </div>

                {/* Commands in category - VS Code keybindings table rows */}
                <For each={bindings}>
                  {(binding, index) => (
                    <KeybindingRow
                      binding={binding}
                      index={index()}
                      isEditing={editingCommandId() === binding.commandId}
                      isEditingWhen={editingWhenCommandId() === binding.commandId}
                      editingWhenValue={editingWhenCommandId() === binding.commandId ? editingWhenValue() : ""}
                      hasConflict={hasConflict(binding.commandId)}
                      conflictingCommands={getConflictingCommands(binding.commandId)}
                      isModified={isModified(binding)}
                      isWhenModified={isWhenModified(binding)}
                      recordedKeystrokes={
                        editingCommandId() === binding.commandId
                          ? keymap.recordedKeystrokes()
                          : []
                      }
                      formatKeybinding={keymap.formatKeybinding}
                      onStartRecording={() => handleStartRecording(binding.commandId)}
                      onSaveBinding={handleSaveBinding}
                      onCancelRecording={handleCancelRecording}
                      onResetBinding={() => handleResetBinding(binding.commandId)}
                      onRemoveBinding={() => handleRemoveBinding(binding.commandId)}
                      onStartEditingWhen={() => handleStartEditingWhen(binding.commandId, binding.customWhen ?? binding.when ?? "")}
                      onWhenValueChange={setEditingWhenValue}
                      onSaveWhen={handleSaveWhen}
                      onCancelEditingWhen={handleCancelEditingWhen}
                      onResetWhen={() => handleResetWhen(binding.commandId)}
                    />
                  )}
                </For>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Recording mode overlay info */}
      <Show when={keymap.isRecording()}>
        <div class="mt-3 rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-medium text-primary">Recording keybinding...</span>
              <span class="ml-2 text-foreground-muted">
                Press keys to record, Enter to save, Escape to cancel
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Show
                when={keymap.recordedKeystrokes().length > 0}
                fallback={
                  <span class="text-foreground-muted italic">Waiting for input...</span>
                }
              >
                <KeybindingDisplay
                  keystrokes={keymap.recordedKeystrokes()}
                  class="bg-primary/20 border-primary"
                />
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

interface KeybindingRowProps {
  binding: CommandBinding;
  isEditing: boolean;
  isEditingWhen: boolean;
  editingWhenValue: string;
  hasConflict: boolean;
  conflictingCommands: string[];
  isModified: boolean;
  isWhenModified: boolean;
  recordedKeystrokes: Keystroke[];
  formatKeybinding: (keybinding: { keystrokes: Keystroke[] } | null) => string;
  onStartRecording: () => void;
  onSaveBinding: () => void;
  onCancelRecording: () => void;
  onResetBinding: () => void;
  onRemoveBinding: () => void;
  onStartEditingWhen: () => void;
  onWhenValueChange: (value: string) => void;
  onSaveWhen: () => void;
  onCancelEditingWhen: () => void;
  onResetWhen: () => void;
}

function KeybindingRow(props: KeybindingRowProps & { index?: number }) {
  const effectiveBinding = () => 
    props.binding.customKeybinding ?? props.binding.defaultKeybinding;

  const effectiveWhen = () =>
    props.binding.customWhen ?? props.binding.when ?? "";

  // VS Code alternating row colors for odd rows
  const isOddRow = () => props.index !== undefined && props.index % 2 === 1;

  return (
    <div
      class={`keybindings-table-row group flex items-center gap-4 px-4 py-2.5 border-b border-border/50 transition-colors hover:bg-background-tertiary/50 ${
        props.isEditing || props.isEditingWhen ? "bg-primary/5 focused selected" : ""
      } ${props.hasConflict ? "bg-warning/5" : ""}`}
      style={{ 
        "background-color": isOddRow() && !props.isEditing && !props.isEditingWhen && !props.hasConflict 
          ? "var(--vscode-keybindingTable-rowsBackground, rgba(130, 130, 130, 0.04))" 
          : undefined,
        "padding-left": "10px"
      }}
      data-parity={isOddRow() ? "odd" : "even"}
    >
      {/* Command info */}
      <div class="flex-[2] min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm truncate">{props.binding.label}</span>
          <Show when={props.isModified}>
            <span class="text-[10px] rounded-full bg-primary/20 px-1.5 py-0.5 text-primary">
              Modified
            </span>
          </Show>
          <Show when={props.hasConflict}>
            <span 
              class="text-[10px] rounded-full bg-warning/20 px-1.5 py-0.5 text-warning cursor-help"
              title={`Conflicts with: ${props.conflictingCommands.join(", ")}`}
            >
              Conflict
            </span>
          </Show>
        </div>
        <div class="text-xs text-foreground-muted truncate">
          {props.binding.commandId}
        </div>
      </div>

      {/* Keybinding column */}
      <div class="w-[160px] flex items-center">
        <Show
          when={!props.isEditing}
          fallback={
            <div class="flex items-center gap-2">
              <Show
                when={props.recordedKeystrokes.length > 0}
                fallback={
                  <span class="text-sm text-foreground-muted italic">
                    Press keys...
                  </span>
                }
              >
                <KeybindingDisplay
                  keystrokes={props.recordedKeystrokes}
                  class="border-primary bg-primary/10"
                />
              </Show>
              <button
                onClick={props.onSaveBinding}
                disabled={props.recordedKeystrokes.length === 0}
                class="p-1 rounded hover:bg-green-500/20 text-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save (Enter)"
              >
                <Icon name="check" class="h-3.5 w-3.5" />
              </button>
              <button
                onClick={props.onCancelRecording}
                class="p-1 rounded hover:bg-red-500/20 text-red-500"
                title="Cancel (Escape)"
              >
                <Icon name="xmark" class="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          <button
            onClick={props.onStartRecording}
            class="text-left"
            title="Click to change keybinding"
          >
            <Show
              when={effectiveBinding()}
              fallback={
                <span class="text-sm text-foreground-muted italic px-2 py-1 border border-dashed border-border rounded hover:border-primary hover:text-primary transition-colors">
                  Add
                </span>
              }
            >
              <KeybindingDisplay
                keystrokes={effectiveBinding()!.keystrokes}
                class={`hover:border-primary hover:bg-primary/5 transition-colors ${
                  props.hasConflict ? "border-warning" : ""
                }`}
              />
            </Show>
          </button>
        </Show>
      </div>

      {/* When clause column */}
      <div class="flex-1 min-w-[200px]">
        <Show
          when={!props.isEditingWhen}
          fallback={
            <div class="flex items-center gap-2">
              <div class="flex-1">
                <WhenClauseInput
                  value={props.editingWhenValue}
                  onChange={props.onWhenValueChange}
                  placeholder="e.g., editorTextFocus"
                />
              </div>
              <button
                onClick={props.onSaveWhen}
                class="p-1 rounded hover:bg-green-500/20 text-green-500"
                title="Save"
              >
                <Icon name="check" class="h-3.5 w-3.5" />
              </button>
              <button
                onClick={props.onCancelEditingWhen}
                class="p-1 rounded hover:bg-red-500/20 text-red-500"
                title="Cancel (Escape)"
              >
                <Icon name="xmark" class="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          <button
            onClick={props.onStartEditingWhen}
            class="flex items-center gap-2 text-left w-full group/when"
            title="Click to edit when clause"
          >
            <div class="flex-1 min-w-0 truncate">
              <WhenClauseDisplay value={effectiveWhen()} />
            </div>
            <Show when={props.isWhenModified}>
              <span class="text-[10px] rounded-full bg-primary/20 px-1.5 py-0.5 text-primary shrink-0">
                Modified
              </span>
            </Show>
            <Icon name="pen" class="h-3 w-3 text-foreground-muted opacity-0 group-hover/when:opacity-100 transition-opacity shrink-0" />
          </button>
        </Show>
      </div>

      {/* Actions column */}
      <div class="w-[60px] flex items-center justify-end">
        <div class="action-bar flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Show when={props.isModified}>
            <button
              onClick={props.onResetBinding}
              class="p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
              title="Reset keybinding to default"
            >
              <Icon name="rotate-left" class="h-3.5 w-3.5" />
            </button>
          </Show>
          <Show when={props.isWhenModified}>
            <button
              onClick={props.onResetWhen}
              class="p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
              title="Reset when clause to default"
            >
              <Icon name="rotate-left" class="h-3.5 w-3.5" />
            </button>
          </Show>
          <Show when={effectiveBinding()}>
            <button
              onClick={props.onRemoveBinding}
              class="p-1 rounded hover:bg-red-500/10 text-foreground-muted hover:text-red-500"
              title="Remove keybinding"
            >
              <Icon name="xmark" class="h-3.5 w-3.5" />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

interface KeybindingDisplayProps {
  keystrokes: Keystroke[];
  class?: string;
}

/** VS Code keybinding code display - follows keybindings.css */
function KeybindingDisplay(props: KeybindingDisplayProps) {
  const formatKeystroke = (keystroke: Keystroke): string => {
    const parts: string[] = [];
    
    if (keystroke.modifiers.ctrl) parts.push("Ctrl");
    if (keystroke.modifiers.alt) parts.push("Alt");
    if (keystroke.modifiers.shift) parts.push("Shift");
    if (keystroke.modifiers.meta) parts.push("Meta");
    
    // Format special keys
    let keyDisplay = keystroke.key;
    const keyMap: Record<string, string> = {
      "ArrowUp": "Up",
      "ArrowDown": "Down",
      "ArrowLeft": "Left",
      "ArrowRight": "Right",
      "Escape": "Esc",
      "Backspace": "Backspace",
      "Delete": "Del",
      "Enter": "Enter",
      "Tab": "Tab",
      " ": "Space",
    };
    
    if (keyMap[keystroke.key]) {
      keyDisplay = keyMap[keystroke.key];
    } else if (keystroke.key.length === 1) {
      keyDisplay = keystroke.key.toUpperCase();
    }
    
    parts.push(keyDisplay);
    return parts.join("+");
  };

  return (
    <div class={`keybinding-code flex items-center gap-1 ${props.class || ""}`} style={{ "font-family": "var(--font-code, 'SF Mono', 'Fira Code', Consolas, monospace)", "font-size": "90%" }}>
      <For each={props.keystrokes}>
        {(keystroke, index) => (
          <>
            <Show when={index() > 0}>
              <span class="text-foreground-muted text-xs mx-0.5">then</span>
            </Show>
            <kbd 
              class="keybinding-code strong px-2 py-0.5 text-xs font-mono rounded border border-border bg-background-tertiary"
              style={{ padding: "1px 4px", "background-color": "rgba(128, 128, 128, 0.17)", "border-radius": "var(--cortex-radius-sm)" }}
            >
              {formatKeystroke(keystroke)}
            </kbd>
          </>
        )}
      </For>
    </div>
  );
}

export default KeymapEditor;

