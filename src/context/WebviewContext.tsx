import { createContext, useContext, ParentComponent, onCleanup, onMount, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";

/**
 * Content Security Policy configuration for webview iframes
 */
export interface WebviewCSPConfig {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
}

/**
 * Options for creating a webview
 */
export interface WebviewOptions {
  /** Allow scripts to execute in the webview */
  enableScripts: boolean;
  /** Array of local resource roots the webview can access */
  localResourceRoots?: string[];
  /** Retain webview content when hidden instead of destroying */
  retainContextWhenHidden: boolean;
  /** Custom CSS to inject into the webview */
  customCSS?: string;
  /** Title displayed in the webview panel header */
  title?: string;
  /** Icon identifier for the webview panel */
  icon?: string;
  /** Custom CSP configuration */
  csp?: WebviewCSPConfig;
  /** Enable sandboxed iframe restrictions */
  sandboxed?: boolean;
  /** Allow clipboard access */
  allowClipboard?: boolean;
  /** Allow downloads */
  allowDownloads?: boolean;
}

/**
 * Message structure for webview communication
 */
export interface WebviewMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  id: string;
}

/**
 * Callback type for handling messages from webviews
 */
export type WebviewMessageHandler<T = unknown> = (message: WebviewMessage<T>) => void;

/**
 * State persistence data for a webview
 */
export interface WebviewState {
  scrollPosition?: { x: number; y: number };
  formData?: Record<string, string>;
  customState?: unknown;
}

/**
 * Complete webview data stored in context
 */
export interface WebviewData {
  id: string;
  html: string;
  options: WebviewOptions;
  visible: boolean;
  state: WebviewState;
  createdAt: number;
  lastInteraction: number;
}

/**
 * Internal store state
 */
interface WebviewStoreState {
  webviews: Record<string, WebviewData>;
  activeWebviewId: string | null;
}

/**
 * Context value exposed to consumers
 */
export interface WebviewContextValue {
  /** Reactive state containing all webviews */
  state: WebviewStoreState;
  /** Create a new webview with the given HTML content and options */
  createWebview: (id: string, html: string, options?: Partial<WebviewOptions>) => void;
  /** Send a message to a specific webview */
  postMessage: <T = unknown>(id: string, type: string, payload: T) => boolean;
  /** Register a callback for messages from a specific webview */
  onMessage: <T = unknown>(id: string, callback: WebviewMessageHandler<T>) => () => void;
  /** Remove and destroy a webview */
  disposeWebview: (id: string) => void;
  /** Get a webview by ID */
  getWebview: (id: string) => WebviewData | undefined;
  /** Update webview HTML content */
  updateContent: (id: string, html: string) => void;
  /** Update webview options */
  updateOptions: (id: string, options: Partial<WebviewOptions>) => void;
  /** Set webview visibility */
  setVisible: (id: string, visible: boolean) => void;
  /** Set the active webview */
  setActiveWebview: (id: string | null) => void;
  /** Save webview state for persistence */
  saveState: (id: string, state: Partial<WebviewState>) => void;
  /** Get webview state */
  getState: (id: string) => WebviewState | undefined;
  /** Check if a webview exists */
  hasWebview: (id: string) => boolean;
  /** Get all webview IDs */
  getWebviewIds: () => string[];
  /** Register a message handler for iframe postMessage events */
  registerMessageHandler: (handler: (event: MessageEvent) => void) => () => void;
}

const DEFAULT_OPTIONS: WebviewOptions = {
  enableScripts: false,
  retainContextWhenHidden: false,
  sandboxed: true,
  allowClipboard: false,
  allowDownloads: false,
  csp: {
    defaultSrc: ["'none'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    workerSrc: ["'none'"],
  },
};

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build CSP meta tag content from config
 */
export function buildCSPString(csp: WebviewCSPConfig): string {
  const directives: string[] = [];
  
  if (csp.defaultSrc?.length) {
    directives.push(`default-src ${csp.defaultSrc.join(" ")}`);
  }
  if (csp.scriptSrc?.length) {
    directives.push(`script-src ${csp.scriptSrc.join(" ")}`);
  }
  if (csp.styleSrc?.length) {
    directives.push(`style-src ${csp.styleSrc.join(" ")}`);
  }
  if (csp.imgSrc?.length) {
    directives.push(`img-src ${csp.imgSrc.join(" ")}`);
  }
  if (csp.fontSrc?.length) {
    directives.push(`font-src ${csp.fontSrc.join(" ")}`);
  }
  if (csp.connectSrc?.length) {
    directives.push(`connect-src ${csp.connectSrc.join(" ")}`);
  }
  if (csp.frameSrc?.length) {
    directives.push(`frame-src ${csp.frameSrc.join(" ")}`);
  }
  if (csp.objectSrc?.length) {
    directives.push(`object-src ${csp.objectSrc.join(" ")}`);
  }
  if (csp.mediaSrc?.length) {
    directives.push(`media-src ${csp.mediaSrc.join(" ")}`);
  }
  if (csp.workerSrc?.length) {
    directives.push(`worker-src ${csp.workerSrc.join(" ")}`);
  }
  
  return directives.join("; ");
}

/**
 * Build sandbox attribute value based on options
 */
export function buildSandboxAttribute(options: WebviewOptions): string {
  const permissions: string[] = [];
  
  // Always allow same-origin for basic functionality
  permissions.push("allow-same-origin");
  
  if (options.enableScripts) {
    permissions.push("allow-scripts");
  }
  
  // Allow forms by default for better UX
  permissions.push("allow-forms");
  
  if (options.allowClipboard) {
    permissions.push("allow-clipboard-read");
    permissions.push("allow-clipboard-write");
  }
  
  if (options.allowDownloads) {
    permissions.push("allow-downloads");
  }
  
  // Allow modals for better UX
  permissions.push("allow-modals");
  
  return permissions.join(" ");
}

/**
 * Wrap HTML content with CSP meta tag and custom CSS
 */
export function wrapHtmlContent(html: string, options: WebviewOptions): string {
  const cspString = options.csp ? buildCSPString(options.csp) : "";
  const cspMeta = cspString ? `<meta http-equiv="Content-Security-Policy" content="${cspString}">` : "";
  
  const customStyle = options.customCSS 
    ? `<style id="webview-custom-css">${options.customCSS}</style>` 
    : "";
  
  // Inject messaging bridge script if scripts are enabled
  const messagingBridge = options.enableScripts ? `
    <script>
      (function() {
        window.webviewBridge = {
          postMessage: function(type, payload) {
            window.parent.postMessage({
              source: 'webview',
              webviewId: '${options.title || "unknown"}',
              type: type,
              payload: payload,
              timestamp: Date.now(),
              id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            }, '*');
          },
          onMessage: function(callback) {
            window.addEventListener('message', function(event) {
              if (event.data && event.data.source === 'webview-host') {
                callback(event.data);
              }
            });
          }
        };
      })();
    </script>
  ` : "";

  // Check if HTML already has a head tag
  if (html.includes("<head>") || html.includes("<head ")) {
    // Insert after <head> tag
    return html.replace(/<head([^>]*)>/i, `<head$1>${cspMeta}${customStyle}${messagingBridge}`);
  } else if (html.includes("<html>") || html.includes("<html ")) {
    // Insert head section after html tag
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${cspMeta}${customStyle}${messagingBridge}</head>`);
  } else {
    // Wrap entire content
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${cspMeta}
  ${customStyle}
  ${messagingBridge}
</head>
<body>
${html}
</body>
</html>`;
  }
}

const WebviewContext = createContext<WebviewContextValue>();

export const WebviewProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<WebviewStoreState>({
    webviews: {},
    activeWebviewId: null,
  });

  // Track message listeners by webview ID
  const messageListeners = new Map<string, Set<WebviewMessageHandler>>();
  // Track global message handlers for iframe postMessage events  
  const globalMessageHandlers = new Set<(event: MessageEvent) => void>();

  // Handle incoming messages from webviews
  const handleWindowMessage = (event: MessageEvent) => {
    // Forward to global handlers
    for (const handler of globalMessageHandlers) {
      handler(event);
    }
    
    // Check if this is a message from a webview
    if (!event.data || event.data.source !== "webview") {
      return;
    }

    const { webviewId, type, payload, timestamp, id } = event.data;
    const listeners = messageListeners.get(webviewId);
    
    if (listeners) {
      const message: WebviewMessage = { type, payload, timestamp, id };
      for (const listener of listeners) {
        listener(message);
      }
    }
  };

  // Set up global message listener
  onMount(() => {
    if (typeof window !== "undefined") {
      window.addEventListener("message", handleWindowMessage);
      onCleanup(() => {
        window.removeEventListener("message", handleWindowMessage);
      });
    }
  });

  const createWebview = (id: string, html: string, options?: Partial<WebviewOptions>) => {
    const mergedOptions: WebviewOptions = {
      ...DEFAULT_OPTIONS,
      ...options,
      csp: options?.csp 
        ? { ...DEFAULT_OPTIONS.csp, ...options.csp }
        : DEFAULT_OPTIONS.csp,
    };

    const now = Date.now();
    
    batch(() => {
      setState(produce((s) => {
        s.webviews[id] = {
          id,
          html,
          options: mergedOptions,
          visible: true,
          state: {},
          createdAt: now,
          lastInteraction: now,
        };
        
        // Set as active if no active webview
        if (!s.activeWebviewId) {
          s.activeWebviewId = id;
        }
      }));
    });

    // Initialize message listener set for this webview
    if (!messageListeners.has(id)) {
      messageListeners.set(id, new Set());
    }
  };

  const postMessage = <T = unknown,>(id: string, type: string, payload: T): boolean => {
    const webview = state.webviews[id];
    if (!webview) {
      return false;
    }

    // Find the iframe for this webview and post message to it
    const iframe = document.querySelector(`iframe[data-webview-id="${id}"]`) as HTMLIFrameElement | null;
    if (!iframe?.contentWindow) {
      return false;
    }

    const message: WebviewMessage<T> = {
      type,
      payload,
      timestamp: Date.now(),
      id: generateMessageId(),
    };

    iframe.contentWindow.postMessage({
      source: "webview-host",
      ...message,
    }, "*");

    // Update last interaction time
    setState(produce((s) => {
      if (s.webviews[id]) {
        s.webviews[id].lastInteraction = Date.now();
      }
    }));

    return true;
  };

  const onMessage = <T = unknown,>(id: string, callback: WebviewMessageHandler<T>): (() => void) => {
    if (!messageListeners.has(id)) {
      messageListeners.set(id, new Set());
    }
    
    const listeners = messageListeners.get(id)!;
    listeners.add(callback as WebviewMessageHandler);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback as WebviewMessageHandler);
    };
  };

  const disposeWebview = (id: string) => {
    batch(() => {
      setState(produce((s) => {
        delete s.webviews[id];
        
        // Clear active if this was the active webview
        if (s.activeWebviewId === id) {
          const remainingIds = Object.keys(s.webviews);
          s.activeWebviewId = remainingIds.length > 0 ? remainingIds[0] : null;
        }
      }));
    });

    // Clean up message listeners
    messageListeners.delete(id);
  };

  const getWebview = (id: string): WebviewData | undefined => {
    return state.webviews[id];
  };

  const updateContent = (id: string, html: string) => {
    setState(produce((s) => {
      if (s.webviews[id]) {
        s.webviews[id].html = html;
        s.webviews[id].lastInteraction = Date.now();
      }
    }));
  };

  const updateOptions = (id: string, options: Partial<WebviewOptions>) => {
    setState(produce((s) => {
      if (s.webviews[id]) {
        s.webviews[id].options = {
          ...s.webviews[id].options,
          ...options,
          csp: options.csp 
            ? { ...s.webviews[id].options.csp, ...options.csp }
            : s.webviews[id].options.csp,
        };
        s.webviews[id].lastInteraction = Date.now();
      }
    }));
  };

  const setVisible = (id: string, visible: boolean) => {
    setState(produce((s) => {
      if (s.webviews[id]) {
        s.webviews[id].visible = visible;
        s.webviews[id].lastInteraction = Date.now();
      }
    }));
  };

  const setActiveWebview = (id: string | null) => {
    setState("activeWebviewId", id);
  };

  const saveState = (id: string, webviewState: Partial<WebviewState>) => {
    setState(produce((s) => {
      if (s.webviews[id]) {
        s.webviews[id].state = {
          ...s.webviews[id].state,
          ...webviewState,
        };
      }
    }));
  };

  const getState = (id: string): WebviewState | undefined => {
    return state.webviews[id]?.state;
  };

  const hasWebview = (id: string): boolean => {
    return id in state.webviews;
  };

  const getWebviewIds = (): string[] => {
    return Object.keys(state.webviews);
  };

  const registerMessageHandler = (handler: (event: MessageEvent) => void): (() => void) => {
    globalMessageHandlers.add(handler);
    return () => {
      globalMessageHandlers.delete(handler);
    };
  };

  return (
    <WebviewContext.Provider
      value={{
        state,
        createWebview,
        postMessage,
        onMessage,
        disposeWebview,
        getWebview,
        updateContent,
        updateOptions,
        setVisible,
        setActiveWebview,
        saveState,
        getState,
        hasWebview,
        getWebviewIds,
        registerMessageHandler,
      }}
    >
      {props.children}
    </WebviewContext.Provider>
  );
};

export function useWebview() {
  const ctx = useContext(WebviewContext);
  if (!ctx) throw new Error("useWebview must be used within WebviewProvider");
  return ctx;
}
