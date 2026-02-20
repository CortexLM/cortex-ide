import { Show, For, createSignal, createMemo, createEffect } from "solid-js";
import { Icon } from '../ui/Icon';
import {
  useSemanticTokenCustomizations,
  SEMANTIC_TOKEN_TYPES,
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPE_INFO,
  SEMANTIC_TOKEN_MODIFIER_INFO,
  parseTokenSelector,
  buildTokenSelector,
  type SemanticTokenRule,
  type SemanticTokenRuleValue,
  type SemanticTokenType,
  type SemanticTokenModifier,
} from "@/context/SemanticTokenCustomizationsContext";

// ============================================================================
// Component Props
// ============================================================================

export interface SemanticTokenEditorProps {
  /** Theme name to edit */
  themeName?: string;
  /** Callback when changes are made */
  onChange?: () => void;
}

// ============================================================================
// Main Editor Component
// ============================================================================

export function SemanticTokenEditor(props: SemanticTokenEditorProps) {
  const semanticTokens = useSemanticTokenCustomizations();
  
  const themeName = () => props.themeName ?? semanticTokens.currentThemeName();
  const customizations = () => semanticTokens.getCustomizations(themeName());
  
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedCategories, setExpandedCategories] = createSignal<Set<string>>(new Set(["Types", "Variables", "Functions"]));
  const [editingRule, setEditingRule] = createSignal<string | null>(null);
  const [showAddRule, setShowAddRule] = createSignal(false);

  // Group rules by category
  const rulesByCategory = createMemo(() => {
    const categories: Record<string, Array<{ selector: string; value: SemanticTokenRuleValue }>> = {
      "Types": [],
      "Variables": [],
      "Functions": [],
      "Other Tokens": [],
      "Modifiers (*)": [],
    };

    const rules = semanticTokens.getAllRules(themeName());
    const query = searchQuery().toLowerCase();

    for (const rule of rules) {
      // Filter by search
      if (query && !rule.selector.toLowerCase().includes(query)) {
        continue;
      }

      const { type } = parseTokenSelector(rule.selector);
      
      if (type === null) {
        // Wildcard rules (*.deprecated, etc.)
        categories["Modifiers (*)"].push(rule);
      } else if (["type", "class", "interface", "enum", "struct", "typeParameter", "namespace"].includes(type)) {
        categories["Types"].push(rule);
      } else if (["variable", "property", "parameter", "enumMember"].includes(type)) {
        categories["Variables"].push(rule);
      } else if (["function", "method", "macro", "decorator", "event"].includes(type)) {
        categories["Functions"].push(rule);
      } else {
        categories["Other Tokens"].push(rule);
      }
    }

    return categories;
  });

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle rule change
  const handleRuleChange = (selector: string, value: SemanticTokenRuleValue) => {
    semanticTokens.setRule(themeName(), selector, value);
    props.onChange?.();
  };

  // Handle rule delete
  const handleRuleDelete = (selector: string) => {
    semanticTokens.removeRule(themeName(), selector);
    props.onChange?.();
  };

  // Handle export
  const handleExport = () => {
    const json = semanticTokens.exportCustomizations();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "semantic-token-customizations.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle import
  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        if (semanticTokens.importCustomizations(text)) {
          props.onChange?.();
        }
      }
    };
    input.click();
  };

  return (
    <div class="semantic-token-editor h-full flex flex-col">
      {/* Header */}
      <div class="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div>
          <h3 class="text-lg font-semibold">Semantic Token Colors</h3>
          <p class="text-sm text-foreground-muted">
            Customize colors for semantic tokens from language servers
          </p>
        </div>
        
        {/* Enable/Disable toggle */}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={customizations().enabled}
            onChange={(e) => {
              semanticTokens.setEnabled(themeName(), e.currentTarget.checked);
              props.onChange?.();
            }}
            class="w-4 h-4 rounded border-border"
          />
          <span class="text-sm">Enable semantic highlighting</span>
        </label>
      </div>

      {/* Toolbar */}
      <div class="flex items-center justify-between gap-4 mb-4">
        {/* Search */}
        <div class="relative flex-1 max-w-xs">
          <Icon name="magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Search tokens..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        <div class="flex items-center gap-2">
          {/* Add rule */}
          <button
            onClick={() => setShowAddRule(true)}
            class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active hover:bg-background-tertiary transition-colors"
          >
            <Icon name="plus" class="h-3.5 w-3.5" />
            Add Rule
          </button>

          {/* Reset */}
          <button
            onClick={() => {
              semanticTokens.resetTheme(themeName());
              props.onChange?.();
            }}
            class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active hover:bg-background-tertiary transition-colors"
          >
            <Icon name="rotate-left" class="h-3.5 w-3.5" />
            Reset
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active hover:bg-background-tertiary transition-colors"
          >
            <Icon name="upload" class="h-3.5 w-3.5" />
            Import
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            class="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-border-active hover:bg-background-tertiary transition-colors"
          >
            <Icon name="download" class="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Rules list */}
      <div class="flex-1 overflow-y-auto rounded-lg border border-border">
        <Show
          when={customizations().enabled}
          fallback={
            <div class="flex h-32 items-center justify-center text-foreground-muted">
              Semantic highlighting is disabled
            </div>
          }
        >
          <For each={Object.entries(rulesByCategory())}>
            {([category, rules]) => (
              <Show when={rules.length > 0}>
                <div class="border-b border-border last:border-b-0">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    class="w-full flex items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground-muted hover:bg-background-tertiary transition-colors"
                  >
                    <Show
                      when={expandedCategories().has(category)}
                      fallback={<Icon name="chevron-right" class="h-4 w-4" />}
                    >
                      <Icon name="chevron-down" class="h-4 w-4" />
                    </Show>
                    {category}
                    <span class="ml-auto text-xs font-normal">
                      {rules.length} rule{rules.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {/* Rules */}
                  <Show when={expandedCategories().has(category)}>
                    <For each={rules}>
                      {(rule) => (
                        <SemanticTokenRuleRow
                          selector={rule.selector}
                          value={rule.value}
                          isEditing={editingRule() === rule.selector}
                          onStartEdit={() => setEditingRule(rule.selector)}
                          onStopEdit={() => setEditingRule(null)}
                          onChange={(value) => handleRuleChange(rule.selector, value)}
                          onDelete={() => handleRuleDelete(rule.selector)}
                          getPreviewStyle={semanticTokens.getPreviewStyle}
                        />
                      )}
                    </For>
                  </Show>
                </div>
              </Show>
            )}
          </For>
        </Show>
      </div>

      {/* Add rule dialog */}
      <Show when={showAddRule()}>
        <AddRuleDialog
          existingSelectors={Object.keys(customizations().rules)}
          onAdd={(selector, value) => {
            handleRuleChange(selector, value);
            setShowAddRule(false);
          }}
          onClose={() => setShowAddRule(false)}
        />
      </Show>
    </div>
  );
}

// ============================================================================
// Rule Row Component
// ============================================================================

interface SemanticTokenRuleRowProps {
  selector: string;
  value: SemanticTokenRuleValue;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onChange: (value: SemanticTokenRuleValue) => void;
  onDelete: () => void;
  getPreviewStyle: (value: SemanticTokenRuleValue) => Record<string, string>;
}

function SemanticTokenRuleRow(props: SemanticTokenRuleRowProps) {
  const [editValue, setEditValue] = createSignal<SemanticTokenRule>({});

  // Initialize edit value when editing starts
  createEffect(() => {
    if (props.isEditing) {
      const v = props.value;
      setEditValue(typeof v === "string" ? { foreground: v } : { ...v });
    }
  });

  // Parse selector for display
  const { type } = parseTokenSelector(props.selector);

  // Get type info
  const typeInfo = type ? SEMANTIC_TOKEN_TYPE_INFO.find(t => t.type === type) : null;

  // Preview style
  const previewStyle = () => props.getPreviewStyle(props.value);

  const handleSave = () => {
    const v = editValue();
    // If only foreground is set, simplify to string
    const keys = Object.keys(v).filter(k => v[k as keyof SemanticTokenRule] !== undefined);
    if (keys.length === 1 && keys[0] === "foreground") {
      props.onChange(v.foreground!);
    } else {
      props.onChange(v);
    }
    props.onStopEdit();
  };

  return (
    <div class="group flex items-center gap-4 px-4 py-2 hover:bg-background-tertiary/50 transition-colors">
      {/* Selector */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <code class="font-mono text-sm">{props.selector}</code>
          <Show when={typeInfo}>
            <span class="text-xs text-foreground-muted">
              {typeInfo!.description}
            </span>
          </Show>
        </div>
      </div>

      {/* Preview */}
      <div class="w-32">
        <Show
          when={!props.isEditing}
          fallback={
            <div class="flex items-center gap-2">
              {/* Color picker */}
              <input
                type="color"
                value={editValue().foreground || "var(--cortex-text-primary)"}
                onInput={(e) => setEditValue(prev => ({ ...prev, foreground: e.currentTarget.value }))}
                class="w-8 h-8 rounded border border-border cursor-pointer"
              />
            </div>
          }
        >
          <div
            class="font-mono text-sm px-2 py-1 rounded border border-border bg-background"
            style={previewStyle()}
          >
            sample
          </div>
        </Show>
      </div>

      {/* Style controls (when editing) */}
      <Show when={props.isEditing}>
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editValue().bold}
              onChange={(e) => setEditValue(prev => ({ ...prev, bold: e.currentTarget.checked }))}
            />
            Bold
          </label>
          <label class="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editValue().italic}
              onChange={(e) => setEditValue(prev => ({ ...prev, italic: e.currentTarget.checked }))}
            />
            Italic
          </label>
          <label class="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editValue().underline}
              onChange={(e) => setEditValue(prev => ({ ...prev, underline: e.currentTarget.checked }))}
            />
            Underline
          </label>
          <label class="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={editValue().strikethrough}
              onChange={(e) => setEditValue(prev => ({ ...prev, strikethrough: e.currentTarget.checked }))}
            />
            Strike
          </label>
        </div>
      </Show>

      {/* Actions */}
      <div class="flex items-center gap-1">
        <Show
          when={!props.isEditing}
          fallback={
            <>
              <button
                onClick={handleSave}
                class="p-1.5 rounded hover:bg-green-500/20 text-green-500"
                title="Save"
              >
                <Icon name="check" class="h-4 w-4" />
              </button>
              <button
                onClick={props.onStopEdit}
                class="p-1.5 rounded hover:bg-red-500/20 text-red-500"
                title="Cancel"
              >
                <Icon name="xmark" class="h-4 w-4" />
              </button>
            </>
          }
        >
          <button
            onClick={props.onStartEdit}
            class="p-1.5 rounded hover:bg-background-tertiary text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit"
          >
            <Icon name="pen" class="h-4 w-4" />
          </button>
          <button
            onClick={props.onDelete}
            class="p-1.5 rounded hover:bg-red-500/10 text-foreground-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <Icon name="trash" class="h-4 w-4" />
          </button>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Add Rule Dialog
// ============================================================================

interface AddRuleDialogProps {
  existingSelectors: string[];
  onAdd: (selector: string, value: SemanticTokenRuleValue) => void;
  onClose: () => void;
}

function AddRuleDialog(props: AddRuleDialogProps) {
  const [selectedType, setSelectedType] = createSignal<SemanticTokenType | "*">("variable");
  const [selectedModifiers, setSelectedModifiers] = createSignal<SemanticTokenModifier[]>([]);
  const [foreground, setForeground] = createSignal("var(--cortex-text-primary)");
  const [bold, setBold] = createSignal(false);
  const [italic, setItalic] = createSignal(false);
  const [underline, setUnderline] = createSignal(false);
  const [strikethrough, setStrikethrough] = createSignal(false);

  const selector = createMemo(() => {
    const type = selectedType() === "*" ? null : selectedType();
    return buildTokenSelector(type, selectedModifiers());
  });

  const isExisting = createMemo(() => props.existingSelectors.includes(selector()));

  const handleAdd = () => {
    if (isExisting()) return;

    const rule: SemanticTokenRule = { foreground: foreground() };
    if (bold()) rule.bold = true;
    if (italic()) rule.italic = true;
    if (underline()) rule.underline = true;
    if (strikethrough()) rule.strikethrough = true;

    // Simplify to string if only foreground
    const keys = Object.keys(rule).filter(k => rule[k as keyof SemanticTokenRule] !== undefined && rule[k as keyof SemanticTokenRule] !== false);
    if (keys.length === 1 && keys[0] === "foreground") {
      props.onAdd(selector(), rule.foreground!);
    } else {
      props.onAdd(selector(), rule);
    }
  };

  const toggleModifier = (mod: SemanticTokenModifier) => {
    setSelectedModifiers(prev => {
      if (prev.includes(mod)) {
        return prev.filter(m => m !== mod);
      } else {
        return [...prev, mod];
      }
    });
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-background rounded-lg border border-border shadow-xl w-[500px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 class="text-lg font-semibold">Add Semantic Token Rule</h3>
          <button
            onClick={props.onClose}
            class="p-1 rounded hover:bg-background-tertiary"
          >
            <Icon name="xmark" class="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Token Type */}
          <div>
            <label class="block text-sm font-medium mb-2">Token Type</label>
            <select
              value={selectedType()}
              onChange={(e) => setSelectedType(e.currentTarget.value as SemanticTokenType | "*")}
              class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="*">* (All Types)</option>
              <For each={SEMANTIC_TOKEN_TYPES}>
                {(type) => {
                  const info = SEMANTIC_TOKEN_TYPE_INFO.find(t => t.type === type);
                  return (
                    <option value={type}>
                      {type} - {info?.label || type}
                    </option>
                  );
                }}
              </For>
            </select>
          </div>

          {/* Modifiers */}
          <div>
            <label class="block text-sm font-medium mb-2">Modifiers</label>
            <div class="flex flex-wrap gap-2">
              <For each={SEMANTIC_TOKEN_MODIFIERS}>
                {(mod) => {
                  const info = SEMANTIC_TOKEN_MODIFIER_INFO.find(m => m.modifier === mod);
                  return (
                    <button
                      onClick={() => toggleModifier(mod)}
                      class={`px-2 py-1 text-xs rounded border transition-colors ${
                        selectedModifiers().includes(mod)
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-border-active"
                      }`}
                      title={info?.description}
                    >
                      {mod}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Selector preview */}
          <div>
            <label class="block text-sm font-medium mb-2">Selector</label>
            <code class={`block px-3 py-2 rounded border bg-background-tertiary font-mono text-sm ${
              isExisting() ? "border-warning text-warning" : "border-border"
            }`}>
              {selector()}
            </code>
            <Show when={isExisting()}>
              <p class="mt-1 text-xs text-warning">This selector already exists</p>
            </Show>
          </div>

          {/* Color */}
          <div>
            <label class="block text-sm font-medium mb-2">Foreground Color</label>
            <div class="flex items-center gap-2">
              <input
                type="color"
                value={foreground()}
                onInput={(e) => setForeground(e.currentTarget.value)}
                class="w-10 h-10 rounded border border-border cursor-pointer"
              />
              <input
                type="text"
                value={foreground()}
                onInput={(e) => setForeground(e.currentTarget.value)}
                class="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                placeholder="var(--cortex-text-primary)"
              />
            </div>
          </div>

          {/* Font Style */}
          <div>
            <label class="block text-sm font-medium mb-2">Font Style</label>
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bold()}
                  onChange={(e) => setBold(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-sm font-bold">Bold</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={italic()}
                  onChange={(e) => setItalic(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-sm italic">Italic</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={underline()}
                  onChange={(e) => setUnderline(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-sm underline">Underline</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={strikethrough()}
                  onChange={(e) => setStrikethrough(e.currentTarget.checked)}
                  class="rounded"
                />
                <span class="text-sm line-through">Strikethrough</span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label class="block text-sm font-medium mb-2">Preview</label>
            <div
              class="px-3 py-2 rounded border border-border bg-background font-mono"
              style={{
                color: foreground(),
                "font-weight": bold() ? "bold" : "normal",
                "font-style": italic() ? "italic" : "normal",
                "text-decoration": [
                  underline() ? "underline" : "",
                  strikethrough() ? "line-through" : "",
                ].filter(Boolean).join(" ") || "none",
              }}
            >
              const exampleVariable = "sample text";
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={props.onClose}
            class="px-4 py-2 text-sm rounded-lg border border-border hover:border-border-active hover:bg-background-tertiary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isExisting()}
            class="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Quick Customization Panel
// ============================================================================

export interface SemanticTokenQuickPanelProps {
  themeName?: string;
}

/** A simpler panel for quick semantic token customization */
export function SemanticTokenQuickPanel(props: SemanticTokenQuickPanelProps) {
  const semanticTokens = useSemanticTokenCustomizations();
  const themeName = () => props.themeName ?? semanticTokens.currentThemeName();

  // Common tokens for quick access
  const commonTokens = [
    { selector: "variable", label: "Variables" },
    { selector: "variable.readonly", label: "Constants" },
    { selector: "parameter", label: "Parameters" },
    { selector: "function", label: "Functions" },
    { selector: "method", label: "Methods" },
    { selector: "type", label: "Types" },
    { selector: "class", label: "Classes" },
    { selector: "interface", label: "Interfaces" },
    { selector: "property", label: "Properties" },
    { selector: "namespace", label: "Namespaces" },
    { selector: "decorator", label: "Decorators" },
    { selector: "*.deprecated", label: "Deprecated" },
  ];

  const getColor = (selector: string): string => {
    const rules = semanticTokens.getCustomizations(themeName()).rules;
    const value = rules[selector];
    if (!value) return "var(--cortex-text-inactive)";
    return typeof value === "string" ? value : value.foreground || "var(--cortex-text-inactive)";
  };

  const setColor = (selector: string, color: string) => {
    semanticTokens.setRule(themeName(), selector, color);
  };

  return (
    <div class="semantic-token-quick-panel space-y-3">
      <div class="text-sm font-medium text-foreground-muted mb-2">
        Quick Token Colors
      </div>
      <div class="grid grid-cols-2 gap-2">
        <For each={commonTokens}>
          {(token) => (
            <div class="flex items-center gap-2">
              <input
                type="color"
                value={getColor(token.selector)}
                onInput={(e) => setColor(token.selector, e.currentTarget.value)}
                class="w-6 h-6 rounded border border-border cursor-pointer"
                title={token.selector}
              />
              <span class="text-sm truncate">{token.label}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export default SemanticTokenEditor;

