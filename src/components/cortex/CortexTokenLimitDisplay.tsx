import {
  Component,
  Show,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  JSX,
} from "solid-js";
import { CortexIcon } from "./primitives/CortexIcon";
import { useSDK } from "@/context/SDKContext";

export interface CortexTokenLimitDisplayProps {
  modelName?: string;
  contextWindow?: number;
  inputCostPer1K?: number;
  outputCostPer1K?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "claude-opus-4": 200000,
  "claude-opus-4.5": 200000,
  "claude-sonnet-4": 200000,
  "claude-3.5-sonnet": 200000,
  "claude-3-opus": 200000,
  "gpt-4o": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "o1": 200000,
  "o3": 200000,
  "gemini-pro": 1000000,
  "gemini-2.0-flash": 1000000,
  "deepseek-chat": 64000,
  "mistral-large": 128000,
};

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4": { input: 0.015, output: 0.075 },
  "claude-opus-4.5": { input: 0.015, output: 0.075 },
  "claude-sonnet-4": { input: 0.003, output: 0.015 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "o1": { input: 0.015, output: 0.06 },
  "deepseek-chat": { input: 0.001, output: 0.002 },
};

const TOKEN_COLORS = {
  normal: "var(--cortex-success)",
  warning: "var(--cortex-warning)",
  critical: "var(--cortex-error)",
} as const;

const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

export const CortexTokenLimitDisplay: Component<CortexTokenLimitDisplayProps> = (props) => {
  let sdk: ReturnType<typeof useSDK> | null = null;
  try { sdk = useSDK(); } catch { /* not available */ }

  const [open, setOpen] = createSignal(false);
  let dropdownRef: HTMLDivElement | undefined;

  const tokenData = createMemo(() => {
    if (!sdk) return { input: 0, output: 0 };
    let input = 0;
    let output = 0;
    for (const msg of sdk.state.messages) {
      if (msg.metadata) {
        input += msg.metadata.inputTokens ?? 0;
        output += msg.metadata.outputTokens ?? 0;
      }
    }
    return { input, output };
  });

  const totalTokens = createMemo(() => tokenData().input + tokenData().output);
  const contextWindow = createMemo(() => {
    if (props.contextWindow) return props.contextWindow;
    const model = props.modelName || "";
    for (const [key, val] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (model.toLowerCase().includes(key.toLowerCase())) return val;
    }
    return 200000;
  });

  const percentage = createMemo(() => {
    const cw = contextWindow();
    return cw > 0 ? Math.min((totalTokens() / cw) * 100, 100) : 0;
  });

  const fillColor = createMemo(() => {
    const pct = percentage();
    if (pct >= 95) return TOKEN_COLORS.critical;
    if (pct >= 80) return TOKEN_COLORS.warning;
    return TOKEN_COLORS.normal;
  });

  const pricing = createMemo(() => {
    if (props.inputCostPer1K !== undefined && props.outputCostPer1K !== undefined) {
      return { input: props.inputCostPer1K, output: props.outputCostPer1K };
    }
    const model = props.modelName || "";
    for (const [key, val] of Object.entries(MODEL_PRICING)) {
      if (model.toLowerCase().includes(key.toLowerCase())) return val;
    }
    return { input: 0.005, output: 0.025 };
  });

  const handleClickOutside = (e: MouseEvent) => {
    if (dropdownRef && !dropdownRef.contains(e.target as Node)) setOpen(false);
  };

  createEffect(() => {
    if (open()) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
  });

  onCleanup(() => document.removeEventListener("mousedown", handleClickOutside));

  const triggerStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    gap: "6px",
    padding: "4px 8px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    "font-family": "var(--cortex-font-sans)",
    "font-size": "12px",
    color: "var(--cortex-text-secondary)",
    "border-radius": "var(--cortex-radius-sm)",
  };

  return (
    <div ref={dropdownRef} class={props.class} style={{ position: "relative", display: "inline-flex", ...props.style }}>
      <button style={triggerStyle} onClick={() => setOpen(!open())}>
        <CortexIcon name="gauge" size={14} color={fillColor()} />
        <span style={{ color: fillColor() }}>Token Limit</span>
        <span style={{ color: "var(--cortex-text-inactive)" }}>{percentage().toFixed(0)}%</span>
      </button>

      <Show when={open()}>
        <div style={{ position: "absolute", top: "100%", right: "0", "margin-top": "4px", width: "260px", background: "var(--cortex-bg-elevated)", border: "1px solid var(--cortex-border-hover)", "border-radius": "8px", "z-index": "600", "font-family": "var(--cortex-font-sans)", overflow: "hidden" }}>
          {/* Progress bar */}
          <div style={{ padding: "12px 12px 8px" }}>
            <div style={{ width: "100%", height: "6px", background: "var(--cortex-progress-bg)", "border-radius": "3px", overflow: "hidden" }}>
              <div style={{ width: `${percentage()}%`, height: "100%", background: fillColor(), "border-radius": "3px", transition: "width 300ms ease" }} />
            </div>
            <div style={{ display: "flex", "justify-content": "space-between", "margin-top": "4px", "font-size": "11px", color: "var(--cortex-text-inactive)" }}>
              <span>{formatTokens(totalTokens())} / {formatTokens(contextWindow())}</span>
              <span style={{ color: fillColor() }}>{percentage().toFixed(0)}%</span>
            </div>
          </div>

          {/* Token Usage Section */}
          <div style={{ padding: "4px 12px" }}>
            <div style={{ "font-size": "12px", color: "var(--cortex-text-secondary)", padding: "6px 0", "border-bottom": "1px solid var(--cortex-border-hover)", "font-weight": "500" }}>Token Usage</div>
            <div style={{ display: "flex", "justify-content": "space-between", padding: "6px 0", "font-size": "12px" }}>
              <span style={{ color: "var(--cortex-text-secondary)" }}>Input Tokens:</span>
              <span style={{ color: "var(--cortex-text-on-surface)", "font-weight": "500" }}>{tokenData().input.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", "justify-content": "space-between", padding: "6px 0", "font-size": "12px" }}>
              <span style={{ color: "var(--cortex-text-secondary)" }}>Output Tokens:</span>
              <span style={{ color: "var(--cortex-text-on-surface)", "font-weight": "500" }}>{tokenData().output.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", "justify-content": "space-between", padding: "6px 0", "font-size": "12px" }}>
              <span style={{ color: "var(--cortex-text-secondary)" }}>Total Tokens:</span>
              <span style={{ color: "var(--cortex-text-on-surface)", "font-weight": "500" }}>{totalTokens().toLocaleString()}</span>
            </div>
          </div>

          {/* Cost Section */}
          <div style={{ padding: "4px 12px 12px" }}>
            <div style={{ "font-size": "12px", color: "var(--cortex-text-secondary)", padding: "6px 0", "border-bottom": "1px solid var(--cortex-border-hover)", "font-weight": "500" }}>Cost</div>
            <div style={{ display: "flex", "justify-content": "space-between", padding: "6px 0", "font-size": "12px" }}>
              <span style={{ color: "var(--cortex-text-secondary)" }}>Input cost / 1K tokens</span>
              <span style={{ color: "var(--cortex-text-on-surface)", "font-weight": "500" }}>$ {pricing().input.toFixed(3)}</span>
            </div>
            <div style={{ display: "flex", "justify-content": "space-between", padding: "6px 0", "font-size": "12px" }}>
              <span style={{ color: "var(--cortex-text-secondary)" }}>Output cost / 1K tokens</span>
              <span style={{ color: "var(--cortex-text-on-surface)", "font-weight": "500" }}>$ {pricing().output.toFixed(3)}</span>
            </div>
          </div>

          {/* Warning */}
          <Show when={percentage() >= 80}>
            <div style={{ padding: "8px 12px", background: percentage() >= 95 ? "var(--cortex-error-bg)" : "var(--cortex-warning-bg)", display: "flex", "align-items": "center", gap: "6px", "font-size": "11px", color: percentage() >= 95 ? TOKEN_COLORS.critical : TOKEN_COLORS.warning }}>
              <CortexIcon name="warning" size={12} color={percentage() >= 95 ? TOKEN_COLORS.critical : TOKEN_COLORS.warning} />
              {percentage() >= 95 ? "Token limit nearly reached." : "Approaching token limit."}
            </div>
          </Show>

          {/* Model info */}
          <Show when={props.modelName}>
            <div style={{ padding: "8px 12px", "border-top": "1px solid var(--cortex-border-hover)", "font-size": "11px", color: "var(--cortex-text-inactive)" }}>
              Model: {props.modelName} · {formatTokens(contextWindow())} context
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default CortexTokenLimitDisplay;
