import { Component, For, Show, createSignal, createMemo } from "solid-js";
import { CortexModal, CortexButton, CortexIcon } from "@/components/cortex/primitives";

export interface CodeActionEdit {
  filePath: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  newText: string;
  originalText?: string;
}

export interface CodeActionPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  title: string;
  description?: string;
  edits: CodeActionEdit[];
  isApplying?: boolean;
}

export const CodeActionPreviewDialog: Component<CodeActionPreviewDialogProps> = (props) => {
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);

  const affectedFiles = createMemo(() => {
    const files = new Map<string, CodeActionEdit[]>();
    for (const edit of props.edits) {
      const existing = files.get(edit.filePath) || [];
      existing.push(edit);
      files.set(edit.filePath, existing);
    }
    return Array.from(files.entries());
  });

  const totalEdits = createMemo(() => props.edits.length);

  const selectedEdits = createMemo(() => {
    const file = selectedFile();
    if (!file) return props.edits;
    return props.edits.filter((e) => e.filePath === file);
  });

  const fileName = (path: string) => path.split("/").pop() || path;

  return (
    <CortexModal
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      size="lg"
      closable
      closeOnEscape
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "16px", padding: "8px 0" }}>
        <Show when={props.description}>
          <div style={{
            "font-size": "13px",
            color: "var(--cortex-text-muted)",
            padding: "0 4px",
          }}>
            {props.description}
          </div>
        </Show>

        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          background: "var(--cortex-bg-secondary)",
          "border-radius": "var(--cortex-radius-sm)",
          "font-size": "12px",
          color: "var(--cortex-text-muted)",
        }}>
          <CortexIcon name="edit" size={14} />
          <span>{totalEdits()} edit{totalEdits() !== 1 ? "s" : ""} across {affectedFiles().length} file{affectedFiles().length !== 1 ? "s" : ""}</span>
        </div>

        <Show when={affectedFiles().length > 1}>
          <div style={{ display: "flex", gap: "4px", "flex-wrap": "wrap" }}>
            <button
              style={{
                padding: "4px 8px",
                "font-size": "11px",
                "border-radius": "var(--cortex-radius-sm)",
                border: "none",
                cursor: "pointer",
                background: selectedFile() === null ? "var(--cortex-accent-primary)" : "var(--cortex-bg-secondary)",
                color: selectedFile() === null ? "var(--cortex-bg-primary)" : "var(--cortex-text-primary)",
              }}
              onClick={() => setSelectedFile(null)}
            >
              All files
            </button>
            <For each={affectedFiles()}>
              {([path]) => (
                <button
                  style={{
                    padding: "4px 8px",
                    "font-size": "11px",
                    "border-radius": "var(--cortex-radius-sm)",
                    border: "none",
                    cursor: "pointer",
                    background: selectedFile() === path ? "var(--cortex-accent-primary)" : "var(--cortex-bg-secondary)",
                    color: selectedFile() === path ? "var(--cortex-bg-primary)" : "var(--cortex-text-primary)",
                  }}
                  onClick={() => setSelectedFile(path)}
                  title={path}
                >
                  {fileName(path)}
                </button>
              )}
            </For>
          </div>
        </Show>

        <div style={{
          "max-height": "400px",
          overflow: "auto",
          "border-radius": "var(--cortex-radius-md)",
          border: "1px solid var(--cortex-border-default)",
        }}>
          <For each={selectedEdits()}>
            {(edit) => (
              <div style={{
                padding: "8px 12px",
                "border-bottom": "1px solid var(--cortex-border-default)",
                "font-family": "var(--cortex-font-mono)",
                "font-size": "12px",
              }}>
                <div style={{
                  "font-size": "11px",
                  color: "var(--cortex-text-muted)",
                  "margin-bottom": "4px",
                }}>
                  {edit.filePath} (L{edit.range.startLine}:{edit.range.startColumn})
                </div>
                <Show when={edit.originalText}>
                  <div style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    color: "var(--cortex-error)",
                    padding: "4px 8px",
                    "border-radius": "2px",
                    "margin-bottom": "2px",
                    "white-space": "pre-wrap",
                    "word-break": "break-all",
                  }}>
                    - {edit.originalText}
                  </div>
                </Show>
                <Show when={edit.newText}>
                  <div style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    color: "var(--cortex-success)",
                    padding: "4px 8px",
                    "border-radius": "2px",
                    "white-space": "pre-wrap",
                    "word-break": "break-all",
                  }}>
                    + {edit.newText}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>

        <div style={{ display: "flex", "justify-content": "flex-end", gap: "8px" }}>
          <CortexButton variant="secondary" onClick={props.onClose}>
            Cancel
          </CortexButton>
          <CortexButton
            variant="primary"
            onClick={props.onApply}
            loading={props.isApplying}
            icon="check"
          >
            Apply Changes
          </CortexButton>
        </div>
      </div>
    </CortexModal>
  );
};

export default CodeActionPreviewDialog;
