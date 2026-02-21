/**
 * OptimizedProviders - Two-Tier Provider Loading
 * 
 * PERFORMANCE STRATEGY:
 * - Tier 1 (Essential): ~15 providers loaded synchronously for first meaningful paint
 * - Tier 2 (Deferred): ~53 providers loaded after first paint via requestIdleCallback
 * - Heavy COMPONENTS (Monaco, Terminal, etc.) are lazy-loaded in Layout.tsx
 * - IPC calls in providers are DEFERRED to not block first paint
 * 
 * This ensures:
 * 1. First paint is fast with only essential providers
 * 2. Deferred providers mount after idle callback
 * 3. All useXxx() hooks work immediately once children render
 * 4. App shell renders fast, heavy components load progressively
 */

const PROVIDERS_START = performance.now();
if (import.meta.env.DEV) console.log(`[STARTUP] OptimizedProviders.tsx module loading @ ${PROVIDERS_START.toFixed(1)}ms`);

import { ParentProps, JSX, ErrorBoundary, createSignal, onMount, Show } from "solid-js";

// ============================================================================
// ERROR FALLBACK
// ============================================================================
function ErrorFallback(err: Error): JSX.Element {
  return (
    <div class="h-screen w-screen flex flex-col items-center justify-center bg-[#1e1e1e] text-white p-8">
      <h1 class="text-xl font-bold mb-4 text-red-500">Failed to Initialize</h1>
      <p class="text-sm mb-4 opacity-80">The application could not load its core systems.</p>
      <pre class="bg-black/50 p-4 rounded text-xs max-w-2xl overflow-auto border border-white/10 mb-4">
        {err.toString()}
      </pre>
      <button 
        onClick={() => window.location.reload()}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
      >
        Reload Application
      </button>
    </div>
  );
}

// ============================================================================
// TIER 1: ESSENTIAL PROVIDERS - Synchronous, needed for first meaningful paint
// ============================================================================
import { I18nProvider } from "@/context/I18nContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CortexColorThemeProvider } from "@/context/CortexColorThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { SDKProvider } from "@/context/SDKContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { CommandProvider } from "@/context/CommandContext";
import { EditorProvider } from "@/context/EditorContext";
import { KeymapProvider } from "@/context/KeymapContext";
import { WindowsProvider } from "@/context/WindowsContext";
import { LayoutProvider } from "@/context/LayoutContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { SearchProvider } from "@/context/SearchContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { EditorFeaturesProvider } from "@/context/editor/EditorFeaturesProvider";

// ============================================================================
// TIER 2: DEFERRED PROVIDERS - Loaded after first paint
// ============================================================================
import { ColorCustomizationsProvider } from "@/context/ColorCustomizationsContext";
import { TokenColorCustomizationsProvider } from "@/context/TokenColorCustomizationsContext";
import { ActivityIndicatorProvider } from "@/context/ActivityIndicatorContext";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { FileIconThemeProvider } from "@/context/theme/IconThemeProvider";
import { ProductIconThemeProvider } from "@/context/theme/ProductIconTheme";
import { AccessibilityProvider } from "@/context/AccessibilityContext";
import { ZenModeProvider } from "@/components/ZenMode";
import { RecentProjectsProvider } from "@/context/RecentProjectsContext";
import { AutoUpdateProvider } from "@/context/AutoUpdateContext";
import { ExtensionsProvider } from "@/context/ExtensionsContext";
import { LLMProvider } from "@/context/LLMContext";
import { AIProvider } from "@/context/AIContext";
import { SessionProvider } from "@/context/SessionContext";
import { LSPProvider } from "@/context/LSPContext";
import { DiagnosticsProvider } from "@/context/DiagnosticsContext";
import { OutputProvider } from "@/context/OutputContext";
import { NavigationHistoryProvider } from "@/context/NavigationHistoryContext";
import { FileOperationsProvider } from "@/context/FileOperationsContext";
import { FormatterProvider } from "@/context/FormatterContext";
import { LanguageSelectorProvider } from "@/context/LanguageSelectorContext";
import { EncodingProvider } from "@/context/EncodingContext";
import { TabSwitcherProvider } from "@/context/TabSwitcherContext";
import { WhichKeyProvider } from "@/context/WhichKeyContext";
import { QuickInputProvider } from "@/context/QuickInputContext";
import { QuickPickProvider } from "@/context/QuickPickContext";
import { BookmarksProvider } from "@/context/BookmarksContext";
import { SemanticSearchProvider } from "@/context/SemanticSearchContext";
import { OutlineProvider } from "@/context/OutlineContext";
import { ExtensionRecommendationsProvider } from "@/context/ExtensionRecommendationsContext";
import { TerminalsProvider } from "@/context/TerminalsContext";
import { PreviewProvider } from "@/context/PreviewContext";
import { PlanProvider } from "@/context/PlanContext";
import { GitHostingProvider } from "@/context/GitHostingContext";
import { GitMergeProvider } from "@/context/GitMergeContext";
import { MultiRepoProvider } from "@/context/MultiRepoContext";
import { AgentFollowProvider } from "@/context/AgentFollowContext";
import { SubAgentProvider } from "@/context/SubAgentContext";
import { ToolchainProvider } from "@/context/ToolchainContext";
import { RemoteProvider } from "@/context/RemoteContext";
import { VimProvider } from "@/context/VimContext";
import { CollabProvider } from "@/context/CollabContext";
import { CollabSyncProvider } from "@/context/CollabSyncContext";
import { ChannelsProvider } from "@/context/ChannelsContext";
import { JournalProvider } from "@/context/JournalContext";
import { TasksProvider } from "@/context/TasksContext";
import { REPLProvider } from "@/context/REPLContext";
import { DebugProvider } from "@/context/DebugContext";
import { TestingProvider } from "@/context/TestingContext";
import { SnippetsProvider } from "@/context/SnippetsContext";
import { PromptStoreProvider } from "@/context/PromptStoreContext";
import { SupermavenProvider } from "@/context/SupermavenContext";
import { TimelineProvider } from "@/context/TimelineContext";
import { WorkspaceSymbolsProvider } from "@/context/WorkspaceSymbolsContext";
import { TunnelProvider } from "@/context/TunnelContext";
import { PullRequestProvider } from "@/context/PullRequestContext";
import { MergeEditorProvider } from "@/context/merge/MergeEditorProvider";
import { DiffEditorProvider } from "@/context/diff/DiffEditorProvider";
import { TabsProvider } from "@/context/editor/TabsProvider";
import { CommandPaletteProvider } from "@/context/CommandPaletteContext";

if (import.meta.env.DEV) console.log(`[STARTUP] All provider imports done @ ${performance.now().toFixed(1)}ms (${(performance.now() - PROVIDERS_START).toFixed(1)}ms for imports)`);

// ============================================================================
// DEFERRED PROVIDERS COMPONENT
// Wraps Tier 2 providers, mounted after first paint via requestIdleCallback.
// Children are only rendered once all deferred providers are ready,
// ensuring useXxx() hooks always find their provider.
// ============================================================================
function DeferredProviders(props: ParentProps): JSX.Element {
  const [ready, setReady] = createSignal(false);

  onMount(() => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setReady(true));
    } else {
      setTimeout(() => setReady(true), 0);
    }
  });

  if (import.meta.env.DEV) {
    onMount(() => {
      const check = setInterval(() => {
        if (ready()) {
          console.log(`[STARTUP] DeferredProviders ready @ ${performance.now().toFixed(1)}ms`);
          clearInterval(check);
        }
      }, 10);
    });
  }

  return (
    <Show when={ready()}>
      {/* Tier 2: Deferred providers - order preserved for dependency correctness */}
      <ColorCustomizationsProvider>
      <TokenColorCustomizationsProvider>
      <ActivityIndicatorProvider>
      <ProfilesProvider>
      <FileIconThemeProvider>
      <ProductIconThemeProvider>

      <AccessibilityProvider>
      <ZenModeProvider>
      <RecentProjectsProvider>
      <AutoUpdateProvider>
      <ExtensionsProvider>
      <LLMProvider>
      <AIProvider>
      <SessionProvider>
      <LSPProvider>
      <DiagnosticsProvider>
      <OutputProvider>
      <NavigationHistoryProvider>
      <FileOperationsProvider>
      <FormatterProvider>
      <LanguageSelectorProvider>
      <EncodingProvider>
      <TabSwitcherProvider>
      <WhichKeyProvider>
      <QuickInputProvider>
      <QuickPickProvider>
      <BookmarksProvider>
      <SemanticSearchProvider>
      <OutlineProvider>
      <ExtensionRecommendationsProvider>

      <TerminalsProvider>
      <PreviewProvider>
      <PlanProvider>
      <GitHostingProvider>
      <GitMergeProvider>
      <MultiRepoProvider>
      <AgentFollowProvider>
      <SubAgentProvider>
      <ToolchainProvider>
      <RemoteProvider>
      <VimProvider>
      <CollabProvider>
      <CollabSyncProvider>
      <ChannelsProvider>
      <JournalProvider>
      <TasksProvider>
      <REPLProvider>
      <DebugProvider>
      <TestingProvider>
      <SnippetsProvider>
      <PromptStoreProvider>
      <SupermavenProvider>
      <TimelineProvider>
      <WorkspaceSymbolsProvider>
      <TunnelProvider>
      <PullRequestProvider>
      <CommandPaletteProvider>
      <MergeEditorProvider>
      <DiffEditorProvider>
      <TabsProvider>

        {props.children}

      </TabsProvider>
      </DiffEditorProvider>
      </MergeEditorProvider>
      </CommandPaletteProvider>
      </PullRequestProvider>
      </TunnelProvider>
      </WorkspaceSymbolsProvider>
      </TimelineProvider>
      </SupermavenProvider>
      </PromptStoreProvider>
      </SnippetsProvider>
      </TestingProvider>
      </DebugProvider>
      </REPLProvider>
      </TasksProvider>
      </JournalProvider>
      </ChannelsProvider>
      </CollabSyncProvider>
      </CollabProvider>
      </VimProvider>
      </RemoteProvider>
      </ToolchainProvider>
      </SubAgentProvider>
      </AgentFollowProvider>
      </MultiRepoProvider>
      </GitMergeProvider>
      </GitHostingProvider>
      </PlanProvider>
      </PreviewProvider>
      </TerminalsProvider>

      </ExtensionRecommendationsProvider>
      </OutlineProvider>
      </SemanticSearchProvider>
      </BookmarksProvider>
      </QuickPickProvider>
      </QuickInputProvider>
      </WhichKeyProvider>
      </TabSwitcherProvider>
      </EncodingProvider>
      </LanguageSelectorProvider>
      </FormatterProvider>
      </FileOperationsProvider>
      </NavigationHistoryProvider>
      </OutputProvider>
      </DiagnosticsProvider>
      </LSPProvider>
      </SessionProvider>
      </AIProvider>
      </LLMProvider>
      </ExtensionsProvider>
      </AutoUpdateProvider>
      </RecentProjectsProvider>
      </ZenModeProvider>
      </AccessibilityProvider>

      </ProductIconThemeProvider>
      </FileIconThemeProvider>
      </ProfilesProvider>
      </ActivityIndicatorProvider>
      </TokenColorCustomizationsProvider>
      </ColorCustomizationsProvider>
    </Show>
  );
}

// ============================================================================
// MAIN EXPORT - Two-tier provider loading
// 
// Tier 1: Essential providers loaded synchronously (first meaningful paint)
// Tier 2: Deferred providers loaded after requestIdleCallback
// ============================================================================
export function OptimizedProviders(props: ParentProps): JSX.Element {
  if (import.meta.env.DEV) console.log(`[STARTUP] OptimizedProviders rendering @ ${performance.now().toFixed(1)}ms`);
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      {/* Tier 1: Essential providers - always available immediately */}
      <I18nProvider>
      <ThemeProvider>
      <CortexColorThemeProvider>
      <ToastProvider>
      <SDKProvider>
      <SettingsProvider>
      <CommandProvider>
      <KeymapProvider>
      <WindowsProvider>
      <LayoutProvider>
      <NotificationsProvider>
      <SearchProvider>
      <WorkspaceProvider>
      <EditorProvider>
      <EditorFeaturesProvider>

        {/* Tier 2: Deferred providers - mounted after first paint */}
        <DeferredProviders>
          {props.children}
        </DeferredProviders>

      </EditorFeaturesProvider>
      </EditorProvider>
      </WorkspaceProvider>
      </SearchProvider>
      </NotificationsProvider>
      </LayoutProvider>
      </WindowsProvider>
      </KeymapProvider>
      </CommandProvider>
      </SettingsProvider>
      </SDKProvider>
      </ToastProvider>
      </CortexColorThemeProvider>
      </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default OptimizedProviders;
