import { createSignal, createMemo, onCleanup, For, Show, batch } from "solid-js";
import type { Theme } from "@/context/ThemeContext";
import {
  useTheme,
  DEFAULT_DARK_COLORS,
  DEFAULT_LIGHT_COLORS,
} from "@/context/ThemeContext";
import { Button, Card, Text } from "@/components/ui";

// ============================================================================
// Theme Option Configuration
// ============================================================================

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
  icon: () => any;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "dark",
    name: "Dark",
    description: "Easy on the eyes, perfect for low-light environments",
    icon: () => (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
    ),
  },
  {
    id: "light",
    name: "Light",
    description: "Clean and bright, ideal for well-lit spaces",
    icon: () => (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
  },
  {
    id: "system",
    name: "System",
    description: "Automatically match your operating system theme",
    icon: () => (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
      </svg>
    ),
  },
];

// ============================================================================
// Preview Timeout Management
// ============================================================================

const PREVIEW_TIMEOUT_MS = 3000;

// ============================================================================
// Mini Code Preview Component
// ============================================================================

interface MiniCodePreviewProps {
  isDark: boolean;
}

function MiniCodePreview(props: MiniCodePreviewProps) {
  const colors = createMemo(() => {
    const palette = props.isDark ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
    return {
      bg: palette.editor.editorBackground,
      fg: palette.editor.editorForeground,
      lineHighlight: palette.editor.editorLineHighlight,
      lineNumber: palette.editor.editorLineNumber,
      lineNumberActive: palette.editor.editorLineNumberActive,
      gutter: palette.editor.editorGutter,
      keyword: palette.syntax.keyword,
      string: palette.syntax.string,
      function: palette.syntax.function,
      variable: palette.syntax.variable,
      comment: palette.syntax.comment,
      punctuation: palette.syntax.punctuation,
      number: palette.syntax.number,
      type: palette.syntax.type,
    };
  });

  return (
    <div
      class="theme-preview-mini-code"
      style={{
        "background-color": colors().bg,
        color: colors().fg,
      }}
    >
      <div
        class="theme-preview-mini-gutter"
        style={{
          "background-color": colors().gutter,
          color: colors().lineNumber,
        }}
      >
        <span>1</span>
        <span style={{ color: colors().lineNumberActive }}>2</span>
        <span>3</span>
        <span>4</span>
        <span>5</span>
      </div>
      <div class="theme-preview-mini-content">
        <div class="theme-preview-mini-line">
          <span style={{ color: colors().keyword }}>const</span>{" "}
          <span style={{ color: colors().variable }}>theme</span>{" "}
          <span style={{ color: colors().punctuation }}>=</span>{" "}
          <span style={{ color: colors().string }}>"orion"</span>
          <span style={{ color: colors().punctuation }}>;</span>
        </div>
        <div
          class="theme-preview-mini-line theme-preview-mini-line-highlight"
          style={{ "background-color": colors().lineHighlight }}
        >
          <span style={{ color: colors().keyword }}>function</span>{" "}
          <span style={{ color: colors().function }}>greet</span>
          <span style={{ color: colors().punctuation }}>(</span>
          <span style={{ color: colors().variable }}>name</span>
          <span style={{ color: colors().punctuation }}>:</span>{" "}
          <span style={{ color: colors().type }}>string</span>
          <span style={{ color: colors().punctuation }}>)</span>{" "}
          <span style={{ color: colors().punctuation }}>{"{"}</span>
        </div>
        <div class="theme-preview-mini-line">
          {"  "}
          <span style={{ color: colors().keyword }}>return</span>{" "}
          <span style={{ color: colors().string }}>`Hello, ${"{"}</span>
          <span style={{ color: colors().variable }}>name</span>
          <span style={{ color: colors().string }}>{"}"}`</span>
          <span style={{ color: colors().punctuation }}>;</span>
        </div>
        <div class="theme-preview-mini-line">
          <span style={{ color: colors().punctuation }}>{"}"}</span>
        </div>
        <div class="theme-preview-mini-line">
          <span style={{ color: colors().comment }}>{"// Welcome!"}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mini UI Preview Component
// ============================================================================

interface MiniUIPreviewProps {
  isDark: boolean;
}

function MiniUIPreview(props: MiniUIPreviewProps) {
  const colors = createMemo(() => {
    const palette = props.isDark ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS;
    return {
      bg: palette.ui.background,
      bgSecondary: palette.ui.backgroundSecondary,
      bgTertiary: palette.ui.backgroundTertiary,
      fg: palette.ui.foreground,
      fgMuted: palette.ui.foregroundMuted,
      primary: palette.ui.primary,
      secondary: palette.ui.secondary,
      accent: palette.ui.accent,
      success: palette.ui.success,
      warning: palette.ui.warning,
      error: palette.ui.error,
      border: palette.ui.border,
    };
  });

  return (
    <div
      class="theme-preview-mini-ui"
      style={{
        "background-color": colors().bg,
        "border-color": colors().border,
      }}
    >
      {/* Mini sidebar */}
      <div
        class="theme-preview-mini-sidebar"
        style={{ "background-color": colors().bgSecondary }}
      >
        <div
          class="theme-preview-mini-sidebar-item theme-preview-mini-sidebar-item-active"
          style={{
            "background-color": colors().bgTertiary,
            color: colors().fg,
          }}
        />
        <div
          class="theme-preview-mini-sidebar-item"
          style={{ "background-color": colors().border }}
        />
        <div
          class="theme-preview-mini-sidebar-item"
          style={{ "background-color": colors().border }}
        />
      </div>
      
      {/* Mini content area */}
      <div class="theme-preview-mini-main">
        {/* Mini header */}
        <div
          class="theme-preview-mini-header"
          style={{
            "background-color": colors().bgSecondary,
            "border-color": colors().border,
          }}
        >
          <div
            class="theme-preview-mini-tab theme-preview-mini-tab-active"
            style={{
              "background-color": colors().bg,
              color: colors().fg,
              "border-color": colors().primary,
            }}
          />
          <div
            class="theme-preview-mini-tab"
            style={{ color: colors().fgMuted }}
          />
        </div>
        
        {/* Mini buttons row */}
        <div class="theme-preview-mini-buttons">
          <div
            class="theme-preview-mini-btn"
            style={{ "background-color": colors().primary }}
          />
          <div
            class="theme-preview-mini-btn"
            style={{
              "background-color": "transparent",
              "border-color": colors().border,
            }}
          />
        </div>
        
        {/* Mini status indicators */}
        <div class="theme-preview-mini-status">
          <div
            class="theme-preview-mini-badge"
            style={{ "background-color": colors().success }}
          />
          <div
            class="theme-preview-mini-badge"
            style={{ "background-color": colors().warning }}
          />
          <div
            class="theme-preview-mini-badge"
            style={{ "background-color": colors().error }}
          />
          <div
            class="theme-preview-mini-badge"
            style={{ "background-color": colors().accent }}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Theme Card Component
// ============================================================================

interface ThemeCardProps {
  option: ThemeOption;
  isSelected: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onPreviewStart: () => void;
  onPreviewEnd: () => void;
}

function ThemeCard(props: ThemeCardProps) {
  let hoverTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  
  const resolvedIsDark = createMemo(() => {
    if (props.option.id === "system") {
      return typeof window !== "undefined" && 
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return props.option.id === "dark";
  });

  const handleMouseEnter = () => {
    if (!props.isSelected) {
      props.onPreviewStart();
      hoverTimeoutRef = setTimeout(() => {
        props.onPreviewEnd();
      }, PREVIEW_TIMEOUT_MS);
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
      hoverTimeoutRef = null;
    }
    if (!props.isSelected) {
      props.onPreviewEnd();
    }
  };

  onCleanup(() => {
    if (hoverTimeoutRef) {
      clearTimeout(hoverTimeoutRef);
    }
  });

  return (
    <Card
      variant="outlined"
      padding="none"
      hoverable
      onClick={props.onSelect}
      style={{
        display: "flex",
        "flex-direction": "column",
        cursor: "pointer",
        overflow: "hidden",
        border: props.isSelected 
          ? "2px solid var(--jb-border-focus)" 
          : props.isPreviewing 
            ? "2px solid var(--cortex-accent)" 
            : "2px solid var(--jb-border-default)",
        background: props.isSelected 
          ? "color-mix(in srgb, var(--jb-border-focus) 5%, var(--jb-panel))"
          : "var(--jb-panel)",
        transition: "all 200ms ease",
      }}
    >
      {/* Preview thumbnail */}
      <div style={{
        display: "grid",
        "grid-template-columns": "1fr 1fr",
        gap: "8px",
        padding: "12px",
        background: "var(--jb-surface-active)",
        "border-bottom": "1px solid var(--jb-border-default)",
      }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <MiniUIPreview isDark={resolvedIsDark()} />
        <MiniCodePreview isDark={resolvedIsDark()} />
      </div>
      
      {/* Card content */}
      <div style={{ padding: "12px" }}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" }}>
          <span style={{ display: "flex", color: "var(--jb-text-muted-color)" }}>{props.option.icon()}</span>
          <Text weight="semibold" size="sm" style={{ color: "var(--jb-text-body-color)" }}>
            {props.option.name}
          </Text>
          <Show when={props.isSelected}>
            <span style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "20px",
              height: "20px",
              background: "var(--jb-btn-primary-bg)",
              color: "var(--cortex-text-primary)",
              "border-radius": "var(--cortex-radius-full)",
              "margin-left": "auto",
            }}>
              <svg style={{ width: "12px", height: "12px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </Show>
        </div>
        <Text variant="muted" size="xs" style={{ margin: 0, "line-height": "1.4" }}>
          {props.option.description}
        </Text>
      </div>
      
      {/* Previewing indicator */}
      <Show when={props.isPreviewing && !props.isSelected}>
        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "6px 12px",
          background: "var(--cortex-accent)",
          color: "var(--cortex-text-primary)",
          "font-size": "12px",
          "font-weight": "500",
        }}>
          <span style={{
            width: "6px",
            height: "6px",
            background: "var(--cortex-bg-primary)",
            "border-radius": "var(--cortex-radius-full)",
            animation: "blink 1s ease-in-out infinite",
          }} />
          <span>Previewing...</span>
        </div>
      </Show>
    </Card>
  );
}

// ============================================================================
// Main ThemePreview Component
// ============================================================================

export function ThemePreview() {
  const {
    theme,
    setTheme,
    previewTheme,
    isPreviewActive,
    startPreview,
    stopPreview,
  } = useTheme();

  const [pendingTheme, setPendingTheme] = createSignal<Theme | null>(null);
  
  const currentlyPreviewing = createMemo(() => previewTheme());
  
  const handleThemeSelect = (themeId: Theme) => {
    if (theme() === themeId) {
      if (isPreviewActive()) {
        stopPreview();
      }
      setPendingTheme(null);
      return;
    }
    
    setPendingTheme(themeId);
    startPreview(themeId);
  };

  const handlePreviewStart = (themeId: Theme) => {
    if (theme() !== themeId) {
      startPreview(themeId);
    }
  };

  const handlePreviewEnd = () => {
    if (pendingTheme() === null) {
      stopPreview();
    }
  };

  const handleApply = () => {
    const pending = pendingTheme();
    if (pending) {
      batch(() => {
        setTheme(pending);
        setPendingTheme(null);
        stopPreview();
      });
    }
  };

  const handleCancel = () => {
    batch(() => {
      setPendingTheme(null);
      stopPreview();
    });
  };

  const hasUnsavedChanges = createMemo(() => {
    return pendingTheme() !== null && pendingTheme() !== theme();
  });

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      {/* Theme selection header */}
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "flex-start", gap: "16px" }}>
        <div>
          <Text as="h3" size="md" weight="semibold" style={{ color: "var(--jb-text-body-color)", margin: "0 0 4px 0" }}>
            Appearance
          </Text>
          <Text variant="muted" size="sm" style={{ margin: 0 }}>
            Choose your preferred color theme
          </Text>
        </div>
        
        <Show when={hasUnsavedChanges()}>
          <div style={{ display: "flex", gap: "8px", "flex-shrink": "0" }}>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply}>
              Apply Theme
            </Button>
          </div>
        </Show>
      </div>
      
      {/* Theme cards grid */}
      <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        <For each={THEME_OPTIONS}>
          {(option) => (
            <ThemeCard
              option={option}
              isSelected={theme() === option.id && !hasUnsavedChanges()}
              isPreviewing={currentlyPreviewing() === option.id}
              onSelect={() => handleThemeSelect(option.id)}
              onPreviewStart={() => handlePreviewStart(option.id)}
              onPreviewEnd={handlePreviewEnd}
            />
          )}
        </For>
      </div>
      
      {/* Preview banner */}
      <Show when={isPreviewActive() && !hasUnsavedChanges()}>
        <Card variant="outlined" padding="sm" style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          background: "color-mix(in srgb, var(--cortex-accent) 15%, var(--jb-panel))",
          border: "1px solid var(--cortex-accent)",
        }}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
            <span style={{ display: "flex", color: "var(--cortex-accent)" }}>
              <svg style={{ width: "16px", height: "16px" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
            <Text size="sm" style={{ color: "var(--jb-text-body-color)" }}>
              Preview mode — hover away or wait to revert
            </Text>
          </div>
        </Card>
      </Show>
      
      {/* Embedded styles */}
      <style>{`
        .theme-preview-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .theme-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .theme-preview-title h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-foreground);
          margin: 0 0 0.25rem 0;
        }

        .theme-preview-title p {
          font-size: 0.875rem;
          color: var(--color-foreground-muted);
          margin: 0;
        }

        .theme-preview-actions {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .theme-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
        }

        /* Theme Card Styles */
        .theme-preview-card {
          display: flex;
          flex-direction: column;
          background: var(--color-background-secondary);
          border: 2px solid var(--color-border);
          border-radius: 0.75rem;
          padding: 0;
          cursor: pointer;
          transition: all 200ms ease;
          text-align: left;
          overflow: hidden;
        }

        .theme-preview-card:hover {
          border-color: var(--color-border-active);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .theme-preview-card:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent);
        }

        .theme-preview-card-selected {
          border-color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 5%, var(--color-background-secondary));
        }

        .theme-preview-card-previewing {
          border-color: var(--color-accent);
          animation: pulse-preview 2s ease-in-out infinite;
        }

        @keyframes pulse-preview {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 30%, transparent); }
          50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 10%, transparent); }
        }

        /* Thumbnail area */
        .theme-preview-card-thumbnail {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          padding: 0.75rem;
          background: var(--color-background-tertiary);
          border-bottom: 1px solid var(--color-border);
        }

        /* Mini UI Preview */
        .theme-preview-mini-ui {
          display: flex;
          border-radius: 0.375rem;
          border: 1px solid;
          overflow: hidden;
          height: 64px;
        }

        .theme-preview-mini-sidebar {
          width: 20px;
          padding: 4px 3px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .theme-preview-mini-sidebar-item {
          height: 6px;
          border-radius: var(--cortex-radius-sm);
        }

        .theme-preview-mini-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 4px;
          gap: 4px;
        }

        .theme-preview-mini-header {
          display: flex;
          gap: 4px;
          padding-bottom: 3px;
          border-bottom: 1px solid;
        }

        .theme-preview-mini-tab {
          width: 20px;
          height: 8px;
          border-radius: var(--cortex-radius-sm) 2px 0 0;
        }

        .theme-preview-mini-tab-active {
          border-bottom: 2px solid;
        }

        .theme-preview-mini-buttons {
          display: flex;
          gap: 3px;
        }

        .theme-preview-mini-btn {
          width: 16px;
          height: 6px;
          border-radius: var(--cortex-radius-sm);
          border: 1px solid transparent;
        }

        .theme-preview-mini-status {
          display: flex;
          gap: 3px;
          margin-top: auto;
        }

        .theme-preview-mini-badge {
          width: 8px;
          height: 4px;
          border-radius: var(--cortex-radius-sm);
        }

        /* Mini Code Preview */
        .theme-preview-mini-code {
          display: flex;
          border-radius: 0.375rem;
          overflow: hidden;
          font-family: monospace;
          font-size: 6px;
          line-height: 1.4;
          height: 64px;
        }

        .theme-preview-mini-gutter {
          padding: 4px 3px;
          text-align: right;
          display: flex;
          flex-direction: column;
          gap: 0;
          min-width: 12px;
        }

        .theme-preview-mini-gutter span {
          height: 8.4px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .theme-preview-mini-content {
          flex: 1;
          padding: 4px;
          overflow: hidden;
        }

        .theme-preview-mini-line {
          white-space: nowrap;
          height: 8.4px;
          overflow: hidden;
          padding: 0 2px;
          border-radius: var(--cortex-radius-sm);
        }

        /* Card content */
        .theme-preview-card-content {
          padding: 0.75rem;
        }

        .theme-preview-card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.25rem;
        }

        .theme-preview-card-icon {
          display: flex;
          color: var(--color-foreground-muted);
        }

        .theme-preview-card-selected .theme-preview-card-icon {
          color: var(--color-primary);
        }

        .theme-preview-card-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-foreground);
        }

        .theme-preview-card-check {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: var(--color-primary);
          color: white;
          border-radius: 50%;
          margin-left: auto;
        }

        .theme-preview-card-description {
          font-size: 0.75rem;
          color: var(--color-foreground-muted);
          margin: 0;
          line-height: 1.4;
        }

        /* Previewing indicator */
        .theme-preview-card-indicator {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: var(--color-accent);
          color: white;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .theme-preview-card-indicator-dot {
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Preview banner */
        .theme-preview-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 1rem;
          background: color-mix(in srgb, var(--color-accent) 15%, var(--color-background-secondary));
          border: 1px solid var(--color-accent);
          border-radius: 0.5rem;
          animation: fadeIn 200ms ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .theme-preview-banner-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: var(--color-foreground);
        }

        .theme-preview-banner-icon {
          display: flex;
          color: var(--color-accent);
        }
      `}</style>
    </div>
  );
}

export default ThemePreview;

