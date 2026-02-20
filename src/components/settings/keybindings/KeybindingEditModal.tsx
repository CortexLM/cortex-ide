import { Show, For } from "solid-js";
import type { Accessor, Setter } from "solid-js";
import type { RecordedKey } from "../../../types/keybindings";
import type { KeybindingTableItem } from "./keybindingsTypes";
import { baseStyles } from "./keybindingsStyles";
import { modalStyles } from "./keybindingsModalStyles";
import { formatRecordedKey } from "./keybindingsHelpers";

const styles = { ...baseStyles, ...modalStyles };

export interface KeybindingEditModalProps {
  editModalOpen: Accessor<boolean>;
  editingItem: Accessor<KeybindingTableItem | null>;
  isRecording: Accessor<boolean>;
  recordedKeys: Accessor<RecordedKey[]>;
  editWhenClause: Accessor<string>;
  editConflicts: Accessor<string[]>;
  setEditWhenClause: Setter<string>;
  closeEditModal: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  saveEdit: () => void;
  resetToDefault: () => void;
  removeKeybinding: () => void;
}

export function KeybindingEditModal(props: KeybindingEditModalProps) {
  return (
    <Show when={props.editModalOpen()}>
      <div style={styles.modalOverlay} onClick={props.closeEditModal}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.modalTitle}>
            Edit Keybinding: {props.editingItem()?.commandTitle}
          </div>

          <div style={styles.modalField}>
            <label style={styles.modalLabel}>Keybinding</label>
            <div
              style={{
                ...styles.recordButton,
                ...(props.isRecording() ? styles.recordButtonRecording : {}),
              }}
              onClick={() => (props.isRecording() ? props.stopRecording() : props.startRecording())}
              tabIndex={0}
            >
              <Show
                when={props.recordedKeys().length > 0}
                fallback={
                  <span>
                    {props.isRecording()
                      ? "Press keys... (click to stop)"
                      : "Click to record keys"}
                  </span>
                }
              >
                <div style={styles.recordedKeys}>
                  <For each={props.recordedKeys()}>
                    {(key, index) => (
                      <>
                        <span style={styles.recordedKey}>
                          {formatRecordedKey(key)}
                        </span>
                        <Show when={index() < props.recordedKeys().length - 1}>
                          <span style={{ opacity: 0.5 }}>{"\u2192"}</span>
                        </Show>
                      </>
                    )}
                  </For>
                </div>
              </Show>
              <Show when={props.isRecording()}>
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    "border-radius": "var(--cortex-radius-full)",
                    "background-color": "var(--vscode-errorForeground, var(--cortex-error))",
                    animation: "pulse 1s infinite",
                  }}
                />
              </Show>
            </div>

            <Show when={props.editingItem()?.keybinding && props.recordedKeys().length === 0}>
              <div
                style={{
                  "margin-top": "4px",
                  "font-size": "11px",
                  opacity: "0.7",
                }}
              >
                Current: {props.editingItem()?.keybinding}
              </div>
            </Show>
          </div>

          <div style={styles.modalField}>
            <label style={styles.modalLabel}>When Clause (optional)</label>
            <input
              type="text"
              value={props.editWhenClause()}
              onInput={(e) => props.setEditWhenClause(e.currentTarget.value)}
              placeholder="e.g., editorTextFocus && !suggestWidgetVisible"
              style={styles.modalInput}
            />
            <div
              style={{
                "margin-top": "4px",
                "font-size": "11px",
                opacity: "0.7",
              }}
            >
              Conditions when this keybinding is active
            </div>
          </div>

          <Show when={props.editConflicts().length > 0}>
            <div style={styles.conflictWarning}>
              <span>{"\u26A0"}</span>
              <span>
                Conflicts with: {props.editConflicts().join(", ")}
              </span>
            </div>
          </Show>

          <div style={styles.modalActions}>
            <button
              style={{ ...styles.actionButton, ...styles.dangerButton }}
              onClick={props.removeKeybinding}
            >
              Remove
            </button>
            <button style={styles.actionButton} onClick={props.resetToDefault}>
              Reset to Default
            </button>
            <button style={styles.actionButton} onClick={props.closeEditModal}>
              Cancel
            </button>
            <button
              style={{ ...styles.actionButton, ...styles.primaryButton }}
              onClick={props.saveEdit}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </Show>
  );
}
