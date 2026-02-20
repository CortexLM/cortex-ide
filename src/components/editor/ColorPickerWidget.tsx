/**
 * Color Picker Widget
 *
 * A comprehensive color picker component for the Monaco editor.
 * Features:
 * - Saturation/brightness picker
 * - Hue slider
 * - Alpha slider
 * - Format toggle (HEX/RGB/HSL)
 * - Preview and apply
 * - Color history
 */

import { createSignal, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import type { Color } from "@/providers/ColorProvider";
import {
  colorToHex,
  colorToRgb,
  colorToHsl,
  hexToColor,
  rgbToColor,
  hslToColor,
} from "@/providers/ColorProvider";

// ============================================================================
// Types
// ============================================================================

export type ColorFormat = "hex" | "rgb" | "hsl";

export interface ColorPickerWidgetProps {
  /** Initial color value */
  initialColor: Color;
  /** Callback when color changes (live preview) */
  onChange?: (color: Color) => void;
  /** Callback when color is applied (confirmed) */
  onApply?: (color: Color, format: ColorFormat) => void;
  /** Callback when picker is closed */
  onClose?: () => void;
  /** Position of the widget */
  position?: { x: number; y: number };
  /** Available color presentations */
  presentations?: Array<{ label: string; value: string }>;
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

// ============================================================================
// Color Conversion Utilities
// ============================================================================

function rgbToHsv(r: number, g: number, b: number): HSV {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hi = Math.floor((h / 60) % 6);
  const f = h / 60 - hi;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0, g = 0, b = 0;

  switch (hi) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  return { r, g, b };
}

function colorToHsv(color: Color): HSV {
  return rgbToHsv(color.red, color.green, color.blue);
}

function hsvToColor(hsv: HSV, alpha: number): Color {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return { red: r, green: g, blue: b, alpha };
}

// ============================================================================
// Component
// ============================================================================

export function ColorPickerWidget(props: ColorPickerWidgetProps) {
  // State
  const [hsv, setHsv] = createSignal<HSV>(colorToHsv(props.initialColor));
  const [alpha, setAlpha] = createSignal(props.initialColor.alpha);
  const [format, setFormat] = createSignal<ColorFormat>("hex");
  const [inputValue, setInputValue] = createSignal("");
  const [isDraggingSV, setIsDraggingSV] = createSignal(false);
  const [isDraggingHue, setIsDraggingHue] = createSignal(false);
  const [isDraggingAlpha, setIsDraggingAlpha] = createSignal(false);

  // Refs
  let containerRef: HTMLDivElement | undefined;
  let svPickerRef: HTMLDivElement | undefined;
  let hueSliderRef: HTMLDivElement | undefined;
  let alphaSliderRef: HTMLDivElement | undefined;

  // Computed color
  const currentColor = () => hsvToColor(hsv(), alpha());

  // Format the current color as string
  const formatColor = (color: Color, fmt: ColorFormat): string => {
    switch (fmt) {
      case "hex":
        return color.alpha < 1 ? colorToHex(color, true) : colorToHex(color, false);
      case "rgb":
        return colorToRgb(color);
      case "hsl":
        return colorToHsl(color);
    }
  };

  // Update input value when color or format changes
  createEffect(() => {
    setInputValue(formatColor(currentColor(), format()));
  });

  // Notify onChange when color changes
  createEffect(() => {
    const color = currentColor();
    props.onChange?.(color);
  });

  // Handle saturation/value picker interaction
  const handleSVInteraction = (e: MouseEvent | TouchEvent) => {
    if (!svPickerRef) return;

    const rect = svPickerRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    setHsv((prev) => ({
      ...prev,
      s: x,
      v: 1 - y,
    }));
  };

  // Handle hue slider interaction
  const handleHueInteraction = (e: MouseEvent | TouchEvent) => {
    if (!hueSliderRef) return;

    const rect = hueSliderRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setHsv((prev) => ({
      ...prev,
      h: x * 360,
    }));
  };

  // Handle alpha slider interaction
  const handleAlphaInteraction = (e: MouseEvent | TouchEvent) => {
    if (!alphaSliderRef) return;

    const rect = alphaSliderRef.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setAlpha(x);
  };

  // Mouse/touch event handlers
  const handleMouseDown = (type: "sv" | "hue" | "alpha") => (e: MouseEvent) => {
    e.preventDefault();
    if (type === "sv") {
      setIsDraggingSV(true);
      handleSVInteraction(e);
    } else if (type === "hue") {
      setIsDraggingHue(true);
      handleHueInteraction(e);
    } else {
      setIsDraggingAlpha(true);
      handleAlphaInteraction(e);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingSV()) handleSVInteraction(e);
    if (isDraggingHue()) handleHueInteraction(e);
    if (isDraggingAlpha()) handleAlphaInteraction(e);
  };

  const handleMouseUp = () => {
    setIsDraggingSV(false);
    setIsDraggingHue(false);
    setIsDraggingAlpha(false);
  };

  // Touch event handlers
  const handleTouchStart = (type: "sv" | "hue" | "alpha") => (e: TouchEvent) => {
    if (type === "sv") {
      setIsDraggingSV(true);
      handleSVInteraction(e);
    } else if (type === "hue") {
      setIsDraggingHue(true);
      handleHueInteraction(e);
    } else {
      setIsDraggingAlpha(true);
      handleAlphaInteraction(e);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDraggingSV()) handleSVInteraction(e);
    if (isDraggingHue()) handleHueInteraction(e);
    if (isDraggingAlpha()) handleAlphaInteraction(e);
  };

  const handleTouchEnd = () => {
    setIsDraggingSV(false);
    setIsDraggingHue(false);
    setIsDraggingAlpha(false);
  };

  // Setup global event listeners
  onMount(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  });

  onCleanup(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
  });

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);

    // Try to parse the input
    let parsed: Color | null = null;

    if (value.startsWith("#")) {
      parsed = hexToColor(value);
    } else if (value.startsWith("rgb")) {
      parsed = rgbToColor(value);
    } else if (value.startsWith("hsl")) {
      parsed = hslToColor(value);
    }

    if (parsed) {
      setHsv(colorToHsv(parsed));
      setAlpha(parsed.alpha);
    }
  };

  // Handle format toggle
  const toggleFormat = () => {
    const formats: ColorFormat[] = ["hex", "rgb", "hsl"];
    const currentIndex = formats.indexOf(format());
    setFormat(formats[(currentIndex + 1) % formats.length]);
  };

  // Handle apply
  const handleApply = () => {
    props.onApply?.(currentColor(), format());
    props.onClose?.();
  };

  // Handle close on Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose?.();
    } else if (e.key === "Enter") {
      handleApply();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Get the pure hue color for SV picker background
  const pureHueColor = () => {
    const { r, g, b } = hsvToRgb(hsv().h, 1, 1);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  };

  // Get CSS color string for current color
  const currentColorCss = () => {
    const c = currentColor();
    return `rgba(${Math.round(c.red * 255)}, ${Math.round(c.green * 255)}, ${Math.round(c.blue * 255)}, ${c.alpha})`;
  };

  // Get CSS color string without alpha for alpha slider background
  const opaqueColorCss = () => {
    const c = currentColor();
    return `rgb(${Math.round(c.red * 255)}, ${Math.round(c.green * 255)}, ${Math.round(c.blue * 255)})`;
  };

  return (
    <div
      ref={containerRef}
      class="color-picker-widget"
      style={{
        position: props.position ? "fixed" : "relative",
        left: props.position ? `${props.position.x}px` : undefined,
        top: props.position ? `${props.position.y}px` : undefined,
        "z-index": 10000,
      }}
    >
      {/* Saturation/Value Picker */}
      <div
        ref={svPickerRef}
        class="sv-picker"
        style={{
          background: `linear-gradient(to right, white, ${pureHueColor()})`,
        }}
        onMouseDown={handleMouseDown("sv")}
        onTouchStart={handleTouchStart("sv")}
      >
        <div class="sv-picker-overlay" />
        <div
          class="sv-picker-cursor"
          style={{
            left: `${hsv().s * 100}%`,
            top: `${(1 - hsv().v) * 100}%`,
          }}
        />
      </div>

      {/* Sliders Container */}
      <div class="sliders-container">
        {/* Hue Slider */}
        <div
          ref={hueSliderRef}
          class="hue-slider"
          onMouseDown={handleMouseDown("hue")}
          onTouchStart={handleTouchStart("hue")}
        >
          <div
            class="slider-cursor"
            style={{ left: `${(hsv().h / 360) * 100}%` }}
          />
        </div>

        {/* Alpha Slider */}
        <div
          ref={alphaSliderRef}
          class="alpha-slider"
          onMouseDown={handleMouseDown("alpha")}
          onTouchStart={handleTouchStart("alpha")}
        >
          <div
            class="alpha-slider-gradient"
            style={{
              background: `linear-gradient(to right, transparent, ${opaqueColorCss()})`,
            }}
          />
          <div
            class="slider-cursor"
            style={{ left: `${alpha() * 100}%` }}
          />
        </div>
      </div>

      {/* Color Preview and Input */}
      <div class="color-input-row">
        <div class="color-preview-container">
          <div
            class="color-preview"
            style={{ "background-color": currentColorCss() }}
          />
          <div
            class="color-preview-original"
            style={{
              "background-color": `rgba(${Math.round(props.initialColor.red * 255)}, ${Math.round(props.initialColor.green * 255)}, ${Math.round(props.initialColor.blue * 255)}, ${props.initialColor.alpha})`,
            }}
            title="Original color"
            onClick={() => {
              setHsv(colorToHsv(props.initialColor));
              setAlpha(props.initialColor.alpha);
            }}
          />
        </div>

        <div class="color-input-container">
          <button
            class="format-toggle"
            onClick={toggleFormat}
            title={`Switch format (current: ${format().toUpperCase()})`}
          >
            {format().toUpperCase()}
          </button>
          <input
            type="text"
            class="color-input"
            value={inputValue()}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
            }}
          />
        </div>
      </div>

      {/* Color Presentations (from LSP) */}
      <Show when={props.presentations && props.presentations.length > 0}>
        <div class="color-presentations">
          <div class="presentations-label">Formats:</div>
          <div class="presentations-list">
            <For each={props.presentations}>
              {(pres) => (
                <button
                  class="presentation-item"
                  onClick={() => {
                    setInputValue(pres.value);
                    handleInputChange(pres.value);
                  }}
                  title={pres.label}
                >
                  {pres.label}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* Actions */}
      <div class="color-picker-actions">
        <button class="action-cancel" onClick={props.onClose}>
          Cancel
        </button>
        <button class="action-apply" onClick={handleApply}>
          Apply
        </button>
      </div>

      <style>{`
        .color-picker-widget {
          width: 240px;
          padding: 12px;
          background: var(--vscode-editor-background, var(--cortex-bg-primary));
          border: 1px solid var(--vscode-widget-border, var(--cortex-bg-active));
          border-radius: var(--cortex-radius-md);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
          font-family: var(--vscode-font-family, system-ui);
          font-size: 12px;
          color: var(--vscode-foreground, var(--cortex-text-primary));
        }

        .sv-picker {
          position: relative;
          width: 100%;
          height: 160px;
          border-radius: var(--cortex-radius-sm);
          cursor: crosshair;
          overflow: hidden;
        }

        .sv-picker-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent, black);
        }

        .sv-picker-cursor {
          position: absolute;
          width: 12px;
          height: 12px;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .sliders-container {
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hue-slider {
          position: relative;
          height: 12px;
          border-radius: var(--cortex-radius-md);
          background: linear-gradient(
            to right,
            var(--cortex-error),
            var(--cortex-warning),
            var(--cortex-success),
            var(--cortex-info),
            var(--cortex-info),
            var(--cortex-info),
            var(--cortex-error)
          );
          cursor: pointer;
        }

        .alpha-slider {
          position: relative;
          height: 12px;
          border-radius: var(--cortex-radius-md);
          background-image: linear-gradient(45deg, var(--cortex-text-inactive) 25%, transparent 25%),
            linear-gradient(-45deg, var(--cortex-text-inactive) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--cortex-text-inactive) 75%),
            linear-gradient(-45deg, transparent 75%, var(--cortex-text-inactive) 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          cursor: pointer;
        }

        .alpha-slider-gradient {
          position: absolute;
          inset: 0;
          border-radius: var(--cortex-radius-md);
        }

        .slider-cursor {
          position: absolute;
          top: 50%;
          width: 14px;
          height: 14px;
          background: white;
          border: 2px solid #666;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .color-input-row {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .color-preview-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .color-preview {
          width: 36px;
          height: 24px;
          border-radius: var(--cortex-radius-sm);
          border: 1px solid var(--vscode-widget-border, var(--cortex-bg-active));
          background-image: linear-gradient(45deg, var(--cortex-text-inactive) 25%, transparent 25%),
            linear-gradient(-45deg, var(--cortex-text-inactive) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--cortex-text-inactive) 75%),
            linear-gradient(-45deg, transparent 75%, var(--cortex-text-inactive) 75%);
          background-size: 8px 8px;
          background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
          position: relative;
        }

        .color-preview::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: var(--cortex-radius-sm);
          background: inherit;
          background-image: none;
        }

        .color-preview-original {
          width: 36px;
          height: 12px;
          border-radius: var(--cortex-radius-sm);
          border: 1px solid var(--vscode-widget-border, var(--cortex-bg-active));
          cursor: pointer;
          opacity: 0.8;
        }

        .color-preview-original:hover {
          opacity: 1;
        }

        .color-input-container {
          flex: 1;
          display: flex;
          gap: 4px;
        }

        .format-toggle {
          padding: 4px 8px;
          background: var(--vscode-button-secondaryBackground, var(--cortex-bg-hover));
          border: 1px solid var(--vscode-button-border, transparent);
          border-radius: var(--cortex-radius-sm);
          color: var(--vscode-button-secondaryForeground, var(--cortex-text-primary));
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          min-width: 36px;
        }

        .format-toggle:hover {
          background: var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active));
        }

        .color-input {
          flex: 1;
          padding: 4px 8px;
          background: var(--vscode-input-background, var(--cortex-bg-hover));
          border: 1px solid var(--vscode-input-border, var(--cortex-bg-hover));
          border-radius: var(--cortex-radius-sm);
          color: var(--vscode-input-foreground, var(--cortex-text-primary));
          font-family: monospace;
          font-size: 11px;
          outline: none;
        }

        .color-input:focus {
          border-color: var(--vscode-focusBorder, var(--cortex-info));
        }

        .color-presentations {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid var(--vscode-widget-border, var(--cortex-bg-active));
        }

        .presentations-label {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, var(--cortex-text-inactive));
          margin-bottom: 4px;
        }

        .presentations-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .presentation-item {
          padding: 2px 6px;
          background: var(--vscode-badge-background, var(--cortex-bg-active));
          border: none;
          border-radius: var(--cortex-radius-sm);
          color: var(--vscode-badge-foreground, var(--cortex-text-primary));
          font-family: monospace;
          font-size: 10px;
          cursor: pointer;
        }

        .presentation-item:hover {
          background: var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active));
        }

        .color-picker-actions {
          margin-top: 12px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .action-cancel,
        .action-apply {
          padding: 4px 12px;
          border: none;
          border-radius: var(--cortex-radius-sm);
          font-size: 12px;
          cursor: pointer;
        }

        .action-cancel {
          background: var(--vscode-button-secondaryBackground, var(--cortex-bg-hover));
          color: var(--vscode-button-secondaryForeground, var(--cortex-text-primary));
        }

        .action-cancel:hover {
          background: var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active));
        }

        .action-apply {
          background: var(--vscode-button-background, var(--cortex-info));
          color: var(--vscode-button-foreground, var(--cortex-text-primary));
        }

        .action-apply:hover {
          background: var(--vscode-button-hoverBackground, var(--cortex-info));
        }
      `}</style>
    </div>
  );
}

export default ColorPickerWidget;

