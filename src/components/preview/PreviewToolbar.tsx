/**
 * PreviewToolbar - Navigation and controls toolbar for browser preview
 * 
 * Features:
 * - URL input with navigation
 * - Back/Forward/Refresh buttons
 * - Device selector dropdown
 * - Zoom controls
 * - Live reload toggle
 * - Additional options menu
 */

import {
  createSignal,
  createMemo,
  Show,
  For,
} from "solid-js";
import { usePreview, DEVICE_PRESETS } from "@/context/PreviewContext";
import { Icon } from "../ui/Icon";
import { CortexDropdown, type CortexDropdownOption } from "../cortex/primitives/CortexDropdown";
import { CortexTooltip } from "../cortex/primitives/CortexTooltip";

export interface PreviewToolbarProps {
  class?: string;
}

export function PreviewToolbar(props: PreviewToolbarProps) {
  const preview = usePreview();
  
  const [urlInput, setUrlInput] = createSignal(preview.state.url);
  const [showZoomMenu, setShowZoomMenu] = createSignal(false);
  const [showMoreMenu, setShowMoreMenu] = createSignal(false);

  const deviceOptions = createMemo<CortexDropdownOption[]>(() =>
    DEVICE_PRESETS.map((device) => ({
      value: device.id,
      label: device.name,
      description: `${device.width} × ${device.height}`,
      icon: device.type === "mobile" ? "smartphone" : device.type === "tablet" ? "tablet" : "monitor",
    }))
  );

  const zoomLevels = [25, 50, 75, 100, 125, 150, 175, 200];

  const handleUrlSubmit = (e: Event) => {
    e.preventDefault();
    const url = urlInput().trim();
    if (url) {
      preview.navigate(url);
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    const device = DEVICE_PRESETS.find((d) => d.id === deviceId);
    if (device) {
      preview.setDevice(device);
    }
  };

  const handleZoomChange = (zoom: number) => {
    preview.setZoom(zoom);
    setShowZoomMenu(false);
  };

  const iconButtonStyle = (active?: boolean) => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "28px",
    padding: "0",
    background: active ? "var(--cortex-interactive-selected)" : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    color: active ? "var(--cortex-accent-primary)" : "var(--cortex-text-muted)",
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast, 100ms ease), color var(--cortex-transition-fast, 100ms ease)",
  });

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "8px 12px",
        background: "var(--cortex-bg-secondary)",
        "border-bottom": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
        "flex-shrink": "0",
      }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
        <CortexTooltip content="Go back">
          <button
            style={iconButtonStyle()}
            disabled={!preview.canGoBack()}
            onClick={() => preview.goBack()}
            onMouseEnter={(e) => {
              if (preview.canGoBack()) {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }}
          >
            <Icon name="arrow-left" size={16} />
          </button>
        </CortexTooltip>

        <CortexTooltip content="Go forward">
          <button
            style={iconButtonStyle()}
            disabled={!preview.canGoForward()}
            onClick={() => preview.goForward()}
            onMouseEnter={(e) => {
              if (preview.canGoForward()) {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }}
          >
            <Icon name="arrow-right" size={16} />
          </button>
        </CortexTooltip>

        <CortexTooltip content={preview.isLoading() ? "Stop" : "Refresh"}>
          <button
            style={iconButtonStyle()}
            onClick={() => preview.refresh()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              e.currentTarget.style.color = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }}
          >
            <Icon name={preview.isLoading() ? "x" : "refresh-cw"} size={16} />
          </button>
        </CortexTooltip>
      </div>

      <form
        onSubmit={handleUrlSubmit}
        style={{
          flex: "1",
          display: "flex",
          "align-items": "center",
        }}
      >
        <div
          style={{
            flex: "1",
            display: "flex",
            "align-items": "center",
            gap: "8px",
            height: "32px",
            padding: "0 12px",
            background: "var(--cortex-input-bg, var(--cortex-bg-tertiary))",
            border: "1px solid var(--cortex-input-border, rgba(255,255,255,0.1))",
            "border-radius": "var(--cortex-radius-md, 8px)",
          }}
        >
          <Icon
            name={preview.state.url.startsWith("https") ? "lock" : "globe"}
            size={14}
            style={{ color: "var(--cortex-text-muted)", "flex-shrink": "0" }}
          />
          <input
            type="text"
            value={urlInput()}
            onInput={(e) => setUrlInput(e.currentTarget.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Enter URL or localhost:port"
            style={{
              flex: "1",
              background: "transparent",
              border: "none",
              color: "var(--cortex-text-primary)",
              "font-size": "13px",
              outline: "none",
            }}
          />
          <Show when={urlInput()}>
            <button
              type="button"
              onClick={() => {
                setUrlInput("");
              }}
              style={{
                display: "flex",
                "align-items": "center",
                padding: "0",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-muted)",
                cursor: "pointer",
              }}
            >
              <Icon name="x" size={14} />
            </button>
          </Show>
        </div>
      </form>

      <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
        <CortexDropdown
          options={deviceOptions()}
          value={preview.state.device.id}
          onChange={handleDeviceChange}
          style={{ width: "140px" }}
        />

        <CortexTooltip content="Rotate device">
          <button
            style={iconButtonStyle()}
            onClick={() => preview.rotateDevice()}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              e.currentTarget.style.color = "var(--cortex-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }}
          >
            <Icon name="rotate-cw" size={16} />
          </button>
        </CortexTooltip>
      </div>

      <div style={{ position: "relative" }}>
        <CortexTooltip content="Zoom">
          <button
            style={{
              ...iconButtonStyle(showZoomMenu()),
              width: "auto",
              padding: "0 8px",
              gap: "4px",
            }}
            onClick={() => setShowZoomMenu((prev) => !prev)}
            onMouseEnter={(e) => {
              if (!showZoomMenu()) {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showZoomMenu()) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <span style={{ "font-size": "12px" }}>{preview.state.zoom}%</span>
            <Icon name="chevron-down" size={12} />
          </button>
        </CortexTooltip>

        <Show when={showZoomMenu()}>
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: "0",
              "margin-top": "4px",
              background: "var(--cortex-dropdown-bg, var(--cortex-bg-elevated))",
              border: "1px solid var(--cortex-dropdown-border, rgba(255,255,255,0.1))",
              "border-radius": "var(--cortex-radius-md, 8px)",
              "box-shadow": "var(--cortex-shadow-lg, 0 8px 24px rgba(0,0,0,0.4))",
              "z-index": "100",
              overflow: "hidden",
            }}
          >
            <For each={zoomLevels}>
              {(zoom) => (
                <button
                  onClick={() => handleZoomChange(zoom)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "8px 16px",
                    background: zoom === preview.state.zoom
                      ? "var(--cortex-interactive-selected)"
                      : "transparent",
                    border: "none",
                    color: zoom === preview.state.zoom
                      ? "var(--cortex-accent-primary)"
                      : "var(--cortex-text-primary)",
                    "font-size": "13px",
                    "text-align": "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (zoom !== preview.state.zoom) {
                      e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (zoom !== preview.state.zoom) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {zoom}%
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div
        style={{
          width: "1px",
          height: "20px",
          background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
        }}
      />

      <CortexTooltip content={preview.state.isLiveReload ? "Disable live reload" : "Enable live reload"}>
        <button
          style={iconButtonStyle(preview.state.isLiveReload)}
          onClick={() => {
            if (preview.state.isLiveReload) {
              preview.disableLiveReload();
            } else {
              preview.enableLiveReload();
            }
          }}
          onMouseEnter={(e) => {
            if (!preview.state.isLiveReload) {
              e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              e.currentTarget.style.color = "var(--cortex-text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!preview.state.isLiveReload) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }
          }}
        >
          <Icon name="zap" size={16} />
        </button>
      </CortexTooltip>

      <CortexTooltip content={preview.state.showRulers ? "Hide rulers" : "Show rulers"}>
        <button
          style={iconButtonStyle(preview.state.showRulers)}
          onClick={() => preview.toggleRulers()}
          onMouseEnter={(e) => {
            if (!preview.state.showRulers) {
              e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              e.currentTarget.style.color = "var(--cortex-text-primary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!preview.state.showRulers) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--cortex-text-muted)";
            }
          }}
        >
          <Icon name="ruler" size={16} />
        </button>
      </CortexTooltip>

      <div style={{ position: "relative" }}>
        <CortexTooltip content="More options">
          <button
            style={iconButtonStyle(showMoreMenu())}
            onClick={() => setShowMoreMenu((prev) => !prev)}
            onMouseEnter={(e) => {
              if (!showMoreMenu()) {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showMoreMenu()) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--cortex-text-muted)";
              }
            }}
          >
            <Icon name="more-vertical" size={16} />
          </button>
        </CortexTooltip>

        <Show when={showMoreMenu()}>
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: "0",
              "margin-top": "4px",
              "min-width": "180px",
              background: "var(--cortex-dropdown-bg, var(--cortex-bg-elevated))",
              border: "1px solid var(--cortex-dropdown-border, rgba(255,255,255,0.1))",
              "border-radius": "var(--cortex-radius-md, 8px)",
              "box-shadow": "var(--cortex-shadow-lg, 0 8px 24px rgba(0,0,0,0.4))",
              "z-index": "100",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => {
                preview.toggleOutline();
                setShowMoreMenu(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-primary)",
                "font-size": "13px",
                "text-align": "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon name={preview.state.showOutline ? "check-square" : "square"} size={14} />
              <span>Show outline</span>
            </button>

            <button
              onClick={async () => {
                const dataUrl = await preview.takeScreenshot();
                if (dataUrl) {
                  const link = document.createElement("a");
                  link.href = dataUrl;
                  link.download = `preview-${Date.now()}.png`;
                  link.click();
                }
                setShowMoreMenu(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-primary)",
                "font-size": "13px",
                "text-align": "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon name="camera" size={14} />
              <span>Take screenshot</span>
            </button>

            <button
              onClick={() => {
                preview.hardRefresh();
                setShowMoreMenu(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-primary)",
                "font-size": "13px",
                "text-align": "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Icon name="refresh-cw" size={14} />
              <span>Hard refresh</span>
            </button>

            <div
              style={{
                height: "1px",
                margin: "4px 0",
                background: "var(--cortex-border-default, rgba(255,255,255,0.1))",
              }}
            />

            <button
              onClick={() => {
                preview.clearHistory();
                setShowMoreMenu(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-muted)",
                "font-size": "13px",
                "text-align": "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--cortex-text-muted)";
              }}
            >
              <Icon name="trash-2" size={14} />
              <span>Clear history</span>
            </button>

            <button
              onClick={() => {
                preview.close();
                setShowMoreMenu(false);
              }}
              style={{
                display: "flex",
                "align-items": "center",
                gap: "8px",
                width: "100%",
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                color: "var(--cortex-text-muted)",
                "font-size": "13px",
                "text-align": "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--cortex-interactive-hover)";
                e.currentTarget.style.color = "var(--cortex-text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--cortex-text-muted)";
              }}
            >
              <Icon name="x" size={14} />
              <span>Close preview</span>
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default PreviewToolbar;
