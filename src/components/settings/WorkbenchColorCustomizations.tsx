/**
 * WorkbenchColorCustomizations Component
 * 
 * UI for editing workbench.colorCustomizations settings.
 * Allows users to override theme colors for the entire workbench UI.
 */

import { createSignal, createMemo, Show, For } from "solid-js";
import {
  useColorCustomizations,
  type ColorKeyInfo,
  type ColorCustomization,
} from "@/context/ColorCustomizationsContext";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "./FormComponents";

// ============================================================================
// Types
// ============================================================================

interface ColorPickerRowProps {
  colorKey: ColorKeyInfo;
  currentValue: string | undefined;
  themeName: string;
  isGlobal: boolean;
  onChangeGlobal: (key: string, value: string) => void;
  onChangeTheme: (key: string, value: string) => void;
  onRemoveGlobal: (key: string) => void;
  onRemoveTheme: (key: string) => void;
}

type Tab = "global" | "theme";
type CategoryFilter = "all" | string;

// ============================================================================
// Color Picker Row Component
// ============================================================================

function ColorPickerRow(props: ColorPickerRowProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [inputValue, setInputValue] = createSignal(props.currentValue || "");

  const hasValue = () => props.currentValue !== undefined;

  const handleColorInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const newColor = target.value;
    setInputValue(newColor);
    
    if (props.isGlobal) {
      props.onChangeGlobal(props.colorKey.key, newColor);
    } else {
      props.onChangeTheme(props.colorKey.key, newColor);
    }
  };

  const handleTextInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.value;
    setInputValue(value);
    
    // Validate hex color format
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value)) {
      if (props.isGlobal) {
        props.onChangeGlobal(props.colorKey.key, value);
      } else {
        props.onChangeTheme(props.colorKey.key, value);
      }
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    // Reset to current value if invalid
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
    if (props.isGlobal) {
      props.onRemoveGlobal(props.colorKey.key);
    } else {
      props.onRemoveTheme(props.colorKey.key);
    }
    setInputValue("");
  };

  // Update input when external value changes
  createMemo(() => {
    if (!isEditing() && props.currentValue) {
      setInputValue(props.currentValue);
    }
  });

  return (
    <div class="workbench-color-row">
      <div class="workbench-color-info">
        <span class="workbench-color-key" title={props.colorKey.key}>
          {props.colorKey.key}
        </span>
        <span class="workbench-color-label">{props.colorKey.label}</span>
        <span class="workbench-color-description">{props.colorKey.description}</span>
      </div>
      
      <div class="workbench-color-controls">
        {/* Color swatch with native picker */}
        <div class="workbench-color-swatch-wrapper">
          <input
            type="color"
            value={props.currentValue?.slice(0, 7) || "var(--cortex-accent-text)"}
            onInput={handleColorInput}
            class="workbench-color-native-input"
            title={`Pick color for ${props.colorKey.label}`}
          />
          <div
            class="workbench-color-swatch"
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
              class="workbench-color-hex-display"
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
            class="workbench-color-hex-input"
            placeholder="#RRGGBB"
            maxLength={9}
            autofocus
          />
        </Show>
        
        {/* Reset button */}
        <Show when={hasValue()}>
          <button
            type="button"
            class="workbench-color-reset-btn"
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
// Category Group Component
// ============================================================================

function CategoryGroup(props: {
  category: string;
  colorKeys: ColorKeyInfo[];
  customizations: ColorCustomization;
  themeName: string;
  isGlobal: boolean;
  onChangeGlobal: (key: string, value: string) => void;
  onChangeTheme: (key: string, value: string) => void;
  onRemoveGlobal: (key: string) => void;
  onRemoveTheme: (key: string) => void;
}) {
  const [isExpanded, setIsExpanded] = createSignal(true);
  
  const customizationCount = createMemo(() => {
    return props.colorKeys.filter(ck => props.customizations[ck.key]).length;
  });

  return (
    <div class="workbench-category-group">
      <button
        type="button"
        class="workbench-category-header"
        onClick={() => setIsExpanded(!isExpanded())}
      >
        <svg
          class={`workbench-category-chevron ${isExpanded() ? "expanded" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span class="workbench-category-title">{props.category}</span>
        <Show when={customizationCount() > 0}>
          <span class="workbench-category-badge">{customizationCount()}</span>
        </Show>
        <span class="workbench-category-count">{props.colorKeys.length} colors</span>
      </button>
      
      <Show when={isExpanded()}>
        <div class="workbench-category-content">
          <For each={props.colorKeys}>
            {(colorKey) => (
              <ColorPickerRow
                colorKey={colorKey}
                currentValue={props.customizations[colorKey.key]}
                themeName={props.themeName}
                isGlobal={props.isGlobal}
                onChangeGlobal={props.onChangeGlobal}
                onChangeTheme={props.onChangeTheme}
                onRemoveGlobal={props.onRemoveGlobal}
                onRemoveTheme={props.onRemoveTheme}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WorkbenchColorCustomizations() {
  const colorCustomizations = useColorCustomizations();
  const { effectiveTheme } = useTheme();
  
  const [activeTab, setActiveTab] = createSignal<Tab>("global");
  const [categoryFilter, setCategoryFilter] = createSignal<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showImportExport, setShowImportExport] = createSignal(false);
  const [importExportMode, setImportExportMode] = createSignal<"import" | "export">("export");
  const [importText, setImportText] = createSignal("");
  const [importError, setImportError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  // Get current theme name for theme-specific customizations
  const currentThemeName = () => {
    const t = effectiveTheme();
    return t === "system" ? "dark" : t;
  };

  // Get all color keys and group by category
  const colorKeys = colorCustomizations.getColorKeys();
  
  const categories = createMemo(() => {
    const categoryMap = new Map<string, ColorKeyInfo[]>();
    
    for (const key of colorKeys) {
      const existing = categoryMap.get(key.category) || [];
      existing.push(key);
      categoryMap.set(key.category, existing);
    }
    
    return Array.from(categoryMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  });

  const uniqueCategories = createMemo(() => {
    return ["all", ...Array.from(new Set(colorKeys.map(k => k.category)))].sort();
  });

  // Filter color keys based on search and category
  const filteredCategories = createMemo(() => {
    const search = searchQuery().toLowerCase();
    const filter = categoryFilter();
    
    return categories()
      .map(([category, keys]) => {
        if (filter !== "all" && category !== filter) {
          return [category, []] as [string, ColorKeyInfo[]];
        }
        
        const filtered = keys.filter(key => 
          !search || 
          key.key.toLowerCase().includes(search) ||
          key.label.toLowerCase().includes(search) ||
          key.description.toLowerCase().includes(search)
        );
        
        return [category, filtered] as [string, ColorKeyInfo[]];
      })
      .filter(([, keys]) => keys.length > 0);
  });

  // Get effective customizations based on active tab
  const effectiveCustomizations = createMemo(() => {
    const parsed = colorCustomizations.customizations();
    
    if (activeTab() === "global") {
      return parsed.global;
    }
    
    return parsed.perTheme[currentThemeName()] || {};
  });

  // Handlers
  const handleGlobalChange = (key: string, value: string) => {
    colorCustomizations.setGlobalCustomization(key, value);
  };

  const handleThemeChange = (key: string, value: string) => {
    colorCustomizations.setThemeCustomization(currentThemeName(), key, value);
  };

  const handleGlobalRemove = (key: string) => {
    colorCustomizations.removeGlobalCustomization(key);
  };

  const handleThemeRemove = (key: string) => {
    colorCustomizations.removeThemeCustomization(currentThemeName(), key);
  };

  const handleResetAll = () => {
    if (activeTab() === "global") {
      colorCustomizations.resetAllCustomizations();
    } else {
      colorCustomizations.resetThemeCustomizations(currentThemeName());
    }
  };

  const handleExport = async () => {
    try {
      await navigator.clipboard.writeText(colorCustomizations.exportCustomizations());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
    }
  };

  const handleImport = async () => {
    setImportError(null);
    const success = await colorCustomizations.importCustomizations(importText());
    if (!success) {
      setImportError("Invalid JSON format. Please check your input.");
    } else {
      setShowImportExport(false);
      setImportText("");
    }
  };

  const applyCustomizations = () => {
    colorCustomizations.applyToCSS(currentThemeName());
  };

  return (
    <div class="workbench-color-customizations">
      {/* Header */}
      <div class="workbench-header">
        <div class="workbench-header-info">
          <h3>Workbench Color Customizations</h3>
          <p>
            Override theme colors for the workbench UI. Global settings apply to all themes,
            theme-specific settings only apply to the selected theme.
          </p>
        </div>
        
        <div class="workbench-header-stats">
          <span class="workbench-stat">
            <span class="workbench-stat-value">{colorCustomizations.globalCustomizationCount()}</span>
            <span class="workbench-stat-label">Global</span>
          </span>
          <span class="workbench-stat">
            <span class="workbench-stat-value">{colorCustomizations.themeCustomizationCount(currentThemeName())}</span>
            <span class="workbench-stat-label">{currentThemeName()}</span>
          </span>
        </div>
      </div>

      {/* Actions */}
      <div class="workbench-actions">
        <div class="workbench-tabs">
          <button
            type="button"
            class={`workbench-tab ${activeTab() === "global" ? "active" : ""}`}
            onClick={() => setActiveTab("global")}
          >
            Global
            <Show when={colorCustomizations.globalCustomizationCount() > 0}>
              <span class="workbench-tab-badge">{colorCustomizations.globalCustomizationCount()}</span>
            </Show>
          </button>
          <button
            type="button"
            class={`workbench-tab ${activeTab() === "theme" ? "active" : ""}`}
            onClick={() => setActiveTab("theme")}
          >
            {currentThemeName()} Theme
            <Show when={colorCustomizations.themeCustomizationCount(currentThemeName()) > 0}>
              <span class="workbench-tab-badge">{colorCustomizations.themeCustomizationCount(currentThemeName())}</span>
            </Show>
          </button>
        </div>
        
        <div class="workbench-action-buttons">
          <Button variant="ghost" size="sm" onClick={() => { setImportExportMode("import"); setShowImportExport(true); }}>
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setImportExportMode("export"); setShowImportExport(true); }}>
            Export
          </Button>
          <Button variant="ghost" size="sm" onClick={applyCustomizations}>
            Apply
          </Button>
          <Show when={activeTab() === "global" ? colorCustomizations.globalCustomizationCount() > 0 : colorCustomizations.themeCustomizationCount(currentThemeName()) > 0}>
            <Button variant="danger" size="sm" onClick={handleResetAll}>
              Reset All
            </Button>
          </Show>
        </div>
      </div>

      {/* Filters */}
      <div class="workbench-filters">
        <input
          type="text"
          class="workbench-search"
          placeholder="Search colors..."
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />
        
        <select
          class="workbench-category-filter"
          value={categoryFilter()}
          onChange={(e) => setCategoryFilter(e.currentTarget.value)}
        >
          <For each={uniqueCategories()}>
            {(category) => (
              <option value={category}>
                {category === "all" ? "All Categories" : category}
              </option>
            )}
          </For>
        </select>
      </div>

      {/* Color Groups */}
      <div class="workbench-color-groups">
        <For each={filteredCategories()}>
          {([category, keys]) => (
            <CategoryGroup
              category={category}
              colorKeys={keys}
              customizations={effectiveCustomizations()}
              themeName={currentThemeName()}
              isGlobal={activeTab() === "global"}
              onChangeGlobal={handleGlobalChange}
              onChangeTheme={handleThemeChange}
              onRemoveGlobal={handleGlobalRemove}
              onRemoveTheme={handleThemeRemove}
            />
          )}
        </For>
      </div>

      {/* Import/Export Dialog */}
      <Show when={showImportExport()}>
        <div class="workbench-dialog-overlay" onClick={() => setShowImportExport(false)}>
          <div class="workbench-dialog" onClick={(e) => e.stopPropagation()}>
            <div class="workbench-dialog-header">
              <h4>{importExportMode() === "export" ? "Export" : "Import"} Color Customizations</h4>
              <button
                type="button"
                class="workbench-dialog-close"
                onClick={() => setShowImportExport(false)}
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="workbench-dialog-content">
              <Show
                when={importExportMode() === "export"}
                fallback={
                  <>
                    <p>Paste your color customizations JSON:</p>
                    <textarea
                      class="workbench-dialog-textarea"
                      placeholder='{"editor.background": "var(--cortex-bg-primary)", ...}'
                      value={importText()}
                      onInput={(e) => setImportText(e.currentTarget.value)}
                      rows={10}
                    />
                    <Show when={importError()}>
                      <p class="workbench-dialog-error">{importError()}</p>
                    </Show>
                    <div class="workbench-dialog-actions">
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
                <p>Copy or download your color customizations:</p>
                <textarea
                  class="workbench-dialog-textarea"
                  value={colorCustomizations.exportCustomizations()}
                  readOnly
                  rows={10}
                />
                <div class="workbench-dialog-actions">
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
        .workbench-color-customizations {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 600px;
        }

        .workbench-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .workbench-header-info h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0 0 0.25rem;
        }

        .workbench-header-info p {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
          margin: 0;
        }

        .workbench-header-stats {
          display: flex;
          gap: 1rem;
        }

        .workbench-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          border-radius: 0.375rem;
        }

        .workbench-stat-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .workbench-stat-label {
          font-size: 0.625rem;
          color: var(--color-foreground-muted);
          text-transform: uppercase;
        }

        .workbench-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }

        .workbench-tabs {
          display: flex;
          gap: 0.25rem;
        }

        .workbench-tab {
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

        .workbench-tab:hover {
          background: var(--color-background-secondary);
          color: var(--color-foreground);
        }

        .workbench-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .workbench-tab-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: var(--cortex-radius-full);
        }

        .workbench-action-buttons {
          display: flex;
          gap: 0.5rem;
        }

        .workbench-filters {
          display: flex;
          gap: 0.75rem;
        }

        .workbench-search {
          flex: 1;
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-foreground);
          font-size: 0.875rem;
        }

        .workbench-search:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .workbench-search::placeholder {
          color: var(--color-foreground-muted);
        }

        .workbench-category-filter {
          padding: 0.5rem 0.75rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-foreground);
          font-size: 0.875rem;
          min-width: 150px;
        }

        .workbench-color-groups {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .workbench-category-group {
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        .workbench-category-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--color-background-secondary);
          border: none;
          color: var(--color-foreground);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
        }

        .workbench-category-header:hover {
          background: var(--color-background-tertiary);
        }

        .workbench-category-chevron {
          width: 1rem;
          height: 1rem;
          transition: transform 0.15s ease;
        }

        .workbench-category-chevron.expanded {
          transform: rotate(90deg);
        }

        .workbench-category-title {
          flex: 1;
        }

        .workbench-category-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--color-primary);
          color: white;
          border-radius: var(--cortex-radius-full);
        }

        .workbench-category-count {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
        }

        .workbench-category-content {
          display: flex;
          flex-direction: column;
          border-top: 1px solid var(--color-border);
        }

        .workbench-color-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .workbench-color-row:last-child {
          border-bottom: none;
        }

        .workbench-color-row:hover {
          background: var(--color-background-secondary);
        }

        .workbench-color-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
          flex: 1;
        }

        .workbench-color-key {
          font-size: 0.75rem;
          font-family: monospace;
          color: var(--color-primary);
        }

        .workbench-color-label {
          font-size: 0.875rem;
          color: var(--color-foreground);
          font-weight: 500;
        }

        .workbench-color-description {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
        }

        .workbench-color-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .workbench-color-swatch-wrapper {
          position: relative;
          width: 28px;
          height: 28px;
        }

        .workbench-color-native-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .workbench-color-swatch {
          width: 28px;
          height: 28px;
          border-radius: 0.25rem;
          border: 2px solid var(--color-border);
          pointer-events: none;
        }

        .workbench-color-hex-display {
          font-size: 0.75rem;
          font-family: monospace;
          padding: 0.25rem 0.5rem;
          background: var(--color-background-tertiary);
          border: 1px solid var(--color-border);
          border-radius: 0.25rem;
          color: var(--color-foreground);
          cursor: pointer;
          min-width: 80px;
          text-align: center;
        }

        .workbench-color-hex-display:hover {
          border-color: var(--color-border-active);
        }

        .workbench-color-hex-input {
          font-size: 0.75rem;
          font-family: monospace;
          padding: 0.25rem 0.5rem;
          background: var(--color-background);
          border: 1px solid var(--color-primary);
          border-radius: 0.25rem;
          color: var(--color-foreground);
          min-width: 80px;
          text-align: center;
          outline: none;
        }

        .workbench-color-reset-btn {
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

        .workbench-color-reset-btn:hover {
          background: var(--color-error);
          border-color: var(--color-error);
          color: white;
        }

        /* Dialog */
        .workbench-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .workbench-dialog {
          width: 90%;
          max-width: 500px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
        }

        .workbench-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .workbench-dialog-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .workbench-dialog-close {
          display: flex;
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: var(--color-foreground-muted);
          cursor: pointer;
          border-radius: 0.25rem;
        }

        .workbench-dialog-close:hover {
          background: var(--color-background-secondary);
          color: var(--color-foreground);
        }

        .workbench-dialog-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .workbench-dialog-content p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
        }

        .workbench-dialog-textarea {
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

        .workbench-dialog-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .workbench-dialog-error {
          color: var(--color-error) !important;
        }

        .workbench-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }
      `}</style>
    </div>
  );
}

