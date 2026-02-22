/**
 * CortexDesktopLayout - Orchestrator connecting Figma components to Cortex contexts
 *
 * Composes sub-components from layout/ and manages top-level state:
 * current mode, sidebar tab, bottom panel state, and event listeners.
 */

import {
  ParentProps,
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  Show,
  Suspense,
  lazy,
} from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { getWindowLabel } from "@/utils/windowStorage";

import CortexTitleBar from "./CortexTitleBar";
import { WindowResizers } from "./titlebar/WindowResizers";
import { ChatPanelState, ChatMessage } from "./CortexChatPanel";
import { Agent } from "./CortexAgentSidebar";
import { FileChange } from "./CortexChangesPanel";
import { Message } from "./CortexConversationView";
import { ApprovalDialog } from "@/components/ApprovalDialog";
import { CortexNotifications } from "./CortexNotifications";
import { NotificationHandler } from "./handlers/NotificationHandler";

import { useEditor } from "@/context/EditorContext";
import { useSDK } from "@/context/SDKContext";
import { useAIAgent } from "@/context/ai/AIAgentContext";
import { useAIProvider } from "@/context/ai/AIProviderContext";
import { useMultiRepo } from "@/context/MultiRepoContext";
import { useCommands } from "@/context/CommandContext";
import { createLogger } from "@/utils/logger";
import { FileEditHandlers } from "./handlers/FileEditHandlers";

import { ViewNavigationHandlers } from "./handlers/ViewNavigationHandlers";

import { CortexModeCarousel } from "./layout/CortexModeCarousel";
import { CortexVibeLayout } from "./layout/CortexVibeLayout";
import { CortexIDELayout } from "./layout/CortexIDELayout";
import type { ViewMode, SidebarTab, BottomPanelTab } from "./layout/types";
import { BOTTOM_PANEL_DEFAULT_HEIGHT, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_DEFAULT_WIDTH } from "./layout/types";

const logger = createLogger("DesktopLayout");

// AI Modifications, Token Limit, Update File panels
const CortexAIModificationsPanel = lazy(() => import("./CortexAIModificationsPanel").then(m => ({ default: m.CortexAIModificationsPanel })));
const CortexTokenLimitDisplay = lazy(() => import("./CortexTokenLimitDisplay").then(m => ({ default: m.CortexTokenLimitDisplay })));
const CortexUpdateFileViewPanel = lazy(() => import("./CortexUpdateFileView").then(m => ({ default: m.CortexUpdateFileView })));

const STORAGE_KEYS = {
  mode: "figma_layout_mode",
  sidebarTab: "figma_layout_sidebar_tab",
  sidebarCollapsed: "figma_layout_sidebar_collapsed",
  sidebarWidth: "figma_layout_sidebar_width",
  chatState: "figma_layout_chat_state",
} as const;

const VALID_MODES: ViewMode[] = ["vibe", "ide"];
const VALID_SIDEBAR_TABS: SidebarTab[] = ["files", "search", "git", "debug", "extensions", "agents", "themes", "plugins", "account"];
const VALID_CHAT_STATES: ChatPanelState[] = ["minimized", "expanded", "home"];

function loadLayoutState() {
  const rawMode = localStorage.getItem(STORAGE_KEYS.mode);
  const rawTab = localStorage.getItem(STORAGE_KEYS.sidebarTab);
  const rawWidth = parseInt(localStorage.getItem(STORAGE_KEYS.sidebarWidth) || String(SIDEBAR_DEFAULT_WIDTH), 10);
  const rawChat = localStorage.getItem(STORAGE_KEYS.chatState);

  const label = getWindowLabel();
  const currentProject = localStorage.getItem(`cortex_current_project_${label}`)
    || (label === "main" ? localStorage.getItem("cortex_current_project") : null);
  const hasProject = currentProject && currentProject !== "." && currentProject !== "";

  return {
    mode: hasProject ? "ide" as ViewMode
      : (VALID_MODES.includes(rawMode as ViewMode) ? (rawMode as ViewMode) : "vibe" as ViewMode),
    sidebarTab: VALID_SIDEBAR_TABS.includes(rawTab as SidebarTab) ? (rawTab as SidebarTab) : "files" as SidebarTab,
    sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "true",
    sidebarWidth: Number.isFinite(rawWidth) ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, rawWidth)) : SIDEBAR_DEFAULT_WIDTH,
    chatState: VALID_CHAT_STATES.includes(rawChat as ChatPanelState) ? (rawChat as ChatPanelState) : "minimized" as ChatPanelState,
  };
}

function saveLayoutState(state: { mode?: ViewMode; sidebarTab?: SidebarTab; sidebarCollapsed?: boolean; sidebarWidth?: number; chatState?: ChatPanelState }) {
  if (state.mode !== undefined) localStorage.setItem(STORAGE_KEYS.mode, state.mode);
  if (state.sidebarTab !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarTab, state.sidebarTab);
  if (state.sidebarCollapsed !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(state.sidebarCollapsed));
  if (state.sidebarWidth !== undefined) localStorage.setItem(STORAGE_KEYS.sidebarWidth, String(state.sidebarWidth));
  if (state.chatState !== undefined) localStorage.setItem(STORAGE_KEYS.chatState, state.chatState);
}

export function CortexDesktopLayout(props: ParentProps) {
  const editor = useEditor();
  const sdk = useSDK();
  const commands = useCommands();

  let aiAgent: ReturnType<typeof useAIAgent> | null = null;
  try { aiAgent = useAIAgent(); } catch { /* not available */ }
  let multiRepo: ReturnType<typeof useMultiRepo> | null = null;
  try { multiRepo = useMultiRepo(); } catch { /* not available */ }
  let aiProvider: ReturnType<typeof useAIProvider> | null = null;
  try { aiProvider = useAIProvider(); } catch { /* not available */ }

  const dynamicModelName = createMemo(() => {
    if (aiProvider) { const m = aiProvider.selectedModel(); if (m) return m; }
    return "claude-opus-4.5";
  });

  const init = loadLayoutState();
  const [mode, setMode] = createSignal<ViewMode>(init.mode);
  const [sidebarTab, setSidebarTab] = createSignal<SidebarTab>(init.sidebarTab);
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(init.sidebarCollapsed);
  const [sidebarWidth, setSidebarWidth] = createSignal(init.sidebarWidth);
  const [chatState, setChatState] = createSignal<ChatPanelState>(init.chatState);
  const [isResizing, setIsResizing] = createSignal(false);
  const [bottomPanelTab, setBottomPanelTab] = createSignal<BottomPanelTab>("terminal");
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = createSignal(true);
  const [bottomPanelHeight, setBottomPanelHeight] = createSignal(BOTTOM_PANEL_DEFAULT_HEIGHT);
  const [chatInput, setChatInput] = createSignal("");

  // AI Modifications panel state
  const [showAIModifications, setShowAIModifications] = createSignal(false);

  // Update File view state
  const [activeUpdateFile, setActiveUpdateFile] = createSignal<{
    filePath: string;
    oldContent: string;
    newContent: string;
    diffLines: { type: "added" | "removed" | "unchanged"; content: string; lineNumber?: number }[];
  } | null>(null);

  const [selectedConversationId, setSelectedConversationId] = createSignal<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = createSignal<string | null>(null);
  const [terminalOutput, setTerminalOutput] = createSignal<string[]>([]);
  const [localAgents, setLocalAgents] = createSignal<Agent[]>([]);
  const [isMenuOpen, setIsMenuOpen] = createSignal(false);
  const [activeMenuLabel, setActiveMenuLabel] = createSignal<string | null>(null);
  let appWindow: Awaited<ReturnType<typeof getCurrentWindow>> | null = null;

  const agents = createMemo((): Agent[] => {
    if (aiAgent) {
      const ca = aiAgent.agents();
      if (ca.length > 0) return ca.map(a => ({ id: a.id, name: a.name, branch: "main", status: a.status === "failed" ? "error" : a.status as Agent["status"], isExpanded: true, conversations: [] }));
    }
    return localAgents();
  });

  const fileChanges = createMemo((): FileChange[] => {
    if (multiRepo) {
      const repo = multiRepo.activeRepository();
      if (repo) return [...repo.stagedFiles, ...repo.unstagedFiles].map(f => ({ path: f.path, additions: 0, deletions: 0, status: f.status === "added" ? "added" : f.status === "deleted" ? "deleted" : "modified" }));
    }
    return [];
  });

  const mapMessages = (msgs: typeof sdk.state.messages) => {
    if (!msgs || msgs.length === 0) return [];
    return msgs.map(msg => {
      const text = msg.parts.filter((p): p is { type: "text"; content: string } => p.type === "text").map(p => p.content).join("\n");
      return { id: msg.id, role: msg.role, content: text || "", timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined };
    });
  };

  const vibeMessages = createMemo((): Message[] => mapMessages(sdk.state.messages) as Message[]);
  const chatMessages = createMemo((): ChatMessage[] => mapMessages(sdk.state.messages).map(m => ({ ...m, type: m.role === "user" ? "user" as const : "agent" as const })));
  const isChatProcessing = () => sdk.state.isStreaming;
  const projectPath = createMemo(() => {
    const cwd = sdk.state.config.cwd;
    if (cwd && cwd !== ".") return cwd;
    const label = getWindowLabel();
    const stored = localStorage.getItem(`cortex_current_project_${label}`)
      || (label === "main" ? localStorage.getItem("cortex_current_project") : null);
    if (stored && stored !== "." && stored !== "") return stored;
    return null;
  });
  const projectName = createMemo(() => { const p = projectPath(); if (!p || p === ".") return "Cortex"; return p.replace(/\\/g, "/").split("/").pop() || "Cortex"; });
  const activeFile = createMemo(() => editor.state.openFiles.find(f => f.id === editor.state.activeFileId));

  const statusBarBranch = createMemo(() => multiRepo?.activeRepository()?.branch ?? null);
  const statusBarIsSyncing = createMemo(() => multiRepo?.activeRepository()?.status === "loading");
  const statusBarHasChanges = createMemo(() => {
    const repo = multiRepo?.activeRepository();
    if (!repo) return false;
    return repo.stagedFiles.length > 0 || repo.unstagedFiles.length > 0;
  });
  const statusBarLanguage = createMemo(() => activeFile()?.language ?? "Plain Text");

  const handleStatusBarBranchClick = () => window.dispatchEvent(new CustomEvent("view:git"));
  const handleStatusBarTogglePanel = () => window.dispatchEvent(new CustomEvent("layout:toggle-panel"));
  const handleStatusBarToggleTerminal = () => window.dispatchEvent(new CustomEvent("terminal:toggle"));

  createEffect(() => { saveLayoutState({ mode: mode(), sidebarTab: sidebarTab(), sidebarCollapsed: sidebarCollapsed(), sidebarWidth: sidebarWidth(), chatState: chatState() }); });

  onMount(async () => {
    try { appWindow = await getCurrentWindow(); invoke("show_window").catch(() => {}); } catch { /* not in Tauri */ }

    const evMap: Record<string, EventListener> = {
      "viewmode:change": ((e: Event) => setMode((e as CustomEvent<{ mode: ViewMode }>).detail.mode)) as EventListener,
      "chat:toggle": (() => setChatState(p => p === "expanded" ? "minimized" : "expanded")) as EventListener,
      "folder:did-open": (() => { setMode("ide"); setSidebarTab("files"); setSidebarCollapsed(false); }) as EventListener,
      "settings:open-tab": (() => editor.openVirtualFile("Settings", "", "plaintext")) as EventListener,
      "view:explorer": (() => { setSidebarTab("files"); setSidebarCollapsed(false); }) as EventListener,
      "view:search": (() => { setSidebarTab("search"); setSidebarCollapsed(false); }) as EventListener,
      "view:git": (() => { setSidebarTab("git"); setSidebarCollapsed(false); }) as EventListener,
      "view:extensions": (() => { setSidebarTab("extensions"); setSidebarCollapsed(false); }) as EventListener,
      "sidebar:toggle": (() => setSidebarCollapsed(!sidebarCollapsed())) as EventListener,
      "selection:select-all": (() => document.execCommand("selectAll")) as EventListener,
      "help:docs": (() => window.open("https://docs.cortex.dev", "_blank")) as EventListener,
      "terminal:toggle": (() => { if (bottomPanelCollapsed()) { setBottomPanelCollapsed(false); setBottomPanelTab("terminal"); } else if (bottomPanelTab() === "terminal") { setBottomPanelCollapsed(true); } else { setBottomPanelTab("terminal"); } }) as EventListener,
      "layout:toggle-panel": (() => setBottomPanelCollapsed(!bottomPanelCollapsed())) as EventListener,
      "ai:modifications:toggle": (() => setShowAIModifications((prev) => !prev)) as EventListener,
      "file:update-view": ((e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.filePath && detail?.newContent !== undefined) {
          setActiveUpdateFile({
            filePath: detail.filePath,
            oldContent: detail.oldContent ?? "",
            newContent: detail.newContent,
            diffLines: detail.diffLines ?? [],
          });
        }
      }) as EventListener,
    };

    for (const [ev, fn] of Object.entries(evMap)) window.addEventListener(ev, fn);
    onCleanup(() => { for (const [ev, fn] of Object.entries(evMap)) window.removeEventListener(ev, fn); });

    const cwd = sdk.state.config.cwd;
    if (cwd && cwd !== "." && cwd !== "" && mode() !== "ide") {
      setMode("ide");
    }
  });

  const handleMinimize = async () => { if (appWindow) await appWindow.minimize(); };
  const handleMaximize = async () => { if (appWindow) { (await appWindow.isMaximized()) ? await appWindow.unmaximize() : await appWindow.maximize(); } };
  const handleClose = async () => { if (appWindow) await appWindow.close(); };

  const handleModeChange = (newMode: ViewMode) => {
    if (mode() === newMode) return;
    setMode(newMode);
    setChatState(newMode === "vibe" ? "home" : "minimized");
  };

  const handleNavItemClick = (id: string) => {
    if (id === "home") { setMode("vibe"); setChatState("home"); return; }
    if (id === "new") { window.dispatchEvent(new CustomEvent("file:new")); return; }
    const tabId = id as SidebarTab;
    if (sidebarCollapsed()) { setSidebarCollapsed(false); setSidebarTab(tabId); }
    else if (sidebarTab() === tabId) { setSidebarCollapsed(true); }
    else { setSidebarTab(tabId); }
  };

  const handleFileSelect = (filePath: string) => editor.openFile(filePath);

  const handleChatSubmit = async (value: string) => {
    if (!value.trim()) return;
    try { await sdk.sendMessage(value); setChatInput(""); if (mode() !== "vibe") setChatState("expanded"); } catch (e) { logger.error("Failed to send message:", e); }
  };


  return (
    <div style={{
      display: "flex", "flex-direction": "column", width: "100vw", height: "100vh",
      background: "#141415", border: "1px solid #2E2F31",
      "border-radius": "24px",
      "box-shadow": "0px 4px 26px 15px rgba(38,36,37,0.38), inset 0px 0px 13.1px 6px rgba(26,24,25,0.2)",
      overflow: "hidden", "font-family": "var(--cortex-font-sans)", color: "var(--cortex-text-primary)",
    }}>
      <FileEditHandlers />
      <CortexTitleBar
        appName={projectName()} currentPage={activeFile()?.name || "Home"} isDraft={activeFile()?.modified}
        mode={mode()} onModeChange={handleModeChange} isDarkMode={true}
        onMinimize={handleMinimize} onMaximize={handleMaximize} onClose={handleClose}
        isMenuOpen={isMenuOpen()} onMenuToggle={() => setIsMenuOpen(!isMenuOpen())}
        activeMenu={activeMenuLabel()} onMenuSelect={setActiveMenuLabel}
        configLabel={dynamicModelName()}
        isRunning={sdk.state.isStreaming}
        onConfigClick={() => window.dispatchEvent(new CustomEvent("settings:open"))}
        onStartPause={() => {
          if (sdk.state.isStreaming) { sdk.interrupt(); }
          else { const msg = chatInput().trim(); if (msg) handleChatSubmit(msg); }
        }}
        onProjectDropdownClick={() => window.dispatchEvent(new CustomEvent("folder:open"))}
      />

      <main style={{ display: "flex", flex: "1", overflow: "hidden", position: "relative" }}>
        <CortexModeCarousel
          mode={mode()}
          vibeContent={() =>
            <CortexVibeLayout
              projectName={projectName()} agents={agents()} selectedConversationId={selectedConversationId()} selectedAgentId={selectedAgentId()}
              vibeMessages={vibeMessages()} fileChanges={fileChanges()} terminalOutput={terminalOutput()}
              chatInput={chatInput()} isProcessing={isChatProcessing()} modelName={dynamicModelName()}
              onConversationSelect={(aId, cId) => { setSelectedAgentId(aId); setSelectedConversationId(cId); }}
              onAgentToggle={(aId) => { setLocalAgents(prev => prev.map(a => a.id === aId ? { ...a, isExpanded: !a.isExpanded } : a)); }}
              onNewWorkspace={() => {
                const id = `agent-${Date.now()}`, n = agents().length + 1;
                setLocalAgents(prev => [...prev, { id, name: `Agent ${n}`, branch: "main", status: "idle", isExpanded: true, conversations: [] }]);
                setSelectedAgentId(id); setSelectedConversationId(null);
                window.dispatchEvent(new CustomEvent("notification", { detail: { type: "success", message: `New agent workspace "Agent ${n}" created.` } }));
              }}
              onInputChange={setChatInput} onSubmit={handleChatSubmit} onFileSelect={handleFileSelect}
              onRunCommand={(cmd) => setTerminalOutput(prev => [...prev, `$ ${cmd}`, "Running..."])}
              onRun={() => setTerminalOutput(prev => [...prev, "$ npm run dev", "Starting..."])}
            />
          }
          ideContent={() =>
            <CortexIDELayout
              sidebarTab={sidebarTab()} sidebarCollapsed={sidebarCollapsed()} sidebarWidth={sidebarWidth()} isResizing={isResizing()}
              projectPath={projectPath()} bottomPanelTab={bottomPanelTab()} bottomPanelCollapsed={bottomPanelCollapsed()} bottomPanelHeight={bottomPanelHeight()}
              chatState={chatState()} chatMessages={chatMessages()} chatInput={chatInput()} isProcessing={isChatProcessing()} modelName={dynamicModelName()}
              onNavItemClick={handleNavItemClick}
              onAvatarClick={() => { if (!sidebarCollapsed() && sidebarTab() === "account") setSidebarCollapsed(true); else { setSidebarCollapsed(false); setSidebarTab("account"); } }}
              onFileSelect={handleFileSelect} onSidebarWidthChange={setSidebarWidth} onResizingChange={setIsResizing}
              onBottomPanelTabChange={setBottomPanelTab} onBottomPanelCollapse={() => setBottomPanelCollapsed(true)} onBottomPanelHeightChange={setBottomPanelHeight}
              onChatInputChange={setChatInput} onChatSubmit={handleChatSubmit}
              branchName={statusBarBranch()} isSyncing={statusBarIsSyncing()} hasChanges={statusBarHasChanges()}
              languageName={statusBarLanguage()}
              onBranchClick={handleStatusBarBranchClick}
              onTogglePanel={handleStatusBarTogglePanel} onToggleTerminal={handleStatusBarToggleTerminal}
            />
          }
        />

        {/* AI Modifications Panel Overlay */}
        <Show when={showAIModifications()}>
          <Suspense>
            <CortexAIModificationsPanel
              onReviewFile={(filePath) => handleFileSelect(filePath)}
              onClose={() => setShowAIModifications(false)}
              style={{
                position: "absolute",
                right: "16px",
                top: "16px",
                bottom: "44px",
                width: "400px",
                "z-index": "90",
              }}
            />
          </Suspense>
        </Show>

        {/* Token Limit Display in IDE mode header area */}
        <Show when={mode() === "ide"}>
          <div style={{ position: "absolute", top: "8px", right: "16px", "z-index": "80" }}>
            <Suspense>
              <CortexTokenLimitDisplay modelName={dynamicModelName()} />
            </Suspense>
          </div>
        </Show>
      </main>

      {/* Update File View Modal */}
      <Show when={activeUpdateFile()}>
        {(update) => (
          <div style={{ position: "fixed", inset: "0", "z-index": "1000", display: "flex", "align-items": "center", "justify-content": "center", background: "var(--cortex-bg-overlay)" }} onClick={() => setActiveUpdateFile(null)}>
            <div style={{ width: "var(--cortex-width-modal-lg)", "max-height": "80vh" }} onClick={(e) => e.stopPropagation()}>
              <Suspense>
                <CortexUpdateFileViewPanel
                  update={update()}
                  onAccept={() => setActiveUpdateFile(null)}
                  onReject={() => setActiveUpdateFile(null)}
                  onClose={() => setActiveUpdateFile(null)}
                />
              </Suspense>
            </div>
          </div>
        )}
      </Show>

      <ViewNavigationHandlers
        setShowCommandPalette={commands.setShowCommandPalette}
        setShowFileFinder={commands.setShowFileFinder}
        setShowGoToLine={commands.setShowGoToLine}
        setSidebarTab={setSidebarTab}
        setSidebarCollapsed={setSidebarCollapsed}
        bottomPanelTab={bottomPanelTab}
        bottomPanelCollapsed={bottomPanelCollapsed}
        setBottomPanelTab={setBottomPanelTab}
        setBottomPanelCollapsed={setBottomPanelCollapsed}
        projectPath={projectPath}
      />

      <ApprovalDialog />
      <CortexNotifications />
      <NotificationHandler />

      <WindowResizers />

      {props.children}
    </div>
  );
}

export default CortexDesktopLayout;
