import { Component, createSignal, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import type { Breakpoint } from "../../context/DebugContext";

// ============== Types ==============

export type BreakpointType = "breakpoint" | "conditional" | "logpoint" | "hitCount";

export interface BreakpointWidgetProps {
  /** The breakpoint being edited, or null for new breakpoint */
  breakpoint?: Breakpoint | null;
  /** File path for new breakpoints */
  filePath: string;
  /** Line number for new breakpoints */
  line: number;
  /** Column number for inline breakpoints */
  column?: number;
  /** Initial breakpoint type to show */
  initialType?: BreakpointType;
  /** Called when the widget should be closed */
  onClose: () => void;
  /** Called when the breakpoint is saved */
  onSave: (data: BreakpointWidgetData) => void;
  /** Position style for the widget */
  style?: Record<string, string | number>;
}

export interface BreakpointWidgetData {
  type: BreakpointType;
  condition: string;
  hitCondition: string;
  logMessage: string;
  enabled: boolean;
}

// ============== Component ==============

export const BreakpointWidget: Component<BreakpointWidgetProps> = (props) => {
  // Initialize state from existing breakpoint or defaults
  const getInitialType = (): BreakpointType => {
    if (props.initialType) return props.initialType;
    if (props.breakpoint) {
      if (props.breakpoint.isLogpoint || props.breakpoint.logMessage) return "logpoint";
      if (props.breakpoint.hitCondition) return "hitCount";
      if (props.breakpoint.condition) return "conditional";
    }
    return "breakpoint";
  };

  const [type, setType] = createSignal<BreakpointType>(getInitialType());
  const [condition, setCondition] = createSignal(props.breakpoint?.condition || "");
  const [hitCondition, setHitCondition] = createSignal(props.breakpoint?.hitCondition || "");
  const [logMessage, setLogMessage] = createSignal(props.breakpoint?.logMessage || "");
  const [enabled, setEnabled] = createSignal(props.breakpoint?.enabled ?? true);

  let containerRef: HTMLDivElement | undefined;
  let primaryInputRef: HTMLInputElement | undefined;

  // Focus the primary input when mounted
  onMount(() => {
    primaryInputRef?.focus();
  });

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
    }
  };

  // Handle click outside to close
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("mousedown", handleClickOutside);
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Update primary input reference when type changes
  createEffect(() => {
    // Track type() to trigger effect when type changes
    type();
    // Re-focus on type change
    setTimeout(() => primaryInputRef?.focus(), 0);
  });

  const handleSave = () => {
    props.onSave({
      type: type(),
      condition: condition(),
      hitCondition: hitCondition(),
      logMessage: logMessage(),
      enabled: enabled(),
    });
  };

  const getPlaceholder = (): string => {
    switch (type()) {
      case "conditional":
        return "Enter condition expression (e.g., x > 10)";
      case "hitCount":
        return "Enter hit count (e.g., 5, >10, %3)";
      case "logpoint":
        return "Enter log message (use {expression} for interpolation)";
      default:
        return "";
    }
  };

  const getInputLabel = (): string => {
    switch (type()) {
      case "conditional":
        return "Condition";
      case "hitCount":
        return "Hit Count";
      case "logpoint":
        return "Log Message";
      default:
        return "";
    }
  };

  const breakpointTypes: { value: BreakpointType; label: string; description: string }[] = [
    { value: "breakpoint", label: "Breakpoint", description: "Standard breakpoint" },
    { value: "conditional", label: "Conditional", description: "Break when condition is true" },
    { value: "hitCount", label: "Hit Count", description: "Break after N hits" },
    { value: "logpoint", label: "Logpoint", description: "Log message without stopping" },
  ];

  return (
    <div
      ref={containerRef}
      class="breakpoint-widget"
      style={{
        position: "absolute",
        "z-index": "1000",
        "min-width": "320px",
        "max-width": "450px",
        "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
        border: "1px solid var(--vscode-editorWidget-border, var(--cortex-bg-active))",
        "border-radius": "var(--cortex-radius-sm)",
        "box-shadow": "0 2px 8px rgba(0, 0, 0, 0.3)",
        "font-size": "13px",
        color: "var(--vscode-foreground, var(--cortex-text-primary))",
        ...props.style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 12px",
          "border-bottom": "1px solid var(--vscode-editorWidget-border, var(--cortex-bg-active))",
          "background-color": "var(--vscode-editorWidget-background, var(--cortex-bg-primary))",
        }}
      >
        <span style={{ "font-weight": "500" }}>
          {props.breakpoint ? "Edit Breakpoint" : "Add Breakpoint"}
        </span>
        <span style={{ "font-size": "11px", opacity: "0.7" }}>
          Line {props.line}
          {props.column !== undefined && `:${props.column}`}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: "12px" }}>
        {/* Breakpoint Type Dropdown */}
        <div style={{ "margin-bottom": "12px" }}>
          <label
            style={{
              display: "block",
              "margin-bottom": "4px",
              "font-size": "12px",
              opacity: "0.8",
            }}
          >
            Type
          </label>
          <select
            value={type()}
            onChange={(e) => setType(e.currentTarget.value as BreakpointType)}
            style={{
              width: "100%",
              padding: "6px 8px",
              "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
              color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
              border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-sm)",
              "font-size": "13px",
              cursor: "pointer",
            }}
          >
            <For each={breakpointTypes}>
              {(bt) => (
                <option value={bt.value}>
                  {bt.label}
                </option>
              )}
            </For>
          </select>
          <div style={{ "font-size": "11px", opacity: "0.6", "margin-top": "2px" }}>
            {breakpointTypes.find((bt) => bt.value === type())?.description}
          </div>
        </div>

        {/* Conditional Input - Condition Expression */}
        <Show when={type() === "conditional"}>
          <div style={{ "margin-bottom": "12px" }}>
            <label
              style={{
                display: "block",
                "margin-bottom": "4px",
                "font-size": "12px",
                opacity: "0.8",
              }}
            >
              {getInputLabel()}
            </label>
            <input
              ref={primaryInputRef}
              type="text"
              value={condition()}
              onInput={(e) => setCondition(e.currentTarget.value)}
              placeholder={getPlaceholder()}
              style={{
                width: "100%",
                padding: "6px 8px",
                "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
                color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
                border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
                "border-radius": "var(--cortex-radius-sm)",
                "font-size": "13px",
                "font-family": "var(--vscode-editor-font-family, monospace)",
                "box-sizing": "border-box",
              }}
            />
          </div>
        </Show>

        {/* Hit Count Input */}
        <Show when={type() === "hitCount"}>
          <div style={{ "margin-bottom": "12px" }}>
            <label
              style={{
                display: "block",
                "margin-bottom": "4px",
                "font-size": "12px",
                opacity: "0.8",
              }}
            >
              {getInputLabel()}
            </label>
            <input
              ref={primaryInputRef}
              type="text"
              value={hitCondition()}
              onInput={(e) => setHitCondition(e.currentTarget.value)}
              placeholder={getPlaceholder()}
              style={{
                width: "100%",
                padding: "6px 8px",
                "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
                color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
                border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
                "border-radius": "var(--cortex-radius-sm)",
                "font-size": "13px",
                "font-family": "var(--vscode-editor-font-family, monospace)",
                "box-sizing": "border-box",
              }}
            />
            <div style={{ "font-size": "11px", opacity: "0.6", "margin-top": "2px" }}>
              Examples: 5 (exact), &gt;10 (greater than), %3 (every 3rd hit)
            </div>
          </div>
        </Show>

        {/* Log Message Input (Logpoint) */}
        <Show when={type() === "logpoint"}>
          <div style={{ "margin-bottom": "12px" }}>
            <label
              style={{
                display: "block",
                "margin-bottom": "4px",
                "font-size": "12px",
                opacity: "0.8",
              }}
            >
              {getInputLabel()}
            </label>
            <input
              ref={primaryInputRef}
              type="text"
              value={logMessage()}
              onInput={(e) => setLogMessage(e.currentTarget.value)}
              placeholder={getPlaceholder()}
              style={{
                width: "100%",
                padding: "6px 8px",
                "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
                color: "var(--vscode-input-foreground, var(--cortex-text-primary))",
                border: "1px solid var(--vscode-input-border, var(--cortex-bg-hover))",
                "border-radius": "var(--cortex-radius-sm)",
                "font-size": "13px",
                "font-family": "var(--vscode-editor-font-family, monospace)",
                "box-sizing": "border-box",
              }}
            />
            <div style={{ "font-size": "11px", opacity: "0.6", "margin-top": "2px" }}>
              Use &#123;expression&#125; to interpolate values, e.g., "x = &#123;x&#125;"
            </div>
          </div>
        </Show>

        {/* Standard breakpoint - no additional inputs needed */}
        <Show when={type() === "breakpoint"}>
          <div
            ref={(el) => (primaryInputRef = el as any)}
            tabIndex={0}
            style={{
              padding: "8px",
              "background-color": "var(--vscode-input-background, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-sm)",
              "margin-bottom": "12px",
              "font-size": "12px",
              opacity: "0.7",
            }}
          >
            Standard breakpoint - execution will pause at this line.
          </div>
        </Show>

        {/* Enabled/Disabled Toggle */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "margin-bottom": "16px",
            cursor: "pointer",
          }}
          onClick={() => setEnabled(!enabled())}
        >
          <div
            style={{
              width: "36px",
              height: "18px",
              "background-color": enabled()
                ? "var(--vscode-button-background, var(--cortex-info))"
                : "var(--vscode-input-background, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-full)",
              position: "relative",
              transition: "background-color 0.2s",
              "margin-right": "8px",
            }}
          >
            <div
              style={{
                width: "14px",
                height: "14px",
                "background-color": "white",
                "border-radius": "var(--cortex-radius-full)",
                position: "absolute",
                top: "2px",
                left: enabled() ? "20px" : "2px",
                transition: "left 0.2s",
              }}
            />
          </div>
          <span style={{ "font-size": "13px" }}>
            {enabled() ? "Enabled" : "Disabled"}
          </span>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            "justify-content": "flex-end",
            gap: "8px",
          }}
        >
          <button
            onClick={props.onClose}
            style={{
              padding: "6px 14px",
              "background-color": "transparent",
              color: "var(--vscode-foreground, var(--cortex-text-primary))",
              border: "1px solid var(--vscode-button-secondaryBackground, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-sm)",
              cursor: "pointer",
              "font-size": "13px",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-button-secondaryHoverBackground, var(--cortex-bg-active))";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "6px 14px",
              "background-color": "var(--vscode-button-background, var(--cortex-info))",
              color: "var(--vscode-button-foreground, var(--cortex-text-primary))",
              border: "none",
              "border-radius": "var(--cortex-radius-sm)",
              cursor: "pointer",
              "font-size": "13px",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-button-hoverBackground, var(--cortex-info))";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-button-background, var(--cortex-info))";
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Footer with keyboard shortcuts hint */}
      <div
        style={{
          padding: "6px 12px",
          "border-top": "1px solid var(--vscode-editorWidget-border, var(--cortex-bg-active))",
          "font-size": "11px",
          opacity: "0.6",
          display: "flex",
          "justify-content": "space-between",
        }}
      >
        <span>Enter to save</span>
        <span>Escape to cancel</span>
      </div>
    </div>
  );
};

export default BreakpointWidget;

