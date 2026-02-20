import { Show, JSX, createSignal, createEffect, onCleanup } from "solid-js";
import { Icon } from "../../ui/Icon";
import { Card, Text } from "@/components/ui";
import { Skeleton } from "@/components/ui/Skeleton";

// ============================================================================
// Types
// ============================================================================

export type ToolStatus = "pending" | "running" | "completed" | "error";

export interface ToolCardProps {
  /** Tool name to display */
  name: string;
  /** Icon component to display */
  icon?: JSX.Element;
  /** Current status of the tool */
  status: ToolStatus;
  /** Duration in milliseconds (optional) */
  durationMs?: number;
  /** Whether the card is expanded by default */
  defaultExpanded?: boolean;
  /** Raw input data for the tool */
  rawInput?: unknown;
  /** Raw output data from the tool */
  rawOutput?: unknown;
  /** Main content to display when expanded */
  children?: JSX.Element;
  /** Error message if status is error */
  errorMessage?: string;
  /** Whether to show loading skeleton */
  loading?: boolean;
  /** Additional class names */
  class?: string;
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
}



function getStatusBorderColor(status: ToolStatus): string {
  switch (status) {
    case "pending":
      return "var(--jb-text-muted-color)";
    case "running":
      return "var(--cortex-warning)";
    case "completed":
      return "var(--cortex-success)";
    case "error":
      return "var(--cortex-error)";
    default:
      return "var(--jb-text-muted-color)";
  }
}

// ============================================================================
// Component
// ============================================================================

export function ToolCard(props: ToolCardProps) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded ?? true);
  const [showRaw, setShowRaw] = createSignal(false);
  const [elapsedTime, setElapsedTime] = createSignal(0);
  
  // Timer for running status
  let startTime: number | undefined;
  let intervalId: number | undefined;
  
  createEffect(() => {
    if (props.status === "running" && !props.durationMs) {
      startTime = Date.now();
      intervalId = window.setInterval(() => {
        setElapsedTime(Date.now() - startTime!);
      }, 100);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }
  });
  
  onCleanup(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });
  
  const displayDuration = () => {
    if (props.durationMs !== undefined) {
      return formatDuration(props.durationMs);
    }
    if (props.status === "running" && elapsedTime() > 0) {
      return formatDuration(elapsedTime());
    }
    return null;
  };

  const hasRawData = () => props.rawInput !== undefined || props.rawOutput !== undefined;

  return (
    <Card
      variant="outlined"
      padding="none"
      class={props.class || ""}
      style={{
        margin: "8px 0",
        overflow: "hidden",
        "border-left": `3px solid ${getStatusBorderColor(props.status)}`,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      {/* Header */}
      <button
        type="button"
        class="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded())}
        onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
      >
        {/* Expand/Collapse Icon */}
        <span style={{ color: "var(--jb-text-muted-color)", "flex-shrink": "0" }}>
<Show when={expanded()} fallback={<Icon name="chevron-right" class="w-4 h-4" />}>
            <Icon name="chevron-down" class="w-4 h-4" />
          </Show>
        </span>
        
        {/* Tool Icon */}
        <span style={{ color: getStatusBorderColor(props.status), "flex-shrink": "0" }}>
          <Show when={props.icon} fallback={<Icon name="code" class="w-4 h-4" />}>
            {props.icon}
          </Show>
        </span>
        
        {/* Tool Name */}
        <Text
          size="sm"
          weight="medium"
          truncate
          style={{
            flex: "1",
            "font-family": "var(--jb-font-mono, monospace)",
          }}
        >
          {props.name}
        </Text>
        
        {/* Status Indicator */}
        <span class="flex items-center gap-1.5">
          <Show when={props.status === "pending"}>
            <div
              style={{
                width: "8px",
                height: "8px",
                "border-radius": "var(--cortex-radius-full)",
                background: "var(--jb-text-muted-color)",
                opacity: "0.5",
              }}
            />
          </Show>
<Show when={props.status === "running"}>
            <Icon
              name="spinner"
              class="w-4 h-4 animate-spin"
              style={{ color: "var(--cortex-warning)" }}
            />
          </Show>
          <Show when={props.status === "completed"}>
            <Icon
              name="check"
              class="w-4 h-4"
              style={{ color: "var(--cortex-success)" }}
            />
          </Show>
          <Show when={props.status === "error"}>
            <Icon name="xmark" class="w-4 h-4" style={{ color: "var(--cortex-error)" }} />
          </Show>
        </span>
        
        {/* Duration */}
        <Show when={displayDuration()}>
          <div class="flex items-center gap-1">
            <Icon name="clock" class="w-3 h-3" style={{ color: "var(--jb-text-muted-color)" }} />
            <Text variant="muted" size="xs">{displayDuration()}</Text>
          </div>
        </Show>
      </button>
      
      {/* Expandable Content */}
      <div
        style={{
          "max-height": expanded() ? "2000px" : "0",
          overflow: "hidden",
          transition: "max-height 0.3s ease-in-out",
        }}
      >
        <div style={{ "border-top": "1px solid var(--jb-border-default)" }}>
          {/* Loading State */}
          <Show when={props.loading}>
            <div style={{ padding: "12px 14px" }}>
              <Skeleton height={16} width="60%" />
              <div style={{ "margin-top": "8px" }}>
                <Skeleton height={12} count={3} />
              </div>
            </div>
          </Show>
          
          {/* Error Message */}
          <Show when={props.status === "error" && props.errorMessage}>
            <Card
              variant="outlined"
              padding="sm"
              style={{
                margin: "10px 14px",
                background: "rgba(247, 84, 100, 0.1)",
                "border-color": "var(--cortex-error)",
              }}
            >
              <div class="flex items-start gap-2">
                <Icon name="xmark" class="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--cortex-error)" }} />
                <Text color="error" size="sm" style={{ "white-space": "pre-wrap", "word-break": "break-word" }}>
                  {props.errorMessage}
                </Text>
              </div>
            </Card>
          </Show>
          
          {/* Main Content */}
          <Show when={!props.loading && props.children}>
            <div>{props.children}</div>
          </Show>
          
          {/* Raw Data Toggle */}
          <Show when={hasRawData()}>
            <div style={{ "border-top": "1px solid var(--jb-border-default)" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRaw(!showRaw());
                }}
                class="w-full flex items-center gap-1.5 px-3.5 py-2 text-left transition-colors"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--jb-surface-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
<Show when={showRaw()} fallback={<Icon name="eye" class="w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />}>
                  <Icon name="eye-slash" class="w-3.5 h-3.5" style={{ color: "var(--jb-text-muted-color)" }} />
                </Show>
                <Text variant="muted" size="xs">
                  {showRaw() ? "Hide Raw Data" : "Show Raw Data"}
                </Text>
              </button>
              
              <Show when={showRaw()}>
                <div
                  style={{
                    padding: "10px 14px",
                    "border-top": "1px solid var(--jb-border-default)",
                  }}
                >
                  <Show when={props.rawInput !== undefined}>
                    <div style={{ "margin-bottom": props.rawOutput ? "12px" : "0" }}>
                      <Text variant="header" size="xs" style={{ "margin-bottom": "4px", display: "block" }}>
                        Input
                      </Text>
                      <pre
                        style={{
                          margin: "0",
                          padding: "8px",
                          background: "rgba(0, 0, 0, 0.2)",
                          "border-radius": "var(--jb-radius-sm)",
                          "font-family": "var(--jb-font-mono, monospace)",
                          "font-size": "11px",
                          "white-space": "pre-wrap",
                          "word-break": "break-word",
                          "max-height": "200px",
                          "overflow-y": "auto",
                          color: "var(--jb-text-body-color)",
                        }}
                      >
                        {typeof props.rawInput === "string"
                          ? props.rawInput
                          : JSON.stringify(props.rawInput, null, 2)}
                      </pre>
                    </div>
                  </Show>
                  
                  <Show when={props.rawOutput !== undefined}>
                    <div>
                      <Text variant="header" size="xs" style={{ "margin-bottom": "4px", display: "block" }}>
                        Output
                      </Text>
                      <pre
                        style={{
                          margin: "0",
                          padding: "8px",
                          background: "rgba(0, 0, 0, 0.2)",
                          "border-radius": "var(--jb-radius-sm)",
                          "font-family": "var(--jb-font-mono, monospace)",
                          "font-size": "11px",
                          "white-space": "pre-wrap",
                          "word-break": "break-word",
                          "max-height": "200px",
                          "overflow-y": "auto",
                          color: "var(--jb-text-body-color)",
                        }}
                      >
                        {typeof props.rawOutput === "string"
                          ? props.rawOutput
                          : JSON.stringify(props.rawOutput, null, 2)}
                      </pre>
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Card>
  );
}

export default ToolCard;

