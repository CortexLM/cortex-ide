import { createSignal, createMemo, For, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";
import { useOutput, LOG_LEVELS, LOG_LEVEL_LABELS, type LogLevel } from "@/context/OutputContext";
import { OutputChannel } from "./OutputChannel";

export interface OutputPanelProps {
  onClose?: () => void;
}

export function OutputPanel(props: OutputPanelProps) {
  const output = useOutput();
  const [filterText, setFilterText] = createSignal("");
  const [showLogLevelMenu, setShowLogLevelMenu] = createSignal(false);
  const [lockScroll, setLockScroll] = createSignal(false);

  const channelNames = createMemo(() => output.getChannelNames());
  const activeChannel = createMemo(() => output.state.activeChannel);
  const currentLogLevel = createMemo(() => {
    const channel = activeChannel();
    return channel ? output.getChannelLogLevel(channel) : output.getLogLevel();
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

  const handleLogLevelChange = (level: LogLevel) => {
    const channel = activeChannel();
    if (channel) {
      output.setChannelLogLevel(channel, level);
    } else {
      output.setLogLevel(level);
    }
    setShowLogLevelMenu(false);
  };

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-primary)",
        "border-radius": "var(--cortex-radius-lg)",
        border: "1px solid var(--cortex-border-default)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "8px 12px",
          "border-bottom": "1px solid var(--cortex-border-default)",
          background: "var(--cortex-bg-secondary)",
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <Icon name="terminal" style={{ width: "14px", height: "14px", color: "var(--cortex-text-secondary)" }} />
          <span
            style={{
              "font-size": "12px",
              "font-weight": "500",
              color: "var(--cortex-text-primary)",
            }}
          >
            Output
          </span>

          <select
            value={activeChannel() || ""}
            onChange={(e) => handleChannelSelect(e.currentTarget.value)}
            style={{
              "margin-left": "8px",
              padding: "4px 8px",
              "font-size": "11px",
              background: "var(--cortex-bg-tertiary)",
              border: "1px solid var(--cortex-border-default)",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-primary)",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <Show when={!activeChannel()}>
              <option value="">Select channel...</option>
            </Show>
            <For each={channelNames()}>
              {(name) => <option value={name}>{name}</option>}
            </For>
          </select>
        </div>

        <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
          <input
            type="text"
            placeholder="Filter..."
            value={filterText()}
            onInput={(e) => setFilterText(e.currentTarget.value)}
            style={{
              width: "120px",
              padding: "4px 8px",
              "font-size": "11px",
              background: "var(--cortex-bg-tertiary)",
              border: "1px solid var(--cortex-border-default)",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-primary)",
              outline: "none",
            }}
          />

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowLogLevelMenu(!showLogLevelMenu())}
              title={`Log Level: ${LOG_LEVEL_LABELS[currentLogLevel()]}`}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "4px",
                padding: "4px 8px",
                background: "var(--cortex-bg-tertiary)",
                border: "1px solid var(--cortex-border-default)",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--cortex-text-secondary)",
                cursor: "pointer",
                "font-size": "11px",
              }}
            >
              <Icon name="filter" style={{ width: "12px", height: "12px" }} />
              {LOG_LEVEL_LABELS[currentLogLevel()]}
            </button>

            <Show when={showLogLevelMenu()}>
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: "0",
                  "margin-top": "4px",
                  background: "var(--cortex-bg-secondary)",
                  border: "1px solid var(--cortex-border-default)",
                  "border-radius": "var(--cortex-radius-md)",
                  "box-shadow": "0 4px 12px rgba(0, 0, 0, 0.3)",
                  "z-index": "100",
                  "min-width": "100px",
                  overflow: "hidden",
                }}
              >
                <For each={LOG_LEVELS.filter((l) => l !== "off")}>
                  {(level) => (
                    <button
                      onClick={() => handleLogLevelChange(level)}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "6px 12px",
                        "text-align": "left",
                        background: level === currentLogLevel() ? "var(--cortex-accent-primary)" : "transparent",
                        border: "none",
                        color: level === currentLogLevel() ? "white" : "var(--cortex-text-primary)",
                        cursor: "pointer",
                        "font-size": "11px",
                      }}
                    >
                      {LOG_LEVEL_LABELS[level]}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <button
            onClick={() => setLockScroll(!lockScroll())}
            title={lockScroll() ? "Unlock scroll" : "Lock scroll"}
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "28px",
              height: "28px",
              background: lockScroll() ? "var(--cortex-accent-primary)" : "transparent",
              border: "none",
              "border-radius": "var(--cortex-radius-sm)",
              color: lockScroll() ? "white" : "var(--cortex-text-secondary)",
              cursor: "pointer",
            }}
          >
            <Icon name={lockScroll() ? "lock" : "lock-open"} style={{ width: "14px", height: "14px" }} />
          </button>

          <button
            onClick={handleClear}
            title="Clear output"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "28px",
              height: "28px",
              background: "transparent",
              border: "none",
              "border-radius": "var(--cortex-radius-sm)",
              color: "var(--cortex-text-secondary)",
              cursor: "pointer",
            }}
          >
            <Icon name="trash" style={{ width: "14px", height: "14px" }} />
          </button>

          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              title="Close"
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                width: "28px",
                height: "28px",
                background: "transparent",
                border: "none",
                "border-radius": "var(--cortex-radius-sm)",
                color: "var(--cortex-text-secondary)",
                cursor: "pointer",
              }}
            >
              <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={activeChannel()}
        fallback={
          <div
            style={{
              flex: "1",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: "var(--cortex-text-inactive)",
              "font-size": "13px",
            }}
          >
            Select an output channel
          </div>
        }
      >
        <OutputChannel
          channelName={activeChannel()!}
          lockScroll={lockScroll()}
          filterText={filterText()}
        />
      </Show>
    </div>
  );
}

export default OutputPanel;
