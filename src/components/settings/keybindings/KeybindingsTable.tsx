import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { KeybindingSortField, KeybindingSource } from "../../../types/keybindings";
import type { KeybindingTableItem } from "./keybindingsTypes";
import { baseStyles } from "./keybindingsStyles";
import { modalStyles } from "./keybindingsModalStyles";

const styles = { ...baseStyles, ...modalStyles };

export interface KeybindingsTableProps {
  items: () => KeybindingTableItem[];
  handleSort: (field: KeybindingSortField) => void;
  getSortIndicator: (field: KeybindingSortField) => string | null;
  selectedItemId: () => string | null;
  hoveredItemId: () => string | null;
  handleRowClick: (item: KeybindingTableItem) => void;
  handleRowDoubleClick: (item: KeybindingTableItem) => void;
  setHoveredItemId: (id: string | null) => void;
  getSourceBadgeStyle: (source: KeybindingSource) => JSX.CSSProperties;
  onResetBinding?: (commandId: string) => void;
}

export function KeybindingsTable(props: KeybindingsTableProps) {
  return (
    <table style={styles.table}>
      <thead style={styles.tableHeader}>
        <tr>
          <th
            style={{ ...styles.th, ...styles.thCommand }}
            onClick={() => props.handleSort("command")}
          >
            Command
            <span style={styles.sortIndicator}>
              {props.getSortIndicator("command")}
            </span>
          </th>
          <th
            style={{ ...styles.th, ...styles.thKeybinding }}
            onClick={() => props.handleSort("keybinding")}
          >
            Keybinding
            <span style={styles.sortIndicator}>
              {props.getSortIndicator("keybinding")}
            </span>
          </th>
          <th
            style={{ ...styles.th, ...styles.thWhen }}
            onClick={() => props.handleSort("when")}
          >
            When
            <span style={styles.sortIndicator}>
              {props.getSortIndicator("when")}
            </span>
          </th>
          <th
            style={{ ...styles.th, ...styles.thSource }}
            onClick={() => props.handleSort("source")}
          >
            Source
            <span style={styles.sortIndicator}>
              {props.getSortIndicator("source")}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <For each={props.items()}>
          {(item) => (
            <tr
              style={{
                ...styles.tr,
                ...(props.hoveredItemId() === item.id ? styles.trHover : {}),
                ...(props.selectedItemId() === item.id ? styles.trSelected : {}),
              }}
              onClick={() => props.handleRowClick(item)}
              onDblClick={() => props.handleRowDoubleClick(item)}
              onMouseEnter={() => props.setHoveredItemId(item.id)}
              onMouseLeave={() => props.setHoveredItemId(null)}
            >
              <td style={styles.td}>
                <div style={styles.commandCell}>
                  <span style={styles.commandTitle}>
                    {item.category}: {item.commandTitle}
                  </span>
                  <span style={styles.commandId}>{item.command}</span>
                </div>
              </td>
              <td style={styles.td}>
                <div style={styles.keybindingCell}>
                  <Show when={item.keybinding}>
                    <span style={styles.keybindingBadge}>
                      {item.keybinding}
                    </span>
                  </Show>
                  <Show when={item.hasConflict}>
                    <span
                      style={styles.conflictIndicator}
                      title={`Conflicts with: ${item.conflictsWith.join(", ")}`}
                    >
                      {"\u26A0"}
                    </span>
                  </Show>
                </div>
              </td>
              <td style={{ ...styles.td, ...styles.whenCell }}>
                {item.when || "-"}
              </td>
              <td style={styles.td}>
                <div style={styles.sourceCell}>
                  <span style={props.getSourceBadgeStyle(item.source)}>
                    {item.source}
                  </span>
                  <Show when={item.isUserDefined && props.onResetBinding}>
                    <button
                      style={{
                        padding: "2px 4px",
                        border: "none",
                        "border-radius": "var(--cortex-radius-sm)",
                        "background-color": "transparent",
                        color: "var(--vscode-foreground, var(--cortex-text-primary))",
                        cursor: "pointer",
                        "font-size": "14px",
                        opacity: props.hoveredItemId() === item.id ? "0.8" : "0",
                        transition: "opacity 0.1s",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onResetBinding!(item.command);
                      }}
                      title="Reset to default"
                    >
                      {"\u21BA"}
                    </button>
                  </Show>
                </div>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
