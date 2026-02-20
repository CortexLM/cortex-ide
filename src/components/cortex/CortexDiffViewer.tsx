import { Component, createSignal, onMount, onCleanup, Show, type JSX } from "solid-js";
import { CortexGitDiffView } from "./CortexGitDiffView";
import { gitDiff, fsReadFile } from "@/utils/tauri-api";
import { useMultiRepo } from "@/context/MultiRepoContext";
import { detectLanguage } from "@/context/editor/languageDetection";

export interface CortexDiffViewerProps {
  style?: JSX.CSSProperties;
}

interface DiffState {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  language: string;
  staged: boolean;
  repoPath: string;
}

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
  overflow: "hidden",
};

const emptyStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  "align-items": "center",
  "justify-content": "center",
  flex: "1",
  gap: "12px",
  color: "var(--cortex-text-inactive)",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "13px",
};

const errorStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  "align-items": "center",
  "justify-content": "center",
  flex: "1",
  gap: "8px",
  color: "var(--cortex-error)",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "13px",
  padding: "24px",
  "text-align": "center",
};

const loadingStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  flex: "1",
  color: "var(--cortex-text-inactive)",
  "font-family": "var(--cortex-font-sans)",
  "font-size": "13px",
};

function parseDiffForOriginal(diffText: string, currentContent: string): string {
  if (!diffText.trim()) return currentContent;

  const lines = diffText.split("\n");
  const currentLines = currentContent.split("\n");
  const result = [...currentLines];
  const hunks: { start: number; removals: string[]; additions: number }[] = [];

  let hunkStart = -1;
  let removals: string[] = [];
  let additions = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -(\d+)/);
    if (hunkMatch) {
      if (hunkStart >= 0) hunks.push({ start: hunkStart, removals, additions });
      hunkStart = parseInt(hunkMatch[1], 10) - 1;
      removals = [];
      additions = 0;
      continue;
    }
    if (hunkStart < 0) continue;
    if (line.startsWith("-")) removals.push(line.slice(1));
    else if (line.startsWith("+")) additions++;
  }
  if (hunkStart >= 0) hunks.push({ start: hunkStart, removals, additions });

  let offset = 0;
  for (const hunk of hunks) {
    const pos = hunk.start + offset;
    result.splice(pos, hunk.additions, ...hunk.removals);
    offset += hunk.removals.length - hunk.additions;
  }

  return result.join("\n");
}

export const CortexDiffViewer: Component<CortexDiffViewerProps> = (props) => {
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try { multiRepo = useMultiRepo(); } catch { /* context unavailable */ }

  const [diffState, setDiffState] = createSignal<DiffState | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const getRepoPath = (repoId?: string): string | null => {
    if (!multiRepo) return null;
    if (repoId) {
      const repos = multiRepo.repositories();
      const match = repos.find((r) => r.id === repoId);
      if (match) return match.path;
    }
    const active = multiRepo.activeRepository();
    return active?.path ?? null;
  };

  const loadDiff = async (filePath: string, repoId?: string, staged?: boolean) => {
    const repoPath = getRepoPath(repoId);
    if (!repoPath) {
      setError("No repository found");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isStaged = staged ?? false;
      const [diffText, currentContent] = await Promise.all([
        gitDiff(repoPath, filePath, isStaged),
        fsReadFile(repoPath + "/" + filePath).catch(() => ""),
      ]);

      const language = detectLanguage(filePath);
      const originalContent = parseDiffForOriginal(diffText, currentContent);

      setDiffState({
        filePath,
        originalContent,
        modifiedContent: currentContent,
        language,
        staged: isStaged,
        repoPath,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDiffState(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDiffEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.path) loadDiff(detail.path, detail.repoId, detail.staged);
  };

  const handleClose = () => {
    setDiffState(null);
    setError(null);
  };

  onMount(() => {
    window.addEventListener("cortex:git:diff", handleDiffEvent);
  });

  onCleanup(() => {
    window.removeEventListener("cortex:git:diff", handleDiffEvent);
  });

  return (
    <div style={{ ...containerStyle, ...props.style }}>
      <Show when={loading()}>
        <div style={loadingStyle}>
          <span>Loading diff...</span>
        </div>
      </Show>

      <Show when={!loading() && error()}>
        <div style={errorStyle}>
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 13A6 6 0 1 1 8 2a6 6 0 0 1 0 12zm-.5-3h1v1h-1zm0-7h1v5h-1z"/>
          </svg>
          <span>{error()}</span>
        </div>
      </Show>

      <Show when={!loading() && !error() && !diffState()}>
        <div style={emptyStyle}>
          <svg width="40" height="40" viewBox="0 0 16 16" fill="currentColor" opacity="0.5">
            <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h2.764c.958 0 1.76.56 2.311 1.184C9.075 3.816 9.876 4 10.5 4h2A1.5 1.5 0 0 1 14 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9z"/>
          </svg>
          <span>Click a file in Source Control to view its diff</span>
        </div>
      </Show>

      <Show when={!loading() && !error() && diffState()}>
        {(state) => (
          <CortexGitDiffView
            filePath={state().filePath}
            originalContent={state().originalContent}
            modifiedContent={state().modifiedContent}
            language={state().language}
            staged={state().staged}
            onClose={handleClose}
          />
        )}
      </Show>
    </div>
  );
};

export default CortexDiffViewer;
