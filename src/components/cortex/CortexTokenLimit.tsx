import { Component, Show, JSX } from "solid-js";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";

export interface CortexTokenLimitProps {
  usedTokens: number;
  maxTokens: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  modelName?: string;
  variant?: "compact" | "full";
  onManageContext?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

const TOKEN_COLORS = {
  normal: "var(--cortex-success)",
  warning: "var(--cortex-warning)",
  critical: "var(--cortex-error)",
} as const;

const formatTokenCount = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
};

export const CortexTokenLimit: Component<CortexTokenLimitProps> = (props) => {
  const variant = () => props.variant ?? "compact";
  const warningThreshold = () => props.warningThreshold ?? 0.8;
  const criticalThreshold = () => props.criticalThreshold ?? 0.95;

  const usage = () => props.maxTokens > 0 ? props.usedTokens / props.maxTokens : 0;
  const percentage = () => Math.min(usage() * 100, 100);

  const fillColor = () => {
    const ratio = usage();
    if (ratio >= criticalThreshold()) return TOKEN_COLORS.critical;
    if (ratio >= warningThreshold()) return TOKEN_COLORS.warning;
    return TOKEN_COLORS.normal;
  };

  const isWarning = () => usage() >= warningThreshold();
  const isCritical = () => usage() >= criticalThreshold();
  const isCompact = () => variant() === "compact";

  return (
    <Show
      when={!isCompact()}
      fallback={
        <span
          class={props.class}
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "4px",
            "font-family": "var(--cortex-font-sans)",
            "font-size": "12px",
            color: fillColor(),
            cursor: "default",
            ...props.style,
          }}
        >
          <CortexIcon name="gauge" size={14} color={fillColor()} />
          Token Limit
        </span>
      }
    >
      <div
        class={props.class}
        style={{
          display: "flex",
          "flex-direction": "column",
          gap: "12px",
          padding: "16px",
          background: "var(--cortex-bg-primary)",
          color: "var(--cortex-text-primary)",
          "font-family": "var(--cortex-font-sans)",
          "border-radius": "var(--cortex-radius-lg)",
          border: "1px solid var(--cortex-border-default)",
          ...props.style,
        }}
      >
        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}>
          <CortexIcon name="gauge" size={18} color={fillColor()} />
          <span style={{ "font-weight": "600", "font-size": "14px" }}>
            Token Limit
          </span>
        </div>

        <div style={{
          width: "100%",
          height: "8px",
          background: "var(--cortex-bg-elevated)",
          "border-radius": "var(--cortex-radius-sm)",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${percentage()}%`,
            height: "100%",
            background: fillColor(),
            "border-radius": "var(--cortex-radius-sm)",
            transition: "width 300ms ease, background 300ms ease",
          }} />
        </div>

        <div style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "font-size": "12px",
        }}>
          <span style={{ color: "var(--cortex-text-secondary)" }}>
            {formatTokenCount(props.usedTokens)} / {formatTokenCount(props.maxTokens)} tokens used
          </span>
          <span style={{ color: fillColor(), "font-weight": "500" }}>
            {percentage().toFixed(0)}%
          </span>
        </div>

        <Show when={props.modelName}>
          <div style={{
            "font-size": "12px",
            color: "var(--cortex-text-inactive)",
          }}>
            Model: {props.modelName}
          </div>
        </Show>

        <Show when={isCritical()}>
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            padding: "8px 12px",
            background: "var(--cortex-error-bg)",
            "border-radius": "var(--cortex-radius-sm)",
            "font-size": "12px",
            color: TOKEN_COLORS.critical,
          }}>
            <CortexIcon name="warning" size={14} color={TOKEN_COLORS.critical} />
            Token limit nearly reached. Consider reducing context.
          </div>
        </Show>

        <Show when={isWarning() && !isCritical()}>
          <div style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            padding: "8px 12px",
            background: "var(--cortex-warning-bg)",
            "border-radius": "var(--cortex-radius-sm)",
            "font-size": "12px",
            color: TOKEN_COLORS.warning,
          }}>
            <CortexIcon name="warning" size={14} color={TOKEN_COLORS.warning} />
            Approaching token limit. Manage context to free space.
          </div>
        </Show>

        <Show when={props.onManageContext}>
          <CortexButton
            variant="secondary"
            size="sm"
            onClick={props.onManageContext}
            fullWidth
          >
            Manage Context
          </CortexButton>
        </Show>
      </div>
    </Show>
  );
};

export default CortexTokenLimit;
