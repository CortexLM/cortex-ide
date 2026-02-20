export { ExtensionCard } from "./ExtensionCard";
export type { ViewMode } from "./ExtensionCard";
export { ExtensionsPanel } from "./ExtensionsPanel";
export { ExtensionMarketplace } from "./ExtensionMarketplace";
export { ExtensionDetail, MOCK_EXTENSION_DETAIL } from "./ExtensionDetail";
export type {
  ExtensionDetailData,
  ExtensionVersion,
  ExtensionReview,
  ExtensionDependency,
  ExtensionScreenshot,
} from "./ExtensionDetail";
export { ExtensionBisect, ExtensionBisectIndicator } from "./ExtensionBisect";
export type { ExtensionBisectProps } from "./ExtensionBisect";

// Extension Profiler and Runtime Status
export { ExtensionProfiler } from "./ExtensionProfiler";
export type { ExtensionProfile } from "./ExtensionProfiler";
export {
  RuntimeStatusBadge,
  RuntimeStatusDot,
  RuntimeStatusIndicator,
  RuntimeStatusDetails,
  RuntimeStatusSummary,
} from "./ExtensionRuntimeStatus";
export type { RuntimeStatusBadgeProps } from "./ExtensionRuntimeStatus";
export { ExtensionProfilerCommands } from "./ExtensionProfilerCommands";

// Plugin Registry and Permissions
export { RegistryBrowser } from "./RegistryBrowser";
export type { RegistryPlugin } from "./RegistryBrowser";
export { PluginDetail } from "./PluginDetail";
export type { PluginInfo, PluginDependency } from "./PluginDetail";
export { PluginPermissionDialog } from "./PluginPermissionDialog";
export type { PermissionRequest } from "./PluginPermissionDialog";

// Plugin-contributed UI elements
export { ContributedView } from "./ContributedView";
export { ContributedPanel } from "./ContributedPanel";
export { ContributedStatusBarItem } from "./ContributedStatusBarItem";

// Plugin management and dialogs
export { PluginManager } from "./PluginManager";
export { PluginSidebarContainer, PluginPanelContainer } from "./PluginViewContainer";
export { PluginDialogs } from "./PluginDialogs";

// Node.js Extension Host bridge
export { ExtensionHostBridge } from "./ExtensionHostBridge";
