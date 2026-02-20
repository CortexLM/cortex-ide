import { Component, For, Show, createSignal, JSX } from "solid-js";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";

export interface AIModification {
  id: string;
  filePath: string;
  description: string;
  additions: number;
  deletions: number;
  diffLines: { type: "added" | "removed" | "unchanged"; content: string; lineNumber: number }[];
  status: "pending" | "accepted" | "rejected";
}

export interface CortexAIModificationsProps {
  modifications: AIModification[];
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onAcceptAll?: () => void;
  onUndoAll?: () => void;
  onReviewFile?: (filePath: string) => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const DIFF_COLORS: Record<"added" | "removed" | "unchanged", { bg: string; prefix: string; textColor: string }> = {
  added: {
    bg: "var(--cortex-diff-added-bg)",
    prefix: "+",
    textColor: "var(--cortex-diff-added-text)",
  },
  removed: {
    bg: "var(--cortex-diff-removed-bg)",
    prefix: "-",
    textColor: "var(--cortex-diff-removed-text)",
  },
  unchanged: {
    bg: "transparent",
    prefix: " ",
    textColor: "var(--cortex-text-primary)",
  },
};

const ModificationDiffLine: Component<{ line: AIModification["diffLines"][0] }> = (props) => {
  const colors = () => DIFF_COLORS[props.line.type];
  return (
    <div style={{ display: "flex", "min-height": "20px", background: colors().bg, "font-family": "var(--cortex-font-mono)", "font-size": "12px", "line-height": "1.6" }}>
      <span style={{ width: "44px", "text-align": "right", padding: "0 8px", color: "var(--cortex-text-secondary)", "user-select": "none", "flex-shrink": "0" }}>
        {props.line.lineNumber}
      </span>
      <span style={{ width: "20px", "text-align": "center", color: colors().textColor, "font-weight": "600", "user-select": "none", "flex-shrink": "0" }}>
        {colors().prefix}
      </span>
      <span style={{ flex: "1", padding: "0 8px", "white-space": "pre", color: colors().textColor, "tab-size": "4" }}>
        {props.line.content}
      </span>
    </div>
  );
};

const FileSection: Component<{
  modification: AIModification;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onReviewFile?: (filePath: string) => void;
}> = (props) => {
  const [expanded, setExpanded] = createSignal(true);

  const fileName = () => {
    const parts = props.modification.filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || props.modification.filePath;
  };

  const isResolved = () => props.modification.status !== "pending";

  return (
    <div style={{
      border: "1px solid var(--cortex-border-default)",
      "border-radius": "var(--cortex-radius-md)",
      overflow: "hidden",
      "margin-bottom": "8px",
    }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "8px 12px",
          background: "var(--cortex-bg-secondary)",
          cursor: "pointer",
          "user-select": "none",
        }}
        onClick={() => setExpanded(!expanded())}
      >
        <CortexIcon
          name={expanded() ? "chevron-down" : "chevron-right"}
          size={12}
          color="var(--cortex-text-inactive)"
        />
        <Show when={isResolved()}>
          <CortexIcon
            name="check"
            size={14}
            color={props.modification.status === "accepted" ? "var(--cortex-success)" : "var(--cortex-text-inactive)"}
          />
        </Show>
        <CortexIcon name="file" size={14} color="var(--cortex-text-secondary)" />
        <span style={{
          flex: "1",
          "font-size": "13px",
          "font-weight": "500",
          color: "var(--cortex-text-primary)",
          "font-family": "var(--cortex-font-sans)",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
        }}>
          {fileName()}
        </span>
        <span style={{ "font-size": "12px", color: "var(--cortex-diff-added-text)", "font-weight": "500" }}>
          +{props.modification.additions}
        </span>
        <span style={{ "font-size": "12px", color: "var(--cortex-diff-removed-text)", "font-weight": "500" }}>
          -{props.modification.deletions}
        </span>
      </div>

      <Show when={expanded()}>
        <div style={{
          "border-top": "1px solid var(--cortex-border-default)",
          "max-height": "300px",
          "overflow-y": "auto",
        }}>
          <For each={props.modification.diffLines}>
            {(line) => <ModificationDiffLine line={line} />}
          </For>
        </div>

        <Show when={props.modification.status === "pending"}>
          <div style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "flex-end",
            gap: "8px",
            padding: "8px 12px",
            "border-top": "1px solid var(--cortex-border-default)",
            background: "var(--cortex-bg-secondary)",
          }}>
            <Show when={props.onReviewFile}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onReviewFile?.(props.modification.filePath);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--cortex-text-secondary)",
                  "font-size": "12px",
                  "font-family": "var(--cortex-font-sans)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  "margin-right": "auto",
                }}
              >
                Review
              </button>
            </Show>
            <CortexButton
              variant="secondary"
              size="xs"
              onClick={() => props.onReject?.(props.modification.id)}
            >
              Reject
            </CortexButton>
            <CortexButton
              variant="primary"
              size="xs"
              onClick={() => props.onAccept?.(props.modification.id)}
            >
              Accept
            </CortexButton>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export const CortexAIModifications: Component<CortexAIModificationsProps> = (props) => {
  const editedCount = () => props.modifications.length;

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        background: "var(--cortex-bg-primary)",
        color: "var(--cortex-text-primary)",
        "font-family": "var(--cortex-font-sans)",
        "border-radius": "var(--cortex-radius-lg)",
        border: "1px solid var(--cortex-border-default)",
        overflow: "hidden",
        ...props.style,
      }}
    >
      <div style={{
        display: "flex",
        "align-items": "center",
        gap: "12px",
        padding: "12px 16px",
        "border-bottom": "1px solid var(--cortex-border-default)",
        background: "var(--cortex-bg-secondary)",
      }}>
        <span style={{ "font-weight": "600", "font-size": "14px", flex: "1" }}>
          AI Modifications
        </span>
        <Show when={editedCount() > 0}>
          <button
            onClick={() => props.onReviewFile?.(props.modifications[0]?.filePath ?? "")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--cortex-text-on-surface)",
              "font-size": "12px",
              "font-family": "var(--cortex-font-sans)",
              cursor: "pointer",
              padding: "4px 8px",
              "text-decoration": "underline",
              "text-underline-offset": "2px",
            }}
          >
            Edited {editedCount()} file{editedCount() !== 1 ? "s" : ""}… Review
          </button>
        </Show>
        <Show when={props.onUndoAll}>
          <button
            onClick={props.onUndoAll}
            style={{
              display: "inline-flex",
              "align-items": "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              color: "var(--cortex-undo-color)",
              "font-size": "12px",
              "font-family": "var(--cortex-font-sans)",
              "font-weight": "500",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            <CortexIcon name="corner-up-left" size={14} color="var(--cortex-undo-color)" />
            Undo Changes
          </button>
        </Show>
      </div>

      <div style={{ flex: "1", overflow: "auto", padding: "12px" }}>
        <For each={props.modifications}>
          {(mod) => (
            <FileSection
              modification={mod}
              onAccept={props.onAccept}
              onReject={props.onReject}
              onReviewFile={props.onReviewFile}
            />
          )}
        </For>

        <Show when={props.modifications.length === 0}>
          <div style={{
            padding: "24px",
            "text-align": "center",
            color: "var(--cortex-text-inactive)",
            "font-size": "13px",
          }}>
            No modifications yet
          </div>
        </Show>
      </div>

      <Show when={props.onAcceptAll && props.modifications.some(m => m.status === "pending")}>
        <div style={{ display: "flex", "justify-content": "flex-end", gap: "8px", padding: "12px 16px", "border-top": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
          <CortexButton variant="primary" size="sm" onClick={props.onAcceptAll}>Accept All</CortexButton>
        </div>
      </Show>
    </div>
  );
};

export default CortexAIModifications;
