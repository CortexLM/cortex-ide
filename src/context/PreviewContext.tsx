/**
 * PreviewContext - Browser Preview Context for Cortex IDE
 * 
 * Provides state and controls for the integrated browser preview panel.
 * Supports live reload, URL navigation, device emulation, and developer tools.
 */

import {
  createContext,
  useContext,
  ParentComponent,
  createEffect,
  Accessor,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useTerminals } from "./TerminalsContext";
import { useSDK } from "./SDKContext";

export type DeviceType = "desktop" | "tablet" | "mobile" | "custom";
export type PreviewStatus = "idle" | "loading" | "ready" | "error";

export interface DevicePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  type: DeviceType;
  userAgent?: string;
  deviceScaleFactor?: number;
}

export interface PreviewServer {
  url: string;
  port: number;
  name: string;
  terminalId?: string;
  detectedAt: number;
}

export interface PreviewHistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

export interface PreviewState {
  activeServer: PreviewServer | null;
  servers: PreviewServer[];
  showPreview: boolean;
  refreshKey: number;
  
  url: string;
  status: PreviewStatus;
  isOpen: boolean;
  isPinned: boolean;
  isLiveReload: boolean;
  liveReloadPort: number;
  device: DevicePreset;
  zoom: number;
  history: PreviewHistoryEntry[];
  historyIndex: number;
  error: string | null;
  isDevToolsOpen: boolean;
  showRulers: boolean;
  showOutline: boolean;
}

export interface PreviewContextValue {
  state: PreviewState;
  
  openPreview: (url: string, name?: string) => void;
  closePreview: () => void;
  togglePreview: () => void;
  refreshPreview: () => void;
  setActiveServer: (server: PreviewServer | null) => void;
  
  isOpen: Accessor<boolean>;
  isLoading: Accessor<boolean>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  currentUrl: Accessor<string>;
  
  open: (url?: string) => void;
  close: () => void;
  toggle: () => void;
  pin: () => void;
  unpin: () => void;
  
  navigate: (url: string) => void;
  refresh: () => void;
  hardRefresh: () => void;
  goBack: () => void;
  goForward: () => void;
  
  setDevice: (device: DevicePreset) => void;
  setCustomSize: (width: number, height: number) => void;
  setZoom: (zoom: number) => void;
  rotateDevice: () => void;
  
  enableLiveReload: (port?: number) => void;
  disableLiveReload: () => void;
  
  toggleDevTools: () => void;
  toggleRulers: () => void;
  toggleOutline: () => void;
  
  takeScreenshot: () => Promise<string | null>;
  
  clearHistory: () => void;
  setError: (error: string | null) => void;
  setStatus: (status: PreviewStatus) => void;
  updateTitle: (title: string) => void;
}

const PreviewContext = createContext<PreviewContextValue>();

const STORAGE_KEY = "cortex-preview-settings";
const DEFAULT_PORT = 3000;

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "desktop", name: "Desktop", width: 1920, height: 1080, type: "desktop" },
  { id: "laptop", name: "Laptop", width: 1366, height: 768, type: "desktop" },
  { id: "ipad-pro", name: "iPad Pro", width: 1024, height: 1366, type: "tablet", deviceScaleFactor: 2 },
  { id: "ipad", name: "iPad", width: 768, height: 1024, type: "tablet", deviceScaleFactor: 2 },
  { id: "iphone-14-pro", name: "iPhone 14 Pro", width: 393, height: 852, type: "mobile", deviceScaleFactor: 3 },
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, type: "mobile", deviceScaleFactor: 2 },
  { id: "pixel-7", name: "Pixel 7", width: 412, height: 915, type: "mobile", deviceScaleFactor: 2.625 },
  { id: "galaxy-s21", name: "Galaxy S21", width: 360, height: 800, type: "mobile", deviceScaleFactor: 3 },
];

const DEFAULT_DEVICE = DEVICE_PRESETS[0];

const SERVER_URL_PATTERNS = [
  /(?:Local|Server|App|Dev|http)[:\s]+(?:running\s+(?:at|on)\s+)?(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  /(?:listening|started|running)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  /(?:ready|available)\s+(?:on|at)\s+(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
  /➜\s+Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
  /ready\s+-\s+started.*on\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/gi,
  /(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+)/gi,
];

function extractPort(url: string): number {
  const match = url.match(/:(\d+)/);
  return match ? parseInt(match[1], 10) : 80;
}

function normalizeServerUrl(url: string): string {
  return url.replace(/0\.0\.0\.0/, "localhost");
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  
  url = url.trim();
  
  if (url.startsWith("localhost") || url.match(/^\d+\.\d+\.\d+\.\d+/)) {
    return `http://${url}`;
  }
  
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("file://")) {
    if (url.includes(".") && !url.includes(" ")) {
      return `https://${url}`;
    }
  }
  
  return url;
}

export const PreviewProvider: ParentComponent = (props) => {
  const terminals = useTerminals();
  const sdk = useSDK();
  
  const [state, setState] = createStore<PreviewState>({
    activeServer: null,
    servers: [],
    showPreview: false,
    refreshKey: 0,
    
    url: "",
    status: "idle",
    isOpen: false,
    isPinned: false,
    isLiveReload: false,
    liveReloadPort: DEFAULT_PORT,
    device: DEFAULT_DEVICE,
    zoom: 100,
    history: [],
    historyIndex: -1,
    error: null,
    isDevToolsOpen: false,
    showRulers: false,
    showOutline: false,
  });

  onMount(() => {
    loadSettings();
    
    window.addEventListener("preview:navigate", handleExternalNavigate as EventListener);
    window.addEventListener("preview:open", handleExternalOpen as EventListener);
    window.addEventListener("preview:close", handleExternalClose as EventListener);
    window.addEventListener("file:saved", handleFileSaved as EventListener);
  });

  onCleanup(() => {
    window.removeEventListener("preview:navigate", handleExternalNavigate as EventListener);
    window.removeEventListener("preview:open", handleExternalOpen as EventListener);
    window.removeEventListener("preview:close", handleExternalClose as EventListener);
    window.removeEventListener("file:saved", handleFileSaved as EventListener);
  });

  createEffect(() => {
    const settings = {
      isPinned: state.isPinned,
      isLiveReload: state.isLiveReload,
      liveReloadPort: state.liveReloadPort,
      device: state.device,
      zoom: state.zoom,
      showRulers: state.showRulers,
      showOutline: state.showOutline,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  });

  function loadSettings(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setState(produce((s) => {
          if (parsed.isPinned !== undefined) s.isPinned = parsed.isPinned;
          if (parsed.isLiveReload !== undefined) s.isLiveReload = parsed.isLiveReload;
          if (parsed.liveReloadPort !== undefined) s.liveReloadPort = parsed.liveReloadPort;
          if (parsed.device) s.device = parsed.device;
          if (parsed.zoom !== undefined) s.zoom = parsed.zoom;
          if (parsed.showRulers !== undefined) s.showRulers = parsed.showRulers;
          if (parsed.showOutline !== undefined) s.showOutline = parsed.showOutline;
        }));
      }
    } catch (e) {
      console.error("[Preview] Failed to load settings:", e);
    }
  }

  function handleExternalNavigate(e: CustomEvent<{ url: string }>) {
    navigate(e.detail.url);
  }

  function handleExternalOpen(e: CustomEvent<{ url?: string }>) {
    open(e.detail?.url);
  }

  function handleExternalClose() {
    close();
  }

  function handleFileSaved() {
    if (state.isLiveReload && state.isOpen) {
      refresh();
    }
  }

  function addToHistory(url: string, title: string = ""): void {
    setState(
      produce((s) => {
        if (s.historyIndex < s.history.length - 1) {
          s.history = s.history.slice(0, s.historyIndex + 1);
        }
        
        s.history.push({
          url,
          title: title || url,
          timestamp: Date.now(),
        });
        
        if (s.history.length > 50) {
          s.history = s.history.slice(-50);
        }
        
        s.historyIndex = s.history.length - 1;
      })
    );
  }

  const detectServerFromOutput = (output: string, terminalId?: string): PreviewServer | null => {
    for (const pattern of SERVER_URL_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(output);
      if (match && match[1]) {
        const url = normalizeServerUrl(match[1]);
        const port = extractPort(url);
        
        if (port === 22 || port === 21 || port === 25) continue;
        
        return {
          url,
          port,
          name: `Server :${port}`,
          terminalId,
          detectedAt: Date.now(),
        };
      }
    }
    return null;
  };

  createEffect(() => {
    const messages = sdk.state.messages;
    
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      
      for (const part of msg.parts) {
        if (part.type === "tool" && part.tool.output) {
          const server = detectServerFromOutput(part.tool.output);
          if (server) {
            const existing = state.servers.find(s => s.port === server.port);
            if (!existing) {
              setState(produce((s) => {
                s.servers.push(server);
                if (!s.activeServer) {
                  s.activeServer = server;
                  s.showPreview = true;
                }
              }));
            }
          }
        }
      }
    }
  });

  createEffect(() => {
    const terminalsList = terminals.state.terminals;
    
    setState(produce((s) => {
      s.servers = s.servers.filter(server => {
        if (!server.terminalId) return true;
        const terminal = terminalsList.find(t => t.id === server.terminalId);
        return terminal && terminal.status === "running";
      });
      
      if (s.activeServer && !s.servers.find(srv => srv.port === s.activeServer!.port)) {
        s.activeServer = s.servers[0] || null;
        if (!s.activeServer) {
          s.showPreview = false;
        }
      }
    }));
  });

  let lastSessionId: string | null = null;
  createEffect(() => {
    const currentSessionId = sdk.state.currentSession?.id || null;
    
    if (lastSessionId !== null && currentSessionId !== lastSessionId) {
      setState(produce((s) => {
        s.servers = [];
        s.activeServer = null;
        s.showPreview = false;
        s.refreshKey = 0;
      }));
    }
    
    lastSessionId = currentSessionId;
  });

  const openPreview = (url: string, name?: string) => {
    const normalizedUrl = normalizeServerUrl(url);
    const port = extractPort(normalizedUrl);
    
    const server: PreviewServer = {
      url: normalizedUrl,
      port,
      name: name || `Server :${port}`,
      detectedAt: Date.now(),
    };
    
    setState(produce((s) => {
      if (!s.servers.find(srv => srv.port === port)) {
        s.servers.push(server);
      }
      s.activeServer = server;
      s.showPreview = true;
    }));
  };

  const closePreview = () => {
    setState("showPreview", false);
  };

  const togglePreview = () => {
    setState("showPreview", !state.showPreview);
  };

  const refreshPreview = () => {
    setState("refreshKey", state.refreshKey + 1);
  };

  const setActiveServer = (server: PreviewServer | null) => {
    setState("activeServer", server);
    if (server) {
      setState("showPreview", true);
    }
  };

  const open = (url?: string) => {
    const targetUrl = url || state.url || `http://localhost:${state.liveReloadPort}`;
    setState(produce((s) => {
      s.isOpen = true;
      if (targetUrl !== s.url) {
        s.url = normalizeUrl(targetUrl);
        s.status = "loading";
        s.error = null;
      }
    }));
    
    if (url && url !== state.url) {
      addToHistory(normalizeUrl(url));
    }
    
    window.dispatchEvent(new CustomEvent("preview:opened", { detail: { url: targetUrl } }));
  };

  const close = () => {
    setState("isOpen", false);
    window.dispatchEvent(new CustomEvent("preview:closed"));
  };

  const toggle = () => {
    if (state.isOpen) {
      close();
    } else {
      open();
    }
  };

  const pin = () => setState("isPinned", true);
  const unpin = () => setState("isPinned", false);

  const navigate = (url: string) => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return;
    
    setState(produce((s) => {
      s.url = normalizedUrl;
      s.status = "loading";
      s.error = null;
    }));
    
    addToHistory(normalizedUrl);
    
    window.dispatchEvent(new CustomEvent("preview:navigated", { detail: { url: normalizedUrl } }));
  };

  const refresh = () => {
    if (!state.url) return;
    setState("status", "loading");
    window.dispatchEvent(new CustomEvent("preview:refresh"));
  };

  const hardRefresh = () => {
    if (!state.url) return;
    setState("status", "loading");
    window.dispatchEvent(new CustomEvent("preview:hard-refresh"));
  };

  const goBack = () => {
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const entry = state.history[newIndex];
      setState(produce((s) => {
        s.historyIndex = newIndex;
        s.url = entry.url;
        s.status = "loading";
      }));
      window.dispatchEvent(new CustomEvent("preview:navigated", { detail: { url: entry.url } }));
    }
  };

  const goForward = () => {
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const entry = state.history[newIndex];
      setState(produce((s) => {
        s.historyIndex = newIndex;
        s.url = entry.url;
        s.status = "loading";
      }));
      window.dispatchEvent(new CustomEvent("preview:navigated", { detail: { url: entry.url } }));
    }
  };

  const setDevice = (device: DevicePreset) => {
    setState("device", device);
    window.dispatchEvent(new CustomEvent("preview:device-changed", { detail: { device } }));
  };

  const setCustomSize = (width: number, height: number) => {
    setState("device", {
      id: "custom",
      name: "Custom",
      width: Math.max(320, width),
      height: Math.max(480, height),
      type: "custom",
    });
  };

  const setZoom = (zoom: number) => {
    setState("zoom", Math.max(25, Math.min(200, zoom)));
  };

  const rotateDevice = () => {
    setState("device", (prev) => ({
      ...prev,
      width: prev.height,
      height: prev.width,
    }));
  };

  const enableLiveReload = (port?: number) => {
    setState(produce((s) => {
      s.isLiveReload = true;
      if (port !== undefined) {
        s.liveReloadPort = port;
      }
    }));
  };

  const disableLiveReload = () => {
    setState("isLiveReload", false);
  };

  const toggleDevTools = () => {
    setState("isDevToolsOpen", (prev) => !prev);
    window.dispatchEvent(new CustomEvent("preview:toggle-devtools"));
  };

  const toggleRulers = () => setState("showRulers", (prev) => !prev);
  const toggleOutline = () => setState("showOutline", (prev) => !prev);

  const takeScreenshot = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const handler = (e: CustomEvent<{ dataUrl: string }>) => {
        window.removeEventListener("preview:screenshot-result", handler as EventListener);
        resolve(e.detail?.dataUrl || null);
      };
      
      window.addEventListener("preview:screenshot-result", handler as EventListener);
      window.dispatchEvent(new CustomEvent("preview:take-screenshot"));
      
      setTimeout(() => {
        window.removeEventListener("preview:screenshot-result", handler as EventListener);
        resolve(null);
      }, 5000);
    });
  };

  const clearHistory = () => {
    setState(produce((s) => {
      s.history = [];
      s.historyIndex = -1;
    }));
  };

  const setError = (error: string | null) => {
    setState(produce((s) => {
      s.error = error;
      if (error) {
        s.status = "error";
      }
    }));
  };

  const setStatus = (status: PreviewStatus) => {
    setState("status", status);
  };

  const updateTitle = (title: string) => {
    if (state.historyIndex >= 0 && state.history[state.historyIndex]) {
      setState("history", state.historyIndex, "title", title);
    }
  };

  const isOpen: Accessor<boolean> = () => state.isOpen;
  const isLoading: Accessor<boolean> = () => state.status === "loading";
  const canGoBack: Accessor<boolean> = () => state.historyIndex > 0;
  const canGoForward: Accessor<boolean> = () => state.historyIndex < state.history.length - 1;
  const currentUrl: Accessor<string> = () => state.url;

  const value: PreviewContextValue = {
    state,
    
    openPreview,
    closePreview,
    togglePreview,
    refreshPreview,
    setActiveServer,
    
    isOpen,
    isLoading,
    canGoBack,
    canGoForward,
    currentUrl,
    open,
    close,
    toggle,
    pin,
    unpin,
    navigate,
    refresh,
    hardRefresh,
    goBack,
    goForward,
    setDevice,
    setCustomSize,
    setZoom,
    rotateDevice,
    enableLiveReload,
    disableLiveReload,
    toggleDevTools,
    toggleRulers,
    toggleOutline,
    takeScreenshot,
    clearHistory,
    setError,
    setStatus,
    updateTitle,
  };

  return (
    <PreviewContext.Provider value={value}>
      {props.children}
    </PreviewContext.Provider>
  );
};

export function usePreview(): PreviewContextValue {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreview must be used within a PreviewProvider");
  }
  return context;
}
