import { 
  Show, 
  createSignal, 
  createEffect, 
  onCleanup, 
  createMemo,
  For,
  type JSX 
} from "solid-js";
import { Icon } from "./ui/Icon";
import { 
  useWebview, 
  wrapHtmlContent, 
  buildSandboxAttribute,
  type WebviewOptions,
  type WebviewMessage,
} from "@/context/WebviewContext";

export interface WebviewPanelProps {
  /** Unique identifier for this webview instance */
  id: string;
  /** HTML content to display in the webview */
  html?: string;
  /** Webview configuration options */
  options?: Partial<WebviewOptions>;
  /** CSS class to apply to the container */
  class?: string;
  /** Inline styles for the container */
  style?: JSX.CSSProperties;
  /** Callback when webview is ready (iframe loaded) */
  onReady?: () => void;
  /** Callback for receiving messages from the webview */
  onMessage?: <T = unknown>(message: WebviewMessage<T>) => void;
  /** Callback when webview encounters an error */
  onError?: (error: Error) => void;
  /** Callback when close button is clicked */
  onClose?: () => void;
  /** Show header with controls */
  showHeader?: boolean;
  /** Enable devtools button in header */
  showDevTools?: boolean;
  /** Custom header content */
  headerContent?: JSX.Element;
  /** Loading placeholder */
  loadingContent?: JSX.Element;
  /** Minimum height for the panel */
  minHeight?: string;
  /** Maximum height for the panel */
  maxHeight?: string;
}

/**
 * WebviewPanel Component
 * 
 * A sandboxed iframe-based webview panel with full message passing support,
 * CSP headers, and state persistence capabilities.
 */
export function WebviewPanel(props: WebviewPanelProps) {
  const webview = useWebview();
  
  const [isLoading, setIsLoading] = createSignal(true);
  const [hasError, setHasError] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string>("");
  const [isMaximized, setIsMaximized] = createSignal(false);
  const [isVisible, setIsVisible] = createSignal(true);
  const [refreshKey, setRefreshKey] = createSignal(0);
  
  let iframeRef: HTMLIFrameElement | undefined;

  // Memoized webview data
  const webviewData = createMemo(() => webview.getWebview(props.id));
  
  // Get effective options (props override stored)
  const effectiveOptions = createMemo((): WebviewOptions => {
    const stored = webviewData()?.options;
    const defaultOptions: WebviewOptions = {
      enableScripts: false,
      retainContextWhenHidden: false,
      sandboxed: true,
      allowClipboard: false,
      allowDownloads: false,
    };
    
    return {
      ...defaultOptions,
      ...stored,
      ...props.options,
    };
  });

  // Get effective HTML content
  const effectiveHtml = createMemo(() => {
    return props.html ?? webviewData()?.html ?? "";
  });

  // Build the wrapped HTML with CSP and custom CSS
  const wrappedHtml = createMemo(() => {
    const html = effectiveHtml();
    const opts = effectiveOptions();
    return wrapHtmlContent(html, opts);
  });

  // Build the blob URL for the iframe src
  const blobUrl = createMemo(() => {
    const html = wrappedHtml();
    if (!html) return "";
    
    const blob = new Blob([html], { type: "text/html" });
    return URL.createObjectURL(blob);
  });

  // Clean up blob URL on change
  createEffect((prevUrl: string | undefined) => {
    const currentUrl = blobUrl();
    if (prevUrl && prevUrl !== currentUrl) {
      URL.revokeObjectURL(prevUrl);
    }
    return currentUrl;
  });

  // Clean up blob URL on unmount
  onCleanup(() => {
    const url = blobUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  });

  // Create or update webview in context
  createEffect(() => {
    const id = props.id;
    const html = effectiveHtml();
    const opts = effectiveOptions();
    
    if (!webview.hasWebview(id)) {
      webview.createWebview(id, html, opts);
    } else if (html !== webviewData()?.html) {
      webview.updateContent(id, html);
    }
  });

  // Subscribe to messages from this webview
  createEffect(() => {
    if (!props.onMessage) return;
    
    const unsubscribe = webview.onMessage(props.id, props.onMessage);
    onCleanup(unsubscribe);
  });

  // Handle visibility changes for state persistence
  createEffect(() => {
    const opts = effectiveOptions();
    const visible = isVisible();
    
    webview.setVisible(props.id, visible);
    
    // Save scroll position when hiding if retainContextWhenHidden is enabled
    if (!visible && opts.retainContextWhenHidden && iframeRef?.contentWindow) {
      try {
        const scrollX = iframeRef.contentWindow.scrollX || 0;
        const scrollY = iframeRef.contentWindow.scrollY || 0;
        webview.saveState(props.id, { scrollPosition: { x: scrollX, y: scrollY } });
      } catch {
        // Cross-origin access might be blocked, ignore
      }
    }
  });

  // Restore scroll position when becoming visible
  createEffect(() => {
    if (!isVisible() || isLoading()) return;
    
    const opts = effectiveOptions();
    const state = webview.getState(props.id);
    
    if (opts.retainContextWhenHidden && state?.scrollPosition && iframeRef?.contentWindow) {
      try {
        iframeRef.contentWindow.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
      } catch {
        // Cross-origin access might be blocked, ignore
      }
    }
  });

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
    props.onReady?.();
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
    setErrorMessage("Failed to load webview content");
    props.onError?.(new Error("Failed to load webview content"));
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey(k => k + 1);
  };

  const handleClose = () => {
    props.onClose?.();
    webview.disposeWebview(props.id);
  };

  const handleToggleMaximize = () => {
    setIsMaximized(!isMaximized());
  };

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible());
  };

  const sandboxAttr = createMemo(() => {
    const opts = effectiveOptions();
    return opts.sandboxed !== false ? buildSandboxAttribute(opts) : undefined;
  });

  const showHeader = () => props.showHeader !== false;
  const title = () => effectiveOptions().title || "Webview";
  const icon = () => effectiveOptions().icon;

  // Determine container styles based on maximized state
  const containerStyle = createMemo((): JSX.CSSProperties => {
    const baseStyle: JSX.CSSProperties = {
      background: "var(--background-base)",
      "border-color": "var(--border-weak)",
      "min-height": props.minHeight || "200px",
      "max-height": props.maxHeight || "none",
    };

    if (isMaximized()) {
      return {
        ...baseStyle,
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        "z-index": "9999",
        "border-radius": "0",
      };
    }

    return baseStyle;
  });

  return (
    <div 
      class={`flex flex-col rounded-2xl overflow-hidden border ${props.class || ""}`}
      style={{ ...containerStyle(), ...props.style }}
    >
      {/* Header */}
      <Show when={showHeader()}>
        <div 
          class="shrink-0 h-10 flex items-center justify-between px-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          {/* Title section */}
          <div class="flex items-center gap-2 min-w-0">
            <Show when={icon()}>
              <span class="text-sm" style={{ color: "var(--text-weak)" }}>
                {icon()}
              </span>
            </Show>
            <span 
              class="text-xs font-medium truncate"
              style={{ color: "var(--text-base)" }}
            >
              {title()}
            </span>
            <Show when={props.headerContent}>
              {props.headerContent}
            </Show>
          </div>

          {/* Actions */}
          <div class="flex items-center gap-1">
            <Show when={props.showDevTools}>
              <button
                onClick={() => {
                  // Open browser devtools for iframe (not always possible)
                  if (import.meta.env.DEV) console.log("[WebviewPanel] DevTools requested for:", props.id);
                }}
                class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="DevTools"
              >
                <Icon name="code" class="w-3.5 h-3.5" />
              </button>
            </Show>
            <button
              onClick={handleToggleVisibility}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title={isVisible() ? "Hide content" : "Show content"}
            >
              <Show when={isVisible()} fallback={<Icon name="eye-slash" class="w-3.5 h-3.5" />}>
                <Icon name="eye" class="w-3.5 h-3.5" />
              </Show>
            </button>
            <button
              onClick={handleRefresh}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Refresh"
            >
              <Icon name="rotate" class={`w-3.5 h-3.5 ${isLoading() ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleToggleMaximize}
              class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title={isMaximized() ? "Restore" : "Maximize"}
            >
              <Show when={isMaximized()} fallback={<Icon name="maximize" class="w-3.5 h-3.5" />}>
                <Icon name="minimize" class="w-3.5 h-3.5" />
              </Show>
            </button>
            <Show when={props.onClose}>
              <button
                onClick={handleClose}
                class="p-1.5 rounded transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Close"
              >
                <Icon name="xmark" class="w-3.5 h-3.5" />
              </button>
            </Show>
          </div>
        </div>
      </Show>

      {/* Content area */}
      <div class="flex-1 relative">
        {/* Loading overlay */}
        <Show when={isLoading()}>
          <div 
            class="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "var(--background-stronger)" }}
          >
            <Show 
              when={props.loadingContent} 
              fallback={
                <div class="flex flex-col items-center gap-3">
                  <div 
                    class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ "border-color": "var(--border-weak)", "border-top-color": "transparent" }}
                  />
                  <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                    Loading webview...
                  </span>
                </div>
              }
            >
              {props.loadingContent}
            </Show>
          </div>
        </Show>

        {/* Error display */}
        <Show when={hasError()}>
          <div 
            class="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "var(--background-stronger)" }}
          >
            <div class="flex flex-col items-center gap-3 text-center p-4">
              <div 
                class="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239, 68, 68, 0.1)" }}
              >
                <Icon name="xmark" class="w-6 h-6" style={{ color: "var(--cortex-error)" }} />
              </div>
              <span class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
                Failed to load content
              </span>
              <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                {errorMessage()}
              </span>
              <button
                onClick={handleRefresh}
                class="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ 
                  background: "var(--surface-raised)",
                  color: "var(--text-base)"
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        </Show>

        {/* Hidden message when not visible but retaining context */}
        <Show when={!isVisible() && effectiveOptions().retainContextWhenHidden}>
          <div 
            class="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "var(--background-stronger)" }}
          >
            <div class="flex flex-col items-center gap-2 text-center p-4">
              <Icon name="eye-slash" class="w-6 h-6" style={{ color: "var(--text-weaker)" }} />
              <span class="text-xs" style={{ color: "var(--text-weaker)" }}>
                Content hidden (state preserved)
              </span>
            </div>
          </div>
        </Show>

        {/* Iframe */}
        <Show when={blobUrl() && (isVisible() || effectiveOptions().retainContextWhenHidden)}>
          {/* Force re-render on refresh by keying with refreshKey */}
          <iframe
            ref={iframeRef}
            data-webview-id={props.id}
            src={`${blobUrl()}#refresh=${refreshKey()}`}
            class="w-full h-full border-0"
            style={{ 
              background: "white",
              display: isVisible() ? "block" : "none",
              "min-height": props.minHeight || "200px",
            }}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox={sandboxAttr()}
            title={title()}
            allow={effectiveOptions().allowClipboard ? "clipboard-read; clipboard-write" : ""}
          />
        </Show>
      </div>
    </div>
  );
}

/**
 * WebviewPanelContainer - Container for multiple webview panels
 * Manages a collection of webview panels with tab-like navigation
 */
export interface WebviewPanelContainerProps {
  /** CSS class for the container */
  class?: string;
  /** Inline styles */
  style?: JSX.CSSProperties;
  /** Show tabs for switching between webviews */
  showTabs?: boolean;
  /** Callback when active webview changes */
  onActiveChange?: (id: string | null) => void;
}

export function WebviewPanelContainer(props: WebviewPanelContainerProps) {
  const webview = useWebview();
  
  const webviewIds = createMemo(() => webview.getWebviewIds());
  const activeId = createMemo(() => webview.state.activeWebviewId);
  
  const handleTabClick = (id: string) => {
    webview.setActiveWebview(id);
    props.onActiveChange?.(id);
  };

  const handleCloseWebview = (id: string) => {
    webview.disposeWebview(id);
    props.onActiveChange?.(webview.state.activeWebviewId);
  };

  return (
    <div 
      class={`flex flex-col h-full ${props.class || ""}`}
      style={props.style}
    >
      {/* Tabs */}
      <Show when={props.showTabs !== false && webviewIds().length > 1}>
        <div 
          class="flex items-center gap-1 px-2 py-1 border-b overflow-x-auto"
          style={{ 
            background: "var(--background-base)",
            "border-color": "var(--border-weak)"
          }}
        >
          <For each={webviewIds()}>
            {(id) => {
              const data = () => webview.getWebview(id);
              const isActive = () => activeId() === id;
              
              return (
                <button
                  onClick={() => handleTabClick(id)}
                  class={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                    transition-colors shrink-0
                    ${isActive() ? "bg-[var(--surface-raised)]" : "hover:bg-[var(--surface-raised)]"}
                  `}
                  style={{ 
                    color: isActive() ? "var(--text-base)" : "var(--text-weak)"
                  }}
                >
                  <span class="truncate max-w-[120px]">
                    {data()?.options.title || id}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseWebview(id);
                    }}
                    class="p-0.5 rounded hover:bg-[var(--surface-overlay)] transition-colors"
                  >
                    <Icon name="xmark" class="w-3 h-3" />
                  </span>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Active webview panel */}
      <div class="flex-1 relative">
        <For each={webviewIds()}>
          {(id) => {
            const isActive = () => activeId() === id;
            const data = () => webview.getWebview(id);
            
            return (
              <Show when={data()}>
                <div
                  class="absolute inset-0"
                  style={{ display: isActive() ? "block" : "none" }}
                >
                  <WebviewPanel
                    id={id}
                    showHeader={webviewIds().length === 1}
                    onClose={() => handleCloseWebview(id)}
                  />
                </div>
              </Show>
            );
          }}
        </For>

        {/* Empty state */}
        <Show when={webviewIds().length === 0}>
          <div 
            class="absolute inset-0 flex items-center justify-center"
            style={{ background: "var(--background-base)" }}
          >
            <span class="text-sm" style={{ color: "var(--text-weaker)" }}>
              No webviews open
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}

export default WebviewPanel;

