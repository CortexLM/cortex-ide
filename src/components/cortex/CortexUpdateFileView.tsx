import { Component, For, Show, createSignal, createResource, createMemo } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";
import { highlightCode, detectLanguageFromPath } from "@/utils/shikiHighlighter";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber?: number;
}

export interface FileUpdate {
  filePath: string;
  oldContent: string;
  newContent: string;
  diffLines: DiffLine[];
  timestamp?: Date;
}

export interface CortexUpdateFileViewProps {
  update: FileUpdate;
  onAccept?: () => void;
  onReject?: () => void;
  onClose?: () => void;
}

const LINE_COLORS: Record<DiffLine["type"], { bg: string; border: string; prefix: string; textColor: string }> = {
  added: { bg: "var(--cortex-diff-added-bg)", border: "var(--cortex-diff-added-border)", prefix: "+", textColor: "var(--cortex-diff-added-text)" },
  removed: { bg: "var(--cortex-diff-removed-bg)", border: "var(--cortex-diff-removed-border)", prefix: "-", textColor: "var(--cortex-diff-removed-text)" },
  unchanged: { bg: "transparent", border: "transparent", prefix: " ", textColor: "var(--cortex-text-primary)" },
};

const HighlightedDiffLine: Component<{ line: DiffLine; lineIndex: number; highlighted?: string }> = (props) => {
  const colors = () => LINE_COLORS[props.line.type];
  return (
    <div style={{ display: "flex", "min-height": "20px", background: colors().bg, "border-left": `3px solid ${colors().border}` }}>
      <span style={{ width: "44px", "text-align": "right", padding: "0 8px", color: "var(--cortex-text-secondary)", "user-select": "none", "flex-shrink": "0", "font-family": "var(--cortex-font-mono)", "font-size": "12px", "line-height": "1.6" }}>
        {props.line.lineNumber ?? props.lineIndex + 1}
      </span>
      <span style={{ width: "20px", "text-align": "center", color: colors().textColor, "font-weight": "600", "user-select": "none", "flex-shrink": "0", "font-family": "var(--cortex-font-mono)", "font-size": "12px", "line-height": "1.6" }}>
        {colors().prefix}
      </span>
      <Show
        when={props.highlighted}
        fallback={
          <span style={{ flex: "1", padding: "0 8px", "white-space": "pre", color: colors().textColor, "tab-size": "4", "font-family": "var(--cortex-font-mono)", "font-size": "12px", "line-height": "1.6" }}>
            {props.line.content}
          </span>
        }
      >
        <span
          style={{ flex: "1", padding: "0 8px", "white-space": "pre", "tab-size": "4", "font-size": "12px", "line-height": "1.6" }}
          innerHTML={props.highlighted}
        />
      </Show>
    </div>
  );
};

export const CortexUpdateFileView: Component<CortexUpdateFileViewProps> = (props) => {
  const [showFullDiff, setShowFullDiff] = createSignal(false);
  const [isApplying, setIsApplying] = createSignal(false);

  const additions = () => props.update.diffLines.filter((l) => l.type === "added").length;
  const deletions = () => props.update.diffLines.filter((l) => l.type === "removed").length;

  const visibleLines = () => (showFullDiff() ? props.update.diffLines : props.update.diffLines.slice(0, 50));

  const fileName = () => {
    const parts = props.update.filePath.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || props.update.filePath;
  };

  const dirPath = () => {
    const parts = props.update.filePath.replace(/\\/g, "/").split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
  };

  const language = createMemo(() => detectLanguageFromPath(props.update.filePath));

  const codeForHighlight = createMemo(() =>
    visibleLines()
      .map((l) => l.content)
      .join("\n")
  );

  const [highlighted] = createResource(
    () => ({ code: codeForHighlight(), lang: language() }),
    async ({ code, lang }) => {
      if (!code || lang === "plaintext") return null;
      try {
        const html = await highlightCode(code, lang);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const codeEl = doc.querySelector("code");
        if (!codeEl) return null;
        const lines: string[] = [];
        const raw = codeEl.innerHTML.split("\n");
        for (const line of raw) lines.push(line);
        return lines;
      } catch {
        return null;
      }
    }
  );

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await invoke("fs_write_file", { path: props.update.filePath, content: props.update.newContent });
      props.onAccept?.();
    } catch {
      // noop
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscard = () => {
    props.onReject?.();
  };

  return (
    <div style={{ display: "flex", "flex-direction": "column", height: "100%", background: "var(--cortex-bg-primary)", color: "var(--cortex-text-primary)", "font-family": "var(--cortex-font-sans)", "border-radius": "var(--cortex-radius-lg)", border: "1px solid var(--cortex-border-default)", overflow: "hidden" }}>
      {/* Header: file path + stats */}
      <div style={{ display: "flex", "align-items": "center", gap: "12px", padding: "12px 16px", "border-bottom": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
        <CortexIcon name="file" size={16} color="var(--cortex-text-secondary)" />
        <div style={{ flex: "1", "min-width": "0" }}>
          <div style={{ "font-weight": "600", "font-size": "14px" }}>{fileName()}</div>
          <Show when={dirPath()}>
            <div style={{ "font-size": "11px", color: "var(--cortex-text-inactive)", "margin-top": "2px", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{dirPath()}</div>
          </Show>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "flex-shrink": "0" }}>
          <span style={{ "font-size": "12px", color: "var(--cortex-diff-added-text)", "font-weight": "500" }}>+{additions()}</span>
          <span style={{ "font-size": "12px", color: "var(--cortex-diff-removed-text)", "font-weight": "500" }}>-{deletions()}</span>
        </div>
        <Show when={props.onClose}>
          <button onClick={props.onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}>
            <CortexIcon name="xmark" size={14} color="var(--cortex-text-muted)" />
          </button>
        </Show>
      </div>

      {/* Diff content with syntax highlighting */}
      <div style={{ flex: "1", overflow: "auto" }}>
        <For each={visibleLines()}>
          {(line, index) => {
            const hl = () => {
              const lines = highlighted();
              if (!lines || index() >= lines.length) return undefined;
              return lines[index()];
            };
            return <HighlightedDiffLine line={line} lineIndex={index()} highlighted={hl()} />;
          }}
        </For>
        <Show when={!showFullDiff() && props.update.diffLines.length > 50}>
          <button
            onClick={() => setShowFullDiff(true)}
            style={{ width: "100%", padding: "8px", background: "var(--cortex-bg-secondary)", border: "none", "border-top": "1px solid var(--cortex-border-default)", color: "var(--cortex-accent-primary)", "font-size": "12px", cursor: "pointer", "font-family": "var(--cortex-font-sans)" }}
          >
            Show {props.update.diffLines.length - 50} more lines...
          </button>
        </Show>
      </div>

      {/* Footer: timestamp + actions */}
      <div style={{ display: "flex", "align-items": "center", "justify-content": "flex-end", gap: "8px", padding: "12px 16px", "border-top": "1px solid var(--cortex-border-default)", background: "var(--cortex-bg-secondary)" }}>
        <Show when={props.update.timestamp}>
          <span style={{ flex: "1", "font-size": "11px", color: "var(--cortex-text-tertiary)" }}>
            Updated {props.update.timestamp?.toLocaleString()}
          </span>
        </Show>
        <CortexButton variant="secondary" size="sm" onClick={handleDiscard}>
          Discard
        </CortexButton>
        <CortexButton variant="primary" size="sm" onClick={handleApply} loading={isApplying()}>
          Apply Changes
        </CortexButton>
      </div>
    </div>
  );
};

export default CortexUpdateFileView;
