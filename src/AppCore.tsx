/**
 * AppCore.tsx - Heavy Application Core (Lazy Loaded)
 * 
 * This file contains the HEAVY part of the app:
 * - OptimizedProviders (68 context providers)
 * - All UI components and dialogs
 * - Hooks that depend on contexts
 * 
 * It is LAZY-LOADED by AppShell.tsx to ensure fast first paint.
 * The import chain:
 *   index.tsx -> AppShell.tsx (instant) -> lazy(AppCore.tsx) (deferred)
 */

// Startup timing
const CORE_LOAD_TIME = performance.now();
if (import.meta.env.DEV) console.log(`[STARTUP] AppCore.tsx module loading @ ${CORE_LOAD_TIME.toFixed(1)}ms`);

import { ParentProps, createSignal, onMount, onCleanup, createEffect, Show, lazy, Suspense, batch } from "solid-js";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { getWindowLabel } from "@/utils/windowStorage";
import { listen } from "@tauri-apps/api/event";
import { setProjectPath } from "@/utils/workspace";
import type { FeedbackType } from "@/components/FeedbackDialog";
import { DialogErrorBoundary } from "@/components/ErrorBoundary";

// Core providers wrapper - handles all context with Suspense
import { OptimizedProviders } from "@/context/OptimizedProviders";

// Hooks - safe to import since OptimizedProviders ensures they're available
import { useAuxiliaryWindowInfo } from "@/context/WindowsContext";
import { useToast } from "@/context/ToastContext";
import { useEditor } from "@/context/EditorContext";
import { useExtensions } from "@/context/ExtensionsContext";
import { useCommands } from "@/context/CommandContext";
import { useLayout } from "@/context/LayoutContext";

if (import.meta.env.DEV) console.log(`[STARTUP] AppCore imports done @ ${performance.now().toFixed(1)}ms`);

// ============================================================================
// Lazy-loaded UI Components - Grouped by usage pattern
// ============================================================================

// ALWAYS VISIBLE - Load immediately in first Suspense
const ToastManager = lazy(() => import("@/components/ToastManager").then(m => ({ default: m.ToastManager })));
const NotificationCenter = lazy(() => import("@/components/NotificationCenter").then(m => ({ default: m.NotificationCenter })));

// COMMAND PALETTE - Core UI, should load early
const CommandPalette = lazy(() => import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const ViewQuickAccess = lazy(() => import("@/components/ViewQuickAccess").then(m => ({ default: m.ViewQuickAccess })));
const PaletteCommandPalette = lazy(() => import("@/components/palette/CommandPalette").then(m => ({ default: m.PaletteCommandPalette })));
const PaletteQuickOpen = lazy(() => import("@/components/palette/QuickOpen").then(m => ({ default: m.PaletteQuickOpen })));

// DIALOGS - Only load when opened
const FeedbackDialog = lazy(() => import("@/components/FeedbackDialog").then(m => ({ default: m.FeedbackDialog })));
const SettingsDialog = lazy(() => import("@/components/SettingsDialog").then(m => ({ default: m.SettingsDialog })));
const AutoUpdateDialog = lazy(() => import("@/components/AutoUpdate").then(m => ({ default: m.AutoUpdateDialog })));
const CloneRepositoryDialog = lazy(() => import("@/components/git/CloneRepositoryDialog").then(m => ({ default: m.CloneRepositoryDialog })));
const EmmetWrapDialog = lazy(() => import("@/components/EmmetWrapDialog").then(m => ({ default: m.EmmetWrapDialog })));

// TERMINAL PANEL - Only when terminal is visible
const TerminalPanel = lazy(() => import("@/components/TerminalPanel").then(m => ({ default: m.TerminalPanel })));

// FILE PICKERS - Only when invoked
const FileFinder = lazy(() => import("@/components/FileFinder").then(m => ({ default: m.FileFinder })));
const BufferSearch = lazy(() => import("@/components/BufferSearch").then(m => ({ default: m.BufferSearch })));
const GoToLineDialog = lazy(() => import("@/components/cortex/dialogs/GoToLineDialog").then(m => ({ default: m.GoToLineDialog })));
const GoToSymbolDialog = lazy(() => import("@/components/cortex/dialogs/GoToSymbolDialog").then(m => ({ default: m.GoToSymbolDialog })));
const ProjectSearch = lazy(() => import("@/components/ProjectSearch").then(m => ({ default: m.ProjectSearch })));
const ProjectSymbols = lazy(() => import("@/components/ProjectSymbols").then(m => ({ default: m.ProjectSymbols })));
const WorkspaceSymbolPicker = lazy(() => import("@/components/WorkspaceSymbolPicker").then(m => ({ default: m.WorkspaceSymbolPicker })));

// TASKS - Only when tasks panel is used
const TasksPanel = lazy(() => import("@/components/tasks").then(m => ({ default: m.TasksPanel })));
const TaskConfigEditor = lazy(() => import("@/components/tasks").then(m => ({ default: m.TaskConfigEditor })));
const TaskQuickPick = lazy(() => import("@/components/tasks").then(m => ({ default: m.TaskQuickPick })));
const TasksJsonEditor = lazy(() => import("@/components/tasks").then(m => ({ default: m.TasksJsonEditor })));

// REPL - Only when REPL is opened
const REPLPanel = lazy(() => import("@/components/repl").then(m => ({ default: m.REPLPanel })));

// DEV TOOLS - Only in dev mode
const ComponentPreview = lazy(() => import("@/components/dev").then(m => ({ default: m.ComponentPreview })));
const Inspector = lazy(() => import("@/components/dev").then(m => ({ default: m.Inspector })));
const InspectorProvider = lazy(() => import("@/context/InspectorContext").then(m => ({ default: m.InspectorProvider })));

// JOURNAL - Only when journal opened
const JournalPanel = lazy(() => import("@/components/Journal").then(m => ({ default: m.JournalPanel })));

// SNIPPETS - Only when snippets panel opened
const SnippetsPanel = lazy(() => import("@/components/snippets").then(m => ({ default: m.SnippetsPanel })));
const SnippetEditor = lazy(() => import("@/components/snippets").then(m => ({ default: m.SnippetEditor })));

// AI COMPONENTS - Only when AI features used
const PromptStore = lazy(() => import("@/components/ai").then(m => ({ default: m.PromptStore })));
const PromptEditor = lazy(() => import("@/components/ai").then(m => ({ default: m.PromptEditor })));
const QuickChat = lazy(() => import("@/components/ai").then(m => ({ default: m.QuickChat })));
const SubAgentManager = lazy(() => import("@/components/ai/SubAgentManager").then(m => ({ default: m.SubAgentManager })));

// EDITOR MODALS - Only when invoked
const TabSwitcher = lazy(() => import("@/components/editor/TabSwitcher").then(m => ({ default: m.TabSwitcher })));
const LanguageSelectorModal = lazy(() => import("@/components/editor/LanguageSelector").then(m => ({ default: m.LanguageSelectorModal })));
const EncodingPickerModal = lazy(() => import("@/components/editor/EncodingPicker").then(m => ({ default: m.EncodingPickerModal })));

// MISC UI
const WhichKey = lazy(() => import("@/components/WhichKey").then(m => ({ default: m.WhichKey })));
const BookmarksPanel = lazy(() => import("@/components/BookmarksPanel").then(m => ({ default: m.BookmarksPanel })));
const ScreencastMode = lazy(() => import("@/components/ScreencastMode").then(m => ({ default: m.ScreencastMode })));
const AuxiliaryWindow = lazy(() => import("@/components/AuxiliaryWindow").then(m => ({ default: m.AuxiliaryWindow })));

// PROFILES
const ProfileSwitcher = lazy(() => import("@/components/profiles").then(m => ({ default: m.ProfileSwitcher })));
const ProfileManager = lazy(() => import("@/components/profiles").then(m => ({ default: m.ProfileManager })));
const ProfileCommands = lazy(() => import("@/components/profiles").then(m => ({ default: m.ProfileCommands })));

// EXTENSIONS
const ExtensionProfilerCommands = lazy(() => import("@/components/extensions").then(m => ({ default: m.ExtensionProfilerCommands })));

// TERMINAL TOOLS
const TerminalToolsCommands = lazy(() => import("@/components/terminal/TerminalToolsCommands").then(m => ({ default: m.TerminalToolsCommands })));

// CODE NAVIGATION
const ReferencesView = lazy(() => import("@/components/ReferencesView").then(m => ({ default: m.ReferencesView })));
const CallHierarchyPanel = lazy(() => import("@/components/CallHierarchyView").then(m => ({ default: m.CallHierarchyPanel })));
const TypeHierarchyView = lazy(() => import("@/components/TypeHierarchyView").then(m => ({ default: m.TypeHierarchyView })));

// SEARCH
const SearchEditorWithState = lazy(() => import("@/components/SearchEditor").then(m => {
  const Wrapper = () => {
    const { SearchEditorComponent } = m.useSearchEditor();
    return SearchEditorComponent();
  };
  return { default: Wrapper };
}));
const SearchInOpenEditorsWithState = lazy(() => import("@/components/search/SearchInOpenEditors").then(m => {
  const Wrapper = () => {
    const { SearchInOpenEditorsComponent } = m.useSearchInOpenEditors();
    return SearchInOpenEditorsComponent();
  };
  return { default: Wrapper };
}));

// DEBUG
const StepInTargetsMenuGlobal = lazy(() => import("@/components/debugger/StepInTargetsMenu").then(m => ({ default: m.StepInTargetsMenuGlobal })));
const DebugKeyboardHandler = lazy(() => import("@/components/debugger/DebugKeyboardHandler").then(m => ({ default: m.DebugKeyboardHandler })));

// ============================================================================
// Deep Link Types
// ============================================================================
interface DeepLinkOpenFile { type: "OpenFile"; payload: { path: string }; }
interface DeepLinkOpenFolder { type: "OpenFolder"; payload: { path: string }; }
interface DeepLinkOpenSettings { type: "OpenSettings"; payload: { section: string }; }
interface DeepLinkUnknown { type: "Unknown"; payload: { raw_url: string }; }
type DeepLinkAction = DeepLinkOpenFile | DeepLinkOpenFolder | DeepLinkOpenSettings | DeepLinkUnknown;

// ============================================================================
// MCP Listeners - Deferred initialization
// ============================================================================
let mcpCleanup: (() => void) | null = null;

async function initMcpListeners() {
  const { setupMcpListeners, cleanupMcpListeners } = await import("@/utils/mcp-listeners");
  await setupMcpListeners();
  mcpCleanup = cleanupMcpListeners;
}

// ============================================================================
// Helper Components - Now safe to use hooks directly
// ============================================================================

/** Registers extension commands with the command palette */
function ExtensionCommandRegistrar(): null {
  const extensions = useExtensions();
  const commands = useCommands();
  
  createEffect(() => {
    const currentExtensions = extensions.enabledExtensions();
    const cmds = currentExtensions.flatMap(ext => 
      (ext.manifest?.contributes?.commands || []).map(contrib => ({
        id: contrib.command,
        label: contrib.title,
        category: contrib.category || ext.manifest?.name || 'Unknown',
        action: () => extensions.executeExtensionCommand(contrib.command)
      }))
    );
    
    cmds.forEach(cmd => commands.registerCommand(cmd));
    
    onCleanup(() => {
      cmds.forEach(cmd => commands.unregisterCommand(cmd.id));
    });
  });
  
  return null;
}

/** Listens for extension notifications */
function ExtensionNotificationListener(): null {
  const toast = useToast();
  let unlisten: (() => void) | undefined;

  onCleanup(() => unlisten?.());

  onMount(async () => {
    unlisten = await listen("extension:notification", (event: any) => {
      const payload = event?.payload;
      if (!payload) return;
      const { type, message } = payload;
      if (type === "info") toast.info(message);
      else if (type === "error") toast.error(message);
    });
  });

  return null;
}

/** Handles cortex:// deep link events */
function DeepLinkHandler(): null {
  const toast = useToast();
  const editor = useEditor();
  let unlisten: (() => void) | undefined;

  onCleanup(() => unlisten?.());

  onMount(async () => {
    unlisten = await listen<DeepLinkAction>("deep:link", async (event) => {
      const action = event.payload;
      if (import.meta.env.DEV) console.log("[DeepLink] Received:", action);

      switch (action.type) {
        case "OpenFile": {
          try {
            await editor.openFile(action.payload.path);
            toast.info(`Opened: ${action.payload.path.split(/[\\/]/).pop()}`);
          } catch (err) {
            toast.error(`Failed to open: ${action.payload.path}`);
          }
          break;
        }
        case "OpenFolder": {
          setProjectPath(action.payload.path);
          localStorage.setItem(`cortex_current_project_${getWindowLabel()}`, action.payload.path);
          window.dispatchEvent(new CustomEvent("workspace:change", { detail: { path: action.payload.path } }));
          toast.info(`Opening: ${action.payload.path.split(/[\\/]/).pop()}`);
          setTimeout(() => window.location.reload(), 100);
          break;
        }
        case "OpenSettings": {
          window.dispatchEvent(new CustomEvent("settings:open-tab"));
          break;
        }
        case "Unknown": {
          toast.error("Unknown deep link format");
          break;
        }
      }
    });
  });

  return null;
}

// ============================================================================
// MAIN APP CONTENT - Rendered inside OptimizedProviders
// ============================================================================
function AppContent(props: ParentProps) {
  const windowInfo = useAuxiliaryWindowInfo();
  const layout = useLayout();
  
  // Dialog states
  const [showFeedback, setShowFeedback] = createSignal(false);
  const [feedbackType, setFeedbackType] = createSignal<FeedbackType>("general");
  const [showSettings, setShowSettings] = createSignal(false);
  const [settingsInitialJsonView, setSettingsInitialJsonView] = createSignal(false);
  const [settingsInitialShowDefaults, setSettingsInitialShowDefaults] = createSignal(false);
  const [showTasksJsonEditor, setShowTasksJsonEditor] = createSignal(false);
  const [showCloneRepository, setShowCloneRepository] = createSignal(false);
  const [cloneLoading, setCloneLoading] = createSignal(false);
  
  // Feature visibility states - used to gate lazy loading
  const [devToolsEnabled, setDevToolsEnabled] = createSignal(false);
  const [terminalUsed, setTerminalUsed] = createSignal(false);
  const [replUsed, setReplUsed] = createSignal(false);
  const [journalUsed, setJournalUsed] = createSignal(false);
  const [snippetsUsed, setSnippetsUsed] = createSignal(false);
  const [aiUsed, setAiUsed] = createSignal(false);
  const [tasksUsed, setTasksUsed] = createSignal(false);
  const [bookmarksUsed, setBookmarksUsed] = createSignal(false);
  const [debugUsed, setDebugUsed] = createSignal(false);

  // Event handlers
  const handleFeedbackOpen = (e: CustomEvent<{ type?: FeedbackType }>) => {
    batch(() => {
      if (e.detail?.type) setFeedbackType(e.detail.type);
      setShowFeedback(true);
    });
  };

  const [settingsInitialSection, setSettingsInitialSection] = createSignal<string | undefined>(undefined);
  
  const handleSettingsOpen = (e: Event) => {
    const custom = e as CustomEvent<{ jsonView?: boolean; showDefaults?: boolean; section?: string }>;
    batch(() => {
      setSettingsInitialJsonView(custom.detail?.jsonView ?? false);
      setSettingsInitialShowDefaults(custom.detail?.showDefaults ?? false);
      setSettingsInitialSection(custom.detail?.section);
      setShowSettings(true);
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "u") {
      e.preventDefault();
      setFeedbackType("general");
      setShowFeedback(true);
    }
    if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === ",") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("settings:open-tab"));
    }
  };

  const handleCloneRepository = async (url: string, targetDir: string, _openAfterClone: boolean) => {
    setCloneLoading(true);
    setTerminalUsed(true); // Enable terminal when cloning
    try {
      window.dispatchEvent(new CustomEvent("terminal:new"));
      await new Promise(r => setTimeout(r, 500));
      window.dispatchEvent(new CustomEvent("terminal:write-active", { 
        detail: { data: `git clone "${url}" "${targetDir}"\n` } 
      }));
      setShowCloneRepository(false);
    } finally {
      setCloneLoading(false);
    }
  };

  onMount(() => {
    if (import.meta.env.DEV) console.log(`[STARTUP] AppContent mounted @ ${performance.now().toFixed(1)}ms`);
    
    // Event listeners for core functionality
    window.addEventListener("feedback:open", handleFeedbackOpen as EventListener);
    window.addEventListener("settings:open", handleSettingsOpen);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("tasks:open-json-editor", () => setShowTasksJsonEditor(true));
    window.addEventListener("git:clone-repository", () => setShowCloneRepository(true));
    
    // Feature activation listeners - gate lazy loading
    window.addEventListener("terminal:new", () => setTerminalUsed(true));
    window.addEventListener("terminal:open", () => setTerminalUsed(true));
    window.addEventListener("repl:open", () => setReplUsed(true));
    window.addEventListener("journal:open", () => setJournalUsed(true));
    window.addEventListener("snippets:open", () => setSnippetsUsed(true));
    window.addEventListener("ai:open", () => setAiUsed(true));
    window.addEventListener("tasks:open", () => setTasksUsed(true));
    window.addEventListener("bookmarks:open", () => setBookmarksUsed(true));
    window.addEventListener("debug:start", () => setDebugUsed(true));
    window.addEventListener("dev:inspector", () => setDevToolsEnabled(true));

    // Deferred MCP initialization
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => initMcpListeners(), { timeout: 2000 });
    } else {
      setTimeout(initMcpListeners, 500);
    }

    // Window state tracking
    const appWindow = getCurrentWebviewWindow();
    const label = getWindowLabel();

    const updateState = async () => {
      try {
        const factor = await appWindow.scaleFactor();
        const pos = await appWindow.outerPosition();
        const size = await appWindow.innerSize();
        const maximized = await appWindow.isMaximized();
        
        await invoke("update_window_state", {
          label,
          x: pos.toLogical(factor).x,
          y: pos.toLogical(factor).y,
          width: size.toLogical(factor).width,
          height: size.toLogical(factor).height,
          isMaximized: maximized
        });
      } catch (err) { console.debug("Failed to get window state:", err); }
    };

    updateState();

    const listeners: (() => void)[] = [];
    appWindow.onResized(updateState).then(u => listeners.push(u));
    appWindow.onMoved(updateState).then(u => listeners.push(u));

    onCleanup(() => listeners.forEach(u => u()));
  });

  onCleanup(() => {
    window.removeEventListener("feedback:open", handleFeedbackOpen as EventListener);
    window.removeEventListener("settings:open", handleSettingsOpen);
    window.removeEventListener("keydown", handleKeyDown);
    if (mcpCleanup) mcpCleanup();
    invoke("unregister_window", { label: getWindowLabel() }).catch(() => {});
  });

  // Reactive: enable terminal when panel is visible with terminal active
  createEffect(() => {
    if (layout.state.panel.visible && layout.state.panel.activeViewId === "terminal") {
      setTerminalUsed(true);
    }
  });

  return (
    <Show when={windowInfo.isAuxiliaryWindow} fallback={
      <>
        <Show when={props.children} fallback={<div class="p-4 text-white">Route not found</div>}>
          {props.children}
        </Show>
        
        {/* Helper components - hooks are now safe */}
        <ExtensionCommandRegistrar />
        <ExtensionNotificationListener />
        <DeepLinkHandler />
        
        {/* ============================================================ */}
        {/* TIER 1: ALWAYS VISIBLE - Critical UI */}
        {/* ============================================================ */}
        <Suspense>
          <ToastManager />
          <NotificationCenter />
          <CommandPalette />
          <PaletteCommandPalette />
          <PaletteQuickOpen />
          <ViewQuickAccess />
          <WhichKey />
          <ScreencastMode />
          <AutoUpdateDialog />
          
          {/* Profile management - lightweight */}
          <ProfileSwitcher />
          <ProfileManager />
          <ProfileCommands />
          <ExtensionProfilerCommands />
        </Suspense>
        
        {/* ============================================================ */}
        {/* TIER 2: FILE NAVIGATION - Load early for productivity */}
        {/* ============================================================ */}
        <Suspense>
          <FileFinder />
          <BufferSearch />
          <GoToLineDialog />
          <GoToSymbolDialog />
          <ProjectSearch />
          <SearchEditorWithState />
          <SearchInOpenEditorsWithState />
          <ProjectSymbols />
          <WorkspaceSymbolPicker />
          <TabSwitcher />
          <LanguageSelectorModal />
          <EncodingPickerModal />
        </Suspense>
        
        {/* ============================================================ */}
        {/* TIER 3: CODE NAVIGATION - Load on demand */}
        {/* ============================================================ */}
        <Suspense>
          <ReferencesView />
          <CallHierarchyPanel />
          <TypeHierarchyView />
        </Suspense>
        
        {/* ============================================================ */}
        {/* TIER 4: GATED FEATURES - Only load when first used */}
        {/* ============================================================ */}
        
        {/* Terminal - Only when terminal panel visible or explicitly opened */}
        <Show when={terminalUsed() || layout.state.panel.visible}>
          <Suspense>
            <TerminalPanel />
            <TerminalToolsCommands />
          </Suspense>
        </Show>
        
        {/* REPL - Only when REPL opened */}
        <Show when={replUsed()}>
          <Suspense>
            <REPLPanel />
          </Suspense>
        </Show>
        
        {/* Tasks - Only when tasks used */}
        <Show when={tasksUsed() || showTasksJsonEditor()}>
          <Suspense>
            <TasksPanel />
            <TaskConfigEditor />
            <TaskQuickPick />
            <TasksJsonEditor isOpen={showTasksJsonEditor()} onClose={() => setShowTasksJsonEditor(false)} />
          </Suspense>
        </Show>
        
        {/* Journal - Only when journal opened */}
        <Show when={journalUsed()}>
          <Suspense>
            <JournalPanel />
          </Suspense>
        </Show>
        
        {/* Snippets - Only when snippets panel opened */}
        <Show when={snippetsUsed()}>
          <Suspense>
            <SnippetsPanel />
            <SnippetEditor />
          </Suspense>
        </Show>
        
        {/* AI Components - Only when AI features used */}
        <Show when={aiUsed()}>
          <Suspense>
            <PromptStore />
            <PromptEditor />
            <QuickChat />
            <SubAgentManager />
          </Suspense>
        </Show>
        
        {/* Bookmarks - Only when bookmarks panel opened */}
        <Show when={bookmarksUsed()}>
          <Suspense>
            <BookmarksPanel />
          </Suspense>
        </Show>
        
        {/* Debug - Only when debugging started */}
        <Show when={debugUsed()}>
          <Suspense>
            <StepInTargetsMenuGlobal />
            <DebugKeyboardHandler />
          </Suspense>
        </Show>
        
        {/* Dev Tools - Only when inspector activated */}
        <Show when={devToolsEnabled()}>
          <Suspense>
            <ComponentPreview />
            <InspectorProvider><Inspector /></InspectorProvider>
          </Suspense>
        </Show>
        
        {/* ============================================================ */}
        {/* DIALOGS - Only load when explicitly opened */}
        {/* ============================================================ */}
        
        <Show when={showFeedback()}>
          <Suspense>
            <DialogErrorBoundary name="FeedbackDialog">
              <FeedbackDialog isOpen={showFeedback()} onClose={() => setShowFeedback(false)} initialType={feedbackType()} />
            </DialogErrorBoundary>
          </Suspense>
        </Show>
        
        <Show when={showSettings()}>
          <Suspense>
            <DialogErrorBoundary name="SettingsDialog">
              <SettingsDialog
                isOpen={showSettings()}
                onClose={() => { batch(() => { setShowSettings(false); setSettingsInitialJsonView(false); setSettingsInitialShowDefaults(false); setSettingsInitialSection(undefined); }); }}
                initialJsonView={settingsInitialJsonView()}
                initialShowDefaults={settingsInitialShowDefaults()}
                initialSection={settingsInitialSection()}
              />
            </DialogErrorBoundary>
          </Suspense>
        </Show>
        
        <Show when={showCloneRepository()}>
          <Suspense>
            <DialogErrorBoundary name="CloneRepositoryDialog">
              <CloneRepositoryDialog
                open={showCloneRepository()}
                onClone={handleCloneRepository}
                onCancel={() => setShowCloneRepository(false)}
                loading={cloneLoading()}
              />
            </DialogErrorBoundary>
          </Suspense>
        </Show>
        
        {/* Emmet wrap dialog - usually invoked via shortcut */}
        <Suspense>
          <EmmetWrapDialog />
        </Suspense>
      </>
    }>
      <Suspense>
        <AuxiliaryWindow />
      </Suspense>
    </Show>
  );
}

// ============================================================================
// ROOT APP CORE COMPONENT
// ============================================================================
export default function AppCore(props: ParentProps) {
  if (import.meta.env.DEV) console.log(`[STARTUP] AppCore rendering @ ${performance.now().toFixed(1)}ms`);
  
  return (
    <OptimizedProviders>
      <AppContent {...props}>{props.children}</AppContent>
    </OptimizedProviders>
  );
}
