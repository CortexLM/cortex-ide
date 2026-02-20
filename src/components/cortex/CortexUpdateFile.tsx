import { Component, For, Show, createMemo, JSX } from "solid-js";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexModal } from "./primitives/CortexModal";

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

export interface CortexUpdateFileProps {
  isOpen: boolean;
  filePath: string;
  oldContent: string;
  newContent: string;
  onAccept?: () => void;
  onReject?: () => void;
  onClose?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const DIFF_LINE_COLORS: Record<DiffLine["type"], { bg: string; border: string; prefix: string; textColor: string }> = {
  added: {
    bg: "var(--cortex-diff-added-bg)",
    border: "var(--cortex-diff-added-border)",
    prefix: "+",
    textColor: "var(--cortex-diff-added-text)",
  },
  removed: {
    bg: "var(--cortex-diff-removed-bg)",
    border: "var(--cortex-diff-removed-border)",
    prefix: "-",
    textColor: "var(--cortex-diff-removed-text)",
  },
  unchanged: {
    bg: "transparent",
    border: "transparent",
    prefix: " ",
    textColor: "var(--cortex-text-primary)",
  },
};

const computeDiffLines = (oldContent: string, newContent: string): DiffLine[] => {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 1;

  const maxLen = Math.max(oldLines.length, newLines.length);
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx < oldLines.length && newIdx < newLines.length) {
      if (oldLines[oldIdx] === newLines[newIdx]) {
        result.push({ type: "unchanged", content: newLines[newIdx], lineNumber: lineNum++ });
        oldIdx++;
        newIdx++;
      } else {
        let foundMatch = false;
        const lookAhead = Math.min(5, maxLen);

        for (let i = 1; i <= lookAhead; i++) {
          if (newIdx + i < newLines.length && oldLines[oldIdx] === newLines[newIdx + i]) {
            for (let j = 0; j < i; j++) {
              result.push({ type: "added", content: newLines[newIdx + j], lineNumber: lineNum++ });
            }
            newIdx += i;
            foundMatch = true;
            break;
          }
          if (oldIdx + i < oldLines.length && oldLines[oldIdx + i] === newLines[newIdx]) {
            for (let j = 0; j < i; j++) {
              result.push({ type: "removed", content: oldLines[oldIdx + j], lineNumber: lineNum++ });
            }
            oldIdx += i;
            foundMatch = true;
            break;
          }
        }

        if (!foundMatch) {
          result.push({ type: "removed", content: oldLines[oldIdx], lineNumber: lineNum++ });
          result.push({ type: "added", content: newLines[newIdx], lineNumber: lineNum++ });
          oldIdx++;
          newIdx++;
        }
      }
    } else if (oldIdx < oldLines.length) {
      result.push({ type: "removed", content: oldLines[oldIdx], lineNumber: lineNum++ });
      oldIdx++;
    } else {
      result.push({ type: "added", content: newLines[newIdx], lineNumber: lineNum++ });
      newIdx++;
    }
  }

  return result;
};

const UpdateDiffLineRow: Component<{ line: DiffLine }> = (props) => {
  const colors = () => DIFF_LINE_COLORS[props.line.type];

  return (
    <div style={{
      display: "flex",
      "min-height": "20px",
      background: colors().bg,
      "border-left": `3px solid ${colors().border}`,
    }}>
      <span style={{
        width: "44px",
        "text-align": "right",
        padding: "0 8px",
        color: "var(--cortex-text-secondary)",
        "user-select": "none",
        "flex-shrink": "0",
      }}>
        {props.line.lineNumber}
      </span>
      <span style={{
        width: "20px",
        "text-align": "center",
        color: colors().textColor,
        "font-weight": "600",
        "user-select": "none",
        "flex-shrink": "0",
      }}>
        {colors().prefix}
      </span>
      <span style={{
        flex: "1",
        padding: "0 8px",
        "white-space": "pre",
        color: colors().textColor,
        "tab-size": "4",
      }}>
        {props.line.content}
      </span>
    </div>
  );
};

export const CortexUpdateFile: Component<CortexUpdateFileProps> = (props) => {
  const diffLines = createMemo(() => computeDiffLines(props.oldContent, props.newContent));
  const additions = createMemo(() => diffLines().filter(l => l.type === "added").length);
  const deletions = createMemo(() => diffLines().filter(l => l.type === "removed").length);

  const fileName = () => {
    const parts = props.filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || props.filePath;
  };

  const dirPath = () => {
    const parts = props.filePath.replace(/\\/g, "/").split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  };

  const handleClose = () => {
    props.onClose?.();
  };

  const header = (
    <div style={{
      display: "flex",
      "align-items": "center",
      gap: "10px",
      flex: "1",
      "min-width": "0",
    }}>
      <CortexIcon name="file" size={18} color="var(--cortex-text-secondary)" />
      <div style={{ flex: "1", "min-width": "0" }}>
        <div style={{
          "font-weight": "600",
          "font-size": "14px",
          color: "var(--cortex-text-primary)",
        }}>
          {fileName()}
        </div>
        <Show when={dirPath()}>
          <div style={{
            "font-size": "12px",
            color: "var(--cortex-text-inactive)",
            "margin-top": "2px",
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
          }}>
            {dirPath()}
          </div>
        </Show>
      </div>
    </div>
  );

  const footer = (
    <div style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      width: "100%",
    }}>
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        "font-size": "12px",
      }}>
        <span style={{ color: "var(--cortex-diff-added-text)", "font-weight": "500" }}>+{additions()}</span>
        <span style={{ color: "var(--cortex-diff-removed-text)", "font-weight": "500" }}>-{deletions()}</span>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <CortexButton variant="secondary" size="sm" onClick={props.onReject}>
          Reject
        </CortexButton>
        <CortexButton variant="primary" size="sm" onClick={props.onAccept}>
          Accept Changes
        </CortexButton>
      </div>
    </div>
  );

  return (
    <CortexModal
      open={props.isOpen}
      onClose={handleClose}
      size="lg"
      header={header}
      footer={footer}
      showFooter={true}
      class={props.class}
      style={props.style}
    >
      <div style={{
        "font-family": "var(--cortex-font-mono)",
        "font-size": "12px",
        "line-height": "1.6",
        margin: "-20px -24px",
        "max-height": "60vh",
        "overflow-y": "auto",
      }}>
        <For each={diffLines()}>
          {(line) => <UpdateDiffLineRow line={line} />}
        </For>
        <Show when={diffLines().length === 0}>
          <div style={{
            padding: "24px",
            "text-align": "center",
            color: "var(--cortex-text-inactive)",
            "font-family": "var(--cortex-font-sans)",
            "font-size": "13px",
          }}>
            No changes detected
          </div>
        </Show>
      </div>
    </CortexModal>
  );
};

export default CortexUpdateFile;
