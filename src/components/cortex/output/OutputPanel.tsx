import { Component, JSX, createSignal, createMemo, Show, onMount, onCleanup } from "solid-js";
import { CortexIcon, CortexTooltip, CortexDropdown } from "../primitives";
import { useOutput, LOG_LEVELS, LOG_LEVEL_LABELS, type LogLevel } from "@/context/OutputContext";
import { OutputChannelSelector } from "./OutputChannelSelector";
import { CortexOutputChannel } from "./OutputChannel";

export interface OutputPanelProps {
  onClose?: () => void;
  class?: string;
  style?: JSX.CSSProperties;
}

export const OutputPanel: Component<OutputPanelProps> = (props) => {
  const output = useOutput();
  const [lockScroll, setLockScroll] = createSignal(false);
  const [wordWrap, setWordWrap] = createSignal(false);
  const [filterText, setFilterText] = createSignal("");

  const channelNames = createMemo(() => output.getChannelNames());
  const activeChannel = createMemo(() => output.state.activeChannel);
  const currentLogLevel = createMemo((): LogLevel => {
    const channel = activeChannel();
    return channel ? output.getChannelLogLevel(channel) : output.getLogLevel();
  });

  const logLevelOptions = createMemo(() =>
    LOG_LEVELS.filter((l) => l !== "off").map((level) => ({
      value: level,
      label: LOG_LEVEL_LABELS[level],
    }))
  );

  onMount(() => {
    const handleAppend = (e: Event) => {
      const detail = (e as CustomEvent<{ channel: string; text: string; source?: string; severity?: "info" | "warning" | "error" | "success" }>).detail;
      if (detail?.channel && detail?.text) {
        output.appendLine(detail.channel, detail.text, {
          source: detail.source,
          severity: detail.severity,
        });
      }
    };

    const handleClear = (e: Event) => {
      const detail = (e as CustomEvent<{ channel?: string }>).detail;
      const channel = detail?.channel ?? activeChannel();
      if (channel) {
        output.clear(channel);
      }
    };

    window.addEventListener("output:append", handleAppend);
    window.addEventListener("output:clear", handleClear);

    onCleanup(() => {
      window.removeEventListener("output:append", handleAppend);
      window.removeEventListener("output:clear", handleClear);
    });
  });

  const handleChannelSelect = (name: string) => {
    output.setActiveChannel(name);
  };

  const handleClear = () => {
    const channel = activeChannel();
    if (channel) {
      output.clear(channel);
    }
  };

  const handleLogLevelChange = (level: string) => {
    const channel = activeChannel();
    if (channel) {
      output.setChannelLogLevel(channel, level as LogLevel);
    } else {
      output.setLogLevel(level as LogLevel);
    }
  };

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-primary)",
        overflow: "hidden",
        ...props.style,
      }}
    >
      <div style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        padding: "4px 12px",
        "border-bottom": "1px solid var(--cortex-border-default)",
        "flex-shrink": "0",
        gap: "8px",
      }}>
        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          flex: "1",
          "min-width": "0",
        }}>
          <OutputChannelSelector
            channels={channelNames()}
            value={activeChannel()}
            onChange={handleChannelSelect}
            style={{ height: "24px", "font-size": "11px", "min-width": "120px" }}
          />
        </div>

        <div style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
          "flex-shrink": "0",
        }}>
          <input
            type="text"
            placeholder="Filter..."
            value={filterText()}
            onInput={(e) => setFilterText(e.currentTarget.value)}
            style={{
              width: "120px",
              padding: "3px 8px",
              "font-size": "11px",
              background: "var(--cortex-bg-tertiary, var(--cortex-bg-secondary))",
              border: "1px solid var(--cortex-border-default)",
              "border-radius": "4px",
              color: "var(--cortex-text-primary)",
              outline: "none",
              height: "24px",
              "font-family": "var(--cortex-font-sans, Inter, sans-serif)",
            }}
          />

          <CortexDropdown
            options={logLevelOptions()}
            value={currentLogLevel()}
            onChange={handleLogLevelChange}
            style={{ height: "24px", "font-size": "11px", "min-width": "80px" }}
          />

          <PanelToolbarButton
            icon={lockScroll() ? "lock" : "lock-open"}
            tooltip={lockScroll() ? "Auto-scroll enabled (click to disable)" : "Auto-scroll disabled (click to enable)"}
            active={!lockScroll()}
            onClick={() => setLockScroll(!lockScroll())}
          />

          <PanelToolbarButton
            icon="align-left"
            tooltip={wordWrap() ? "Disable word wrap" : "Enable word wrap"}
            active={wordWrap()}
            onClick={() => setWordWrap(!wordWrap())}
          />

          <PanelToolbarButton
            icon="trash"
            tooltip="Clear output"
            onClick={handleClear}
          />

          <Show when={props.onClose}>
            <PanelToolbarButton
              icon="xmark"
              tooltip="Close"
              onClick={props.onClose!}
            />
          </Show>
        </div>
      </div>

      <Show
        when={activeChannel()}
        fallback={
          <div style={{
            flex: "1",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: "var(--cortex-text-muted)",
            "font-family": "var(--cortex-font-mono, 'SF Mono', 'Fira Code', monospace)",
            "font-size": "12px",
          }}>
            Select an output channel
          </div>
        }
      >
        <div style={{
          flex: "1",
          overflow: "hidden",
          "font-family": "var(--cortex-font-mono, 'SF Mono', 'Fira Code', monospace)",
          "font-size": "12px",
          "line-height": "1.4",
          "word-wrap": wordWrap() ? "break-word" : "normal",
          "white-space": wordWrap() ? "pre-wrap" : "pre",
        }}>
          <CortexOutputChannel
            channelName={activeChannel()!}
            lockScroll={lockScroll()}
            filterText={filterText()}
          />
        </div>
      </Show>
    </div>
  );
};

interface PanelToolbarButtonProps {
  icon: string;
  tooltip: string;
  active?: boolean;
  onClick: () => void;
}

const PanelToolbarButton: Component<PanelToolbarButtonProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  return (
    <CortexTooltip content={props.tooltip} position="top">
      <button
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          width: "24px",
          height: "24px",
          background: props.active
            ? "rgba(178, 255, 34, 0.15)"
            : isHovered()
              ? "rgba(255, 255, 255, 0.05)"
              : "transparent",
          border: "none",
          "border-radius": "4px",
          color: props.active
            ? "var(--cortex-accent-primary, #B2FF22)"
            : isHovered()
              ? "var(--cortex-text-primary)"
              : "var(--cortex-text-muted)",
          cursor: "pointer",
          transition: "background 100ms ease, color 100ms ease",
        }}
        onClick={props.onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label={props.tooltip}
      >
        <CortexIcon name={props.icon} size={14} />
      </button>
    </CortexTooltip>
  );
};

export default OutputPanel;
