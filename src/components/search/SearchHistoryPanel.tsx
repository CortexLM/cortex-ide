import { Component, For, Show, createSignal, createMemo, JSX } from "solid-js";
import { useSearch, useSearchHistory, SearchHistoryEntry } from "@/context/SearchContext";
import { CortexButton, CortexIcon, CortexTooltip } from "@/components/cortex/primitives";

export interface SearchHistoryPanelProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const SearchHistoryPanel: Component<SearchHistoryPanelProps> = (props) => {
  const search = useSearch();
  const history = useSearchHistory();
  const [filterText, setFilterText] = createSignal("");

  const filteredHistory = createMemo(() => {
    const entries = history.history();
    const filter = filterText().toLowerCase();
    if (!filter) return entries;
    return entries.filter(
      (e) =>
        e.query.pattern.toLowerCase().includes(filter) ||
        e.query.replacePattern?.toLowerCase().includes(filter)
    );
  });

  const handleLoadEntry = (entry: SearchHistoryEntry) => {
    history.load(entry.id);
  };

  const handleRemoveEntry = (e: MouseEvent, entry: SearchHistoryEntry) => {
    e.stopPropagation();
    history.remove(entry.id);
  };

  const handleClearAll = () => {
    history.clear();
  };

  const handlePersist = async () => {
    await search.persistHistory();
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        ...(props.style || {}),
      }}
      class={props.class}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          "border-bottom": "1px solid var(--border-primary, #313244)",
        }}
      >
        <CortexIcon name="history" size={14} style={{ color: "var(--text-secondary, #a6adc8)" }} />
        <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--text-primary, #cdd6f4)", flex: "1" }}>
          Search History
        </span>
        <CortexTooltip content="Save history to disk" position="bottom">
          <CortexButton variant="ghost" size="xs" onClick={handlePersist} icon="save" />
        </CortexTooltip>
        <CortexTooltip content="Clear all history" position="bottom">
          <CortexButton variant="ghost" size="xs" onClick={handleClearAll} icon="trash-2" disabled={filteredHistory().length === 0} />
        </CortexTooltip>
      </div>

      <div style={{ padding: "8px" }}>
        <input
          type="text"
          placeholder="Filter history..."
          value={filterText()}
          onInput={(e) => setFilterText(e.currentTarget.value)}
          style={{
            width: "100%", padding: "6px 8px", "font-size": "12px",
            "background-color": "var(--bg-primary, #11111b)", border: "1px solid var(--border-primary, #313244)",
            "border-radius": "4px", color: "var(--text-primary, #cdd6f4)", outline: "none", "box-sizing": "border-box",
          }}
        />
      </div>

      <div style={{ flex: "1", "overflow-y": "auto", padding: "0 4px 4px" }}>
        <For each={filteredHistory()}>
          {(entry) => (
            <div
              style={{
                display: "flex", "align-items": "flex-start", gap: "8px", padding: "8px 8px",
                margin: "0 4px 2px", "border-radius": "6px", cursor: "pointer", transition: "background-color 0.15s",
              }}
              onClick={() => handleLoadEntry(entry)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover, #262637)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <CortexIcon
                name={entry.query.replacePattern ? "replace" : "search"}
                size={14}
                style={{ color: "var(--text-secondary, #a6adc8)", "margin-top": "2px", "flex-shrink": "0" }}
              />
              <div style={{ flex: "1", "min-width": "0" }}>
                <div style={{
                  "font-size": "13px", color: "var(--text-primary, #cdd6f4)",
                  overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
                }}>
                  <code style={{ "font-family": "var(--font-mono, monospace)" }}>{entry.query.pattern}</code>
                </div>
                <Show when={entry.query.replacePattern}>
                  <div style={{
                    "font-size": "11px", color: "var(--text-secondary, #a6adc8)",
                    overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap", "margin-top": "2px",
                  }}>
                    → <code style={{ "font-family": "var(--font-mono, monospace)" }}>{entry.query.replacePattern}</code>
                  </div>
                </Show>
                <div style={{ display: "flex", gap: "8px", "margin-top": "4px", "font-size": "11px", color: "var(--text-tertiary, #6c7086)" }}>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                  <span>{entry.resultsCount} files</span>
                  <span>{formatDuration(entry.duration)}</span>
                  <Show when={entry.query.options.useRegex}>
                    <span style={{ color: "var(--color-accent, #89b4fa)" }}>regex</span>
                  </Show>
                  <Show when={entry.query.options.caseSensitive}>
                    <span>Aa</span>
                  </Show>
                </div>
              </div>
              <CortexButton
                variant="ghost"
                size="xs"
                onClick={(e: MouseEvent) => handleRemoveEntry(e, entry)}
                icon="x"
                title="Remove from history"
              />
            </div>
          )}
        </For>

        <Show when={filteredHistory().length === 0}>
          <div style={{
            display: "flex", "flex-direction": "column", "align-items": "center",
            gap: "8px", padding: "32px 16px", color: "var(--text-secondary, #a6adc8)",
          }}>
            <CortexIcon name="search" size={24} style={{ opacity: "0.4" }} />
            <span style={{ "font-size": "13px" }}>
              {filterText() ? "No matching history entries" : "No search history yet"}
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default SearchHistoryPanel;
