/**
 * =============================================================================
 * TERMINAL COLOR PICKER
 * =============================================================================
 *
 * Color picker for terminal tab colors. Matches VS Code's terminal tab color
 * picker functionality.
 *
 * Features:
 * - Preset color palette (8 colors)
 * - Custom color input with hex validation
 * - Color preview swatch
 * - Clear color option (reset to default)
 *
 * Usage:
 *   <TerminalColorPicker
 *     open={showColorPicker()}
 *     currentColor="var(--cortex-info)"
 *     onColorSelect={(color) => handleColorChange(color)}
 *     onCancel={() => setShowColorPicker(false)}
 *   />
 * =============================================================================
 */

import { createSignal, createEffect, For, Show, JSX } from "solid-js";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { tokens } from "@/design-system/tokens";
import { Icon } from "../ui/Icon";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Preset terminal tab colors matching VS Code defaults */
export const PRESET_COLORS = [
  { name: "Red", hex: "var(--cortex-error)" },
  { name: "Orange", hex: "var(--cortex-warning)" },
  { name: "Yellow", hex: "var(--cortex-warning)" },
  { name: "Green", hex: "var(--cortex-success)" },
  { name: "Cyan", hex: "var(--cortex-info)" },
  { name: "Blue", hex: "var(--cortex-info)" },
  { name: "Purple", hex: "var(--cortex-info)" },
  { name: "Pink", hex: "var(--cortex-error)" },
];

// =============================================================================
// TYPES
// =============================================================================

export interface TerminalColorPickerProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Currently selected color (hex or null for default) */
  currentColor: string | null;
  /** Callback when a color is selected */
  onColorSelect: (color: string | null) => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

// =============================================================================
// UTILITIES
// =============================================================================

/** Validate hex color format */
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
}

/** Normalize hex color (expand 3-char to 6-char) */
function normalizeHexColor(color: string): string {
  if (!color.startsWith("#")) {
    color = "#" + color;
  }
  if (color.length === 4) {
    // Expand #RGB to #RRGGBB
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color.toUpperCase();
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TerminalColorPicker(props: TerminalColorPickerProps) {
  const [selectedColor, setSelectedColor] = createSignal<string | null>(props.currentColor);
  const [customColor, setCustomColor] = createSignal("");
  const [customError, setCustomError] = createSignal<string | undefined>(undefined);

  // Reset state when dialog opens
  createEffect(() => {
    if (props.open) {
      setSelectedColor(props.currentColor);
      setCustomColor(props.currentColor || "");
      setCustomError(undefined);
    }
  });

  const handlePresetClick = (color: string) => {
    setSelectedColor(color);
    setCustomColor(color);
    setCustomError(undefined);
  };

  const handleCustomInput = (e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setCustomColor(value);

    // Validate and update selected color
    let colorToCheck = value;
    if (!colorToCheck.startsWith("#") && colorToCheck.length > 0) {
      colorToCheck = "#" + colorToCheck;
    }

    if (!colorToCheck || colorToCheck === "#") {
      setSelectedColor(null);
      setCustomError(undefined);
    } else if (isValidHexColor(colorToCheck)) {
      setSelectedColor(normalizeHexColor(colorToCheck));
      setCustomError(undefined);
    } else {
      setCustomError("Invalid hex color (e.g., var(--cortex-warning))");
    }
  };

  const handleClear = () => {
    setSelectedColor(null);
    setCustomColor("");
    setCustomError(undefined);
  };

  const handleApply = () => {
    props.onColorSelect(selectedColor());
  };

  // Styles
  const gridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(4, 1fr)",
    gap: tokens.spacing.md,
    "margin-bottom": tokens.spacing.lg,
  };

  const swatchStyle = (color: string, isSelected: boolean): JSX.CSSProperties => ({
    width: "40px",
    height: "40px",
    "border-radius": tokens.radius.md,
    background: color,
    border: isSelected ? `2px solid ${tokens.colors.border.focus}` : `1px solid ${tokens.colors.border.default}`,
    cursor: "pointer",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    transition: "transform 150ms ease, box-shadow 150ms ease",
    "box-shadow": isSelected ? `0 0 0 2px ${tokens.colors.border.focus}40` : "none",
  });

  const previewStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.md,
    "margin-bottom": tokens.spacing.md,
  });

  const previewSwatchStyle = (): JSX.CSSProperties => ({
    width: "32px",
    height: "32px",
    "border-radius": tokens.radius.sm,
    background: selectedColor() || tokens.colors.text.muted,
    border: `1px solid ${tokens.colors.border.default}`,
    "flex-shrink": 0,
  });

  const previewLabelStyle: JSX.CSSProperties = {
    "font-size": tokens.typography.fontSize.sm,
    color: tokens.colors.text.primary,
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Set Terminal Tab Color"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={handleClear} disabled={!selectedColor()}>
            Clear
          </Button>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleApply}>
            Apply
          </Button>
        </>
      }
    >
      {/* Preset Colors Grid */}
      <div style={gridStyle}>
        <For each={PRESET_COLORS}>
          {(preset) => {
            const isSelected = () => selectedColor()?.toUpperCase() === preset.hex.toUpperCase();
            return (
              <button
                type="button"
                style={swatchStyle(preset.hex, isSelected())}
                onClick={() => handlePresetClick(preset.hex)}
                onMouseEnter={(e) => {
                  if (!isSelected()) {
                    e.currentTarget.style.transform = "scale(1.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title={preset.name}
                aria-label={`Select ${preset.name} color`}
              >
                <Show when={isSelected()}>
                  <Icon name="check" size={16} color="white" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Custom Color Input */}
      <Input
        label="Custom color (hex)"
        value={customColor()}
        onInput={handleCustomInput}
        placeholder="var(--cortex-warning)"
        error={customError()}
        style={{ width: "100%" }}
      />

      {/* Preview */}
      <div style={previewStyle()}>
        <div style={previewSwatchStyle()} />
        <span style={previewLabelStyle}>
          {selectedColor() ? `Preview: ${selectedColor()}` : "No color selected (default)"}
        </span>
      </div>
    </Modal>
  );
}

export default TerminalColorPicker;

