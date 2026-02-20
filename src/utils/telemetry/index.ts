/**
 * Telemetry Module - Privacy-first telemetry for Cortex Desktop
 */

// Event types and factory functions
export {
  type TelemetryEvent,
  type TelemetryEventWrapper,
  type TelemetryRequestBody,
  type AnyTelemetryEvent,
  type AppLaunchEvent,
  type AppClosedEvent,
  type AppFocusedEvent,
  type AppBlurredEvent,
  type FeatureUsedEvent,
  type CommandExecutedEvent,
  type EditorActionEvent,
  type PanelToggledEvent,
  type ThemeChangedEvent,
  type SessionStartedEvent,
  type SessionEndedEvent,
  type LLMRequestEvent,
  type ToolCallEvent,
  type ErrorEvent,
  type UnhandledErrorEvent,
  type PerformanceEvent,
  type MemoryUsageEvent,
  type RenderPerformanceEvent,
  type ExtensionInstalledEvent,
  type ExtensionUninstalledEvent,
  type ExtensionErrorEvent,
  type NavigationEvent,
  type FileOpenedEvent,
  type SearchPerformedEvent,
  type CollabSessionEvent,
  type RemoteConnectionEvent,
  type DebugSessionEvent,
  type TerminalCreatedEvent,
  type REPLCellExecutedEvent,
  events,
} from "./TelemetryEvents";

// Client and configuration
export {
  TelemetryClient,
  getTelemetryClient,
  resetTelemetryClient,
  type TelemetryConfig,
  type TelemetryStats,
} from "./TelemetryClient";
