/**
 * ExtensionsProvider - Re-exports and plugin system composition
 *
 * Re-exports the existing ExtensionsProvider for backward compatibility
 * and provides a PluginSystemProvider that composes the activation manager,
 * registry client, and plugin API bridge contexts.
 */

import { ParentProps, JSX } from "solid-js";

import {
  ActivationManagerProvider,
  useActivationManager,
} from "@/context/extensions/ActivationManager";
import {
  RegistryClientProvider,
  useRegistryClient,
} from "@/context/extensions/RegistryClient";
import {
  PluginAPIBridgeProvider,
  usePluginAPIBridge,
} from "@/context/extensions/PluginAPIBridge";
import {
  PluginUIContributionsProvider,
  usePluginUIContributions,
} from "@/context/extensions/PluginUIContributions";

// ============================================================================
// Backward-compatible re-exports from the monolithic context
// ============================================================================

export {
  ExtensionsProvider,
  useExtensions,
  useExtensionUpdates,
  useExtensionUpdateNotifications,
  useExtensionRuntime,
  useExtensionCommand,
  useExtensionEvent,
  useRuntimeExtension,
  useExtensionProfiler,
  useExtensionPacks,
  useWebExtensions,
  useExtensionPackEvents,
} from "@/context/ExtensionsContext";

export type {
  ExtensionManifest,
  ExtensionContributes,
  Extension,
  ExtensionSource,
  ExtensionUpdateInfo,
  ExtensionPack,
  ExtensionPackState,
  ExtensionKindString,
  ExtensionAutoUpdateMode,
  ExtensionUpdateSettings,
  MarketplaceExtension,
  ExtensionTheme,
  ExtensionProfileData,
  ExtensionsContextValue,
  ThemeContribution,
  LanguageContribution,
  CommandContribution,
  PanelContribution,
  SettingsContribution,
  KeybindingContribution,
  SnippetContribution,
  SettingsProperty,
  EngineRequirements,
} from "@/context/ExtensionsContext";

// ============================================================================
// Sub-context re-exports
// ============================================================================

export {
  ActivationManagerProvider,
  useActivationManager,
} from "@/context/extensions/ActivationManager";
export type {
  ActivationEventType,
  ActivationManagerContextValue,
} from "@/context/extensions/ActivationManager";

export {
  RegistryClientProvider,
  useRegistryClient,
} from "@/context/extensions/RegistryClient";
export type {
  RegistrySearchResult,
  RegistryPluginDetail,
  RegistryUpdateInfo,
  RegistrySortOption,
  RegistrySearchOptions,
  RegistryCategory,
  RegistryClientContextValue,
} from "@/context/extensions/RegistryClient";

export {
  PluginAPIBridgeProvider,
  usePluginAPIBridge,
} from "@/context/extensions/PluginAPIBridge";
export type {
  PluginMessage,
  PluginMessageSeverity,
  PermissionRequest,
  ContributedViewUpdate,
  ProgressIndicator,
  OutputChannel,
  PluginAPIBridgeContextValue,
} from "@/context/extensions/PluginAPIBridge";

export {
  PluginUIContributionsProvider,
  usePluginUIContributions,
} from "@/context/extensions/PluginUIContributions";
export type {
  SidebarViewContribution,
  PanelTabContribution,
  StatusBarItemContribution,
  CommandPaletteEntry,
  ContextMenuContribution,
  ConfigurationSectionContribution,
  ConfigurationProperty,
  PluginContributions,
  PluginUIContributionsContextValue,
} from "@/context/extensions/PluginUIContributions";

// ============================================================================
// Composed Provider
// ============================================================================

export function PluginSystemProvider(props: ParentProps): JSX.Element {
  return (
    <ActivationManagerProvider>
      <RegistryClientProvider>
        <PluginAPIBridgeProvider>
          <PluginUIContributionsProvider>
            {props.children}
          </PluginUIContributionsProvider>
        </PluginAPIBridgeProvider>
      </RegistryClientProvider>
    </ActivationManagerProvider>
  );
}

export function usePluginSystem() {
  return {
    activation: useActivationManager(),
    registry: useRegistryClient(),
    bridge: usePluginAPIBridge(),
    uiContributions: usePluginUIContributions(),
  };
}
