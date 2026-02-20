import { createSignal, createMemo, Show, splitProps, mergeProps, JSX, onMount } from "solid-js";
import { tokens } from '@/design-system/tokens';

/**
 * Coverage threshold configuration
 */
export interface CoverageThresholds {
  /** Percentage at or above which coverage is considered good (green) */
  good: number;
  /** Percentage at or above which coverage is considered acceptable (yellow) */
  acceptable: number;
  /** Below acceptable is considered poor (red) */
}

/**
 * Default thresholds for coverage visualization
 */
export const DEFAULT_THRESHOLDS: CoverageThresholds = {
  good: 80,
  acceptable: 60,
};

/**
 * Coverage status based on percentage and thresholds
 */
export type CoverageStatus = "good" | "acceptable" | "poor";

/**
 * Get the coverage status based on percentage and thresholds
 */
export function getCoverageStatus(percentage: number, thresholds: CoverageThresholds = DEFAULT_THRESHOLDS): CoverageStatus {
  if (percentage >= thresholds.good) return "good";
  if (percentage >= thresholds.acceptable) return "acceptable";
  return "poor";
}

/**
 * Get the color for a coverage status
 */
export function getCoverageColor(status: CoverageStatus): string {
  switch (status) {
    case "good":
      return "var(--success)";
    case "acceptable":
      return "var(--warning)";
    case "poor":
      return "var(--error)";
  }
}

/**
 * Get the background color for a coverage status (muted version)
 */
export function getCoverageBackgroundColor(status: CoverageStatus): string {
  switch (status) {
    case "good":
      return "rgba(170, 216, 76, 0.15)";
    case "acceptable":
      return "rgba(254, 180, 84, 0.15)";
    case "poor":
      return "rgba(239, 113, 119, 0.15)";
  }
}

/**
 * Props for the CoverageBar component
 */
export interface CoverageBarProps {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** Label text to display */
  label?: string;
  /** Show percentage number */
  showPercentage?: boolean;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Height of the bar in pixels */
  height?: number;
  /** Enable animated transitions */
  animated?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional tooltip content */
  tooltipExtra?: string;
  /** Custom width (CSS value) */
  width?: string;
  /** Compact mode - smaller with inline percentage */
  compact?: boolean;
  /** Additional inline styles */
  style?: JSX.CSSProperties;
  /** Additional class name */
  class?: string;
}

/**
 * Single coverage bar with visual indicator
 */
export function CoverageBar(props: CoverageBarProps) {
  const merged = mergeProps(
    {
      showPercentage: true,
      thresholds: DEFAULT_THRESHOLDS,
      height: 6,
      animated: true,
      showTooltip: true,
      compact: false,
    },
    props
  );

  const [local, rest] = splitProps(merged, [
    "percentage",
    "label",
    "showPercentage",
    "thresholds",
    "height",
    "animated",
    "showTooltip",
    "tooltipExtra",
    "width",
    "compact",
    "style",
    "class",
  ]);

  // Hover state for future interactive features (e.g., detailed tooltips)
  const [_isHovered, setIsHovered] = createSignal(false);
  const [isAnimated, setIsAnimated] = createSignal(false);

  // Clamp percentage to 0-100
  const clampedPercentage = createMemo(() => Math.max(0, Math.min(100, local.percentage)));
  
  const status = createMemo(() => getCoverageStatus(clampedPercentage(), local.thresholds));
  const color = createMemo(() => getCoverageColor(status()));

  // Trigger animation on mount
  onMount(() => {
    if (local.animated) {
      requestAnimationFrame(() => setIsAnimated(true));
    } else {
      setIsAnimated(true);
    }
  });

  const tooltipText = createMemo(() => {
    const parts = [`${clampedPercentage().toFixed(1)}%`];
    if (local.label) parts.unshift(local.label);
    if (local.tooltipExtra) parts.push(local.tooltipExtra);
    return parts.join(" - ");
  });

  const barContainerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "flex-direction": local.compact ? "row" : "column",
    "align-items": local.compact ? "center" : "stretch",
    gap: local.compact ? tokens.spacing.md : tokens.spacing.sm,
    width: local.width || "100%",
    ...local.style,
  });

  const barTrackStyle = (): JSX.CSSProperties => ({
    position: "relative",
    flex: local.compact ? "1" : undefined,
    height: `${local.height}px`,
    "background-color": "var(--surface-raised)",
    "border-radius": `${local.height / 2}px`,
    overflow: "hidden",
  });

  const barFillStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    top: "0",
    left: "0",
    height: "100%",
    width: isAnimated() ? `${clampedPercentage()}%` : "0%",
    "background-color": color(),
    "border-radius": `${local.height / 2}px`,
    transition: local.animated ? "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
  });

  return (
    <div
      {...rest}
      class={local.class}
      style={barContainerStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={local.showTooltip ? tooltipText() : undefined}
    >
      <Show when={local.label && !local.compact}>
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "align-items": "center",
            "font-size": "12px",
          }}
        >
          <span style={{ color: "var(--text-base)" }}>{local.label}</span>
          <Show when={local.showPercentage}>
            <span
              style={{
                color: color(),
                "font-weight": "500",
                "font-variant-numeric": "tabular-nums",
              }}
            >
              {clampedPercentage().toFixed(1)}%
            </span>
          </Show>
        </div>
      </Show>

      <div style={barTrackStyle()}>
        <div style={barFillStyle()} />
      </div>

      <Show when={local.compact && local.showPercentage}>
        <span
          style={{
            "min-width": "48px",
            "text-align": "right",
            color: color(),
            "font-size": "12px",
            "font-weight": "500",
            "font-variant-numeric": "tabular-nums",
          }}
        >
          {clampedPercentage().toFixed(1)}%
        </span>
      </Show>
    </div>
  );
}

/**
 * Props for the CoverageStats component
 */
export interface CoverageStatsProps {
  /** Line coverage percentage */
  lines?: number;
  /** Branch coverage percentage */
  branches?: number;
  /** Function coverage percentage */
  functions?: number;
  /** Statement coverage percentage */
  statements?: number;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Compact horizontal layout */
  compact?: boolean;
  /** Enable animations */
  animated?: boolean;
  /** Additional inline styles */
  style?: JSX.CSSProperties;
}

/**
 * Display multiple coverage metrics as a group of bars
 */
export function CoverageStats(props: CoverageStatsProps) {
  const merged = mergeProps(
    {
      thresholds: DEFAULT_THRESHOLDS,
      compact: false,
      animated: true,
    },
    props
  );

  const metrics = createMemo(() => {
    const result: Array<{ label: string; value: number }> = [];
    if (merged.lines !== undefined) result.push({ label: "Lines", value: merged.lines });
    if (merged.branches !== undefined) result.push({ label: "Branches", value: merged.branches });
    if (merged.functions !== undefined) result.push({ label: "Functions", value: merged.functions });
    if (merged.statements !== undefined) result.push({ label: "Statements", value: merged.statements });
    return result;
  });

  if (merged.compact) {
    return (
      <div
        style={{
          display: "flex",
          gap: "16px",
          "align-items": "center",
          ...merged.style,
        }}
      >
        {metrics().map((metric) => (
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: tokens.spacing.sm,
            }}
          >
            <CoverageBadge
              percentage={metric.value}
              thresholds={merged.thresholds}
              size="sm"
            />
            <span style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
              {metric.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: tokens.spacing.lg,
        ...merged.style,
      }}
    >
      {metrics().map((metric) => (
        <CoverageBar
          percentage={metric.value}
          label={metric.label}
          thresholds={merged.thresholds}
          animated={merged.animated}
        />
      ))}
    </div>
  );
}

/**
 * Props for the CoverageBadge component
 */
export interface CoverageBadgeProps {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Badge size */
  size?: "xs" | "sm" | "md" | "lg";
  /** Show tooltip */
  showTooltip?: boolean;
  /** Additional class */
  class?: string;
  /** Additional styles */
  style?: JSX.CSSProperties;
}

/**
 * Compact badge showing coverage percentage
 */
export function CoverageBadge(props: CoverageBadgeProps) {
  const merged = mergeProps(
    {
      thresholds: DEFAULT_THRESHOLDS,
      size: "md" as const,
      showTooltip: true,
    },
    props
  );

  const clampedPercentage = createMemo(() => Math.max(0, Math.min(100, merged.percentage)));
  const status = createMemo(() => getCoverageStatus(clampedPercentage(), merged.thresholds));
  const color = createMemo(() => getCoverageColor(status()));
  const bgColor = createMemo(() => getCoverageBackgroundColor(status()));

  const sizeStyles: Record<string, { fontSize: string; padding: string; minWidth: string }> = {
    xs: { fontSize: "9px", padding: `1px ${tokens.spacing.sm}`, minWidth: "32px" },
    sm: { fontSize: "10px", padding: `2px 6px`, minWidth: "40px" },
    md: { fontSize: "11px", padding: `3px ${tokens.spacing.md}`, minWidth: "48px" },
    lg: { fontSize: "12px", padding: `${tokens.spacing.sm} 10px`, minWidth: "56px" },
  };

  const currentSize = sizeStyles[merged.size];

  return (
    <span
      class={merged.class}
      title={merged.showTooltip ? `${clampedPercentage().toFixed(1)}% coverage` : undefined}
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        "min-width": currentSize.minWidth,
        padding: currentSize.padding,
        "font-size": currentSize.fontSize,
        "font-weight": "600",
        "font-variant-numeric": "tabular-nums",
        color: color(),
        "background-color": bgColor(),
        "border-radius": tokens.radius.sm,
        ...merged.style,
      }}
    >
      {clampedPercentage().toFixed(0)}%
    </span>
  );
}

/**
 * Props for the CoverageRing component
 */
export interface CoverageRingProps {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** Ring size in pixels */
  size?: number;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Show percentage label in center */
  showLabel?: boolean;
  /** Enable animation */
  animated?: boolean;
  /** Additional styles */
  style?: JSX.CSSProperties;
}

/**
 * Circular ring visualization of coverage percentage
 */
export function CoverageRing(props: CoverageRingProps) {
  const merged = mergeProps(
    {
      size: 64,
      strokeWidth: 6,
      thresholds: DEFAULT_THRESHOLDS,
      showLabel: true,
      animated: true,
    },
    props
  );

  const [isAnimated, setIsAnimated] = createSignal(false);

  onMount(() => {
    if (merged.animated) {
      requestAnimationFrame(() => setIsAnimated(true));
    } else {
      setIsAnimated(true);
    }
  });

  const clampedPercentage = createMemo(() => Math.max(0, Math.min(100, merged.percentage)));
  const status = createMemo(() => getCoverageStatus(clampedPercentage(), merged.thresholds));
  const color = createMemo(() => getCoverageColor(status()));

  const center = createMemo(() => merged.size / 2);
  const radius = createMemo(() => (merged.size - merged.strokeWidth) / 2);
  const circumference = createMemo(() => 2 * Math.PI * radius());
  const offset = createMemo(() => {
    if (!isAnimated()) return circumference();
    return circumference() - (clampedPercentage() / 100) * circumference();
  });

  return (
    <div
      style={{
        position: "relative",
        width: `${merged.size}px`,
        height: `${merged.size}px`,
        ...merged.style,
      }}
      title={`${clampedPercentage().toFixed(1)}% coverage`}
    >
      <svg
        width={merged.size}
        height={merged.size}
        viewBox={`0 0 ${merged.size} ${merged.size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* Background circle */}
        <circle
          cx={center()}
          cy={center()}
          r={radius()}
          fill="none"
          stroke="var(--surface-raised)"
          stroke-width={merged.strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={center()}
          cy={center()}
          r={radius()}
          fill="none"
          stroke={color()}
          stroke-width={merged.strokeWidth}
          stroke-linecap="round"
          stroke-dasharray={String(circumference())}
          stroke-dashoffset={String(offset())}
          style={{
            transition: merged.animated ? "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          }}
        />
      </svg>
      <Show when={merged.showLabel}>
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            "font-size": `${Math.max(10, merged.size / 5)}px`,
            "font-weight": "600",
            "font-variant-numeric": "tabular-nums",
            color: color(),
          }}
        >
          {clampedPercentage().toFixed(0)}%
        </div>
      </Show>
    </div>
  );
}

/**
 * Props for the CoverageChange component
 */
export interface CoverageChangeProps {
  /** Current coverage percentage */
  current: number;
  /** Previous coverage percentage */
  previous: number;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Show absolute values */
  showAbsolute?: boolean;
  /** Additional styles */
  style?: JSX.CSSProperties;
}

/**
 * Display coverage change between two values
 */
export function CoverageChange(props: CoverageChangeProps) {
  const merged = mergeProps(
    {
      thresholds: DEFAULT_THRESHOLDS,
      showAbsolute: false,
    },
    props
  );

  const change = createMemo(() => merged.current - merged.previous);
  const isPositive = createMemo(() => change() > 0);
  const isNeutral = createMemo(() => Math.abs(change()) < 0.01);

  const changeColor = createMemo(() => {
    if (isNeutral()) return "var(--text-weak)";
    return isPositive() ? "var(--success)" : "var(--error)";
  });

  const arrowChar = createMemo(() => {
    if (isNeutral()) return "→";
    return isPositive() ? "↑" : "↓";
  });

  return (
    <div
      style={{
        display: "inline-flex",
        "align-items": "center",
        gap: tokens.spacing.md,
        ...merged.style,
      }}
    >
      <Show when={merged.showAbsolute}>
        <CoverageBadge
          percentage={merged.current}
          thresholds={merged.thresholds}
          size="sm"
        />
      </Show>
      <span
        style={{
          display: "inline-flex",
          "align-items": "center",
          gap: "2px",
          "font-size": "11px",
          "font-weight": "500",
          "font-variant-numeric": "tabular-nums",
          color: changeColor(),
        }}
      >
        <span>{arrowChar()}</span>
        <span>
          {isPositive() ? "+" : ""}
          {change().toFixed(1)}%
        </span>
      </span>
    </div>
  );
}

/**
 * Props for the MiniCoverageBar component
 */
export interface MiniCoverageBarProps {
  /** Coverage percentage (0-100) */
  percentage: number;
  /** Custom thresholds */
  thresholds?: CoverageThresholds;
  /** Width in pixels */
  width?: number;
  /** Height in pixels */
  height?: number;
  /** Additional styles */
  style?: JSX.CSSProperties;
}

/**
 * Minimal inline coverage bar without labels
 */
export function MiniCoverageBar(props: MiniCoverageBarProps) {
  const merged = mergeProps(
    {
      thresholds: DEFAULT_THRESHOLDS,
      width: 60,
      height: 4,
    },
    props
  );

  const clampedPercentage = createMemo(() => Math.max(0, Math.min(100, merged.percentage)));
  const status = createMemo(() => getCoverageStatus(clampedPercentage(), merged.thresholds));
  const color = createMemo(() => getCoverageColor(status()));

  return (
    <div
      title={`${clampedPercentage().toFixed(1)}% coverage`}
      style={{
        display: "inline-block",
        width: `${merged.width}px`,
        height: `${merged.height}px`,
        "background-color": "var(--surface-raised)",
        "border-radius": `${merged.height / 2}px`,
        overflow: "hidden",
        "vertical-align": "middle",
        ...merged.style,
      }}
    >
      <div
        style={{
          width: `${clampedPercentage()}%`,
          height: "100%",
          "background-color": color(),
          "border-radius": `${merged.height / 2}px`,
        }}
      />
    </div>
  );
}


