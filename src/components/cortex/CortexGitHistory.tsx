import { Component, createSignal, createMemo, For, Show, onMount, type JSX } from "solid-js";
import { gitLog, type GitCommit } from "@/utils/tauri-api";
import { getProjectPath } from "@/utils/workspace";
import { createLogger } from "@/utils/logger";
import { CortexIconButton, CortexInput } from "./primitives";

const logger = createLogger("GitHistory");

export interface CortexGitHistoryProps {
  onClose?: () => void;
  onCommitSelect?: (hash: string) => void;
}

const relativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  overflow: "hidden",
  background: "var(--cortex-bg-secondary)",
  color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "13px",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "12px 16px",
  "border-bottom": "1px solid var(--cortex-bg-hover)",
  "flex-shrink": "0",
};

const headerTitleStyle: JSX.CSSProperties = {
  "font-weight": "500",
  display: "flex",
  "align-items": "center",
  gap: "8px",
};

const searchContainerStyle: JSX.CSSProperties = {
  padding: "8px 16px",
  "border-bottom": "1px solid var(--cortex-bg-hover)",
  "flex-shrink": "0",
};

const listContainerStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "auto",
};

const commitRowStyle = (expanded: boolean): JSX.CSSProperties => ({
  padding: "8px 16px",
  cursor: "pointer",
  "border-bottom": "1px solid var(--cortex-bg-hover)",
  background: expanded ? "rgba(255,255,255,0.03)" : "transparent",
  transition: "background 100ms ease",
});

const commitHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "min-width": "0",
};

const hashStyle: JSX.CSSProperties = {
  "font-family": "var(--cortex-font-mono)",
  color: "var(--cortex-accent-primary)",
  "font-size": "12px",
  "flex-shrink": "0",
  "font-weight": "500",
};

const messageStyle: JSX.CSSProperties = {
  flex: "1",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
  color: "var(--cortex-text-primary)",
};

const metaStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
  "flex-shrink": "0",
  color: "var(--cortex-text-inactive)",
  "font-size": "12px",
};

const authorStyle: JSX.CSSProperties = {
  "max-width": "120px",
  overflow: "hidden",
  "text-overflow": "ellipsis",
  "white-space": "nowrap",
};

const dateStyle: JSX.CSSProperties = {
  "white-space": "nowrap",
  "font-variant-numeric": "tabular-nums",
};

const expandedSectionStyle: JSX.CSSProperties = {
  "margin-top": "8px",
  padding: "8px 12px",
  background: "rgba(255,255,255,0.02)",
  "border-radius": "var(--cortex-radius-sm)",
  "font-size": "12px",
};

const fullMessageStyle: JSX.CSSProperties = {
  color: "var(--cortex-text-primary)",
  "white-space": "pre-wrap",
  "word-break": "break-word",
  "line-height": "1.5",
  "margin-bottom": "8px",
};

const parentLabelStyle: JSX.CSSProperties = {
  color: "var(--cortex-text-inactive)",
  "font-size": "11px",
  "margin-bottom": "4px",
};

const parentHashStyle: JSX.CSSProperties = {
  "font-family": "var(--cortex-font-mono)",
  color: "var(--cortex-accent-primary)",
  "font-size": "11px",
};

const loadingStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  padding: "32px",
  color: "var(--cortex-text-inactive)",
  "font-size": "13px",
  gap: "8px",
};

const emptyStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  "align-items": "center",
  "justify-content": "center",
  padding: "48px 16px",
  color: "var(--cortex-text-inactive)",
  gap: "8px",
};

export const CortexGitHistory: Component<CortexGitHistoryProps> = (props) => {
  const [commits, setCommits] = createSignal<GitCommit[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedHash, setExpandedHash] = createSignal<string | null>(null);

  const filteredCommits = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return commits();
    return commits().filter(
      (c) =>
        c.message.toLowerCase().includes(query) ||
        c.shortHash.toLowerCase().includes(query) ||
        c.author.toLowerCase().includes(query),
    );
  });

  const fetchHistory = async () => {
    const projectPath = getProjectPath();
    if (!projectPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await gitLog(projectPath, 100);
      setCommits(result);
    } catch (e) {
      logger.warn("Failed to fetch git history", e);
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    fetchHistory();
  });

  const handleCommitClick = (commit: GitCommit) => {
    setExpandedHash((prev) => (prev === commit.hash ? null : commit.hash));
    props.onCommitSelect?.(commit.hash);
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={headerTitleStyle}>History</span>
        <CortexIconButton
          icon="xmark"
          size={20}
          onClick={() => props.onClose?.()}
          title="Close"
        />
      </div>

      <div style={searchContainerStyle}>
        <CortexInput
          value={searchQuery()}
          onChange={setSearchQuery}
          placeholder="Filter commits..."
          size="sm"
          leftIcon="search"
          type="search"
        />
      </div>

      <div style={listContainerStyle}>
        <Show when={loading()}>
          <div style={loadingStyle}>
            <span>Loading history…</span>
          </div>
        </Show>

        <Show when={!loading() && filteredCommits().length === 0}>
          <div style={emptyStyle}>
            <span style={{ "font-size": "14px" }}>
              {searchQuery() ? "No matching commits" : "No commits yet"}
            </span>
            <Show when={searchQuery()}>
              <span style={{ "font-size": "12px" }}>
                Try a different search term
              </span>
            </Show>
          </div>
        </Show>

        <Show when={!loading()}>
          <For each={filteredCommits()}>
            {(commit) => {
              const isExpanded = () => expandedHash() === commit.hash;
              return (
                <div
                  style={commitRowStyle(isExpanded())}
                  onClick={() => handleCommitClick(commit)}
                  class="git-history-row"
                >
                  <div style={commitHeaderStyle}>
                    <span style={hashStyle}>{commit.shortHash}</span>
                    <span style={messageStyle}>{commit.message.split("\n")[0]}</span>
                    <div style={metaStyle}>
                      <span style={authorStyle}>{commit.author}</span>
                      <span style={dateStyle}>{relativeDate(commit.date)}</span>
                    </div>
                  </div>

                  <Show when={isExpanded()}>
                    <div style={expandedSectionStyle}>
                      <div style={fullMessageStyle}>{commit.message}</div>
                      <Show when={commit.parents.length > 0}>
                        <div style={parentLabelStyle}>Parents</div>
                        <For each={commit.parents}>
                          {(parent) => (
                            <div style={parentHashStyle}>{parent}</div>
                          )}
                        </For>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      <style>{`
        .git-history-row:hover { background: rgba(255,255,255,0.05) !important; }
      `}</style>
    </div>
  );
};

export default CortexGitHistory;
