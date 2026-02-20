/**
 * EditorTokenColorCustomizations Component
 * 
 * UI for editing editor.tokenColorCustomizations settings.
 * Allows users to customize syntax highlighting colors.
 */

import { createSignal, createMemo, Show, For } from "solid-js";
import {
  useTokenColorCustomizations,
  TOKEN_TYPES,
  type TokenTypeInfo,
  type TextMateRule,
  type SimpleTokenCustomizations,
  type TokenColorCustomization,
  type TokenFontStyle,
} from "@/context/TokenColorCustomizationsContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "./FormComponents";

// ============================================================================
// Types
// ============================================================================

type Tab = "simple" | "textmate" | "global" | "theme";
type Scope = "global" | "theme";

// ============================================================================
// Simple Token Color Row Component
// ============================================================================

function SimpleTokenColorRow(props: {
  tokenType: TokenTypeInfo;
  currentValue: string | undefined;
  scope: Scope;
  themeName: string;
  onChangeGlobal: (tokenType: keyof SimpleTokenCustomizations, value: string) => void;
  onChangeTheme: (tokenType: keyof SimpleTokenCustomizations, value: string) => void;
  onRemoveGlobal: (tokenType: keyof SimpleTokenCustomizations) => void;
  onRemoveTheme: (tokenType: keyof SimpleTokenCustomizations) => void;
}) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [inputValue, setInputValue] = createSignal(props.currentValue || "");

  const hasValue = () => props.currentValue !== undefined;

  const handleColorInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const newColor = target.value;
    setInputValue(newColor);
    
    if (props.scope === "global") {
      props.onChangeGlobal(props.tokenType.key, newColor);
    } else {
      props.onChangeTheme(props.tokenType.key, newColor);
    }
  };

  const handleTextInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.value;
    setInputValue(value);
    
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value)) {
      if (props.scope === "global") {
        props.onChangeGlobal(props.tokenType.key, value);
      } else {
        props.onChangeTheme(props.tokenType.key, value);
      }
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(inputValue())) {
      setInputValue(props.currentValue || "");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTextBlur();
    } else if (e.key === "Escape") {
      setInputValue(props.currentValue || "");
      setIsEditing(false);
    }
  };

  const handleReset = () => {
    if (props.scope === "global") {
      props.onRemoveGlobal(props.tokenType.key);
    } else {
      props.onRemoveTheme(props.tokenType.key);
    }
    setInputValue("");
  };

  createMemo(() => {
    if (!isEditing() && props.currentValue) {
      setInputValue(props.currentValue);
    }
  });

  return (
    <div class="token-color-row">
      <div class="token-color-info">
        <span class="token-color-label">{props.tokenType.label}</span>
        <span class="token-color-description">{props.tokenType.description}</span>
        <div class="token-color-scopes">
          <For each={props.tokenType.scopes.slice(0, 3)}>
            {(scope) => <span class="token-color-scope">{scope}</span>}
          </For>
          <Show when={props.tokenType.scopes.length > 3}>
            <span class="token-color-scope-more">+{props.tokenType.scopes.length - 3} more</span>
          </Show>
        </div>
      </div>
      
      <div class="token-color-controls">
        {/* Color preview swatch */}
        <div
          class="token-color-preview"
          style={{
            "background-color": props.currentValue || "transparent",
            "color": props.currentValue || "var(--color-foreground-muted)",
          }}
        >
          Ab
        </div>
        
        {/* Color swatch with native picker */}
        <div class="token-color-swatch-wrapper">
          <input
            type="color"
            value={props.currentValue?.slice(0, 7) || "var(--cortex-text-primary)"}
            onInput={handleColorInput}
            class="token-color-native-input"
            title={`Pick color for ${props.tokenType.label}`}
          />
          <div
            class="token-color-swatch"
            style={{ 
              "background-color": props.currentValue || "transparent",
              "border-style": hasValue() ? "solid" : "dashed",
            }}
          />
        </div>
        
        {/* Hex value input */}
        <Show
          when={isEditing()}
          fallback={
            <button
              type="button"
              class="token-color-hex-display"
              onClick={() => setIsEditing(true)}
              title="Click to edit hex value"
            >
              {props.currentValue || "Not set"}
            </button>
          }
        >
          <input
            type="text"
            value={inputValue()}
            onInput={handleTextInput}
            onBlur={handleTextBlur}
            onKeyDown={handleKeyDown}
            class="token-color-hex-input"
            placeholder="#RRGGBB"
            maxLength={9}
            autofocus
          />
        </Show>
        
        {/* Reset button */}
        <Show when={hasValue()}>
          <button
            type="button"
            class="token-color-reset-btn"
            onClick={handleReset}
            title="Remove customization"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// TextMate Rule Editor Component
// ============================================================================

function TextMateRuleEditor(props: {
  rule: TextMateRule;
  index: number;
  scope: Scope;
  themeName: string;
  onUpdate: (index: number, rule: TextMateRule) => void;
  onRemove: (index: number) => void;
}) {
  const [isExpanded, setIsExpanded] = createSignal(false);
  const [name, setName] = createSignal(props.rule.name || "");
  const [scopeText, setScopeText] = createSignal(
    Array.isArray(props.rule.scope) ? props.rule.scope.join(", ") : props.rule.scope
  );
  const [foreground, setForeground] = createSignal(props.rule.settings.foreground || "");
  const [background, setBackground] = createSignal(props.rule.settings.background || "");
  const [fontStyle, setFontStyle] = createSignal<TokenFontStyle>(props.rule.settings.fontStyle || "");

  const displayScope = () => {
    const scope = props.rule.scope;
    if (Array.isArray(scope)) {
      return scope.length > 2 ? `${scope.slice(0, 2).join(", ")} +${scope.length - 2} more` : scope.join(", ");
    }
    return scope;
  };

  const handleUpdate = () => {
    const scopes = scopeText().split(",").map(s => s.trim()).filter(s => s.length > 0);
    
    const newRule: TextMateRule = {
      name: name() || undefined,
      scope: scopes.length === 1 ? scopes[0] : scopes,
      settings: {
        foreground: foreground() || undefined,
        background: background() || undefined,
        fontStyle: fontStyle() || undefined,
      },
    };

    props.onUpdate(props.index, newRule);
    setIsExpanded(false);
  };

  return (
    <div class="textmate-rule">
      <div class="textmate-rule-header" onClick={() => setIsExpanded(!isExpanded())}>
        <svg
          class={`textmate-rule-chevron ${isExpanded() ? "expanded" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        
        <div class="textmate-rule-preview">
          <Show when={props.rule.settings.foreground}>
            <div
              class="textmate-rule-color"
              style={{ "background-color": props.rule.settings.foreground }}
              title={`Foreground: ${props.rule.settings.foreground}`}
            />
          </Show>
          <Show when={props.rule.settings.fontStyle}>
            <span class="textmate-rule-style" style={{ "font-style": props.rule.settings.fontStyle?.includes("italic") ? "italic" : "normal", "font-weight": props.rule.settings.fontStyle?.includes("bold") ? "bold" : "normal" }}>
              {props.rule.settings.fontStyle}
            </span>
          </Show>
        </div>
        
        <span class="textmate-rule-name">{props.rule.name || "Unnamed Rule"}</span>
        <span class="textmate-rule-scope">{displayScope()}</span>
        
        <button
          type="button"
          class="textmate-rule-remove"
          onClick={(e) => { e.stopPropagation(); props.onRemove(props.index); }}
          title="Remove rule"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      
      <Show when={isExpanded()}>
        <div class="textmate-rule-editor">
          <div class="textmate-rule-field">
            <label>Name (optional)</label>
            <input
              type="text"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Description for this rule"
            />
          </div>
          
          <div class="textmate-rule-field">
            <label>Scopes (comma-separated)</label>
            <textarea
              value={scopeText()}
              onInput={(e) => setScopeText(e.currentTarget.value)}
              placeholder="comment, string.quoted"
              rows={2}
            />
          </div>
          
          <div class="textmate-rule-row">
            <div class="textmate-rule-field">
              <label>Foreground</label>
              <div class="textmate-rule-color-input">
                <input
                  type="color"
                  value={foreground() || "var(--cortex-text-primary)"}
                  onInput={(e) => setForeground(e.currentTarget.value)}
                />
                <input
                  type="text"
                  value={foreground()}
                  onInput={(e) => setForeground(e.currentTarget.value)}
                  placeholder="#RRGGBB"
                />
              </div>
            </div>
            
            <div class="textmate-rule-field">
              <label>Background</label>
              <div class="textmate-rule-color-input">
                <input
                  type="color"
                  value={background() || "var(--cortex-accent-text)"}
                  onInput={(e) => setBackground(e.currentTarget.value)}
                />
                <input
                  type="text"
                  value={background()}
                  onInput={(e) => setBackground(e.currentTarget.value)}
                  placeholder="#RRGGBB"
                />
              </div>
            </div>
          </div>
          
          <div class="textmate-rule-field">
            <label>Font Style</label>
            <select
              value={fontStyle()}
              onChange={(e) => setFontStyle(e.currentTarget.value as TokenFontStyle)}
            >
              <option value="">Normal</option>
              <option value="italic">Italic</option>
              <option value="bold">Bold</option>
              <option value="underline">Underline</option>
              <option value="strikethrough">Strikethrough</option>
              <option value="italic bold">Italic Bold</option>
              <option value="italic underline">Italic Underline</option>
            </select>
          </div>
          
          <div class="textmate-rule-actions">
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleUpdate}>
              Save Changes
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Add TextMate Rule Dialog
// ============================================================================

function AddTextMateRuleDialog(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (rule: TextMateRule) => void;
}) {
  const [name, setName] = createSignal("");
  const [scopeText, setScopeText] = createSignal("");
  const [foreground, setForeground] = createSignal("var(--cortex-text-primary)");
  const [fontStyle, setFontStyle] = createSignal<TokenFontStyle>("");

  const handleAdd = () => {
    const scopes = scopeText().split(",").map(s => s.trim()).filter(s => s.length > 0);
    
    if (scopes.length === 0) return;
    
    const newRule: TextMateRule = {
      name: name() || undefined,
      scope: scopes.length === 1 ? scopes[0] : scopes,
      settings: {
        foreground: foreground() || undefined,
        fontStyle: fontStyle() || undefined,
      },
    };

    props.onAdd(newRule);
    
    // Reset form
    setName("");
    setScopeText("");
    setForeground("var(--cortex-text-primary)");
    setFontStyle("");
    props.onClose();
  };

  return (
    <Show when={props.isOpen}>
      <div class="textmate-dialog-overlay" onClick={props.onClose}>
        <div class="textmate-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="textmate-dialog-header">
            <h4>Add TextMate Rule</h4>
            <button type="button" class="textmate-dialog-close" onClick={props.onClose}>
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="textmate-dialog-content">
            <div class="textmate-rule-field">
              <label>Name (optional)</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="Description for this rule"
              />
            </div>
            
            <div class="textmate-rule-field">
              <label>Scopes (comma-separated) *</label>
              <textarea
                value={scopeText()}
                onInput={(e) => setScopeText(e.currentTarget.value)}
                placeholder="comment, punctuation.definition.comment"
                rows={3}
              />
              <span class="textmate-rule-hint">
                Enter TextMate scope names. Examples: comment, keyword.control, string.quoted
              </span>
            </div>
            
            <div class="textmate-rule-row">
              <div class="textmate-rule-field">
                <label>Foreground Color</label>
                <div class="textmate-rule-color-input">
                  <input
                    type="color"
                    value={foreground()}
                    onInput={(e) => setForeground(e.currentTarget.value)}
                  />
                  <input
                    type="text"
                    value={foreground()}
                    onInput={(e) => setForeground(e.currentTarget.value)}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              
              <div class="textmate-rule-field">
                <label>Font Style</label>
                <select
                  value={fontStyle()}
                  onChange={(e) => setFontStyle(e.currentTarget.value as TokenFontStyle)}
                >
                  <option value="">Normal</option>
                  <option value="italic">Italic</option>
                  <option value="bold">Bold</option>
                  <option value="underline">Underline</option>
                  <option value="italic bold">Italic Bold</option>
                </select>
              </div>
            </div>
            
            <div class="textmate-dialog-actions">
              <Button variant="ghost" onClick={props.onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAdd} disabled={scopeText().trim().length === 0}>
                Add Rule
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Preview Panel Component
// ============================================================================

function TokenPreviewPanel(props: {
  customization: TokenColorCustomization;
}) {
  return (
    <div class="token-preview-panel">
      <h4>Live Preview</h4>
      <div class="token-preview-code">
        <pre>
          <span style={{ color: props.customization.comments || "var(--syntax-comment)" }}>{"// This is a comment"}</span>
          {"\n"}
          <span style={{ color: props.customization.keywords || "var(--syntax-keyword)" }}>const</span>
          {" "}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>greeting</span>
          {" = "}
          <span style={{ color: props.customization.strings || "var(--syntax-string)" }}>"Hello"</span>
          {";"}
          {"\n\n"}
          <span style={{ color: props.customization.keywords || "var(--syntax-keyword)" }}>function</span>
          {" "}
          <span style={{ color: props.customization.functions || "var(--syntax-function)" }}>calculate</span>
          {"("}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>x</span>
          {", "}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>y</span>
          {") {"}
          {"\n  "}
          <span style={{ color: props.customization.keywords || "var(--syntax-keyword)" }}>return</span>
          {" "}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>x</span>
          {" + "}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>y</span>
          {" * "}
          <span style={{ color: props.customization.numbers || "var(--syntax-number)" }}>42</span>
          {";"}
          {"\n}"}
          {"\n\n"}
          <span style={{ color: props.customization.keywords || "var(--syntax-keyword)" }}>class</span>
          {" "}
          <span style={{ color: props.customization.types || "var(--syntax-type)" }}>MyClass</span>
          {" {"}
          {"\n  "}
          <span style={{ color: props.customization.variables || "var(--syntax-variable)" }}>pattern</span>
          {" = "}
          <span style={{ color: props.customization.regexes || "var(--syntax-regexp)" }}>/[a-z]+/gi</span>
          {";"}
          {"\n}"}
        </pre>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EditorTokenColorCustomizations() {
  const tokenCustomizations = useTokenColorCustomizations();
  const { effectiveTheme } = useTheme();
  
  const [activeTab, setActiveTab] = createSignal<Tab>("simple");
  const [activeScope, setActiveScope] = createSignal<Scope>("global");
  const [showAddRule, setShowAddRule] = createSignal(false);
  const [showImportExport, setShowImportExport] = createSignal(false);
  const [importExportMode, setImportExportMode] = createSignal<"import" | "export">("export");
  const [importText, setImportText] = createSignal("");
  const [importError, setImportError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const currentThemeName = () => {
    const t = effectiveTheme();
    return t === "system" ? "dark" : t;
  };

  // Get effective customization for preview
  const effectiveCustomization = createMemo((): TokenColorCustomization => {
    const parsed = tokenCustomizations.customizations();
    const global = parsed.global;
    const theme = parsed.perTheme[currentThemeName()] || {};
    
    return {
      ...global,
      ...theme,
      textMateRules: [
        ...(global.textMateRules || []),
        ...(theme.textMateRules || []),
      ],
    };
  });

  // Get current customization based on scope
  const currentCustomization = createMemo((): TokenColorCustomization => {
    const parsed = tokenCustomizations.customizations();
    
    if (activeScope() === "global") {
      return parsed.global;
    }
    
    return parsed.perTheme[currentThemeName()] || {};
  });

  // Handlers for simple tokens
  const handleGlobalTokenChange = (tokenType: keyof SimpleTokenCustomizations, value: string) => {
    tokenCustomizations.setGlobalTokenCustomization(tokenType, value);
  };

  const handleThemeTokenChange = (tokenType: keyof SimpleTokenCustomizations, value: string) => {
    tokenCustomizations.setThemeTokenCustomization(currentThemeName(), tokenType, value);
  };

  const handleGlobalTokenRemove = (tokenType: keyof SimpleTokenCustomizations) => {
    tokenCustomizations.removeGlobalTokenCustomization(tokenType);
  };

  const handleThemeTokenRemove = (tokenType: keyof SimpleTokenCustomizations) => {
    tokenCustomizations.removeThemeTokenCustomization(currentThemeName(), tokenType);
  };

  // Handlers for TextMate rules
  const handleAddRule = (rule: TextMateRule) => {
    if (activeScope() === "global") {
      tokenCustomizations.addGlobalTextMateRule(rule);
    } else {
      tokenCustomizations.addThemeTextMateRule(currentThemeName(), rule);
    }
  };

  const handleUpdateRule = (index: number, rule: TextMateRule) => {
    if (activeScope() === "global") {
      tokenCustomizations.updateGlobalTextMateRule(index, rule);
    } else {
      tokenCustomizations.updateThemeTextMateRule(currentThemeName(), index, rule);
    }
  };

  const handleRemoveRule = (index: number) => {
    if (activeScope() === "global") {
      tokenCustomizations.removeGlobalTextMateRule(index);
    } else {
      tokenCustomizations.removeThemeTextMateRule(currentThemeName(), index);
    }
  };

  const handleResetAll = () => {
    if (activeScope() === "global") {
      tokenCustomizations.resetAllCustomizations();
    } else {
      tokenCustomizations.resetThemeCustomizations(currentThemeName());
    }
  };

  const handleExport = async () => {
    try {
      await navigator.clipboard.writeText(tokenCustomizations.exportCustomizations());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.warn("Failed to copy to clipboard:", err); }
  };

  const handleImport = async () => {
    setImportError(null);
    const success = await tokenCustomizations.importCustomizations(importText());
    if (!success) {
      setImportError("Invalid JSON format. Please check your input.");
    } else {
      setShowImportExport(false);
      setImportText("");
    }
  };

  return (
    <div class="token-color-customizations">
      {/* Header */}
      <div class="token-header">
        <div class="token-header-info">
          <h3>Token Color Customizations</h3>
          <p>
            Customize syntax highlighting colors. Use simple tokens for quick changes,
            or TextMate rules for fine-grained control.
          </p>
        </div>
        
        <div class="token-header-stats">
          <span class="token-stat">
            <span class="token-stat-value">{tokenCustomizations.globalCustomizationCount()}</span>
            <span class="token-stat-label">Global</span>
          </span>
          <span class="token-stat">
            <span class="token-stat-value">{tokenCustomizations.themeCustomizationCount(currentThemeName())}</span>
            <span class="token-stat-label">{currentThemeName()}</span>
          </span>
        </div>
      </div>

      {/* Scope Tabs */}
      <div class="token-actions">
        <div class="token-scope-tabs">
          <button
            type="button"
            class={`token-scope-tab ${activeScope() === "global" ? "active" : ""}`}
            onClick={() => setActiveScope("global")}
          >
            Global
            <Show when={tokenCustomizations.globalCustomizationCount() > 0}>
              <span class="token-scope-badge">{tokenCustomizations.globalCustomizationCount()}</span>
            </Show>
          </button>
          <button
            type="button"
            class={`token-scope-tab ${activeScope() === "theme" ? "active" : ""}`}
            onClick={() => setActiveScope("theme")}
          >
            {currentThemeName()} Theme
            <Show when={tokenCustomizations.themeCustomizationCount(currentThemeName()) > 0}>
              <span class="token-scope-badge">{tokenCustomizations.themeCustomizationCount(currentThemeName())}</span>
            </Show>
          </button>
        </div>
        
        <div class="token-action-buttons">
          <Button variant="ghost" size="sm" onClick={() => { setImportExportMode("import"); setShowImportExport(true); }}>
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setImportExportMode("export"); setShowImportExport(true); }}>
            Export
          </Button>
          <Show when={activeScope() === "global" ? tokenCustomizations.globalCustomizationCount() > 0 : tokenCustomizations.themeCustomizationCount(currentThemeName()) > 0}>
            <Button variant="danger" size="sm" onClick={handleResetAll}>
              Reset All
            </Button>
          </Show>
        </div>
      </div>

      {/* Content Tabs */}
      <div class="token-tabs">
        <button
          type="button"
          class={`token-tab ${activeTab() === "simple" ? "active" : ""}`}
          onClick={() => setActiveTab("simple")}
        >
          Simple Tokens
        </button>
        <button
          type="button"
          class={`token-tab ${activeTab() === "textmate" ? "active" : ""}`}
          onClick={() => setActiveTab("textmate")}
        >
          TextMate Rules
          <Show when={(currentCustomization().textMateRules?.length || 0) > 0}>
            <span class="token-tab-badge">{currentCustomization().textMateRules?.length}</span>
          </Show>
        </button>
      </div>

      {/* Main Content */}
      <div class="token-content">
        <div class="token-main">
          <Show when={activeTab() === "simple"}>
            <div class="token-simple-list">
              <For each={TOKEN_TYPES}>
                {(tokenType) => (
                  <SimpleTokenColorRow
                    tokenType={tokenType}
                    currentValue={currentCustomization()[tokenType.key]}
                    scope={activeScope()}
                    themeName={currentThemeName()}
                    onChangeGlobal={handleGlobalTokenChange}
                    onChangeTheme={handleThemeTokenChange}
                    onRemoveGlobal={handleGlobalTokenRemove}
                    onRemoveTheme={handleThemeTokenRemove}
                  />
                )}
              </For>
            </div>
          </Show>
          
          <Show when={activeTab() === "textmate"}>
            <div class="token-textmate-section">
              <div class="token-textmate-header">
                <span>TextMate Scope Rules</span>
                <Button variant="primary" size="sm" onClick={() => setShowAddRule(true)}>
                  <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Rule
                </Button>
              </div>
              
              <Show
                when={(currentCustomization().textMateRules?.length || 0) > 0}
                fallback={
                  <div class="token-textmate-empty">
                    <p>No TextMate rules defined.</p>
                    <p>TextMate rules give you fine-grained control over syntax highlighting using scope selectors.</p>
                  </div>
                }
              >
                <div class="token-textmate-list">
                  <For each={currentCustomization().textMateRules || []}>
                    {(rule, index) => (
                      <TextMateRuleEditor
                        rule={rule}
                        index={index()}
                        scope={activeScope()}
                        themeName={currentThemeName()}
                        onUpdate={handleUpdateRule}
                        onRemove={handleRemoveRule}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </div>
        
        {/* Preview Panel */}
        <TokenPreviewPanel customization={effectiveCustomization()} />
      </div>

      {/* Add Rule Dialog */}
      <AddTextMateRuleDialog
        isOpen={showAddRule()}
        onClose={() => setShowAddRule(false)}
        onAdd={handleAddRule}
      />

      {/* Import/Export Dialog */}
      <Show when={showImportExport()}>
        <div class="token-dialog-overlay" onClick={() => setShowImportExport(false)}>
          <div class="token-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="token-dialog-header">
              <h4>{importExportMode() === "export" ? "Export" : "Import"} Token Customizations</h4>
              <button type="button" class="token-dialog-close" onClick={() => setShowImportExport(false)}>
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="token-dialog-content">
              <Show
                when={importExportMode() === "export"}
                fallback={
                  <>
                    <p>Paste your token customizations JSON:</p>
                    <textarea
                      class="token-dialog-textarea"
                      placeholder='{"comments": "var(--cortex-syntax-comment)", "keywords": "var(--cortex-syntax-keyword)"}'
                      value={importText()}
                      onInput={(e) => setImportText(e.currentTarget.value)}
                      rows={10}
                    />
                    <Show when={importError()}>
                      <p class="token-dialog-error">{importError()}</p>
                    </Show>
                    <div class="token-dialog-actions">
                      <Button variant="ghost" onClick={() => setShowImportExport(false)}>
                        Cancel
                      </Button>
                      <Button variant="primary" onClick={handleImport}>
                        Import
                      </Button>
                    </div>
                  </>
                }
              >
                <p>Copy or download your token customizations:</p>
                <textarea
                  class="token-dialog-textarea"
                  value={tokenCustomizations.exportCustomizations()}
                  readOnly
                  rows={10}
                />
                <div class="token-dialog-actions">
                  <Button variant="ghost" onClick={() => setShowImportExport(false)}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={handleExport}>
                    {copied() ? "Copied!" : "Copy to Clipboard"}
                  </Button>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </Show>

      {/* Styles */}
      <style>{`
        .token-color-customizations {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 600px;
        }

        .token-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .token-header-info h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0 0 0.25rem;
        }

        .token-header-info p {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
          margin: 0;
        }

        .token-header-stats {
          display: flex;
          gap: 1rem;
        }

        .token-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          border-radius: 0.375rem;
        }

        .token-stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .token-stat-label {
          font-size: 0.625rem;
          color: var(--color-foreground-muted);
          text-transform: uppercase;
        }

        .token-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .token-scope-tabs {
          display: flex;
          gap: 0.25rem;
        }

        .token-scope-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-foreground-muted);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .token-scope-tab:hover {
          background: var(--color-background-secondary);
          color: var(--color-foreground);
        }

        .token-scope-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .token-scope-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: var(--cortex-radius-full);
        }

        .token-action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .token-tabs {
          display: flex;
          gap: 0.25rem;
          border-bottom: 1px solid var(--color-border);
        }

        .token-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--color-foreground-muted);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .token-tab:hover {
          color: var(--color-foreground);
          background: var(--color-background-secondary);
        }

        .token-tab.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

        .token-tab-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--color-background-tertiary);
          color: var(--color-foreground-muted);
          border-radius: var(--cortex-radius-full);
        }

        .token-tab.active .token-tab-badge {
          background: var(--color-primary);
          color: white;
        }

        .token-content {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 1rem;
          overflow: hidden;
        }

        .token-main {
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .token-simple-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .token-color-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
        }

        .token-color-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .token-color-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-foreground);
        }

        .token-color-description {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
        }

        .token-color-scopes {
          display: flex;
          gap: 0.25rem;
          margin-top: 0.25rem;
        }

        .token-color-scope {
          font-size: 0.625rem;
          font-family: monospace;
          padding: 0.125rem 0.375rem;
          background: var(--color-background-tertiary);
          border-radius: 0.25rem;
          color: var(--color-foreground-muted);
        }

        .token-color-scope-more {
          font-size: 0.625rem;
          color: var(--color-primary);
        }

        .token-color-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .token-color-preview {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          font-family: monospace;
          font-size: 0.875rem;
          font-weight: 600;
          background: var(--color-editor-background, var(--cortex-bg-secondary));
          border-radius: 0.25rem;
        }

        .token-color-swatch-wrapper {
          position: relative;
          width: 28px;
          height: 28px;
        }

        .token-color-native-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .token-color-swatch {
          width: 28px;
          height: 28px;
          border-radius: 0.25rem;
          border: 2px solid var(--color-border);
          pointer-events: none;
        }

        .token-color-hex-display,
        .token-color-hex-input {
          font-size: 0.75rem;
          font-family: monospace;
          padding: 0.25rem 0.5rem;
          background: var(--color-background-tertiary);
          border: 1px solid var(--color-border);
          border-radius: 0.25rem;
          color: var(--color-foreground);
          min-width: 80px;
          text-align: center;
        }

        .token-color-hex-display {
          cursor: pointer;
        }

        .token-color-hex-display:hover {
          border-color: var(--color-border-active);
        }

        .token-color-hex-input {
          background: var(--color-background);
          border-color: var(--color-primary);
          outline: none;
        }

        .token-color-reset-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: 0.25rem;
          color: var(--color-foreground-muted);
          cursor: pointer;
        }

        .token-color-reset-btn:hover {
          background: var(--color-error);
          border-color: var(--color-error);
          color: white;
        }

        /* TextMate Rules Section */
        .token-textmate-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .token-textmate-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .token-textmate-header span {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-foreground);
        }

        .token-textmate-empty {
          padding: 2rem;
          text-align: center;
          color: var(--color-foreground-muted);
          background: var(--color-background-secondary);
          border: 1px dashed var(--color-border);
          border-radius: 0.5rem;
        }

        .token-textmate-empty p {
          margin: 0 0 0.5rem;
          font-size: 0.875rem;
        }

        .token-textmate-empty p:last-child {
          margin: 0;
          font-size: 0.75rem;
        }

        .token-textmate-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .textmate-rule {
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .textmate-rule-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          cursor: pointer;
        }

        .textmate-rule-header:hover {
          background: var(--color-background-tertiary);
        }

        .textmate-rule-chevron {
          width: 1rem;
          height: 1rem;
          transition: transform 0.15s ease;
          color: var(--color-foreground-muted);
        }

        .textmate-rule-chevron.expanded {
          transform: rotate(90deg);
        }

        .textmate-rule-preview {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .textmate-rule-color {
          width: 16px;
          height: 16px;
          border-radius: 0.25rem;
          border: 1px solid var(--color-border);
        }

        .textmate-rule-style {
          font-size: 0.625rem;
          padding: 0.125rem 0.25rem;
          background: var(--color-background-tertiary);
          border-radius: 0.25rem;
          color: var(--color-foreground-muted);
        }

        .textmate-rule-name {
          flex: 1;
          font-size: 0.875rem;
          color: var(--color-foreground);
          font-weight: 500;
        }

        .textmate-rule-scope {
          font-size: 0.75rem;
          font-family: monospace;
          color: var(--color-foreground-muted);
        }

        .textmate-rule-remove {
          display: flex;
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: var(--color-foreground-muted);
          cursor: pointer;
          border-radius: 0.25rem;
        }

        .textmate-rule-remove:hover {
          background: var(--color-error);
          color: white;
        }

        .textmate-rule-editor {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          border-top: 1px solid var(--color-border);
          background: var(--color-background);
        }

        .textmate-rule-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .textmate-rule-field label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-foreground);
        }

        .textmate-rule-field input,
        .textmate-rule-field textarea,
        .textmate-rule-field select {
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-foreground);
          font-size: 0.875rem;
        }

        .textmate-rule-field input:focus,
        .textmate-rule-field textarea:focus,
        .textmate-rule-field select:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .textmate-rule-hint {
          font-size: 0.625rem;
          color: var(--color-foreground-muted);
        }

        .textmate-rule-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .textmate-rule-color-input {
          display: flex;
          gap: 0.5rem;
        }

        .textmate-rule-color-input input[type="color"] {
          width: 40px;
          height: 36px;
          padding: 0.25rem;
          cursor: pointer;
        }

        .textmate-rule-color-input input[type="text"] {
          flex: 1;
          font-family: monospace;
        }

        .textmate-rule-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        /* Preview Panel */
        .token-preview-panel {
          padding: 1rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          overflow-y: auto;
        }

        .token-preview-panel h4 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0 0 0.75rem;
        }

        .token-preview-code {
          padding: 0.75rem;
          background: var(--color-editor-background, var(--cortex-bg-secondary));
          border-radius: 0.375rem;
          overflow-x: auto;
        }

        .token-preview-code pre {
          margin: 0;
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          line-height: 1.5;
          white-space: pre;
          color: var(--color-editor-foreground, var(--cortex-text-primary));
        }

        /* Dialog */
        .textmate-dialog-overlay,
        .token-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .textmate-dialog,
        .token-dialog {
          width: 90%;
          max-width: 500px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
        }

        .textmate-dialog-header,
        .token-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .textmate-dialog-header h4,
        .token-dialog-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .textmate-dialog-close,
        .token-dialog-close {
          display: flex;
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: var(--color-foreground-muted);
          cursor: pointer;
          border-radius: 0.25rem;
        }

        .textmate-dialog-close:hover,
        .token-dialog-close:hover {
          background: var(--color-background-secondary);
          color: var(--color-foreground);
        }

        .textmate-dialog-content,
        .token-dialog-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .textmate-dialog-content p,
        .token-dialog-content p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
        }

        .textmate-dialog-actions,
        .token-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .token-dialog-textarea {
          width: 100%;
          padding: 0.75rem;
          font-family: monospace;
          font-size: 0.75rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-foreground);
          resize: vertical;
        }

        .token-dialog-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .token-dialog-error {
          color: var(--color-error) !important;
        }
      `}</style>
    </div>
  );
}

