import { type Component, type JSX, Show } from "solid-js";
import { useTheme } from "@/context/ThemeContext";
import { Icon } from "../ui/Icon";
import { ColorCustomizer } from "./ColorCustomizer";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

interface ColorCustomizationEditorProps {
  onClose?: () => void;
}

// ============================================================================
// Styles
// ============================================================================

const containerStyle: JSX.CSSProperties = {
  display: "flex",
  "flex-direction": "column",
  height: "100%",
};

const headerStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "8px 16px",
  "border-bottom": `1px solid ${tokens.colors.border.default}`,
  background: tokens.colors.surface.panel,
};

const headerTitleStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "8px",
};

const titleTextStyle: JSX.CSSProperties = {
  "font-size": "13px",
  "font-weight": "500",
  color: tokens.colors.text.primary,
};

const headerActionsStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  gap: "4px",
};

const actionBtnStyle: JSX.CSSProperties = {
  padding: "4px 8px",
  border: "none",
  "border-radius": tokens.radius.sm,
  background: "transparent",
  color: tokens.colors.text.secondary,
  cursor: "pointer",
  "font-size": "11px",
};

const resetBtnStyle: JSX.CSSProperties = {
  ...actionBtnStyle,
  color: tokens.colors.state.error,
};

const closeBtnStyle: JSX.CSSProperties = {
  ...actionBtnStyle,
  color: tokens.colors.text.muted,
  padding: "4px",
};

const bodyStyle: JSX.CSSProperties = {
  flex: "1",
  "overflow-y": "auto",
};

// ============================================================================
// Component
// ============================================================================

export const ColorCustomizationEditor: Component<ColorCustomizationEditorProps> = (props) => {
  const themeCtx = useTheme();

  const handleResetAll = () => {
    themeCtx.resetCustomizations();
  };

  const handleExportTheme = () => {
    const data = themeCtx.exportCustomizations();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cortex-theme-customizations.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTheme = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        themeCtx.importCustomizations(text);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={headerTitleStyle}>
          <Icon name="palette" style={{ width: "16px", height: "16px", color: tokens.colors.accent.primary } as JSX.CSSProperties} />
          <span style={titleTextStyle}>Color Customizations</span>
        </div>
        <div style={headerActionsStyle}>
          <button
            style={actionBtnStyle}
            onClick={handleImportTheme}
            title="Import theme customizations"
          >
            Import
          </button>
          <button
            style={actionBtnStyle}
            onClick={handleExportTheme}
            title="Export theme customizations"
          >
            Export
          </button>
          <button
            style={resetBtnStyle}
            onClick={handleResetAll}
            title="Reset all customizations"
          >
            Reset All
          </button>
          <Show when={props.onClose}>
            <button
              style={closeBtnStyle}
              onClick={props.onClose}
              title="Close"
            >
              <Icon name="xmark" style={{ width: "14px", height: "14px" } as JSX.CSSProperties} />
            </button>
          </Show>
        </div>
      </div>
      <div style={bodyStyle}>
        <ColorCustomizer />
      </div>
    </div>
  );
};
