import { createSignal, createMemo, For, Show, onMount, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { useKeymap, Keystroke, Keybinding } from "../../../context/KeymapContext";
import { KeybindingSource, KeybindingSortField, KeybindingSortOrder, RecordedKey } from "../../../types/keybindings";
import type { KeybindingTableItem, FilterSource } from "./keybindingsTypes";
import { baseStyles } from "./keybindingsStyles";
import { modalStyles } from "./keybindingsModalStyles";
import { formatRecordedKey, buildConflictsMap, buildTableItems } from "./keybindingsHelpers";
import { KeybindingEditModal } from "./KeybindingEditModal";
import { KeybindingsTable } from "./KeybindingsTable";

const styles = { ...baseStyles, ...modalStyles };

export function KeybindingsEditor() {
  const keymap = useKeymap();

  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchByKeybinding, setSearchByKeybinding] = createSignal(false);
  const [sortField, setSortField] = createSignal<KeybindingSortField>("command");
  const [sortOrder, setSortOrder] = createSignal<KeybindingSortOrder>("asc");
  const [filterSource, setFilterSource] = createSignal<FilterSource>("all");
  const [selectedItemId, setSelectedItemId] = createSignal<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = createSignal<string | null>(null);
  const [editModalOpen, setEditModalOpen] = createSignal(false);
  const [editingItem, setEditingItem] = createSignal<KeybindingTableItem | null>(null);
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordedKeys, setRecordedKeys] = createSignal<RecordedKey[]>([]);
  const [editWhenClause, setEditWhenClause] = createSignal("");
  const [editConflicts, setEditConflicts] = createSignal<string[]>([]);
  const [isRecordingSearch, setIsRecordingSearch] = createSignal(false);
  const [recordedSearchKeys, setRecordedSearchKeys] = createSignal<RecordedKey[]>([]);
  const [showConflictSuggestions, setShowConflictSuggestions] = createSignal(false);
  const [importExportStatus, setImportExportStatus] = createSignal<string | null>(null);

  const conflictsMap = createMemo(() => buildConflictsMap(keymap.bindings(), keymap.formatKeybinding));
  const tableItems = createMemo(() => buildTableItems(keymap.bindings(), conflictsMap(), keymap.formatKeybinding));

  const filteredAndSortedItems = createMemo(() => {
    let items = tableItems();
    const query = searchQuery().toLowerCase();
    const filter = filterSource();
    const byKey = searchByKeybinding();
    if (query) {
      items = items.filter((item) =>
        byKey
          ? item.keybinding.toLowerCase().includes(query)
          : item.commandTitle.toLowerCase().includes(query) ||
            item.command.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
      );
    }
    if (filter !== "all") {
      items = items.filter((item) => {
        if (filter === "user") return item.isUserDefined;
        if (filter === "default") return item.isDefault;
        if (filter === "extension") return item.source === "extension";
        return true;
      });
    }
    const field = sortField();
    const order = sortOrder();
    items = [...items].sort((a, b) => {
      let cmp = 0;
      switch (field) {
        case "command": cmp = a.commandTitle.localeCompare(b.commandTitle); break;
        case "keybinding": cmp = a.keybinding.localeCompare(b.keybinding); break;
        case "when": cmp = a.when.localeCompare(b.when); break;
        case "source": cmp = a.source.localeCompare(b.source); break;
      }
      return order === "asc" ? cmp : -cmp;
    });
    return items;
  });

  const handleSort = (field: KeybindingSortField) => {
    if (sortField() === field) { setSortOrder((p) => (p === "asc" ? "desc" : "asc")); }
    else { setSortField(field); setSortOrder("asc"); }
  };

  const getSortIndicator = (field: KeybindingSortField) => {
    if (sortField() !== field) return null;
    return sortOrder() === "asc" ? "\u25B2" : "\u25BC";
  };

  const openEditModal = (item: KeybindingTableItem) => {
    setEditingItem(item); setEditWhenClause(item.when);
    setRecordedKeys([]); setIsRecording(false); setEditConflicts([]); setEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditModalOpen(false); setEditingItem(null); setIsRecording(false);
    setRecordedKeys([]); setEditWhenClause(""); setEditConflicts([]);
  };

  const startRecording = () => { setIsRecording(true); setRecordedKeys([]); setEditConflicts([]); };
  const stopRecording = () => { setIsRecording(false); checkForConflicts(); };

  const checkForConflicts = () => {
    const keys = recordedKeys();
    if (keys.length === 0) { setEditConflicts([]); return; }
    const keyStr = keys.map(formatRecordedKey).join(" ");
    const ei = editingItem();
    setEditConflicts(
      tableItems()
        .filter((item) => item.id !== ei?.id && item.keybinding.toLowerCase() === keyStr.toLowerCase())
        .map((item) => item.commandTitle)
    );
  };

  const startRecordingSearch = () => {
    setIsRecordingSearch(true);
    setRecordedSearchKeys([]);
    setSearchByKeybinding(true);
  };

  const stopRecordingSearch = () => {
    setIsRecordingSearch(false);
    const keys = recordedSearchKeys();
    if (keys.length > 0) {
      setSearchQuery(keys.map(formatRecordedKey).join(" ").toLowerCase());
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isRecordingSearch()) {
      if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const rk: RecordedKey = {
        code: event.code, key: event.key, ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey, timestamp: Date.now(),
      };
      setRecordedSearchKeys((prev) => (prev.length >= 2 ? [rk] : [...prev, rk]));
      setTimeout(() => stopRecordingSearch(), 500);
      return;
    }
    if (!isRecording()) return;
    if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const rk: RecordedKey = {
      code: event.code, key: event.key, ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey, timestamp: Date.now(),
    };
    setRecordedKeys((prev) => (prev.length >= 2 ? [rk] : [...prev, rk]));
    setTimeout(checkForConflicts, 100);
  };

  const saveEdit = () => {
    const item = editingItem();
    if (!item) return;
    const keys = recordedKeys();
    if (keys.length > 0) {
      const keystrokes: Keystroke[] = keys.map((k) => ({
        key: k.key, modifiers: { ctrl: k.ctrlKey, alt: k.altKey, shift: k.shiftKey, meta: k.metaKey },
      }));
      keymap.setCustomBinding(item.command, { keystrokes } as Keybinding);
    }
    const newWhen = editWhenClause().trim();
    if (newWhen !== item.when) keymap.setCustomWhen(item.command, newWhen || null);
    closeEditModal();
  };

  const resetToDefault = () => { const i = editingItem(); if (i) { keymap.resetToDefault(i.command); closeEditModal(); } };
  const removeKeybinding = () => { const i = editingItem(); if (i) { keymap.setCustomBinding(i.command, null); closeEditModal(); } };
  const addKeybinding = () => { const s = selectedItemId(); if (!s) return; const i = tableItems().find((x) => x.id === s); if (i) openEditModal(i); };
  const removeSelectedKeybinding = () => { const s = selectedItemId(); if (s) keymap.setCustomBinding(s, null); };
  const resetSelectedToDefault = () => { const s = selectedItemId(); if (s) keymap.resetToDefault(s); };
  const resetAllToDefaults = () => { keymap.resetAllToDefault(); };

  const handleResetBinding = (commandId: string) => { keymap.resetToDefault(commandId); };

  const handleImportFromFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath && typeof filePath === "string") {
        const entries = await invoke<any[]>("import_keybindings", { path: filePath });
        if (entries && entries.length > 0) {
          setImportExportStatus(`Imported ${entries.length} keybindings`);
          setTimeout(() => setImportExportStatus(null), 3000);
        }
      }
    } catch (e) {
      setImportExportStatus("Import failed");
      setTimeout(() => setImportExportStatus(null), 3000);
    }
  };

  const handleExportToFile = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const filePath = await save({
        defaultPath: "keybindings.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (filePath) {
        const allItems = tableItems();
        const entries = allItems.map(item => ({
          command: item.command,
          key: item.keybinding,
          when: item.when || null,
          source: item.source,
        }));
        await invoke("export_keybindings", { path: filePath, bindings: entries });
        setImportExportStatus(`Exported ${entries.length} keybindings`);
        setTimeout(() => setImportExportStatus(null), 3000);
      }
    } catch (e) {
      setImportExportStatus("Export failed");
      setTimeout(() => setImportExportStatus(null), 3000);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    onCleanup(() => { window.removeEventListener("keydown", handleKeyDown, true); });
  });

  const getSourceBadgeStyle = (source: KeybindingSource) => {
    switch (source) {
      case "user": return { ...styles.sourceBadge, ...styles.sourceBadgeUser };
      case "extension": return { ...styles.sourceBadge, ...styles.sourceBadgeExtension };
      default: return { ...styles.sourceBadge, ...styles.sourceBadgeDefault };
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.searchContainer}>
          <input
            type="text"
            placeholder={searchByKeybinding() ? "Search by keybinding..." : "Search commands..."}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            style={styles.searchInput}
          />
          <span style={styles.searchIcon}>{"\uD83D\uDD0D"}</span>
        </div>
        <button
          style={{ ...styles.filterButton, ...(searchByKeybinding() ? styles.filterButtonActive : {}) }}
          onClick={() => setSearchByKeybinding((prev) => !prev)}
          title="Toggle search by keybinding"
        >
          {"\u2328"}
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(isRecordingSearch() ? styles.filterButtonActive : {}),
            ...(isRecordingSearch() ? { "border-color": "var(--vscode-errorForeground, var(--cortex-error))" } : {}),
          }}
          onClick={() => (isRecordingSearch() ? stopRecordingSearch() : startRecordingSearch())}
          title={isRecordingSearch() ? "Stop recording keys" : "Record keys to search"}
        >
          {isRecordingSearch() ? "\u23F9 Recording..." : "\uD83C\uDFB9 Record Keys"}
        </button>
        <div style={styles.filterContainer}>
          <For each={["all", "user", "default", "extension"] as FilterSource[]}>
            {(filter) => (
              <button
                style={{ ...styles.filterButton, ...(filterSource() === filter ? styles.filterButtonActive : {}) }}
                onClick={() => setFilterSource(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            )}
          </For>
        </div>
        <div style={styles.actionButtons}>
          <button style={{ ...styles.actionButton, ...styles.primaryButton }} onClick={addKeybinding} disabled={!selectedItemId()} title="Add/Edit Keybinding">+ Add</button>
          <button style={styles.actionButton} onClick={removeSelectedKeybinding} disabled={!selectedItemId()} title="Remove Keybinding">- Remove</button>
          <button style={styles.actionButton} onClick={resetSelectedToDefault} disabled={!selectedItemId()} title="Reset to Default">{"\u21BA"} Reset</button>
          <button style={{ ...styles.actionButton, ...styles.dangerButton }} onClick={resetAllToDefaults} title="Reset all keybindings to defaults">{"\u21BA"} Reset All</button>
          <button style={styles.actionButton} onClick={handleImportFromFile} title="Import keybindings from file">{"\uD83D\uDCE5"} Import</button>
          <button style={styles.actionButton} onClick={handleExportToFile} title="Export keybindings to file">{"\uD83D\uDCE4"} Export</button>
        </div>
        <Show when={isRecording()}>
          <span style={{ display: "flex", "align-items": "center", gap: "4px", color: "var(--vscode-errorForeground, var(--cortex-error))" }}>
            <span style={{ width: "8px", height: "8px", "border-radius": "50%", background: "var(--vscode-errorForeground, var(--cortex-error))", animation: "pulse 1s infinite" }} />
            Recording...
          </span>
        </Show>
      </div>

      <div style={styles.tableContainer}>
        <Show
          when={filteredAndSortedItems().length > 0}
          fallback={
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>{"\u2328"}</div>
              <div>No keybindings found</div>
              <div style={{ "font-size": "12px", "margin-top": "4px" }}>Try adjusting your search or filters</div>
            </div>
          }
        >
          <KeybindingsTable
            items={filteredAndSortedItems}
            handleSort={handleSort}
            getSortIndicator={getSortIndicator}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            handleRowClick={(item) => setSelectedItemId(item.id)}
            handleRowDoubleClick={openEditModal}
            setHoveredItemId={setHoveredItemId}
            getSourceBadgeStyle={getSourceBadgeStyle}
            onResetBinding={handleResetBinding}
          />
        </Show>
      </div>

      <div style={styles.statusBar}>
        <span>{filteredAndSortedItems().length} of {tableItems().length} keybindings</span>
        <span>
          {conflictsMap().size > 0 && (
            <span style={{ color: "var(--vscode-errorForeground, var(--cortex-error))", cursor: "pointer" }} onClick={() => setShowConflictSuggestions((p) => !p)}>
              {"\u26A0"} {conflictsMap().size} conflict(s) detected {showConflictSuggestions() ? "\u25BC" : "\u25B6"}
            </span>
          )}
        </span>
        <Show when={importExportStatus()}>
          <span style={{ color: "var(--jb-border-focus)" }}>{importExportStatus()}</span>
        </Show>
      </div>

      <KeybindingEditModal
        editModalOpen={editModalOpen} editingItem={editingItem}
        isRecording={isRecording} recordedKeys={recordedKeys}
        editWhenClause={editWhenClause} editConflicts={editConflicts}
        setEditWhenClause={setEditWhenClause} closeEditModal={closeEditModal}
        startRecording={startRecording} stopRecording={stopRecording}
        saveEdit={saveEdit} resetToDefault={resetToDefault} removeKeybinding={removeKeybinding}
      />
    </div>
  );
}

export default KeybindingsEditor;
