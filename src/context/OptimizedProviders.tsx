/**
 * OptimizedProviders - All Providers SYNCHRONOUS
 * 
 * PERFORMANCE STRATEGY:
 * - Providers are SMALL (~2-10KB each) - no need to lazy load them
 * - Providers MUST be sync so contexts are immediately available
 * - Heavy COMPONENTS (Monaco, Terminal, etc.) are lazy-loaded in Layout.tsx
 * - IPC calls in providers are DEFERRED to not block first paint
 * 
 * This ensures:
 * 1. All useXxx() hooks work immediately
 * 2. No "must be used within Provider" errors
 * 3. App shell renders fast, heavy components load progressively
 */

const PROVIDERS_START = performance.now();
if (import.meta.env.DEV) console.log(`[STARTUP] OptimizedProviders.tsx module loading @ ${PROVIDERS_START.toFixed(1)}ms`);

import { ParentProps, JSX, ErrorBoundary } from "solid-js";

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
// ALL PROVIDERS - SYNCHRONOUS IMPORTS
// Providers are small and MUST be available immediately for hooks to work
// ============================================================================

// Tier 1: Core (absolutely essential)
import { I18nProvider } from "@/context/I18nContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CortexColorThemeProvider } from "@/context/CortexColorThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { WindowsProvider } from "@/context/WindowsContext";
import { LayoutProvider } from "@/context/LayoutContext";

// Tier 2: SDK & Infrastructure
import { ColorCustomizationsProvider } from "@/context/ColorCustomizationsContext";
import { TokenColorCustomizationsProvider } from "@/context/TokenColorCustomizationsContext";
import { SDKProvider } from "@/context/SDKContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { ActivityIndicatorProvider } from "@/context/ActivityIndicatorContext";
import { ProfilesProvider } from "@/context/ProfilesContext";
import { FileIconThemeProvider } from "@/context/theme/IconThemeProvider";
import { ProductIconThemeProvider } from "@/context/theme/ProductIconTheme";

// Tier 3: Editor & Workspace
import { KeymapProvider } from "@/context/KeymapContext";
import { CommandProvider } from "@/context/CommandContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { EditorProvider } from "@/context/EditorContext";
import { EditorFeaturesProvider } from "@/context/editor/EditorFeaturesProvider";

// Tier 4: Features
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
import { SearchProvider } from "@/context/SearchContext";
import { OutlineProvider } from "@/context/OutlineContext";
import { ExtensionRecommendationsProvider } from "@/context/ExtensionRecommendationsContext";

// Tier 5: Development Tools
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
import { FactoryProvider } from "@/context/FactoryContext";
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
// MAIN EXPORT - All providers nested synchronously
// 
// This is the CORRECT approach for SolidJS:
// - All providers load upfront (they're small, ~2-10KB each)
// - Heavy components (Monaco, Terminal) are lazy in Layout.tsx
// - Hooks always find their provider immediately
// ============================================================================
export function OptimizedProviders(props: ParentProps): JSX.Element {
  if (import.meta.env.DEV) console.log(`[STARTUP] OptimizedProviders rendering @ ${performance.now().toFixed(1)}ms`);
  return (
    <ErrorBoundary fallback={ErrorFallback}>
      {/* Tier 1: Core */}
      <I18nProvider>
      <ThemeProvider>
      <CortexColorThemeProvider>
      <ToastProvider>
      <SettingsProvider>
      <WindowsProvider>
      <LayoutProvider>
      
      {/* Tier 2: SDK & Infrastructure */}
      <ColorCustomizationsProvider>
      <TokenColorCustomizationsProvider>
      <SDKProvider>
      <NotificationsProvider>
      <ActivityIndicatorProvider>
      <ProfilesProvider>
      <FileIconThemeProvider>
      <ProductIconThemeProvider>
      
      {/* Tier 3: Editor & Workspace */}
      <KeymapProvider>
      <CommandProvider>
      <WorkspaceProvider>
      <EditorProvider>
      <EditorFeaturesProvider>
      
      {/* Tier 4: Features */}
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
      <SearchProvider>
      <OutlineProvider>
      <ExtensionRecommendationsProvider>
      
      {/* Tier 5: Development Tools */}
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
      <FactoryProvider>
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
      </FactoryProvider>
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
      </SearchProvider>
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
      
      </EditorFeaturesProvider>
      </EditorProvider>
      </WorkspaceProvider>
      </CommandProvider>
      </KeymapProvider>
      
      </ProductIconThemeProvider>
      </FileIconThemeProvider>
      </ProfilesProvider>
      </ActivityIndicatorProvider>
      </NotificationsProvider>
      </SDKProvider>
      </TokenColorCustomizationsProvider>
      </ColorCustomizationsProvider>
      
      </LayoutProvider>
      </WindowsProvider>
      </SettingsProvider>
      </ToastProvider>
      </CortexColorThemeProvider>
      </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default OptimizedProviders;