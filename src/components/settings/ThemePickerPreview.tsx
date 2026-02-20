import { createSignal, createMemo, Show, For, type JSX } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import type { Theme } from "@/context/theme/types";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

interface ThemePickerPreviewProps {
  onClose?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "System", icon: "desktop" },
];

// ============================================================================
// Styles
// ============================================================================

const panelStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  gap: "16px",
  padding: "16px",
  background: "var(--vscode-settings-editor-background, var(--surface-panel))",
  color: tokens.colors.text.primary,
  "font-size": "13px",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  "padding-bottom": "8px",
  "border-bottom": `1px solid ${tokens.colors.border.default}`,
};

const themeToggleGroupStyle: JSX.CSSProperties = {
  display: "flex",
  gap: "4px",
  "border-radius": tokens.radius.md,
  padding: "4px",
  background: tokens.colors.surface.active,
};

const themeButtonStyle = (active: boolean): JSX.CSSProperties => ({
  display: "flex",
  "align-items": "center",
  gap: "6px",
  padding: "6px 14px",
  border: "none",
  "border-radius": tokens.radius.sm,
  background: active ? tokens.colors.accent.primary : "transparent",
  color: active ? "#fff" : tokens.colors.text.secondary,
  cursor: "pointer",
  "font-size": "12px",
  "font-weight": active ? "600" : "400",
  transition: "background 0.15s, color 0.15s",
});

const previewContainerStyle: JSX.CSSProperties = {
  "border-radius": tokens.radius.md,
  overflow: "hidden",
  border: `1px solid ${tokens.colors.border.default}`,
};

const uiPreviewStyle = (colors: Record<string, string>): JSX.CSSProperties => ({
  display: "flex",
  "min-height": "120px",
  background: colors.background ?? "var(--surface-card)",
});

const sidebarPreviewStyle = (colors: Record<string, string>): JSX.CSSProperties => ({
  width: "80px",
  padding: "8px",
  "border-right": `1px solid ${colors.border ?? tokens.colors.border.default}`,
  background: colors.backgroundSecondary ?? "var(--surface-panel)",
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
});

const sidebarItemStyle = (colors: Record<string, string>, active: boolean): JSX.CSSProperties => ({
  padding: "4px 6px",
  "border-radius": "3px",
  "font-size": "10px",
  color: active ? (colors.foreground ?? "#fff") : (colors.foregroundMuted ?? "#888"),
  background: active ? (colors.backgroundTertiary ?? "var(--surface-hover)") : "transparent",
  "white-space": "nowrap",
  overflow: "hidden",
  "text-overflow": "ellipsis",
});

const codePreviewStyle = (editorColors: Record<string, string>): JSX.CSSProperties => ({
  flex: "1",
  padding: "8px 12px",
  background: editorColors.editorBackground ?? "var(--surface-card)",
  "font-family": "monospace",
  "font-size": "11px",
  "line-height": "1.5",
  overflow: "hidden",
});

const paletteStyle: JSX.CSSProperties = {
  display: "flex",
  gap: "6px",
  padding: "8px 12px",
  background: tokens.colors.surface.active,
};

const paletteSwatchStyle = (color: string): JSX.CSSProperties => ({
  width: "24px",
  height: "24px",
  "border-radius": tokens.radius.sm,
  background: color,
  border: "1px solid rgba(128,128,128,0.3)",
});

const actionsStyle: JSX.CSSProperties = {
  display: "flex",
  "justify-content": "flex-end",
  gap: "8px",
};

const buttonStyle = (primary: boolean): JSX.CSSProperties => ({
  padding: "6px 16px",
  border: primary ? "none" : `1px solid ${tokens.colors.border.default}`,
  "border-radius": tokens.radius.sm,
  background: primary ? tokens.colors.accent.primary : "transparent",
  color: primary ? "#fff" : tokens.colors.text.secondary,
  cursor: "pointer",
  "font-size": "12px",
  "font-weight": "600",
  transition: "background 0.15s",
});

// ============================================================================
// Component
// ============================================================================

export function ThemePickerPreview(props: ThemePickerPreviewProps) {
  const themeCtx = useTheme();
  const [previewing, setPreviewing] = createSignal(false);

  const currentTheme = () => themeCtx.effectiveTheme();

  const handleThemeSelect = (t: Theme) => {
    themeCtx.startPreview(t);
    setPreviewing(true);
  };

  const handleApply = () => {
    themeCtx.applyPreviewedTheme();
    setPreviewing(false);
  };

  const handleCancel = () => {
    themeCtx.stopPreview();
    setPreviewing(false);
  };

  const colors = () => themeCtx.colors();
  const editorColors = () => themeCtx.editorColors();
  const syntaxColors = () => themeCtx.syntaxColors();

  const themeLabel = createMemo(() => {
    const t = currentTheme();
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  const paletteColors = createMemo(() => {
    const c = colors();
    return [
      { color: c.primary, label: "Primary" },
      { color: c.secondary, label: "Secondary" },
      { color: c.accent, label: "Accent" },
      { color: c.success, label: "Success" },
      { color: c.warning, label: "Warning" },
      { color: c.error, label: "Error" },
      { color: c.info, label: "Info" },
    ];
  });

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="palette" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary }} />
          <span style={{ "font-weight": "600" }}>Theme</span>
          <span style={{ color: tokens.colors.text.muted, "font-size": "12px" }}>({themeLabel()})</span>
        </div>
        <Show when={props.onClose}>
          <button
            style={{ background: "transparent", border: "none", cursor: "pointer", color: tokens.colors.text.muted, padding: "2px" } as JSX.CSSProperties}
            onClick={props.onClose}
            title="Close"
          >
            <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
          </button>
        </Show>
      </div>

      {/* Theme toggle buttons */}
      <div style={themeToggleGroupStyle}>
        <For each={THEME_OPTIONS}>
          {(opt) => (
            <button
              style={themeButtonStyle(currentTheme() === opt.value)}
              onClick={() => handleThemeSelect(opt.value)}
              title={opt.label}
            >
              <Icon name={opt.icon} style={{ width: "14px", height: "14px" }} />
              {opt.label}
            </button>
          )}
        </For>
      </div>

      {/* Preview panel */}
      <div style={previewContainerStyle}>
        {/* UI preview */}
        <div style={uiPreviewStyle(colors() as unknown as Record<string, string>)}>
          <div style={sidebarPreviewStyle(colors() as unknown as Record<string, string>)}>
            <div style={sidebarItemStyle(colors() as unknown as Record<string, string>, true)}>Explorer</div>
            <div style={sidebarItemStyle(colors() as unknown as Record<string, string>, false)}>Search</div>
            <div style={sidebarItemStyle(colors() as unknown as Record<string, string>, false)}>Git</div>
          </div>
          <div style={codePreviewStyle(editorColors() as unknown as Record<string, string>)}>
            <pre style={{ margin: "0" }}>
              <span style={{ color: syntaxColors().keyword }}>const</span>{" "}
              <span style={{ color: syntaxColors().variable }}>app</span>{" "}
              <span style={{ color: syntaxColors().operator }}>=</span>{" "}
              <span style={{ color: syntaxColors().function }}>createApp</span>
              <span style={{ color: syntaxColors().punctuation }}>();</span>
            </pre>
            <pre style={{ margin: "0" }}>
              <span style={{ color: syntaxColors().keyword }}>const</span>{" "}
              <span style={{ color: syntaxColors().variable }}>port</span>{" "}
              <span style={{ color: syntaxColors().operator }}>=</span>{" "}
              <span style={{ color: syntaxColors().number }}>3000</span>
              <span style={{ color: syntaxColors().punctuation }}>;</span>
            </pre>
            <pre style={{ margin: "0" }}>
              <span style={{ color: syntaxColors().comment }}>{"// Start server"}</span>
            </pre>
            <pre style={{ margin: "0" }}>
              <span style={{ color: syntaxColors().variable }}>app</span>
              <span style={{ color: syntaxColors().punctuation }}>.</span>
              <span style={{ color: syntaxColors().function }}>listen</span>
              <span style={{ color: syntaxColors().punctuation }}>(</span>
              <span style={{ color: syntaxColors().variable }}>port</span>
              <span style={{ color: syntaxColors().punctuation }}>);</span>
            </pre>
          </div>
        </div>

        {/* Color palette swatches */}
        <div style={paletteStyle}>
          <For each={paletteColors()}>
            {(swatch) => <div style={paletteSwatchStyle(swatch.color)} title={swatch.label} />}
          </For>
        </div>
      </div>

      {/* Apply / Cancel actions */}
      <Show when={previewing()}>
        <div style={actionsStyle}>
          <button style={buttonStyle(false)} onClick={handleCancel}>Cancel</button>
          <button style={buttonStyle(true)} onClick={handleApply}>Apply Theme</button>
        </div>
      </Show>
    </div>
  );
}
