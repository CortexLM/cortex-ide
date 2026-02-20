import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
} from "solid-js";
import { useSearch, SearchResult, SearchMatch } from "@/context/SearchContext";

export interface SearchResultsTreeProps {
  results: SearchResult[];
  onOpenFile?: (filePath: string, line: number, column?: number) => void;
  onReplaceMatch?: (uri: string, matchId: string) => void;
  onReplaceFile?: (uri: string) => void;
  class?: string;
}

export const SearchResultsTree: Component<SearchResultsTreeProps> = (props) => {
  const search = useSearch();

  const totalMatches = createMemo(() =>
    props.results.reduce((sum, r) => sum + r.totalMatches, 0)
  );

  const handleToggleExpand = (resultId: string) => {
    search.toggleResultExpanded(resultId);
  };

  const handleToggleSelect = (e: MouseEvent, resultId: string) => {
    e.stopPropagation();
    search.toggleResultSelected(resultId);
  };

  return (
    <div class={`flex flex-col overflow-auto ${props.class || ""}`}>
      <Show
        when={props.results.length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center p-8 text-[var(--cortex-text-muted)]">
            <span class="text-sm">No results found</span>
          </div>
        }
      >
        <div class="text-xs text-[var(--cortex-text-muted)] px-3 py-1.5">
          {totalMatches()} results in {props.results.length} files
        </div>
        <For each={props.results}>
          {(result) => (
            <FileResultGroup
              result={result}
              onToggleExpand={() => handleToggleExpand(result.id)}
              onToggleSelect={(e) => handleToggleSelect(e, result.id)}
              onOpenFile={props.onOpenFile}
              onReplaceMatch={props.onReplaceMatch}
              onReplaceFile={props.onReplaceFile}
              isReplaceMode={search.state.isReplaceMode}
            />
          )}
        </For>
      </Show>
    </div>
  );
};

interface FileResultGroupProps {
  result: SearchResult;
  onToggleExpand: () => void;
  onToggleSelect: (e: MouseEvent) => void;
  onOpenFile?: (filePath: string, line: number, column?: number) => void;
  onReplaceMatch?: (uri: string, matchId: string) => void;
  onReplaceFile?: (uri: string) => void;
  isReplaceMode: boolean;
}

const FileResultGroup: Component<FileResultGroupProps> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  return (
    <div class="border-b border-[var(--cortex-border-default,rgba(255,255,255,0.06))]">
      <div
        class="flex items-center gap-1.5 px-3 py-1 cursor-pointer select-none transition-colors duration-100"
        style={{
          background: hovered() ? "var(--cortex-bg-hover, rgba(255,255,255,0.05))" : "transparent",
        }}
        onClick={props.onToggleExpand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Show when={props.isReplaceMode}>
          <input
            type="checkbox"
            checked={props.result.isSelected}
            onClick={props.onToggleSelect}
            class="w-3.5 h-3.5 rounded cursor-pointer accent-[var(--cortex-accent-primary)]"
          />
        </Show>
        <span class="text-[var(--cortex-text-muted)] text-xs flex-shrink-0">
          {props.result.isExpanded ? "▼" : "▶"}
        </span>
        <span class="text-[13px] font-medium text-[var(--cortex-text-primary)] truncate">
          {props.result.filename}
        </span>
        <span class="text-[11px] text-[var(--cortex-text-muted)] truncate flex-1 min-w-0">
          {props.result.relativePath}
        </span>
        <span class="text-[10px] text-[var(--cortex-text-muted)] bg-[var(--cortex-bg-secondary)] px-1.5 py-0.5 rounded-full flex-shrink-0">
          {props.result.totalMatches}
        </span>
        <Show when={props.isReplaceMode && hovered()}>
          <button
            class="text-[var(--cortex-text-muted)] hover:text-[var(--cortex-text-primary)] p-0.5 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              props.onReplaceFile?.(props.result.uri);
            }}
            title="Replace all in file"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 3h4v1H4v3h3v1H3V3zm6 0h4v5h-1V4h-3V3zM4 9h3v1H4v3h3v-1h1v2H3V9h1zm5 0h4v5H9v-1h3v-3H9V9z"/>
            </svg>
          </button>
        </Show>
      </div>

      <Show when={props.result.isExpanded}>
        <div class="pl-6">
          <For each={props.result.matches}>
            {(match) => (
              <MatchLine
                match={match}
                uri={props.result.uri}
                onOpenFile={props.onOpenFile}
                onReplaceMatch={props.onReplaceMatch}
                filePath={props.result.path}
                isReplaceMode={props.isReplaceMode}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

interface MatchLineProps {
  match: SearchMatch;
  uri: string;
  filePath: string;
  onOpenFile?: (filePath: string, line: number, column?: number) => void;
  onReplaceMatch?: (uri: string, matchId: string) => void;
  isReplaceMode: boolean;
}

const MatchLine: Component<MatchLineProps> = (props) => {
  const [hovered, setHovered] = createSignal(false);

  const beforeText = createMemo(() =>
    props.match.preview.slice(0, props.match.previewMatchStart)
  );
  const matchText = createMemo(() =>
    props.match.preview.slice(
      props.match.previewMatchStart,
      props.match.previewMatchStart + props.match.previewMatchLength
    )
  );
  const afterText = createMemo(() =>
    props.match.preview.slice(
      props.match.previewMatchStart + props.match.previewMatchLength
    )
  );

  return (
    <div
      class="flex items-center gap-2 px-3 py-0.5 cursor-pointer transition-colors duration-100"
      style={{
        background: hovered() ? "var(--cortex-bg-hover, rgba(255,255,255,0.03))" : "transparent",
      }}
      onClick={() =>
        props.onOpenFile?.(
          props.filePath,
          props.match.range.startLine + 1,
          props.match.range.startColumn
        )
      }
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span class="min-w-[36px] text-right text-[11px] text-[var(--cortex-text-muted)] font-mono flex-shrink-0">
        {props.match.range.startLine + 1}
      </span>
      <span class="text-[12px] font-mono truncate flex-1 min-w-0">
        <span class="text-[var(--cortex-text-secondary)]">{beforeText()}</span>
        <span class="bg-[var(--cortex-accent-muted,rgba(191,255,0,0.2))] text-[var(--cortex-accent-primary)] rounded-sm px-0.5">
          {matchText()}
        </span>
        <span class="text-[var(--cortex-text-secondary)]">{afterText()}</span>
      </span>
      <Show when={props.isReplaceMode && hovered()}>
        <button
          class="text-[var(--cortex-text-muted)] hover:text-[var(--cortex-text-primary)] p-0.5 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            props.onReplaceMatch?.(props.uri, props.match.id);
          }}
          title="Replace this match"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 3h4v1H4v3h3v1H3V3zm6 0h4v5h-1V4h-3V3z"/>
          </svg>
        </button>
      </Show>
    </div>
  );
};

export default SearchResultsTree;
