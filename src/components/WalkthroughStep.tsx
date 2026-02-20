/**
 * WalkthroughStep Component
 * Individual step within a walkthrough/guided tutorial
 *
 * Features:
 * - Step title and markdown description
 * - Media support (images, videos)
 * - Action button (run command, open file)
 * - Completion checkbox
 * - Visual completion state
 */

import { Show, createSignal, createEffect } from "solid-js";
import { Icon } from "./ui/Icon";
import { Markdown } from "./Markdown";

// ============================================================================
// Types
// ============================================================================

export type WalkthroughActionType = "command" | "open-file" | "open-url" | "open-settings" | "run-command";

export interface WalkthroughAction {
  /** Type of action to perform */
  type: WalkthroughActionType;
  /** Label for the action button */
  label: string;
  /** Value for the action (command id, file path, URL, or settings tab) */
  value: string;
}

export interface WalkthroughStepData {
  /** Unique step identifier */
  id: string;
  /** Step title */
  title: string;
  /** Markdown description content */
  description: string;
  /** Optional media to display */
  media?: {
    type: "image" | "video";
    src: string;
    alt?: string;
  };
  /** Optional action button */
  action?: WalkthroughAction;
}

export interface WalkthroughStepProps {
  /** Step data */
  step: WalkthroughStepData;
  /** Step number (1-based) */
  stepNumber: number;
  /** Total number of steps */
  totalSteps: number;
  /** Whether this step is completed */
  isCompleted: boolean;
  /** Whether this step is the current/active step */
  isActive: boolean;
  /** Whether the step content is expanded */
  isExpanded?: boolean;
  /** Callback when completion state changes */
  onToggleComplete: (stepId: string, completed: boolean) => void;
  /** Callback when step is clicked */
  onClick?: (stepId: string) => void;
}

// ============================================================================
// Action Button Component
// ============================================================================

function ActionButton(props: { action: WalkthroughAction; disabled?: boolean }) {
  const [isExecuting, setIsExecuting] = createSignal(false);

  const getIconName = () => {
    switch (props.action.type) {
      case "command":
      case "run-command":
        return "terminal";
      case "open-file":
        return "file";
      case "open-url":
        return "arrow-up-right-from-square";
      case "open-settings":
        return "gear";
      default:
        return "play";
    }
  };

  const executeAction = async () => {
    if (isExecuting() || props.disabled) return;

    setIsExecuting(true);

    try {
      switch (props.action.type) {
        case "command":
        case "run-command":
          window.dispatchEvent(
            new CustomEvent("command:execute", {
              detail: { commandId: props.action.value },
            })
          );
          break;

        case "open-file":
          window.dispatchEvent(
            new CustomEvent("file:open", {
              detail: { path: props.action.value },
            })
          );
          break;

        case "open-url":
          window.open(props.action.value, "_blank", "noopener,noreferrer");
          break;

        case "open-settings":
          window.dispatchEvent(
            new CustomEvent("settings:open-tab")
          );
          break;
      }
    } catch (error) {
      console.error("[WalkthroughStep] Action failed:", error);
    } finally {
      setTimeout(() => setIsExecuting(false), 300);
    }
  };

  return (
    <button
      onClick={executeAction}
      disabled={isExecuting() || props.disabled}
      class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
      style={{
        background: "var(--accent-primary)",
        color: "var(--text-on-accent)",
        opacity: isExecuting() || props.disabled ? "0.6" : "1",
        cursor: isExecuting() || props.disabled ? "not-allowed" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!isExecuting() && !props.disabled) {
          e.currentTarget.style.opacity = "0.9";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = isExecuting() || props.disabled ? "0.6" : "1";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <Icon name={getIconName()} class="w-4 h-4" />
      <span>{isExecuting() ? "Running..." : props.action.label}</span>
    </button>
  );
}

// ============================================================================
// Media Display Component
// ============================================================================

function MediaDisplay(props: { media: NonNullable<WalkthroughStepData["media"]> }) {
  const [loaded, setLoaded] = createSignal(false);
  const [error, setError] = createSignal(false);

  return (
    <div
      class="relative rounded-lg overflow-hidden mt-4"
      style={{
        background: "var(--background-stronger)",
        border: "1px solid var(--border-weak)",
      }}
    >
      <Show when={props.media.type === "image"}>
        <Show when={!error()} fallback={
          <div
            class="flex items-center justify-center h-40 text-sm"
            style={{ color: "var(--text-weaker)" }}
          >
            Failed to load image
          </div>
        }>
          <img
            src={props.media.src}
            alt={props.media.alt || "Step illustration"}
            class="w-full h-auto max-h-64 object-contain transition-opacity duration-300"
            style={{ opacity: loaded() ? "1" : "0" }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          <Show when={!loaded()}>
            <div
              class="absolute inset-0 flex items-center justify-center"
              style={{ background: "var(--background-stronger)" }}
            >
              <div
                class="w-6 h-6 border-2 rounded-full animate-spin"
                style={{
                  "border-color": "var(--border-weak)",
                  "border-top-color": "var(--accent-primary)",
                }}
              />
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={props.media.type === "video"}>
        <video
          src={props.media.src}
          controls
          class="w-full h-auto max-h-64"
          preload="metadata"
        >
          <track kind="captions" />
          Your browser does not support the video tag.
        </video>
      </Show>
    </div>
  );
}

// ============================================================================
// Completion Checkbox Component
// ============================================================================

function CompletionCheckbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (!props.disabled) {
          props.onChange(!props.checked);
        }
      }}
      class="flex items-center justify-center rounded-md transition-all duration-150"
      style={{
        width: "22px",
        height: "22px",
        background: props.checked ? "var(--accent-primary)" : "transparent",
        border: props.checked ? "none" : "2px solid var(--border-base)",
        cursor: props.disabled ? "default" : "pointer",
        opacity: props.disabled ? "0.5" : "1",
      }}
      onMouseEnter={(e) => {
        if (!props.disabled && !props.checked) {
          e.currentTarget.style.borderColor = "var(--accent-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.disabled && !props.checked) {
          e.currentTarget.style.borderColor = "var(--border-base)";
        }
      }}
      title={props.checked ? "Mark as incomplete" : "Mark as complete"}
    >
      <Show when={props.checked}>
        <Icon name="check" class="w-3.5 h-3.5" style={{ color: "var(--text-on-accent)" }} />
      </Show>
    </button>
  );
}

// ============================================================================
// Main WalkthroughStep Component
// ============================================================================

export function WalkthroughStep(props: WalkthroughStepProps) {
  const [localExpanded, setLocalExpanded] = createSignal(props.isExpanded ?? props.isActive);

  createEffect(() => {
    if (props.isExpanded !== undefined) {
      setLocalExpanded(props.isExpanded);
    } else if (props.isActive) {
      setLocalExpanded(true);
    }
  });

  const handleClick = () => {
    if (props.onClick) {
      props.onClick(props.step.id);
    } else {
      setLocalExpanded(!localExpanded());
    }
  };

  const handleToggleComplete = (completed: boolean) => {
    props.onToggleComplete(props.step.id, completed);
  };

  return (
    <div
      class="walkthrough-step rounded-lg transition-all duration-200"
      style={{
        background: props.isActive
          ? "var(--surface-raised)"
          : "var(--surface-base)",
        border: `1px solid ${props.isActive ? "var(--accent-primary)" : "var(--border-weak)"}`,
        "box-shadow": props.isActive
          ? "0 2px 8px rgba(97, 175, 239, 0.1)"
          : "none",
      }}
    >
      {/* Step Header */}
      <button
        onClick={handleClick}
        class="w-full flex items-center gap-3 p-4 text-left"
        style={{ cursor: "pointer" }}
      >
        {/* Step Number / Completion Status */}
        <div class="flex-shrink-0">
          <Show
            when={props.isCompleted}
            fallback={
              <div
                class="flex items-center justify-center rounded-full text-xs font-semibold"
                style={{
                  width: "28px",
                  height: "28px",
                  background: props.isActive
                    ? "var(--accent-primary)"
                    : "var(--background-stronger)",
                  color: props.isActive
                    ? "var(--text-on-accent)"
                    : "var(--text-weak)",
                }}
              >
                {props.stepNumber}
              </div>
            }
          >
            <div
              class="flex items-center justify-center rounded-full"
              style={{
                width: "28px",
                height: "28px",
                background: "var(--success-bg, var(--cortex-success)15)",
              }}
            >
              <Icon
                name="check"
                class="w-4 h-4"
                style={{ color: "var(--success, var(--cortex-success))" }}
              />
            </div>
          </Show>
        </div>

        {/* Title */}
        <div class="flex-1 min-w-0">
          <h4
            class="font-medium text-sm truncate"
            style={{
              color: props.isCompleted
                ? "var(--text-weak)"
                : "var(--text-base)",
              "text-decoration": props.isCompleted ? "line-through" : "none",
            }}
          >
            {props.step.title}
          </h4>
          <Show when={!localExpanded()}>
            <p
              class="text-xs truncate mt-0.5"
              style={{ color: "var(--text-weaker)" }}
            >
              Step {props.stepNumber} of {props.totalSteps}
            </p>
          </Show>
        </div>

        {/* Expand/Collapse Icon */}
        <div
          class="flex-shrink-0 transition-transform duration-200"
          style={{
            color: "var(--text-weaker)",
            transform: localExpanded() ? "rotate(0deg)" : "rotate(-90deg)",
          }}
        >
          <Icon name="chevron-down" class="w-4 h-4" />
        </div>
      </button>

      {/* Step Content (Expandable) */}
      <Show when={localExpanded()}>
        <div
          class="px-4 pb-4"
          style={{
            "margin-left": "40px",
            "border-top": "1px solid var(--border-weak)",
            "padding-top": "16px",
          }}
        >
          {/* Description */}
          <div
            class="text-sm"
            style={{ color: "var(--text-weak)" }}
          >
            <Markdown content={props.step.description} />
          </div>

          {/* Media */}
          <Show when={props.step.media}>
            <MediaDisplay media={props.step.media!} />
          </Show>

          {/* Action Button and Completion Checkbox */}
          <div class="flex items-center justify-between mt-4 pt-4" style={{ "border-top": "1px solid var(--border-weak)" }}>
            {/* Action Button */}
            <div>
              <Show when={props.step.action}>
                <ActionButton action={props.step.action!} />
              </Show>
            </div>

            {/* Completion Checkbox */}
            <label
              class="flex items-center gap-2 cursor-pointer"
              style={{ color: "var(--text-weak)" }}
            >
              <span class="text-xs">Mark as done</span>
              <CompletionCheckbox
                checked={props.isCompleted}
                onChange={handleToggleComplete}
              />
            </label>
          </div>
        </div>
      </Show>
    </div>
  );
}



