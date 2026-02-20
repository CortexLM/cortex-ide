import { createSignal, createEffect, For, Show, onCleanup, onMount, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import { gitDiff, gitStageHunk, gitUnstageHunk, gitRevertHunk, fsReadFile, fsWriteFile } from "../../utils/tauri-api";
import { getProjectPath } from "../../utils/workspace";
import type * as Monaco from "monaco-editor";
import { MonacoManager } from "@/utils/monacoManager";
import { tokens } from '@/design-system/tokens';
import { getLinePrefix } from "./DiffLine";
import type { DiffHunkData } from "./DiffHunk";
import { DiffHunk } from "./DiffHunk";
import { DiffToolbar } from "./DiffToolbar";

interface FileDiff {
  path: string;
  hunks: DiffHunkData[];
  oldPath?: string;
  binary?: boolean;
  additions: number;
  deletions: number;
  isTruncated?: boolean;
}

interface DiffViewProps {
  file?: string;
  staged?: boolean;
  onClose?: () => void;
  showLineNumbers?: boolean;
  enableWordDiff?: boolean;
  maxLines?: number;
  repoPath?: string;
  onHunkStaged?: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rs: "rust", go: "go", java: "java", kt: "kotlin",
  c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp", rb: "ruby",
  php: "php", swift: "swift", m: "objective-c", sql: "sql",
  html: "html", css: "css", scss: "scss", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", xml: "xml", md: "markdown",
  sh: "shell", bash: "shell", zsh: "shell", dockerfile: "dockerfile",
  toml: "ini", ini: "ini", lua: "lua", r: "r", scala: "scala",
  ex: "elixir", exs: "elixir", erl: "erlang", clj: "clojure",
  hs: "haskell", pl: "perl", vue: "vue", svelte: "svelte", astro: "astro",
};

function detectLanguageFromPath(filePath: string): string {
  return LANGUAGE_MAP[filePath.split(".").pop()?.toLowerCase() || ""] || "plaintext";
}

interface RawFileDiff extends FileDiff { content?: string; rawDiff?: string; }

export function DiffView(props: DiffViewProps) {
  let diffEditorContainerRef: HTMLDivElement | undefined;
  let diffEditorInstance: Monaco.editor.IStandaloneDiffEditor | null = null;
  const monacoManager = MonacoManager.getInstance();

  const [diff, setDiff] = createSignal<FileDiff | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [viewMode, setViewMode] = createSignal<"unified" | "split">("unified");
  const [isFullscreen, setIsFullscreen] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [stagingHunk, setStagingHunk] = createSignal<number | null>(null);
  const [hoveredHunk, setHoveredHunk] = createSignal<number | null>(null);
  const [stagedHunks, setStagedHunks] = createSignal<Set<number>>(new Set());
  const [editMode, setEditMode] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal<string | null>(null);
  const [originalContent, setOriginalContent] = createSignal<string | null>(null);
  const [editLoading, setEditLoading] = createSignal(false);
  const [savingEdit, setSavingEdit] = createSignal(false);
  const [activeHunkIndex, setActiveHunkIndex] = createSignal(0);

  const navigateNextHunk = () => {
    const d = diff();
    if (!d || d.hunks.length === 0) return;
    setActiveHunkIndex(prev => Math.min(prev + 1, d.hunks.length - 1));
    scrollToHunk(activeHunkIndex());
  };

  const navigatePrevHunk = () => {
    const d = diff();
    if (!d || d.hunks.length === 0) return;
    setActiveHunkIndex(prev => Math.max(prev - 1, 0));
    scrollToHunk(activeHunkIndex());
  };

  const scrollToHunk = (index: number) => {
    const hunkElements = document.querySelectorAll('[data-hunk-index]');
    const target = hunkElements[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      navigateNextHunk();
    } else if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      navigatePrevHunk();
    }
  };

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown));
  });

  createEffect(() => { if (props.file) fetchDiff(props.file, props.staged || false); });

  const fetchDiff = async (file: string, staged: boolean) => {
    setLoading(true);
    try {
      const diffText = await gitDiff(getProjectPath(), file, staged);
      const rawDiff: RawFileDiff = { path: file, content: diffText, hunks: [], additions: 0, deletions: 0 };
      setDiff(rawDiff);
    } catch (err) { console.error("Failed to fetch diff:", err); }
    finally { setLoading(false); }
  };

  const handleHunkAction = async (
    hunkIndex: number,
    action: (repoPath: string, file: string, idx: number) => Promise<void>,
    updateStaged?: (s: Set<number>) => Set<number>,
  ) => {
    const currentDiff = diff();
    if (!currentDiff || !props.file || !currentDiff.hunks[hunkIndex]) return;
    const repoPath = props.repoPath || getProjectPath();
    if (!repoPath) return;
    setStagingHunk(hunkIndex);
    try {
      await action(repoPath, props.file, hunkIndex);
      if (updateStaged) setStagedHunks(updateStaged(new Set(stagedHunks())));
      props.onHunkStaged?.();
      setTimeout(() => { if (props.file) fetchDiff(props.file, props.staged || false); }, 300);
    } catch (err) { console.error("Failed hunk action:", err); }
    finally { setStagingHunk(null); }
  };

  const stageHunk = (i: number) => handleHunkAction(i, gitStageHunk, (s) => { s.add(i); return s; });
  const unstageHunk = (i: number) => handleHunkAction(i, gitUnstageHunk, (s) => { s.delete(i); return s; });
  const revertHunk = (i: number) => handleHunkAction(i, gitRevertHunk);

  const copyDiff = async () => {
    if (!diff()) return;
    const text = diff()!.hunks.map(h =>
      h.header + "\n" + h.lines.map(l => getLinePrefix(l.type) + l.content).join("\n")
    ).join("\n\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch (err) { console.error("Failed to copy:", err); }
  };

  const diffStats = createMemo(() => {
    const d = diff();
    if (!d) return { additions: 0, deletions: 0 };
    return {
      additions: d.additions || d.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === "addition").length, 0),
      deletions: d.deletions || d.hunks.reduce((s, h) => s + h.lines.filter(l => l.type === "deletion").length, 0),
    };
  });

  const getFullFilePath = (): string | null => {
    if (!props.file) return null;
    const p = props.repoPath || getProjectPath();
    if (!p) return null;
    return `${p}${p.includes("\\") ? "\\" : "/"}${props.file}`;
  };

  const disposeDiffEditor = () => {
    if (!diffEditorInstance) return;
    const model = diffEditorInstance.getModel();
    model?.original?.dispose?.();
    model?.modified?.dispose?.();
    diffEditorInstance.dispose();
    diffEditorInstance = null;
  };

  const handleEnterEditMode = async () => {
    const filePath = getFullFilePath();
    if (!filePath) return;
    setEditLoading(true);
    try {
      const currentContent = await fsReadFile(filePath);
      setEditedContent(currentContent);
      const projectPath = props.repoPath || getProjectPath();
      if (projectPath) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          setOriginalContent(await invoke<string>("git_show_file", { path: projectPath, file: props.file, revision: "HEAD" }));
        } catch { setOriginalContent(currentContent); }
      } else { setOriginalContent(currentContent); }
      setEditMode(true);
      setTimeout(() => initDiffEditor(), 50);
    } catch (err) { console.error("Failed to enter edit mode:", err); }
    finally { setEditLoading(false); }
  };

  const initDiffEditor = async () => {
    if (!diffEditorContainerRef) return;
    try {
      const monaco = await monacoManager.ensureLoaded();
      const language = detectLanguageFromPath(props.file || "untitled");
      disposeDiffEditor();
      diffEditorInstance = monaco.editor.createDiffEditor(diffEditorContainerRef, {
        theme: "cortex-dark", automaticLayout: true, renderSideBySide: viewMode() === "split",
        enableSplitViewResizing: true, renderIndicators: true, renderMarginRevertIcon: true,
        ignoreTrimWhitespace: false, readOnly: false, originalEditable: false,
        fontSize: 13, lineHeight: 20, fontLigatures: true, scrollBeyondLastLine: false, smoothScrolling: true,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
        minimap: { enabled: false },
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
      });
      const ts = Date.now(), fp = props.file || "untitled";
      const oUri = monaco.Uri.parse(`diff://original-${ts}/${fp}`);
      const mUri = monaco.Uri.parse(`diff://modified-${ts}/${fp}`);
      monaco.editor.getModel(oUri)?.dispose();
      monaco.editor.getModel(mUri)?.dispose();
      const oModel = monaco.editor.createModel(originalContent() || "", language, oUri);
      const mModel = monaco.editor.createModel(editedContent() || "", language, mUri);
      diffEditorInstance.setModel({ original: oModel, modified: mModel });
      mModel.onDidChangeContent(() => setEditedContent(mModel.getValue()));
    } catch (err) { console.error("Failed to initialize diff editor:", err); }
  };

  const handleSaveEdit = async () => {
    const filePath = getFullFilePath(), content = editedContent();
    if (!filePath || content === null) return;
    setSavingEdit(true);
    try {
      await fsWriteFile(filePath, content);
      handleCancelEdit();
      if (props.file) await fetchDiff(props.file, props.staged || false);
      props.onHunkStaged?.();
    } catch (err) { console.error("Failed to save changes:", err); }
    finally { setSavingEdit(false); }
  };

  const handleCancelEdit = () => {
    disposeDiffEditor();
    setEditMode(false);
    setEditedContent(null);
    setOriginalContent(null);
  };

  createEffect(() => {
    if (editMode() && diffEditorInstance) diffEditorInstance.updateOptions({ renderSideBySide: viewMode() === "split" });
  });

  onCleanup(disposeDiffEditor);

  return (
    <div class={`flex flex-col overflow-hidden ${isFullscreen() ? "fixed inset-0 z-50" : "h-full"}`} style={{ background: tokens.colors.surface.canvas }}>
      <DiffToolbar
        filePath={diff()?.path} oldPath={diff()?.oldPath} staged={props.staged}
        additions={diffStats().additions} deletions={diffStats().deletions}
        viewMode={viewMode()} isFullscreen={isFullscreen()} editMode={editMode()}
        editLoading={editLoading()} savingEdit={savingEdit()} copied={copied()}
        onViewModeChange={setViewMode} onToggleFullscreen={() => setIsFullscreen(!isFullscreen())}
        onCopyDiff={copyDiff} onEnterEditMode={handleEnterEditMode}
        onSaveEdit={handleSaveEdit} onCancelEdit={handleCancelEdit} onClose={props.onClose}
      />
      <Show when={editMode()} fallback={
        <div class="flex-1 overflow-auto font-mono text-sm">
          <Show when={loading()}>
            <div class="flex items-center justify-center h-full">
              <span style={{ color: tokens.colors.text.muted }}>Loading diff...</span>
            </div>
          </Show>
          <Show when={!loading() && diff()?.binary}>
            <div class="flex items-center justify-center h-full">
              <span style={{ color: tokens.colors.text.muted }}>Binary file changed</span>
            </div>
          </Show>
          <Show when={!loading() && diff() && !diff()?.binary}>
            <For each={diff()!.hunks}>
              {(hunk, index) => (
                <DiffHunk hunk={hunk} index={index()} staged={props.staged} viewMode={viewMode()}
                  onStageHunk={stageHunk} onUnstageHunk={unstageHunk} onRevertHunk={revertHunk}
                  stagingHunk={stagingHunk()} hoveredHunk={hoveredHunk()} onHoverHunk={setHoveredHunk}
                  stagedHunks={stagedHunks()} />
              )}
            </For>
          </Show>
          <Show when={!loading() && !diff()}>
            <div class="flex items-center justify-center h-full">
              <span style={{ color: tokens.colors.text.muted }}>Select a file to view diff</span>
            </div>
          </Show>
        </div>
      }>
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="flex items-center gap-2 px-3 py-1.5 text-xs border-b" style={{
            background: `color-mix(in srgb, ${tokens.colors.semantic.primary} 10%, transparent)`,
            "border-color": tokens.colors.border.divider, color: tokens.colors.semantic.primary,
          }}>
            <Icon name="pen" class="w-3.5 h-3.5" />
            <span>Editing: {props.file}</span>
            <span class="text-[var(--text-weaker)]">•</span>
            <span class="text-[var(--text-weaker)]">Changes on the right side will be saved to the file</span>
          </div>
          <div ref={diffEditorContainerRef} class="flex-1" style={{ "min-height": "200px" }} />
        </div>
      </Show>
    </div>
  );
}
