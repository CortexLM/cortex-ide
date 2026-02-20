import { createSignal, createMemo, Show, For } from "solid-js";
import {
  useTheme,
  ColorCategory,
  ColorTokenInfo,
  UI_COLOR_TOKENS,
  EDITOR_COLOR_TOKENS,
  SYNTAX_COLOR_TOKENS,
  TERMINAL_COLOR_TOKENS,
} from "@/context/ThemeContext";
import { SectionHeader, Button } from "./FormComponents";

// ============================================================================
// Types
// ============================================================================

interface ColorPickerProps {
  token: ColorTokenInfo;
  category: ColorCategory;
  currentColor: string;
  defaultColor: string;
  isCustomized: boolean;
  onColorChange: (color: string) => void;
  onReset: () => void;
}

interface CategorySectionProps {
  title: string;
  description: string;
  category: ColorCategory;
  tokens: ColorTokenInfo[];
  currentColors: Record<string, string>;
  defaultColors: Record<string, string>;
  customizations: Partial<Record<string, string>>;
  onColorChange: (token: string, color: string) => void;
  onResetToken: (token: string) => void;
  onResetCategory: () => void;
}

type Tab = "ui" | "editor" | "syntax" | "terminal";

// ============================================================================
// Color Picker Component
// ============================================================================

function ColorPicker(props: ColorPickerProps) {
  const [isEditing, setIsEditing] = createSignal(false);
  const [inputValue, setInputValue] = createSignal(props.currentColor);

  const handleColorInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const newColor = target.value;
    props.onColorChange(newColor);
    setInputValue(newColor);
  };

  const handleTextInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const value = target.value;
    setInputValue(value);
    
    // Validate hex color format
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value)) {
      props.onColorChange(value);
    }
  };

  const handleTextBlur = () => {
    setIsEditing(false);
    // Reset to current color if invalid
    if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(inputValue())) {
      setInputValue(props.currentColor);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTextBlur();
    } else if (e.key === "Escape") {
      setInputValue(props.currentColor);
      setIsEditing(false);
    }
  };

  // Update input when external color changes
  createMemo(() => {
    if (!isEditing()) {
      setInputValue(props.currentColor);
    }
  });

  return (
    <div class="theme-color-picker">
      <div class="theme-color-picker-info">
        <span class="theme-color-picker-label">{props.token.label}</span>
        <span class="theme-color-picker-description">{props.token.description}</span>
      </div>
      
      <div class="theme-color-picker-controls">
        {/* Color swatch with native picker */}
        <div class="theme-color-swatch-wrapper">
          <input
            type="color"
            value={props.currentColor.slice(0, 7)}
            onInput={handleColorInput}
            class="theme-color-native-input"
            title={`Pick color for ${props.token.label}`}
          />
          <div
            class="theme-color-swatch"
            style={{ "background-color": props.currentColor }}
          />
        </div>
        
        {/* Hex value input */}
        <Show
          when={isEditing()}
          fallback={
            <button
              type="button"
              class="theme-color-hex-display"
              onClick={() => setIsEditing(true)}
              title="Click to edit hex value"
            >
              {props.currentColor}
            </button>
          }
        >
          <input
            type="text"
            value={inputValue()}
            onInput={handleTextInput}
            onBlur={handleTextBlur}
            onKeyDown={handleKeyDown}
            class="theme-color-hex-input"
            placeholder="#RRGGBB"
            maxLength={9}
            autofocus
          />
        </Show>
        
        {/* Reset button (only shown if customized) */}
        <Show when={props.isCustomized}>
          <button
            type="button"
            class="theme-color-reset-btn"
            onClick={props.onReset}
            title={`Reset to default (${props.defaultColor})`}
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </Show>
        
        {/* Customized indicator */}
        <Show when={props.isCustomized}>
          <span class="theme-color-customized-badge" title="This color has been customized">
            Modified
          </span>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// Category Section Component
// ============================================================================

function CategorySection(props: CategorySectionProps) {
  const customizationCount = createMemo(() => {
    return Object.keys(props.customizations).length;
  });

  return (
    <div class="theme-category-section">
      <div class="theme-category-header">
        <div class="theme-category-title">
          <h4>{props.title}</h4>
          <Show when={customizationCount() > 0}>
            <span class="theme-category-badge">
              {customizationCount()} customized
            </span>
          </Show>
        </div>
        <p class="theme-category-description">{props.description}</p>
        <Show when={customizationCount() > 0}>
          <button
            type="button"
            class="theme-category-reset-btn"
            onClick={props.onResetCategory}
          >
            Reset {props.title} Colors
          </button>
        </Show>
      </div>
      
      <div class="theme-color-grid">
        <For each={props.tokens}>
          {(token) => (
            <ColorPicker
              token={token}
              category={props.category}
              currentColor={props.currentColors[token.key] || "var(--cortex-accent-text)"}
              defaultColor={props.defaultColors[token.key] || "var(--cortex-accent-text)"}
              isCustomized={token.key in props.customizations}
              onColorChange={(color) => props.onColorChange(token.key, color)}
              onReset={() => props.onResetToken(token.key)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

// ============================================================================
// Preview Panel Component
// ============================================================================

function PreviewPanel() {
  const { colors, editorColors, syntaxColors, terminalColors } = useTheme();

  return (
    <div class="theme-preview-panel">
      <SectionHeader title="Live Preview" description="See your customizations in action" />
      
      {/* UI Preview */}
      <div
        class="theme-preview-ui"
        style={{
          "background-color": colors().background,
          "border-color": colors().border,
        }}
      >
        <div
          class="theme-preview-sidebar"
          style={{ "background-color": colors().backgroundSecondary }}
        >
          <div
            class="theme-preview-sidebar-item"
            style={{
              "background-color": colors().backgroundTertiary,
              color: colors().foreground,
            }}
          >
            Selected Item
          </div>
          <div
            class="theme-preview-sidebar-item"
            style={{ color: colors().foregroundMuted }}
          >
            Other Item
          </div>
        </div>
        
        {/* Editor Preview */}
        <div
          class="theme-preview-editor"
          style={{ "background-color": editorColors().editorBackground }}
        >
          <div
            class="theme-preview-line-numbers"
            style={{
              "background-color": editorColors().editorGutter,
              color: editorColors().editorLineNumber,
            }}
          >
            <div>1</div>
            <div style={{ color: editorColors().editorLineNumberActive }}>2</div>
            <div>3</div>
            <div>4</div>
          </div>
          <div class="theme-preview-code">
            <div
              class="theme-preview-line-highlight"
              style={{ "background-color": editorColors().editorLineHighlight }}
            />
            <pre>
              <span style={{ color: syntaxColors().keyword }}>const</span>{" "}
              <span style={{ color: syntaxColors().variable }}>greeting</span>{" "}
              <span style={{ color: syntaxColors().operator }}>=</span>{" "}
              <span style={{ color: syntaxColors().string }}>"Hello"</span>
              <span style={{ color: syntaxColors().punctuation }}>;</span>
            </pre>
            <pre>
              <span style={{ color: syntaxColors().keyword }}>function</span>{" "}
              <span style={{ color: syntaxColors().function }}>sayHello</span>
              <span style={{ color: syntaxColors().punctuation }}>(</span>
              <span style={{ color: syntaxColors().parameter }}>name</span>
              <span style={{ color: syntaxColors().punctuation }}>)</span>{" "}
              <span style={{ color: syntaxColors().punctuation }}>{"{"}</span>
            </pre>
            <pre>
              {"  "}
              <span style={{ color: syntaxColors().keyword }}>return</span>{" "}
              <span style={{ color: syntaxColors().string }}>`${"{"}</span>
              <span style={{ color: syntaxColors().variable }}>greeting</span>
              <span style={{ color: syntaxColors().string }}>{"}"}, ${"{"}</span>
              <span style={{ color: syntaxColors().parameter }}>name</span>
              <span style={{ color: syntaxColors().string }}>{"}"}`</span>
              <span style={{ color: syntaxColors().punctuation }}>;</span>
            </pre>
            <pre>
              <span style={{ color: syntaxColors().punctuation }}>{"}"}</span>
            </pre>
            <pre>
              <span style={{ color: syntaxColors().comment }}>{"// Call the function"}</span>
            </pre>
          </div>
        </div>
      </div>
      
      {/* Terminal Preview */}
      <div
        class="theme-preview-terminal"
        style={{
          "background-color": terminalColors().terminalBackground,
          color: terminalColors().terminalForeground,
        }}
      >
        <div class="theme-preview-terminal-line">
          <span style={{ color: terminalColors().terminalGreen }}>$</span>{" "}
          <span style={{ color: terminalColors().terminalCyan }}>npm</span>{" "}
          <span>run build</span>
        </div>
        <div class="theme-preview-terminal-line">
          <span style={{ color: terminalColors().terminalYellow }}>warning</span>{" "}
          <span>Compilation took 2.3s</span>
        </div>
        <div class="theme-preview-terminal-line">
          <span style={{ color: terminalColors().terminalGreen }}>success</span>{" "}
          <span>Build completed</span>
        </div>
        <div class="theme-preview-terminal-line">
          <span style={{ color: terminalColors().terminalRed }}>error</span>{" "}
          <span>Missing dependency</span>
        </div>
      </div>
      
      {/* Color Palette Preview */}
      <div class="theme-preview-palette">
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().primary }}
          title="Primary"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().secondary }}
          title="Secondary"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().accent }}
          title="Accent"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().success }}
          title="Success"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().warning }}
          title="Warning"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().error }}
          title="Error"
        />
        <div
          class="theme-preview-palette-item"
          style={{ "background-color": colors().info }}
          title="Info"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Import/Export Dialog Component
// ============================================================================

function ImportExportDialog(props: {
  isOpen: boolean;
  mode: "import" | "export";
  exportData: string;
  onImport: (json: string) => void;
  onClose: () => void;
}) {
  const [importText, setImportText] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [copied, setCopied] = createSignal(false);

  const handleImport = () => {
    setError(null);
    const text = importText().trim();
    
    if (!text) {
      setError("Please paste your customizations JSON");
      return;
    }
    
    try {
      JSON.parse(text);
      props.onImport(text);
      props.onClose();
    } catch {
      setError("Invalid JSON format. Please check your input.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(props.exportData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([props.exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "theme-customizations.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Show when={props.isOpen}>
      <div class="theme-dialog-overlay" onClick={props.onClose}>
        <div class="theme-dialog" onClick={(e) => e.stopPropagation()}>
          <div class="theme-dialog-header">
            <h3>{props.mode === "export" ? "Export Customizations" : "Import Customizations"}</h3>
            <button
              type="button"
              class="theme-dialog-close"
              onClick={props.onClose}
              aria-label="Close"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="theme-dialog-content">
            <Show when={props.mode === "export"}>
              <p class="theme-dialog-description">
                Copy or download your theme customizations to share or backup.
              </p>
              <textarea
                class="theme-dialog-textarea"
                value={props.exportData}
                readOnly
                rows={12}
              />
              <div class="theme-dialog-actions">
                <Button variant="secondary" onClick={handleDownload}>
                  <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download JSON
                </Button>
                <Button variant="primary" onClick={handleCopy}>
                  <Show when={copied()} fallback={
                    <>
                      <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy to Clipboard
                    </>
                  }>
                    <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </Show>
                </Button>
              </div>
            </Show>
            
            <Show when={props.mode === "import"}>
              <p class="theme-dialog-description">
                Paste your theme customizations JSON to apply them.
              </p>
              <textarea
                class="theme-dialog-textarea"
                value={importText()}
                onInput={(e) => setImportText(e.currentTarget.value)}
                placeholder='{"ui": {...}, "editor": {...}, "syntax": {...}, "terminal": {...}}'
                rows={12}
              />
              <Show when={error()}>
                <p class="theme-dialog-error">{error()}</p>
              </Show>
              <div class="theme-dialog-actions">
                <Button variant="ghost" onClick={props.onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleImport}>
                  Import Customizations
                </Button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Main ThemeCustomizer Component
// ============================================================================

export function ThemeCustomizer() {
  const {
    colors,
    editorColors,
    syntaxColors,
    terminalColors,
    colorCustomizations,
    setColorCustomization,
    removeColorCustomization,
    resetCustomizations,
    resetCategoryCustomizations,
    exportCustomizations,
    importCustomizations,
    getDefaultColors,
    customizationCount,
  } = useTheme();

  const [activeTab, setActiveTab] = createSignal<Tab>("ui");
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [dialogMode, setDialogMode] = createSignal<"import" | "export">("export");
  const [showResetConfirm, setShowResetConfirm] = createSignal(false);

  const tabs: { id: Tab; label: string; count: () => number }[] = [
    { 
      id: "ui", 
      label: "UI Colors", 
      count: () => Object.keys(colorCustomizations().ui).length 
    },
    { 
      id: "editor", 
      label: "Editor", 
      count: () => Object.keys(colorCustomizations().editor).length 
    },
    { 
      id: "syntax", 
      label: "Syntax", 
      count: () => Object.keys(colorCustomizations().syntax).length 
    },
    { 
      id: "terminal", 
      label: "Terminal", 
      count: () => Object.keys(colorCustomizations().terminal).length 
    },
  ];

  const handleColorChange = (category: ColorCategory, token: string, color: string) => {
    setColorCustomization(category, token, color);
  };

  const handleResetToken = (category: ColorCategory, token: string) => {
    removeColorCustomization(category, token);
  };

  const handleResetCategory = (category: ColorCategory) => {
    resetCategoryCustomizations(category);
  };

  const handleResetAll = () => {
    resetCustomizations();
    setShowResetConfirm(false);
  };

  const openExportDialog = () => {
    setDialogMode("export");
    setDialogOpen(true);
  };

  const openImportDialog = () => {
    setDialogMode("import");
    setDialogOpen(true);
  };

  const handleImport = (json: string) => {
    const success = importCustomizations(json);
    if (!success) {
      console.error("Failed to import customizations");
    }
  };

  const defaults = createMemo(() => getDefaultColors());

  return (
    <div class="theme-customizer">
      {/* Header with actions */}
      <div class="theme-customizer-header">
        <div class="theme-customizer-title">
          <h3>Theme Customization</h3>
          <Show when={customizationCount() > 0}>
            <span class="theme-customizer-badge">
              {customizationCount()} customized
            </span>
          </Show>
        </div>
        
        <div class="theme-customizer-actions">
          <Button variant="ghost" size="sm" onClick={openImportDialog}>
            <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </Button>
          <Button variant="ghost" size="sm" onClick={openExportDialog}>
            <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </Button>
          <Show when={customizationCount() > 0}>
            <Show
              when={showResetConfirm()}
              fallback={
                <Button variant="danger" size="sm" onClick={() => setShowResetConfirm(true)}>
                  <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset All
                </Button>
              }
            >
              <div class="theme-reset-confirm">
                <span>Reset all customizations?</span>
                <Button variant="danger" size="sm" onClick={handleResetAll}>
                  Yes, Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </Show>
          </Show>
        </div>
      </div>

      {/* Tab navigation */}
      <div class="theme-customizer-tabs" role="tablist">
        <For each={tabs}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab() === tab.id}
              class={`theme-customizer-tab ${activeTab() === tab.id ? "theme-customizer-tab-active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              <Show when={tab.count() > 0}>
                <span class="theme-customizer-tab-badge">{tab.count()}</span>
              </Show>
            </button>
          )}
        </For>
      </div>

      {/* Main content area */}
      <div class="theme-customizer-content">
        {/* Left: Color tokens */}
        <div class="theme-customizer-tokens">
          <Show when={activeTab() === "ui"}>
            <CategorySection
              title="UI Colors"
              description="Customize the main interface colors"
              category="ui"
              tokens={UI_COLOR_TOKENS}
              currentColors={colors() as unknown as Record<string, string>}
              defaultColors={defaults().ui as unknown as Record<string, string>}
              customizations={colorCustomizations().ui}
              onColorChange={(token, color) => handleColorChange("ui", token, color)}
              onResetToken={(token) => handleResetToken("ui", token)}
              onResetCategory={() => handleResetCategory("ui")}
            />
          </Show>
          
          <Show when={activeTab() === "editor"}>
            <CategorySection
              title="Editor Colors"
              description="Customize code editor appearance"
              category="editor"
              tokens={EDITOR_COLOR_TOKENS}
              currentColors={editorColors() as unknown as Record<string, string>}
              defaultColors={defaults().editor as unknown as Record<string, string>}
              customizations={colorCustomizations().editor}
              onColorChange={(token, color) => handleColorChange("editor", token, color)}
              onResetToken={(token) => handleResetToken("editor", token)}
              onResetCategory={() => handleResetCategory("editor")}
            />
          </Show>
          
          <Show when={activeTab() === "syntax"}>
            <CategorySection
              title="Syntax Colors"
              description="Customize code syntax highlighting"
              category="syntax"
              tokens={SYNTAX_COLOR_TOKENS}
              currentColors={syntaxColors() as unknown as Record<string, string>}
              defaultColors={defaults().syntax as unknown as Record<string, string>}
              customizations={colorCustomizations().syntax}
              onColorChange={(token, color) => handleColorChange("syntax", token, color)}
              onResetToken={(token) => handleResetToken("syntax", token)}
              onResetCategory={() => handleResetCategory("syntax")}
            />
          </Show>
          
          <Show when={activeTab() === "terminal"}>
            <CategorySection
              title="Terminal Colors"
              description="Customize integrated terminal colors"
              category="terminal"
              tokens={TERMINAL_COLOR_TOKENS}
              currentColors={terminalColors() as unknown as Record<string, string>}
              defaultColors={defaults().terminal as unknown as Record<string, string>}
              customizations={colorCustomizations().terminal}
              onColorChange={(token, color) => handleColorChange("terminal", token, color)}
              onResetToken={(token) => handleResetToken("terminal", token)}
              onResetCategory={() => handleResetCategory("terminal")}
            />
          </Show>
        </div>

        {/* Right: Preview panel */}
        <PreviewPanel />
      </div>

      {/* Import/Export Dialog */}
      <ImportExportDialog
        isOpen={dialogOpen()}
        mode={dialogMode()}
        exportData={exportCustomizations()}
        onImport={handleImport}
        onClose={() => setDialogOpen(false)}
      />

      {/* Embedded styles */}
      <style>{`
        .theme-customizer {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 600px;
        }

        .theme-customizer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .theme-customizer-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .theme-customizer-title h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0;
        }

        .theme-customizer-badge,
        .theme-category-badge {
          font-size: 0.75rem;
          padding: 0.125rem 0.5rem;
          background: var(--color-primary);
          color: white;
          border-radius: var(--cortex-radius-full);
        }

        .theme-customizer-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .theme-reset-confirm {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: var(--color-background-secondary);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
        }

        .theme-customizer-tabs {
          display: flex;
          gap: 0.25rem;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: -1px;
        }

        .theme-customizer-tab {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .theme-customizer-tab:hover {
          color: var(--color-foreground);
          background: var(--color-background-secondary);
        }

        .theme-customizer-tab-active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
        }

        .theme-customizer-tab-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--color-background-tertiary);
          color: var(--color-foreground-muted);
          border-radius: var(--cortex-radius-full);
        }

        .theme-customizer-tab-active .theme-customizer-tab-badge {
          background: var(--color-primary);
          color: white;
        }

        .theme-customizer-content {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 1.5rem;
          overflow: hidden;
        }

        .theme-customizer-tokens {
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .theme-category-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .theme-category-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .theme-category-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .theme-category-title h4 {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0;
        }

        .theme-category-description {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
          margin: 0;
        }

        .theme-category-reset-btn {
          font-size: 0.75rem;
          color: var(--color-primary);
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-top: 0.25rem;
        }

        .theme-category-reset-btn:hover {
          text-decoration: underline;
        }

        .theme-color-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .theme-color-picker {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: var(--color-background-secondary);
          border-radius: 0.375rem;
          border: 1px solid var(--color-border);
        }

        .theme-color-picker-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .theme-color-picker-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-foreground);
        }

        .theme-color-picker-description {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
        }

        .theme-color-picker-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .theme-color-swatch-wrapper {
          position: relative;
          width: 28px;
          height: 28px;
        }

        .theme-color-native-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }

        .theme-color-swatch {
          width: 28px;
          height: 28px;
          border-radius: 0.25rem;
          border: 2px solid var(--color-border);
          pointer-events: none;
        }

        .theme-color-hex-display {
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

        .theme-color-hex-display:hover {
          border-color: var(--color-border-active);
        }

        .theme-color-hex-input {
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

        .theme-color-reset-btn {
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

        .theme-color-reset-btn:hover {
          background: var(--color-background-tertiary);
          color: var(--color-foreground);
        }

        .theme-color-customized-badge {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          background: var(--color-warning);
          color: #000;
          border-radius: 0.25rem;
          font-weight: 500;
        }

        /* Preview Panel */
        .theme-preview-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem;
          background: var(--color-background-secondary);
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          overflow-y: auto;
        }

        .theme-preview-ui {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 1px;
          border: 1px solid;
          border-radius: 0.375rem;
          overflow: hidden;
        }

        .theme-preview-sidebar {
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .theme-preview-sidebar-item {
          padding: 0.375rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
        }

        .theme-preview-editor {
          display: grid;
          grid-template-columns: 24px 1fr;
          font-family: monospace;
          font-size: 0.75rem;
          line-height: 1.5;
          position: relative;
        }

        .theme-preview-line-numbers {
          padding: 0.5rem 0.25rem;
          text-align: right;
        }

        .theme-preview-code {
          padding: 0.5rem;
          position: relative;
        }

        .theme-preview-line-highlight {
          position: absolute;
          left: 0;
          right: 0;
          height: 1.5em;
          top: calc(0.5rem + 1.5em);
          pointer-events: none;
        }

        .theme-preview-code pre {
          margin: 0;
          white-space: pre;
        }

        .theme-preview-terminal {
          padding: 0.5rem;
          border-radius: 0.375rem;
          font-family: monospace;
          font-size: 0.75rem;
          line-height: 1.5;
        }

        .theme-preview-terminal-line {
          white-space: pre;
        }

        .theme-preview-palette {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .theme-preview-palette-item {
          width: 32px;
          height: 32px;
          border-radius: 0.25rem;
          border: 2px solid var(--color-border);
        }

        /* Dialog */
        .theme-dialog-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .theme-dialog {
          width: 90%;
          max-width: 500px;
          background: var(--color-background);
          border: 1px solid var(--color-border);
          border-radius: 0.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .theme-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .theme-dialog-header h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0;
        }

        .theme-dialog-close {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.25rem;
          background: transparent;
          border: none;
          color: var(--color-foreground-muted);
          cursor: pointer;
          border-radius: 0.25rem;
        }

        .theme-dialog-close:hover {
          background: var(--color-background-secondary);
          color: var(--color-foreground);
        }

        .theme-dialog-content {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .theme-dialog-description {
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
          margin: 0;
        }

        .theme-dialog-textarea {
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

        .theme-dialog-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .theme-dialog-error {
          font-size: 0.875rem;
          color: var(--color-error);
          margin: 0;
        }

        .theme-dialog-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        /* Button variant for danger */
        .form-button-danger {
          background: var(--color-error);
          color: white;
          border: none;
        }

        .form-button-danger:hover:not(:disabled) {
          background: color-mix(in srgb, var(--color-error) 90%, black);
        }
      `}</style>
    </div>
  );
}

