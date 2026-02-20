/**
 * Rules Library Panel Component
 *
 * UI for managing AI instruction rules, browsing available rules,
 * and previewing how rules affect AI context.
 */

import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";
import {
  useRulesLibrary,
  type Rule,
  type RuleSource,
  type RulesFile,
  type RulePreview,
} from "@/context/RulesLibraryContext";
import { RulesEditor } from "./RulesEditor";

interface RulesLibraryPanelProps {
  onRuleSelected?: (rule: Rule) => void;
  compact?: boolean;
}

export function RulesLibraryPanel(props: RulesLibraryPanelProps) {
  const rulesLibrary = useRulesLibrary();

  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set(["builtin/coding-standards.rules"]));
  const [showPreview, setShowPreview] = createSignal(false);
  const [showFilters, setShowFilters] = createSignal(false);

  const filteredRules = createMemo(() => rulesLibrary.getFilteredRules());
  const allTags = createMemo(() => rulesLibrary.getAllTags());
  const preview = createMemo(() => rulesLibrary.previewRules());

  const toggleFileExpanded = (path: string) => {
    const expanded = new Set(expandedFiles());
    if (expanded.has(path)) {
      expanded.delete(path);
    } else {
      expanded.add(path);
    }
    setExpandedFiles(expanded);
  };

  const handleToggleRule = async (rule: Rule, e: Event) => {
    e.stopPropagation();
    await rulesLibrary.toggleRule(rule.id);
  };

  const handleEditRule = (rule: Rule, filePath: string, e: Event) => {
    e.stopPropagation();
    rulesLibrary.editRule(rule, filePath);
  };

  const handleDeleteRule = async (rule: Rule, e: Event) => {
    e.stopPropagation();
    if (confirm(`Delete rule "${rule.name}"?`)) {
      await rulesLibrary.deleteRule(rule.id);
    }
  };

  const handleDuplicateRule = async (rule: Rule, e: Event) => {
    e.stopPropagation();
    await rulesLibrary.duplicateRule(rule.id);
  };

  const getSourceLabel = (source: RuleSource): string => {
    switch (source) {
      case "project":
        return "Project";
      case "user":
        return "Custom";
      case "builtin":
        return "Built-in";
    }
  };

  const groupedRulesFiles = createMemo(() => {
    const files = rulesLibrary.state.rulesFiles;
    return {
      project: files.filter(f => f.source === "project"),
      user: files.filter(f => f.source === "user"),
      builtin: files.filter(f => f.source === "builtin"),
    };
  });

  return (
    <div class={`flex flex-col h-full ${props.compact ? "text-sm" : ""}`}>
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <Icon name="book-open" class="h-4 w-4" style={{ color: "var(--color-primary)" }} />
          <span class="font-medium">Rules Library</span>
          <span class="text-xs text-foreground-muted">
            ({rulesLibrary.getEnabledRules().length}/{rulesLibrary.getAllRules().length})
          </span>
        </div>
        <div class="flex items-center gap-1">
          <button
            onClick={() => setShowPreview(!showPreview())}
            class={`p-1 rounded transition-colors ${showPreview() ? "bg-primary/20 text-primary" : "hover:bg-background-tertiary"}`}
            title="Preview Active Rules"
          >
            <Icon name="eye" class="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters())}
            class={`p-1 rounded transition-colors ${showFilters() ? "bg-primary/20 text-primary" : "hover:bg-background-tertiary"}`}
            title="Filter Rules"
          >
            <Icon name="filter" class="h-4 w-4" />
          </button>
          <button
            onClick={() => rulesLibrary.createNewRule()}
            class="p-1 rounded hover:bg-background-tertiary transition-colors"
            title="Create Rule"
          >
            <Icon name="plus" class="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div class="px-3 py-2 border-b border-border">
        <div class="relative">
          <Icon name="magnifying-glass" class="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted" />
          <input
            type="text"
            value={rulesLibrary.state.searchQuery}
            onInput={(e) => rulesLibrary.setSearchQuery(e.currentTarget.value)}
            placeholder="Search rules..."
            class="w-full pl-7 pr-3 py-1.5 rounded text-sm bg-background-tertiary border border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Filters */}
      <Show when={showFilters()}>
        <div class="px-3 py-2 border-b border-border space-y-2">
          {/* Source Filter */}
          <div class="flex items-center gap-2">
            <span class="text-xs text-foreground-muted w-14">Source:</span>
            <div class="flex gap-1">
              <For each={["all", "project", "user", "builtin"] as const}>
                {(source) => (
                  <button
                    onClick={() => rulesLibrary.setFilterSource(source)}
                    class={`px-2 py-0.5 rounded text-xs transition-colors ${
                      rulesLibrary.state.filterSource === source
                        ? "bg-primary text-white"
                        : "bg-background-tertiary hover:bg-background-secondary"
                    }`}
                  >
                    {source === "all" ? "All" : getSourceLabel(source)}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Tags Filter */}
          <div class="flex items-start gap-2">
            <span class="text-xs text-foreground-muted w-14 pt-0.5">Tags:</span>
            <div class="flex flex-wrap gap-1">
              <For each={allTags()}>
                {(tag) => (
                  <button
                    onClick={() => {
                      const current = rulesLibrary.state.filterTags;
                      if (current.includes(tag)) {
                        rulesLibrary.setFilterTags(current.filter(t => t !== tag));
                      } else {
                        rulesLibrary.setFilterTags([...current, tag]);
                      }
                    }}
                    class={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                      rulesLibrary.state.filterTags.includes(tag)
                        ? "bg-primary/20 text-primary border border-primary"
                        : "bg-background-tertiary border border-transparent hover:border-border"
                    }`}
                  >
                    <Icon name="hashtag" class="h-2.5 w-2.5" />
                    {tag}
                  </button>
                )}
              </For>
              <Show when={allTags().length === 0}>
                <span class="text-xs text-foreground-muted italic">No tags</span>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Preview Panel */}
      <Show when={showPreview()}>
        <PreviewPanel preview={preview()} onClose={() => setShowPreview(false)} />
      </Show>

      {/* Rule Editor */}
      <RulesEditor />

      {/* Rules List */}
      <div class="flex-1 overflow-y-auto">
        <Show
          when={rulesLibrary.getAllRules().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center p-4 text-center text-foreground-muted">
              <Icon name="book-open" class="h-8 w-8 mb-2 opacity-50" />
              <p class="text-sm">No rules configured</p>
              <button
                onClick={() => rulesLibrary.createNewRule()}
                class="mt-2 text-xs text-primary hover:underline"
              >
                Create your first rule
              </button>
            </div>
          }
        >
          {/* Project Rules */}
          <Show when={groupedRulesFiles().project.length > 0}>
            <RulesSection
              title="Project Rules"
              icon={<Icon name="folder" class="h-3 w-3" />}
              files={groupedRulesFiles().project}
              expandedFiles={expandedFiles()}
              onToggleFile={toggleFileExpanded}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
              onDuplicateRule={handleDuplicateRule}
              selectedRuleId={rulesLibrary.state.selectedRuleId}
              onSelectRule={(rule) => {
                rulesLibrary.selectRule(rule.id);
                props.onRuleSelected?.(rule);
              }}
              filteredRuleIds={new Set(filteredRules().map(r => r.id))}
            />
          </Show>

          {/* User Rules */}
          <Show when={groupedRulesFiles().user.length > 0}>
            <RulesSection
              title="Custom Rules"
              icon={<Icon name="user" class="h-3 w-3" />}
              files={groupedRulesFiles().user}
              expandedFiles={expandedFiles()}
              onToggleFile={toggleFileExpanded}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
              onDuplicateRule={handleDuplicateRule}
              selectedRuleId={rulesLibrary.state.selectedRuleId}
              onSelectRule={(rule) => {
                rulesLibrary.selectRule(rule.id);
                props.onRuleSelected?.(rule);
              }}
              filteredRuleIds={new Set(filteredRules().map(r => r.id))}
            />
          </Show>

          {/* Built-in Rules */}
          <Show when={groupedRulesFiles().builtin.length > 0}>
            <RulesSection
              title="Built-in Rules"
              icon={<Icon name="gear" class="h-3 w-3" />}
              files={groupedRulesFiles().builtin}
              expandedFiles={expandedFiles()}
              onToggleFile={toggleFileExpanded}
              onToggleRule={handleToggleRule}
              onEditRule={handleEditRule}
              onDeleteRule={handleDeleteRule}
              onDuplicateRule={handleDuplicateRule}
              selectedRuleId={rulesLibrary.state.selectedRuleId}
              onSelectRule={(rule) => {
                rulesLibrary.selectRule(rule.id);
                props.onRuleSelected?.(rule);
              }}
              filteredRuleIds={new Set(filteredRules().map(r => r.id))}
            />
          </Show>
        </Show>
      </div>

      {/* Footer Actions */}
      <div class="flex items-center justify-between px-3 py-2 border-t border-border text-xs">
        <div class="flex items-center gap-2">
          <button
            onClick={() => rulesLibrary.enableAllRules()}
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-background-tertiary transition-colors"
            title="Enable All"
          >
            <Icon name="check" class="h-3 w-3 text-green-500" />
            <span>Enable All</span>
          </button>
          <button
            onClick={() => rulesLibrary.disableAllRules()}
            class="flex items-center gap-1 px-2 py-1 rounded hover:bg-background-tertiary transition-colors"
            title="Disable All"
          >
            <Icon name="xmark" class="h-3 w-3 text-red-500" />
            <span>Disable All</span>
          </button>
        </div>
        <div class="flex items-center gap-1 text-foreground-muted">
          <Icon name="circle-info" class="h-3 w-3" />
          <span>{preview().estimatedTokens} tokens</span>
        </div>
      </div>
    </div>
  );
}

// =====================
// Rules Section Component
// =====================

interface RulesSectionProps {
  title: string;
  icon: any;
  files: RulesFile[];
  expandedFiles: Set<string>;
  onToggleFile: (path: string) => void;
  onToggleRule: (rule: Rule, e: Event) => void;
  onEditRule: (rule: Rule, filePath: string, e: Event) => void;
  onDeleteRule: (rule: Rule, e: Event) => void;
  onDuplicateRule: (rule: Rule, e: Event) => void;
  selectedRuleId: string | null;
  onSelectRule: (rule: Rule) => void;
  filteredRuleIds: Set<string>;
}

function RulesSection(props: RulesSectionProps) {
  const [collapsed, setCollapsed] = createSignal(false);

  const totalRules = createMemo(() => props.files.reduce((sum, f) => sum + f.rules.length, 0));
  const enabledRules = createMemo(() => 
    props.files.reduce((sum, f) => sum + f.rules.filter(r => r.enabled).length, 0)
  );

  return (
    <div class="border-b border-border">
      {/* Section Header */}
      <div
        class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-background-tertiary transition-colors"
        onClick={() => setCollapsed(!collapsed())}
      >
        {collapsed() ? (
          <Icon name="chevron-right" class="h-3 w-3 flex-shrink-0" />
        ) : (
          <Icon name="chevron-down" class="h-3 w-3 flex-shrink-0" />
        )}
        {props.icon}
        <span class="text-xs font-medium flex-1">{props.title}</span>
        <span class="text-xs text-foreground-muted">
          {enabledRules()}/{totalRules()}
        </span>
      </div>

      {/* Files and Rules */}
      <Show when={!collapsed()}>
        <div class="pb-1">
          <For each={props.files}>
            {(file) => (
              <FileItem
                file={file}
                expanded={props.expandedFiles.has(file.path)}
                onToggleExpand={() => props.onToggleFile(file.path)}
                onToggleRule={props.onToggleRule}
                onEditRule={(rule, e) => props.onEditRule(rule, file.path, e)}
                onDeleteRule={props.onDeleteRule}
                onDuplicateRule={props.onDuplicateRule}
                selectedRuleId={props.selectedRuleId}
                onSelectRule={props.onSelectRule}
                filteredRuleIds={props.filteredRuleIds}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// =====================
// File Item Component
// =====================

interface FileItemProps {
  file: RulesFile;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleRule: (rule: Rule, e: Event) => void;
  onEditRule: (rule: Rule, e: Event) => void;
  onDeleteRule: (rule: Rule, e: Event) => void;
  onDuplicateRule: (rule: Rule, e: Event) => void;
  selectedRuleId: string | null;
  onSelectRule: (rule: Rule) => void;
  filteredRuleIds: Set<string>;
}

function FileItem(props: FileItemProps) {
  const visibleRules = createMemo(() => 
    props.file.rules.filter(r => props.filteredRuleIds.has(r.id))
  );
  const enabledCount = createMemo(() => visibleRules().filter(r => r.enabled).length);

  return (
    <div class="ml-3">
      {/* File Header */}
      <div
        class="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-background-tertiary/50 rounded transition-colors"
        onClick={props.onToggleExpand}
      >
        {props.expanded ? (
          <Icon name="chevron-down" class="h-3 w-3 flex-shrink-0 text-foreground-muted" />
        ) : (
          <Icon name="chevron-right" class="h-3 w-3 flex-shrink-0 text-foreground-muted" />
        )}
        <span class="text-xs truncate flex-1">{props.file.name}</span>
        <span class="text-[10px] text-foreground-muted">
          {enabledCount()}/{visibleRules().length}
        </span>
      </div>

      {/* Rules */}
      <Show when={props.expanded}>
        <div class="ml-4 space-y-0.5">
          <For each={visibleRules()}>
            {(rule) => (
              <RuleItem
                rule={rule}
                selected={props.selectedRuleId === rule.id}
                onToggle={(e) => props.onToggleRule(rule, e)}
                onEdit={(e) => props.onEditRule(rule, e)}
                onDelete={(e) => props.onDeleteRule(rule, e)}
                onDuplicate={(e) => props.onDuplicateRule(rule, e)}
                onSelect={() => props.onSelectRule(rule)}
              />
            )}
          </For>
          <Show when={visibleRules().length === 0}>
            <div class="text-[10px] text-foreground-muted italic px-2 py-1">
              No matching rules
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

// =====================
// Rule Item Component
// =====================

interface RuleItemProps {
  rule: Rule;
  selected: boolean;
  onToggle: (e: Event) => void;
  onEdit: (e: Event) => void;
  onDelete: (e: Event) => void;
  onDuplicate: (e: Event) => void;
  onSelect: () => void;
}

function RuleItem(props: RuleItemProps) {
  const [showActions, setShowActions] = createSignal(false);

  return (
    <div
      class={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
        props.selected
          ? "bg-primary/10 border border-primary/30"
          : "hover:bg-background-tertiary border border-transparent"
      }`}
      onClick={props.onSelect}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Toggle Button */}
      <button
        onClick={props.onToggle}
        class={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
          props.rule.enabled
            ? "bg-green-500/20 text-green-500"
            : "bg-foreground-muted/20 text-foreground-muted"
        }`}
        title={props.rule.enabled ? "Disable rule" : "Enable rule"}
      >
        {props.rule.enabled ? (
          <Icon name="check" class="h-2.5 w-2.5" />
        ) : (
          <Icon name="eye-slash" class="h-2.5 w-2.5" />
        )}
      </button>

      {/* Rule Info */}
      <div class="flex-1 min-w-0">
        <div class={`text-xs truncate ${props.rule.enabled ? "" : "text-foreground-muted"}`}>
          {props.rule.name}
        </div>
        <Show when={props.rule.tags.length > 0}>
          <div class="flex gap-1 mt-0.5">
            <For each={props.rule.tags.slice(0, 3)}>
              {(tag) => (
                <span class="text-[9px] px-1 rounded bg-background-tertiary text-foreground-muted">
                  {tag}
                </span>
              )}
            </For>
            <Show when={props.rule.tags.length > 3}>
              <span class="text-[9px] text-foreground-muted">+{props.rule.tags.length - 3}</span>
            </Show>
          </div>
        </Show>
      </div>

      {/* Priority Badge */}
      <span class="text-[9px] text-foreground-muted px-1 rounded bg-background-tertiary">
        P{props.rule.priority}
      </span>

      {/* Action Buttons */}
      <div
        class={`flex items-center gap-0.5 transition-opacity ${
          showActions() ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={props.onEdit}
          class="p-1 rounded hover:bg-background-secondary transition-colors"
          title="Edit rule"
        >
          <Icon name="pen" class="h-3 w-3" />
        </button>
        <button
          onClick={props.onDuplicate}
          class="p-1 rounded hover:bg-background-secondary transition-colors"
          title="Duplicate rule"
        >
          <Icon name="copy" class="h-3 w-3" />
        </button>
        <button
          onClick={props.onDelete}
          class="p-1 rounded hover:bg-background-secondary transition-colors text-red-500"
          title="Delete rule"
        >
          <Icon name="trash" class="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// =====================
// Preview Panel Component
// =====================

interface PreviewPanelProps {
  preview: RulePreview;
  onClose: () => void;
}

function PreviewPanel(props: PreviewPanelProps) {
  const [copied, setCopied] = createSignal(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(props.preview.previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="border-b border-border">
      {/* Preview Header */}
      <div class="flex items-center justify-between px-3 py-2 bg-background-tertiary">
        <div class="flex items-center gap-2">
          <Icon name="eye" class="h-3 w-3" style={{ color: "var(--color-primary)" }} />
          <span class="text-xs font-medium">Active Rules Preview</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-foreground-muted">
            {props.preview.enabledRules} rules • {props.preview.estimatedTokens} tokens
          </span>
          <button
            onClick={copyToClipboard}
            class="p-1 rounded hover:bg-background-secondary transition-colors"
            title="Copy to clipboard"
          >
            {copied() ? (
              <Icon name="check" class="h-3 w-3 text-green-500" />
            ) : (
              <Icon name="copy" class="h-3 w-3" />
            )}
          </button>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-background-secondary transition-colors"
          >
            <Icon name="xmark" class="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Warnings */}
      <Show when={props.preview.warnings.length > 0}>
        <div class="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <For each={props.preview.warnings}>
            {(warning) => (
              <div class="flex items-start gap-2 text-xs text-yellow-600">
                <Icon name="triangle-exclamation" class="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Preview Content */}
      <div class="max-h-48 overflow-y-auto p-3 text-xs font-mono bg-background-tertiary/50">
        <Show
          when={props.preview.previewText}
          fallback={
            <span class="text-foreground-muted italic">No rules enabled</span>
          }
        >
          <pre class="whitespace-pre-wrap break-words">{props.preview.previewText}</pre>
        </Show>
      </div>
    </div>
  );
}

/**
 * Compact rules selector for embedding in chat interfaces
 */
export function RulesSelector(_props: {
  onRulesChanged?: (enabledCount: number) => void;
}) {
  const rulesLibrary = useRulesLibrary();
  const enabledRules = createMemo(() => rulesLibrary.getEnabledRules());

  return (
    <div class="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => rulesLibrary.openPanel()}
        class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-background-tertiary hover:bg-background-secondary transition-colors"
      >
        <Icon name="book-open" class="h-3 w-3" />
        <span>{enabledRules().length} rules active</span>
      </button>
    </div>
  );
}

/**
 * Rules status badge for status bar
 */
export function RulesStatusBadge() {
  const rulesLibrary = useRulesLibrary();
  const enabledRules = createMemo(() => rulesLibrary.getEnabledRules());
  const preview = createMemo(() => rulesLibrary.previewRules());

  return (
    <button
      onClick={() => rulesLibrary.openPanel()}
      class="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-background-tertiary transition-colors"
      title={`${enabledRules().length} rules active (${preview().estimatedTokens} tokens)`}
    >
      <Icon name="book-open" class="h-3 w-3" />
      <span>{enabledRules().length}</span>
      <Show when={preview().warnings.length > 0}>
        <Icon name="triangle-exclamation" class="h-3 w-3 text-yellow-500" />
      </Show>
    </button>
  );
}
