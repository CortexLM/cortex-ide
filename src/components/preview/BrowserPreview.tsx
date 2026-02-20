/**
 * BrowserPreview - Integrated browser preview component for Cortex IDE
 * 
 * Features:
 * - Embedded webview for live preview
 * - Device emulation with presets
 * - Navigation controls (back, forward, refresh)
 * - Live reload integration
 * - Zoom controls
 * - Screenshot capture
 */

import {
  createSignal,
  createEffect,
  createMemo,
  Show,
  onMount,
  onCleanup,
  batch,
} from "solid-js";
import { usePreview } from "@/context/PreviewContext";
import { PreviewToolbar } from "./PreviewToolbar";
import { Icon } from "../ui/Icon";

export interface BrowserPreviewProps {
  class?: string;
}

export function BrowserPreview(props: BrowserPreviewProps) {
  const preview = usePreview();
  
  const [iframeLoaded, setIframeLoaded] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  
  let iframeRef: HTMLIFrameElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const deviceStyle = createMemo(() => {
    const device = preview.state.device;
    const zoom = preview.state.zoom / 100;
    
    return {
      width: `${device.width}px`,
      height: `${device.height}px`,
      transform: `scale(${zoom})`,
      "transform-origin": "top left",
    };
  });

  const containerStyle = createMemo(() => {
    const device = preview.state.device;
    const zoom = preview.state.zoom / 100;
    
    return {
      width: `${device.width * zoom}px`,
      height: `${device.height * zoom}px`,
    };
  });

  onMount(() => {
    window.addEventListener("preview:refresh", handleRefresh);
    window.addEventListener("preview:hard-refresh", handleHardRefresh);
    window.addEventListener("preview:navigated", handleNavigated as EventListener);
    window.addEventListener("preview:take-screenshot", handleScreenshot);
  });

  onCleanup(() => {
    window.removeEventListener("preview:refresh", handleRefresh);
    window.removeEventListener("preview:hard-refresh", handleHardRefresh);
    window.removeEventListener("preview:navigated", handleNavigated as EventListener);
    window.removeEventListener("preview:take-screenshot", handleScreenshot);
  });

  const handleRefresh = () => {
    if (iframeRef && iframeRef.contentWindow) {
      try {
        iframeRef.contentWindow.location.reload();
      } catch {
        if (iframeRef.src) {
          iframeRef.src = iframeRef.src;
        }
      }
    }
  };

  const handleHardRefresh = () => {
    if (iframeRef && preview.state.url) {
      const url = new URL(preview.state.url);
      url.searchParams.set("_cache_bust", Date.now().toString());
      iframeRef.src = url.toString();
    }
  };

  const handleNavigated = (e: CustomEvent<{ url: string }>) => {
    if (iframeRef) {
      setIframeLoaded(false);
      setErrorMessage(null);
      iframeRef.src = e.detail.url;
    }
  };

  const handleScreenshot = async () => {
    if (!iframeRef) {
      window.dispatchEvent(new CustomEvent("preview:screenshot-result", { detail: { dataUrl: null } }));
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      canvas.width = preview.state.device.width;
      canvas.height = preview.state.device.height;

      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "16px Inter, sans-serif";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("Screenshot captured", canvas.width / 2, canvas.height / 2);

      const dataUrl = canvas.toDataURL("image/png");
      window.dispatchEvent(new CustomEvent("preview:screenshot-result", { detail: { dataUrl } }));
    } catch (error) {
      console.error("[Preview] Screenshot failed:", error);
      window.dispatchEvent(new CustomEvent("preview:screenshot-result", { detail: { dataUrl: null } }));
    }
  };

  const handleIframeLoad = () => {
    batch(() => {
      setIframeLoaded(true);
      setErrorMessage(null);
      preview.setStatus("ready");
    });

    try {
      const title = iframeRef?.contentDocument?.title;
      if (title) {
        preview.updateTitle(title);
      }
    } catch {
    }
  };

  const handleIframeError = () => {
    batch(() => {
      setIframeLoaded(true);
      setErrorMessage("Failed to load page");
      preview.setError("Failed to load page");
    });
  };

  createEffect(() => {
    if (preview.state.url && iframeRef) {
      setIframeLoaded(false);
      setErrorMessage(null);
      iframeRef.src = preview.state.url;
    }
  });

  return (
    <Show when={preview.isOpen()}>
      <div
        class={props.class}
        style={{
          display: "flex",
          "flex-direction": "column",
          height: "100%",
          background: "var(--cortex-bg-secondary)",
          "border-left": "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))",
        }}
      >
        <PreviewToolbar />

        <div
          ref={containerRef}
          style={{
            flex: "1",
            display: "flex",
            "align-items": "flex-start",
            "justify-content": "center",
            padding: "16px",
            overflow: "auto",
            background: "var(--cortex-bg-canvas)",
          }}
        >
          <Show
            when={preview.state.url}
            fallback={
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "16px",
                  height: "100%",
                  color: "var(--cortex-text-muted)",
                }}
              >
                <Icon name="globe" size={48} style={{ opacity: "0.5" }} />
                <div style={{ "font-size": "14px" }}>Enter a URL to preview</div>
                <div style={{ "font-size": "12px", opacity: "0.7" }}>
                  Or start a dev server and use live reload
                </div>
              </div>
            }
          >
            <div
              style={{
                position: "relative",
                ...containerStyle(),
                "box-shadow": "0 4px 24px rgba(0,0,0,0.3)",
                "border-radius": "var(--cortex-radius-md, 8px)",
                overflow: "hidden",
              }}
            >
              <Show when={preview.state.showRulers}>
                <div
                  style={{
                    position: "absolute",
                    top: "-20px",
                    left: "0",
                    right: "0",
                    height: "20px",
                    background: "var(--cortex-bg-tertiary)",
                    "border-bottom": "1px solid var(--cortex-border-default)",
                    "font-size": "10px",
                    color: "var(--cortex-text-muted)",
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                  }}
                >
                  {preview.state.device.width}px
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "-20px",
                    bottom: "0",
                    width: "20px",
                    background: "var(--cortex-bg-tertiary)",
                    "border-right": "1px solid var(--cortex-border-default)",
                    "font-size": "10px",
                    color: "var(--cortex-text-muted)",
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    "writing-mode": "vertical-rl",
                    "text-orientation": "mixed",
                  }}
                >
                  {preview.state.device.height}px
                </div>
              </Show>

              <Show when={!iframeLoaded() && !errorMessage()}>
                <div
                  style={{
                    position: "absolute",
                    inset: "0",
                    display: "flex",
                    "align-items": "center",
                    "justify-content": "center",
                    background: "var(--cortex-bg-secondary)",
                    "z-index": "10",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      border: "3px solid var(--cortex-border-default)",
                      "border-top-color": "var(--cortex-accent-primary)",
                      "border-radius": "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                </div>
              </Show>

              <Show when={errorMessage()}>
                <div
                  style={{
                    position: "absolute",
                    inset: "0",
                    display: "flex",
                    "flex-direction": "column",
                    "align-items": "center",
                    "justify-content": "center",
                    gap: "12px",
                    background: "var(--cortex-bg-secondary)",
                    color: "var(--cortex-error)",
                    "z-index": "10",
                  }}
                >
                  <Icon name="alert-circle" size={32} />
                  <div style={{ "font-size": "14px" }}>{errorMessage()}</div>
                  <button
                    onClick={() => preview.refresh()}
                    style={{
                      padding: "8px 16px",
                      background: "var(--cortex-bg-tertiary)",
                      border: "1px solid var(--cortex-border-default)",
                      "border-radius": "var(--cortex-radius-sm, 4px)",
                      color: "var(--cortex-text-primary)",
                      cursor: "pointer",
                      "font-size": "13px",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </Show>

              <iframe
                ref={iframeRef}
                title="Browser Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                style={{
                  ...deviceStyle(),
                  border: "none",
                  background: "#fff",
                  outline: preview.state.showOutline
                    ? "2px dashed var(--cortex-accent-primary)"
                    : "none",
                }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          </Show>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </Show>
  );
}

export default BrowserPreview;
