import { Show, For, createSignal, createMemo } from "solid-js";
import { useSettings, type SettingsScope, type FilesSettings, type SearchSettings } from "@/context/SettingsContext";
import { Toggle, SectionHeader, FormGroup, Button } from "./FormComponents";
import { Icon } from "../ui/Icon";

interface FilesSettingsPanelProps {
  scope?: SettingsScope;
}

// Monaco language options - commonly used languages sorted alphabetically
const MONACO_LANGUAGES = [
  { value: "abap", label: "ABAP" },
  { value: "apex", label: "Apex" },
  { value: "bat", label: "Batch" },
  { value: "c", label: "C" },
  { value: "clojure", label: "Clojure" },
  { value: "coffeescript", label: "CoffeeScript" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "dart", label: "Dart" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "elixir", label: "Elixir" },
  { value: "fsharp", label: "F#" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "handlebars", label: "Handlebars" },
  { value: "hcl", label: "HCL / Terraform" },
  { value: "html", label: "HTML" },
  { value: "ini", label: "Ini / Properties" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "jsonc", label: "JSON with Comments" },
  { value: "jsx", label: "JavaScript React (JSX)" },
  { value: "julia", label: "Julia" },
  { value: "kotlin", label: "Kotlin" },
  { value: "less", label: "Less" },
  { value: "lua", label: "Lua" },
  { value: "markdown", label: "Markdown" },
  { value: "mdx", label: "MDX" },
  { value: "objective-c", label: "Objective-C" },
  { value: "perl", label: "Perl" },
  { value: "php", label: "PHP" },
  { value: "plaintext", label: "Plain Text" },
  { value: "powershell", label: "PowerShell" },
  { value: "python", label: "Python" },
  { value: "r", label: "R" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scala", label: "Scala" },
  { value: "scss", label: "SCSS" },
  { value: "shell", label: "Shell Script" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "toml", label: "TOML" },
  { value: "tsx", label: "TypeScript React (TSX)" },
  { value: "typescript", label: "TypeScript" },
  { value: "vue", label: "Vue" },
  { value: "xml", label: "XML" },
  { value: "yaml", label: "YAML" },
];

/** Row with workspace override indicator */
function SettingRowWithOverride(props: {
  label: string;
  settingKey: keyof FilesSettings;
  hasOverride: boolean;
  isModified?: boolean;
  onReset?: () => void;
  onResetToDefault?: () => void;
  children: any;
}) {
  const isModifiedValue = () => props.isModified ?? false;
  return (
    <div 
      class="setting-item-contents group relative" 
      classList={{ 
        "is-configured": props.hasOverride,
        "is-modified": isModifiedValue() && !props.hasOverride
      }}
    >
      <div class="setting-item-modified-indicator" />
      <div class="flex items-center justify-between gap-4" style={{ padding: "12px 14px 18px" }}>
        <div class="flex items-center gap-2">
          <span class="setting-item-label" style={{ "font-weight": "600", "font-size": "13px" }}>{props.label}</span>
          <Show when={isModifiedValue() && !props.hasOverride}>
            <span 
              class="modified-indicator-dot"
              title="Modified from default"
            />
          </Show>
        </div>
        <div class="flex items-center gap-2">
          {props.children}
          <Show when={props.hasOverride && props.onReset}>
            <button
              onClick={props.onReset}
              class="setting-toolbar-container opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground"
              style={{ transition: "opacity 0.3s" }}
              title="Reset to user setting"
            >
              <Icon name="rotate-left" class="h-3 w-3 toolbar-icon" />
            </button>
          </Show>
          <Show when={isModifiedValue() && !props.hasOverride && props.onResetToDefault}>
            <button
              onClick={props.onResetToDefault}
              class="reset-to-default-button"
              title="Reset to default"
            >
              <Icon name="rotate-left" class="h-3 w-3" />
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
}

/** File Association Row */
function FileAssociationRow(props: {
  pattern: string;
  languageId: string;
  onLanguageChange: (languageId: string) => void;
  onRemove: () => void;
}) {
  return (
    <div class="flex items-center gap-3 p-2 rounded-lg border border-border bg-background-tertiary/30 hover:bg-background-tertiary/50 transition-colors group">
      <Icon name="file" class="h-4 w-4 text-foreground-muted shrink-0" />
      <div class="flex-1 min-w-0">
        <code class="text-sm font-mono text-foreground">{props.pattern}</code>
      </div>
      <div class="flex items-center gap-2">
        <select
          value={props.languageId}
          onChange={(e) => props.onLanguageChange(e.currentTarget.value)}
          class="settings-inline-select text-xs"
          style={{ width: "150px" }}
        >
          <For each={MONACO_LANGUAGES}>
            {(lang) => <option value={lang.value}>{lang.label}</option>}
          </For>
        </select>
        <button
          onClick={props.onRemove}
          class="p-1.5 rounded hover:bg-red-500/20 text-foreground-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="Remove association"
        >
          <Icon name="trash" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Add new file association form */
function AddAssociationForm(props: {
  onAdd: (pattern: string, languageId: string) => void;
}) {
  const [pattern, setPattern] = createSignal("");
  const [languageId, setLanguageId] = createSignal("plaintext");
  const [error, setError] = createSignal<string | null>(null);

  const handleAdd = () => {
    const p = pattern().trim();
    if (!p) {
      setError("Pattern is required");
      return;
    }
    if (!p.includes("*") && !p.includes("?") && !p.includes(".")) {
      setError("Pattern should include a file extension or wildcard (* or ?)");
      return;
    }
    setError(null);
    props.onAdd(p, languageId());
    setPattern("");
    setLanguageId("plaintext");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="e.g., *.myext, Dockerfile.*, .env.*"
          value={pattern()}
          onInput={(e) => {
            setPattern(e.currentTarget.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          class="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <select
          value={languageId()}
          onChange={(e) => setLanguageId(e.currentTarget.value)}
          class="settings-inline-select"
          style={{ width: "150px" }}
        >
          <For each={MONACO_LANGUAGES}>
            {(lang) => <option value={lang.value}>{lang.label}</option>}
          </For>
        </select>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          icon={<Icon name="plus" class="h-3.5 w-3.5" />}
        >
          Add
        </Button>
      </div>
      <Show when={error()}>
        <p class="text-xs text-red-400">{error()}</p>
      </Show>
      <p class="text-xs text-foreground-muted">
        Use glob patterns: <code class="bg-background-tertiary px-1 rounded">*</code> matches any characters, 
        <code class="bg-background-tertiary px-1 rounded ml-1">?</code> matches single character
      </p>
    </div>
  );
}

/** Search Exclude Pattern Row */
function SearchExcludePatternRow(props: {
  pattern: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div class="flex items-center gap-3 p-2 rounded-lg border border-border bg-background-tertiary/30 hover:bg-background-tertiary/50 transition-colors group">
      <Icon name="magnifying-glass" class="h-4 w-4 text-foreground-muted shrink-0" />
      <div class="flex-1 min-w-0">
        <code 
          class="text-sm font-mono"
          classList={{ 
            "text-foreground": props.enabled,
            "text-foreground-muted line-through": !props.enabled
          }}
        >
          {props.pattern}
        </code>
      </div>
      <div class="flex items-center gap-2">
        <button
          onClick={() => props.onToggle(!props.enabled)}
          class={`p-1.5 rounded transition-all ${
            props.enabled 
              ? "text-green-400 hover:bg-green-500/20" 
              : "text-foreground-muted hover:bg-background-tertiary"
          }`}
          title={props.enabled ? "Disable pattern" : "Enable pattern"}
        >
          {props.enabled ? (
            <Icon name="toggle-on" class="h-4 w-4" />
          ) : (
            <Icon name="toggle-off" class="h-4 w-4" />
          )}
        </button>
        <button
          onClick={props.onRemove}
          class="p-1.5 rounded hover:bg-red-500/20 text-foreground-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
          title="Remove pattern"
        >
          <Icon name="trash" class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Add new search exclude pattern form */
function AddSearchExcludeForm(props: {
  onAdd: (pattern: string) => void;
}) {
  const [pattern, setPattern] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const handleAdd = () => {
    const p = pattern().trim();
    if (!p) {
      setError("Pattern is required");
      return;
    }
    setError(null);
    props.onAdd(p);
    setPattern("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="e.g., **/node_modules, **/.git, **/dist"
          value={pattern()}
          onInput={(e) => {
            setPattern(e.currentTarget.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          class="flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleAdd}
          icon={<Icon name="plus" class="h-3.5 w-3.5" />}
        >
          Add
        </Button>
      </div>
      <Show when={error()}>
        <p class="text-xs text-red-400">{error()}</p>
      </Show>
      <p class="text-xs text-foreground-muted">
        Use glob patterns: <code class="bg-background-tertiary px-1 rounded">**</code> matches any path, 
        <code class="bg-background-tertiary px-1 rounded ml-1">*</code> matches any characters
      </p>
    </div>
  );
}

/** Number input with slider component */
function NumberWithSlider(props: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hasOverride?: boolean;
}) {
  return (
    <div class="flex items-center gap-3" style={{ width: "280px" }}>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step || 1}
        value={props.value}
        onInput={(e) => props.onChange(parseInt(e.currentTarget.value))}
        class="flex-1 h-1.5 bg-background-tertiary rounded-lg appearance-none cursor-pointer accent-primary"
        style={{ "min-width": "120px" }}
      />
      <div class="flex items-center gap-1">
        <input
          type="number"
          min={props.min}
          max={props.max}
          step={props.step || 1}
          value={props.value}
          onChange={(e) => {
            const val = parseInt(e.currentTarget.value);
            if (!isNaN(val) && val >= props.min && val <= props.max) {
              props.onChange(val);
            }
          }}
          class={`settings-inline-input w-20 text-right ${props.hasOverride ? "ring-1 ring-purple-500/50" : ""}`}
        />
        <Show when={props.unit}>
          <span class="text-xs text-foreground-muted">{props.unit}</span>
        </Show>
      </div>
    </div>
  );
}

export function FilesSettingsPanel(props: FilesSettingsPanelProps) {
  const settings = useSettings();
  const scope = () => props.scope || "user";
  
  const files = () => settings.effectiveSettings().files;
  
  const updateSetting = <K extends keyof FilesSettings>(key: K, value: FilesSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("files", key, value);
    } else {
      settings.updateFilesSetting(key, value);
    }
  };

  const hasOverride = (key: keyof FilesSettings) => settings.hasWorkspaceOverride("files", key);
  const isModified = (key: keyof FilesSettings) => settings.isSettingModified("files", key);
  const resetOverride = (key: keyof FilesSettings) => {
    settings.resetWorkspaceSetting("files", key);
  };
  const resetToDefault = (key: keyof FilesSettings) => {
    settings.resetSettingToDefault("files", key);
  };

  // File associations
  const associations = createMemo(() => files().associations || {});
  const associationEntries = createMemo(() => Object.entries(associations()).sort((a, b) => a[0].localeCompare(b[0])));

  const handleAddAssociation = async (pattern: string, languageId: string) => {
    await settings.setFileAssociation(pattern, languageId);
  };

  const handleUpdateAssociation = async (pattern: string, languageId: string) => {
    await settings.setFileAssociation(pattern, languageId);
  };

  const handleRemoveAssociation = async (pattern: string) => {
    await settings.removeFileAssociation(pattern);
  };

  // Search exclude patterns
  const search = () => settings.effectiveSettings().search;
  const searchExcludePatterns = createMemo(() => {
    const exclude = search().exclude || {};
    return Object.entries(exclude).sort((a, b) => a[0].localeCompare(b[0]));
  });

  const updateSearchSetting = <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => {
    if (scope() === "workspace" && settings.hasWorkspace()) {
      settings.setWorkspaceSetting("search", key, value);
    } else {
      settings.updateSearchSetting(key, value);
    }
  };

  const handleAddSearchExclude = (pattern: string) => {
    const current = { ...search().exclude };
    current[pattern] = true;
    updateSearchSetting("exclude", current);
  };

  const handleToggleSearchExclude = (pattern: string, enabled: boolean) => {
    const current = { ...search().exclude };
    current[pattern] = enabled;
    updateSearchSetting("exclude", current);
  };

  const handleRemoveSearchExclude = (pattern: string) => {
    const current = { ...search().exclude };
    delete current[pattern];
    updateSearchSetting("exclude", current);
  };

  const autoSaveOptions = [
    { value: "off", label: "Off" },
    { value: "afterDelay", label: "After Delay" },
    { value: "onFocusChange", label: "On Focus Change" },
    { value: "onWindowChange", label: "On Window Change" },
  ];

  const eolOptions = [
    { value: "auto", label: "Auto" },
    { value: "\n", label: "LF (\\n)" },
    { value: "\r\n", label: "CRLF (\\r\\n)" },
  ];

  const encodingOptions = [
    { value: "utf8", label: "UTF-8" },
    { value: "utf8bom", label: "UTF-8 with BOM" },
    { value: "utf16le", label: "UTF-16 LE" },
    { value: "utf16be", label: "UTF-16 BE" },
    { value: "ascii", label: "ASCII" },
    { value: "iso88591", label: "ISO-8859-1" },
  ];

  return (
    <div class="space-y-6 max-h-[500px] overflow-y-auto pr-2">
      {/* Scope indicator */}
      <Show when={scope() === "workspace"}>
        <div class="text-xs text-purple-400 bg-purple-500/10 rounded-lg px-3 py-2 mb-4">
          Editing workspace-specific file settings. Changes apply only to this workspace.
        </div>
      </Show>

      {/* File Associations Section */}
      <SectionHeader 
        title="File Associations" 
        description="Associate file patterns with languages for syntax highlighting"
        icon={<Icon name="file" class="h-4 w-4" />}
      />
      
      <div class="space-y-4">
        {/* Add new association form */}
        <AddAssociationForm onAdd={handleAddAssociation} />

        {/* Existing associations list */}
        <div class="space-y-2">
          <Show 
            when={associationEntries().length > 0}
            fallback={
              <div class="text-center py-6 text-foreground-muted text-sm">
                No custom file associations configured.
                <br />
                <span class="text-xs">Add patterns above to customize language detection.</span>
              </div>
            }
          >
            <div class="text-xs text-foreground-muted mb-2">
              {associationEntries().length} custom association{associationEntries().length !== 1 ? "s" : ""}
            </div>
            <For each={associationEntries()}>
              {([pattern, languageId]) => (
                <FileAssociationRow
                  pattern={pattern}
                  languageId={languageId}
                  onLanguageChange={(newLang) => handleUpdateAssociation(pattern, newLang)}
                  onRemove={() => handleRemoveAssociation(pattern)}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Reset associations button */}
        <Show when={associationEntries().length > 0}>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (confirm("Remove all file associations?")) {
                await updateSetting("associations", {});
              }
            }}
          >
            Clear All Associations
          </Button>
        </Show>
      </div>

      {/* Auto Save */}
      <SectionHeader title="Auto Save" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Auto Save" 
          settingKey="autoSave"
          hasOverride={hasOverride("autoSave")}
          isModified={isModified("autoSave")}
          onReset={() => resetOverride("autoSave")}
          onResetToDefault={() => resetToDefault("autoSave")}
        >
          <select
            value={files().autoSave}
            onChange={(e) => updateSetting("autoSave", e.currentTarget.value as FilesSettings["autoSave"])}
            class={`settings-inline-select ${hasOverride("autoSave") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={autoSaveOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>

        <Show when={files().autoSave === "afterDelay"}>
          <SettingRowWithOverride 
            label="Auto Save Delay (ms)" 
            settingKey="autoSaveDelay"
            hasOverride={hasOverride("autoSaveDelay")}
            isModified={isModified("autoSaveDelay")}
            onReset={() => resetOverride("autoSaveDelay")}
            onResetToDefault={() => resetToDefault("autoSaveDelay")}
          >
            <input
              type="number"
              min="100"
              max="60000"
              step="100"
              value={files().autoSaveDelay}
              onChange={(e) => updateSetting("autoSaveDelay", parseInt(e.currentTarget.value))}
              class={`settings-inline-input w-24 ${hasOverride("autoSaveDelay") ? "ring-1 ring-purple-500/50" : ""}`}
            />
          </SettingRowWithOverride>
        </Show>
      </FormGroup>

      {/* File Formatting */}
      <SectionHeader title="File Formatting" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Trim Trailing Whitespace" 
          settingKey="trimTrailingWhitespace"
          hasOverride={hasOverride("trimTrailingWhitespace")}
          isModified={isModified("trimTrailingWhitespace")}
          onReset={() => resetOverride("trimTrailingWhitespace")}
          onResetToDefault={() => resetToDefault("trimTrailingWhitespace")}
        >
          <Toggle
            checked={files().trimTrailingWhitespace}
            onChange={(checked) => updateSetting("trimTrailingWhitespace", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Insert Final Newline" 
          settingKey="insertFinalNewline"
          hasOverride={hasOverride("insertFinalNewline")}
          isModified={isModified("insertFinalNewline")}
          onReset={() => resetOverride("insertFinalNewline")}
          onResetToDefault={() => resetToDefault("insertFinalNewline")}
        >
          <Toggle
            checked={files().insertFinalNewline}
            onChange={(checked) => updateSetting("insertFinalNewline", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Trim Final Newlines" 
          settingKey="trimFinalNewlines"
          hasOverride={hasOverride("trimFinalNewlines")}
          isModified={isModified("trimFinalNewlines")}
          onReset={() => resetOverride("trimFinalNewlines")}
          onResetToDefault={() => resetToDefault("trimFinalNewlines")}
        >
          <Toggle
            checked={files().trimFinalNewlines}
            onChange={(checked) => updateSetting("trimFinalNewlines", checked)}
          />
        </SettingRowWithOverride>
      </FormGroup>

      {/* Encoding & Line Endings */}
      <SectionHeader title="Encoding & Line Endings" />
      <FormGroup>
        <SettingRowWithOverride 
          label="Default Encoding" 
          settingKey="encoding"
          hasOverride={hasOverride("encoding")}
          isModified={isModified("encoding")}
          onReset={() => resetOverride("encoding")}
          onResetToDefault={() => resetToDefault("encoding")}
        >
          <select
            value={files().encoding}
            onChange={(e) => updateSetting("encoding", e.currentTarget.value)}
            class={`settings-inline-select ${hasOverride("encoding") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={encodingOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Line Endings" 
          settingKey="eol"
          hasOverride={hasOverride("eol")}
          isModified={isModified("eol")}
          onReset={() => resetOverride("eol")}
          onResetToDefault={() => resetToDefault("eol")}
        >
          <select
            value={files().eol}
            onChange={(e) => updateSetting("eol", e.currentTarget.value as FilesSettings["eol"])}
            class={`settings-inline-select ${hasOverride("eol") ? "ring-1 ring-purple-500/50" : ""}`}
          >
            <For each={eolOptions}>
              {(opt) => <option value={opt.value}>{opt.label}</option>}
            </For>
          </select>
        </SettingRowWithOverride>
      </FormGroup>

      {/* File Behavior */}
      <SectionHeader 
        title="File Behavior" 
        description="Settings for file operations and deletion"
        icon={<Icon name="file" class="h-4 w-4" />}
      />
      <FormGroup>
        <SettingRowWithOverride 
          label="Confirm Before Deleting Files" 
          settingKey="confirmDelete"
          hasOverride={hasOverride("confirmDelete")}
          isModified={isModified("confirmDelete")}
          onReset={() => resetOverride("confirmDelete")}
          onResetToDefault={() => resetToDefault("confirmDelete")}
        >
          <Toggle
            checked={files().confirmDelete}
            onChange={(checked) => updateSetting("confirmDelete", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Move Deleted Files to Trash" 
          settingKey="enableTrash"
          hasOverride={hasOverride("enableTrash")}
          isModified={isModified("enableTrash")}
          onReset={() => resetOverride("enableTrash")}
          onResetToDefault={() => resetToDefault("enableTrash")}
        >
          <Toggle
            checked={files().enableTrash}
            onChange={(checked) => updateSetting("enableTrash", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Confirm Drag and Drop" 
          settingKey="confirmDragAndDrop"
          hasOverride={hasOverride("confirmDragAndDrop")}
          isModified={isModified("confirmDragAndDrop")}
          onReset={() => resetOverride("confirmDragAndDrop")}
          onResetToDefault={() => resetToDefault("confirmDragAndDrop")}
        >
          <Toggle
            checked={files().confirmDragAndDrop}
            onChange={(checked) => updateSetting("confirmDragAndDrop", checked)}
          />
        </SettingRowWithOverride>

        <SettingRowWithOverride 
          label="Max Memory for Large Files" 
          settingKey="maxMemoryForLargeFilesMB"
          hasOverride={hasOverride("maxMemoryForLargeFilesMB")}
          isModified={isModified("maxMemoryForLargeFilesMB")}
          onReset={() => resetOverride("maxMemoryForLargeFilesMB")}
          onResetToDefault={() => resetToDefault("maxMemoryForLargeFilesMB")}
        >
          <NumberWithSlider
            value={files().maxMemoryForLargeFilesMB}
            onChange={(value) => updateSetting("maxMemoryForLargeFilesMB", value)}
            min={256}
            max={16384}
            step={256}
            unit="MB"
            hasOverride={hasOverride("maxMemoryForLargeFilesMB")}
          />
        </SettingRowWithOverride>
        
        <div class="text-xs text-foreground-muted px-4 pb-2 -mt-2">
          <Icon name="circle-exclamation" class="inline h-3 w-3 mr-1" />
          Files larger than this will show a warning before opening
        </div>
      </FormGroup>

      {/* Search Exclude Patterns */}
      <SectionHeader 
        title="Search Exclude Patterns" 
        description="Glob patterns to exclude from file search results"
        icon={<Icon name="magnifying-glass" class="h-4 w-4" />}
      />
      
      <div class="space-y-4">
        {/* Add new pattern form */}
        <AddSearchExcludeForm onAdd={handleAddSearchExclude} />

        {/* Existing patterns list */}
        <div class="space-y-2">
          <Show 
            when={searchExcludePatterns().length > 0}
            fallback={
              <div class="text-center py-6 text-foreground-muted text-sm">
                No search exclude patterns configured.
                <br />
                <span class="text-xs">Add patterns above to exclude files from search.</span>
              </div>
            }
          >
            <div class="text-xs text-foreground-muted mb-2">
              {searchExcludePatterns().length} exclude pattern{searchExcludePatterns().length !== 1 ? "s" : ""}
            </div>
            <For each={searchExcludePatterns()}>
              {([pattern, enabled]) => (
                <SearchExcludePatternRow
                  pattern={pattern}
                  enabled={enabled}
                  onToggle={(newEnabled) => handleToggleSearchExclude(pattern, newEnabled)}
                  onRemove={() => handleRemoveSearchExclude(pattern)}
                />
              )}
            </For>
          </Show>
        </div>

        {/* Reset patterns button */}
        <Show when={searchExcludePatterns().length > 0}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Remove all search exclude patterns?")) {
                updateSearchSetting("exclude", {});
              }
            }}
          >
            Clear All Patterns
          </Button>
        </Show>
      </div>

      {/* Reset Button */}
      <div class="pt-4 border-t border-border">
        <Show 
          when={scope() === "user"}
          fallback={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const keys: (keyof FilesSettings)[] = [
                  "autoSave", "autoSaveDelay", "trimTrailingWhitespace", 
                  "insertFinalNewline", "trimFinalNewlines", "encoding", 
                  "eol", "confirmDragAndDrop", "confirmDelete", "enableTrash",
                  "maxMemoryForLargeFilesMB", "associations"
                ];
                keys.forEach(key => {
                  if (hasOverride(key)) {
                    resetOverride(key);
                  }
                });
              }}
            >
              Reset All Workspace File Overrides
            </Button>
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => settings.resetSection("files")}
          >
            Reset Files Settings to Defaults
          </Button>
        </Show>
      </div>
    </div>
  );
}
