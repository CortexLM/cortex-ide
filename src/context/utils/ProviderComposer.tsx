import { ParentProps, JSX, createSignal, Show, onMount } from "solid-js";

/**
 * ProviderComposer utility for composing multiple providers without deep nesting.
 * This improves code readability and makes it easier to manage the provider tree.
 * 
 * Usage:
 * ```tsx
 * <ProviderComposer providers={[
 *   ThemeProvider,
 *   ToastProvider,
 *   SDKProvider,
 * ]}>
 *   <App />
 * </ProviderComposer>
 * ```
 */

// Provider component type that accepts ParentProps (with optional children)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProviderComponent = (props: any) => JSX.Element;

interface ProviderComposerProps extends ParentProps {
  providers: ProviderComponent[];
}

/**
 * Composes multiple context providers into a single component.
 * Providers are applied in order (first provider wraps everything).
 */
export function ProviderComposer(props: ProviderComposerProps): JSX.Element {
  return props.providers.reduceRight<JSX.Element>(
    (acc, Provider) => <Provider>{acc}</Provider>,
    props.children as JSX.Element
  );
}

/**
 * Creates a provider group that can be conditionally loaded.
 * Useful for grouping related providers that can be lazy-loaded together.
 */
export function createProviderGroup(
  providers: ProviderComponent[],
  displayName?: string
): ProviderComponent {
  const GroupedProvider: ProviderComponent = (props) => (
    <ProviderComposer providers={providers}>{props.children}</ProviderComposer>
  );
  
  if (displayName) {
    Object.defineProperty(GroupedProvider, "name", { value: displayName });
  }
  
  return GroupedProvider;
}

/**
 * Creates a deferred provider group that only mounts after the initial render.
 * This can improve startup performance by deferring non-critical providers.
 */
export function createDeferredProviderGroup(
  providers: ProviderComponent[],
  displayName?: string
): ProviderComponent {
  const DeferredProvider: ProviderComponent = (props) => {
    const [mounted, setMounted] = createSignal(false);
    
    onMount(() => {
      // Defer mounting to next frame to allow critical UI to render first
      requestAnimationFrame(() => {
        setMounted(true);
      });
    });
    
    return (
      <Show
        when={mounted()}
        fallback={props.children}
      >
        <ProviderComposer providers={providers}>
          {props.children}
        </ProviderComposer>
      </Show>
    );
  };
  
  if (displayName) {
    Object.defineProperty(DeferredProvider, "name", { value: displayName });
  }
  
  return DeferredProvider;
}

/**
 * Provider groups for the application.
 * These group related providers together for better organization and potential lazy loading.
 */

// Core providers needed for basic app functionality
export const CORE_PROVIDERS = [
  "ThemeProvider",
  "ToastProvider",
  "SettingsProvider",
  "SDKProvider",
] as const;

// Editor-related providers
export const EDITOR_PROVIDERS = [
  "EditorProvider",
  "DiagnosticsProvider",
  "FormatterProvider",
  "LSPProvider",
  "OutlineProvider",
] as const;

// Session/workspace providers
export const SESSION_PROVIDERS = [
  "SessionProvider",
  "WorkspaceProvider",
  "LLMProvider",
  "PlanProvider",
] as const;

// Development tool providers
export const DEV_TOOL_PROVIDERS = [
  "TerminalsProvider",
  "REPLProvider",
  "DebugProvider",
  "TestingProvider",
  "TasksProvider",
] as const;

// Collaboration providers
export const COLLAB_PROVIDERS = [
  "CollabProvider",
  "ChannelsProvider",
  "RemoteProvider",
] as const;

// AI/completion providers
export const AI_PROVIDERS = [
  "SupermavenProvider",
  "SemanticSearchProvider",
] as const;

// UI enhancement providers
export const UI_PROVIDERS = [
  "VimProvider",
  "KeymapProvider",
  "WhichKeyProvider",
  "CommandProvider",
  "QuickInputProvider",
  "TabSwitcherProvider",
  "LanguageSelectorProvider",
  "ActivityIndicatorProvider",
] as const;
