import { Show, createSignal } from "solid-js";
import { Breakpoint, DataBreakpoint, DataBreakpointAccessType } from "@/context/DebugContext";
import { Icon } from "../ui/Icon";

export interface BreakpointInlineEditorProps {
  breakpoint: Breakpoint;
  field: "condition" | "hitCondition" | "logMessage";
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function BreakpointInlineEditor(props: BreakpointInlineEditorProps) {
  const initialValue = () => {
    switch (props.field) {
      case "condition": return props.breakpoint.condition || "";
      case "hitCondition": return props.breakpoint.hitCondition || "";
      case "logMessage": return props.breakpoint.logMessage || "";
    }
  };

  const [value, setValue] = createSignal(initialValue());

  const placeholder = () => {
    switch (props.field) {
      case "condition": return "Expression (e.g. x > 5)";
      case "hitCondition": return "Hit count (e.g. >= 10)";
      case "logMessage": return "Log message (use {expr} for interpolation)";
    }
  };

  const label = () => {
    switch (props.field) {
      case "condition": return "Condition";
      case "hitCondition": return "Hit Count";
      case "logMessage": return "Log Message";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      props.onSave(value());
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onCancel();
    }
  };

  return (
    <div
      class="flex items-center gap-1 px-2 py-1"
      style={{ background: "var(--surface-sunken)" }}
    >
      <span
        class="shrink-0 text-[10px] font-medium uppercase px-1 rounded"
        style={{
          color: "var(--cortex-info)",
          background: "rgba(59, 130, 246, 0.1)",
        }}
      >
        {label()}
      </span>
      <input
        type="text"
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => props.onSave(value())}
        placeholder={placeholder()}
        class="flex-1 px-2 py-0.5 text-xs font-mono rounded outline-none"
        style={{
          background: "var(--surface-base)",
          color: "var(--text-base)",
          border: "1px solid var(--accent)",
          height: "20px",
          "line-height": "20px",
        }}
        autofocus
      />
      <button
        onClick={() => props.onSave(value())}
        class="p-0.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
        style={{ color: "var(--cortex-success)" }}
        title="Save"
      >
        <Icon name="check" size="xs" />
      </button>
      <button
        onClick={props.onCancel}
        class="p-0.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
        style={{ color: "var(--text-weak)" }}
        title="Cancel"
      >
        <Icon name="xmark" size="xs" />
      </button>
    </div>
  );
}

export interface LogpointIndicatorProps {
  isLogpoint: boolean;
  enabled: boolean;
  verified: boolean;
}

export function LogpointIndicator(props: LogpointIndicatorProps) {
  const color = () => {
    if (!props.enabled) return "var(--debug-icon-breakpoint-disabled-foreground)";
    if (!props.verified) return "var(--debug-icon-breakpoint-unverified-foreground)";
    return props.isLogpoint ? "var(--cortex-info)" : "var(--debug-icon-breakpoint-foreground)";
  };

  return (
    <div
      class="flex items-center justify-center"
      style={{ width: "19px", height: "19px", "min-width": "19px", color: color() }}
    >
      <Show
        when={props.isLogpoint}
        fallback={
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="6" />
          </svg>
        }
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L15 8L8 15L1 8L8 1Z" />
        </svg>
      </Show>
    </div>
  );
}

export interface HitCountBadgeProps {
  hitCount?: number;
  hitCondition?: string;
}

export function HitCountBadge(props: HitCountBadgeProps) {
  const hasHitInfo = () =>
    (props.hitCount !== undefined && props.hitCount > 0) || !!props.hitCondition;

  return (
    <Show when={hasHitInfo()}>
      <span
        class="inline-flex items-center gap-0.5 px-1.5 py-0 text-[10px] font-mono rounded-full"
        style={{
          background: "rgba(249, 115, 22, 0.15)",
          color: "var(--cortex-warning)",
          "line-height": "16px",
        }}
        title={
          props.hitCondition
            ? `Hit condition: ${props.hitCondition}`
            : `Hit count: ${props.hitCount}`
        }
      >
        <Icon name="bolt" size="xs" />
        <Show when={props.hitCount !== undefined && props.hitCount > 0}>
          <span>{props.hitCount}</span>
        </Show>
        <Show when={props.hitCondition && (props.hitCount === undefined || props.hitCount === 0)}>
          <span>{props.hitCondition}</span>
        </Show>
      </span>
    </Show>
  );
}

const ACCESS_TYPE_LABELS: Record<DataBreakpointAccessType, { label: string; color: string }> = {
  read: { label: "read", color: "var(--cortex-info)" },
  write: { label: "write", color: "var(--cortex-warning)" },
  readWrite: { label: "read/write", color: "var(--cortex-success)" },
};

export interface DataBreakpointEntryProps {
  breakpoint: DataBreakpoint;
  onToggle: (bp: DataBreakpoint) => void;
  onRemove: (id: string) => void;
}

export function DataBreakpointEntry(props: DataBreakpointEntryProps) {
  const accessInfo = () => ACCESS_TYPE_LABELS[props.breakpoint.accessType];

  return (
    <div class="group" style={{ height: "22px" }}>
      <div class="flex items-center gap-1 px-2 text-xs transition-colors hover:bg-[var(--surface-raised)] h-full">
        <input
          type="checkbox"
          checked={props.breakpoint.enabled}
          onChange={() => props.onToggle(props.breakpoint)}
          class="w-3.5 h-3.5 shrink-0 cursor-pointer accent-[var(--accent)]"
        />
        <div
          class="flex items-center justify-center shrink-0"
          style={{ width: "19px", height: "19px", "min-width": "19px" }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{
              color: props.breakpoint.enabled
                ? "var(--cortex-info)"
                : "var(--debug-icon-breakpoint-disabled-foreground)",
            }}
          >
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2" fill="white" />
          </svg>
        </div>
        <span
          class="truncate"
          style={{
            color: props.breakpoint.enabled ? "var(--text-base)" : "var(--text-weak)",
          }}
        >
          {props.breakpoint.variableName}
        </span>
        <span
          class="shrink-0 text-[10px] px-1.5 rounded-full font-medium"
          style={{
            background: `${accessInfo().color}15`,
            color: accessInfo().color,
          }}
        >
          {accessInfo().label}
        </span>
        <Show when={props.breakpoint.hitCount > 0}>
          <HitCountBadge hitCount={props.breakpoint.hitCount} />
        </Show>
        <Show when={props.breakpoint.description}>
          <span class="truncate opacity-60" style={{ color: "var(--text-weak)" }}>
            {props.breakpoint.description}
          </span>
        </Show>
        <div class="flex-1" />
        <button
          onClick={() => props.onRemove(props.breakpoint.id)}
          class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity hover:bg-[var(--surface-sunken)]"
          style={{ color: "var(--text-weak)" }}
          title="Remove data breakpoint"
        >
          <Icon name="xmark" size="xs" />
        </button>
      </div>
    </div>
  );
}
