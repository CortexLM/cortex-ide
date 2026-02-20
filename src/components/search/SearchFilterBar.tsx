import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  JSX,
} from "solid-js";
import { useSearch } from "@/context/SearchContext";
import { CortexButton, CortexIcon, CortexTooltip } from "@/components/cortex/primitives";

const FILE_TYPE_PRESETS = [
  { label: "TypeScript", pattern: "*.ts,*.tsx", icon: "code" },
  { label: "JavaScript", pattern: "*.js,*.jsx", icon: "code" },
  { label: "Rust", pattern: "*.rs", icon: "code" },
  { label: "Python", pattern: "*.py", icon: "code" },
  { label: "CSS", pattern: "*.css,*.scss,*.less", icon: "palette" },
  { label: "HTML", pattern: "*.html,*.htm", icon: "code" },
  { label: "JSON", pattern: "*.json", icon: "file" },
  { label: "Markdown", pattern: "*.md,*.mdx", icon: "file" },
  { label: "YAML", pattern: "*.yml,*.yaml", icon: "file" },
];

export interface SearchFilterBarProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const SearchFilterBar: Component<SearchFilterBarProps> = (props) => {
  const search = useSearch();
  const [showTypePresets, setShowTypePresets] = createSignal(false);

  const includePattern = createMemo(() => search.state.query.options.includePattern);
  const excludePattern = createMemo(() => search.state.query.options.excludePattern);

  const handleIncludeChange = (value: string) => {
    search.setSearchOptions({ includePattern: value });
  };

  const handleExcludeChange = (value: string) => {
    search.setSearchOptions({ excludePattern: value });
  };

  const handleSelectPreset = (pattern: string) => {
    const current = includePattern();
    const newPattern = current ? `${current},${pattern}` : pattern;
    search.setSearchOptions({ includePattern: newPattern });
    setShowTypePresets(false);
  };

  const handleClearInclude = () => {
    search.setSearchOptions({ includePattern: "" });
  };

  const handleClearExclude = () => {
    search.setSearchOptions({ excludePattern: "" });
  };

  return (
    <div
      class={`flex flex-col gap-1.5 ${props.class || ""}`}
      style={props.style}
    >
      {/* Include filter */}
      <div class="flex items-center gap-1">
        <CortexTooltip content="Files to include (glob patterns)" position="right">
          <span class="text-[11px] text-[var(--cortex-text-muted)] w-14 flex-shrink-0">
            Include:
          </span>
        </CortexTooltip>
        <div class="flex-1 flex items-center gap-1 relative">
          <input
            type="text"
            value={includePattern()}
            onInput={(e) => handleIncludeChange((e.target as HTMLInputElement).value)}
            placeholder="e.g. *.ts, src/**"
            class="w-full px-2 py-1 text-[12px] bg-[var(--cortex-bg-secondary)] border border-[var(--cortex-border-default)] rounded text-[var(--cortex-text-primary)] outline-none focus:border-[var(--cortex-accent-primary)] placeholder:text-[var(--cortex-text-muted)]"
          />
          <Show when={includePattern()}>
            <button
              class="absolute right-6 text-[var(--cortex-text-muted)] hover:text-[var(--cortex-text-primary)]"
              onClick={handleClearInclude}
              title="Clear include filter"
            >
              <CortexIcon name="x" size={12} />
            </button>
          </Show>
          <CortexTooltip content="File type presets" position="bottom">
            <button
              class="flex-shrink-0 p-0.5 text-[var(--cortex-text-muted)] hover:text-[var(--cortex-text-primary)]"
              onClick={() => setShowTypePresets(prev => !prev)}
            >
              <CortexIcon name="list" size={14} />
            </button>
          </CortexTooltip>
        </div>
      </div>

      {/* File type presets dropdown */}
      <Show when={showTypePresets()}>
        <div class="ml-14 bg-[var(--cortex-bg-elevated)] border border-[var(--cortex-border-default)] rounded-lg shadow-lg p-1 z-10">
          <For each={FILE_TYPE_PRESETS}>
            {(preset) => (
              <button
                class="flex items-center gap-2 w-full px-2 py-1 text-left text-[12px] text-[var(--cortex-text-secondary)] hover:bg-[var(--cortex-bg-hover)] rounded"
                onClick={() => handleSelectPreset(preset.pattern)}
              >
                <CortexIcon name={preset.icon} size={12} />
                <span>{preset.label}</span>
                <span class="text-[var(--cortex-text-muted)] ml-auto font-mono text-[10px]">
                  {preset.pattern}
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Exclude filter */}
      <div class="flex items-center gap-1">
        <CortexTooltip content="Files to exclude (glob patterns)" position="right">
          <span class="text-[11px] text-[var(--cortex-text-muted)] w-14 flex-shrink-0">
            Exclude:
          </span>
        </CortexTooltip>
        <div class="flex-1 flex items-center gap-1 relative">
          <input
            type="text"
            value={excludePattern()}
            onInput={(e) => handleExcludeChange((e.target as HTMLInputElement).value)}
            placeholder="e.g. node_modules, dist"
            class="w-full px-2 py-1 text-[12px] bg-[var(--cortex-bg-secondary)] border border-[var(--cortex-border-default)] rounded text-[var(--cortex-text-primary)] outline-none focus:border-[var(--cortex-accent-primary)] placeholder:text-[var(--cortex-text-muted)]"
          />
          <Show when={excludePattern()}>
            <button
              class="absolute right-1 text-[var(--cortex-text-muted)] hover:text-[var(--cortex-text-primary)]"
              onClick={handleClearExclude}
              title="Clear exclude filter"
            >
              <CortexIcon name="x" size={12} />
            </button>
          </Show>
        </div>
      </div>

      {/* Search options toggles */}
      <div class="flex items-center gap-1 ml-14">
        <CortexTooltip content="Search only in open editors" position="bottom">
          <CortexButton
            variant={search.state.query.options.searchInOpenEditors ? "primary" : "ghost"}
            size="xs"
            onClick={() => search.setSearchOptions({
              searchInOpenEditors: !search.state.query.options.searchInOpenEditors,
            })}
            style={{ "font-size": "10px", padding: "2px 6px" }}
          >
            Open Editors
          </CortexButton>
        </CortexTooltip>
        <CortexTooltip content="Use .gitignore rules" position="bottom">
          <CortexButton
            variant={search.state.query.options.useIgnoreFiles ? "primary" : "ghost"}
            size="xs"
            onClick={() => search.setSearchOptions({
              useIgnoreFiles: !search.state.query.options.useIgnoreFiles,
            })}
            style={{ "font-size": "10px", padding: "2px 6px" }}
          >
            .gitignore
          </CortexButton>
        </CortexTooltip>
      </div>
    </div>
  );
};

export default SearchFilterBar;
