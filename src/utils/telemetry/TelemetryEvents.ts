/**
 * Telemetry Events - Type definitions for all telemetry events
 * Privacy-first design with anonymous data collection
 */

// Base event interface
export interface TelemetryEvent {
  type: string;
  timestamp: number;
  properties: Record<string, unknown>;
}

// Event wrapper with session metadata
export interface TelemetryEventWrapper {
  signedIn: boolean;
  millisecondsSinceFirstEvent: number;
  event: TelemetryEvent;
}

// Request body sent to telemetry endpoint
export interface TelemetryRequestBody {
  installationId: string;
  sessionId: string;
  appVersion: string;
  osName: string;
  osVersion: string;
  architecture: string;
  releaseChannel: string;
  events: TelemetryEventWrapper[];
}

// ============================================================================
// Event Types
// ============================================================================

// App lifecycle events
export type AppLaunchEvent = TelemetryEvent & {
  type: "app_launched";
  properties: {
    launchDuration: number;
    isFirstLaunch: boolean;
    previousVersion?: string;
  };
};

export type AppClosedEvent = TelemetryEvent & {
  type: "app_closed";
  properties: {
    sessionDuration: number;
    eventsCount: number;
  };
};

export type AppFocusedEvent = TelemetryEvent & {
  type: "app_focused";
  properties: {
    timeInBackground: number;
  };
};

export type AppBlurredEvent = TelemetryEvent & {
  type: "app_blurred";
  properties: Record<string, never>;
};

// Feature usage events
export type FeatureUsedEvent = TelemetryEvent & {
  type: "feature_used";
  properties: {
    feature: string;
    action: string;
    context?: string;
    metadata?: Record<string, unknown>;
  };
};

export type CommandExecutedEvent = TelemetryEvent & {
  type: "command_executed";
  properties: {
    command: string;
    source: "palette" | "keybinding" | "menu" | "api";
    duration?: number;
    success: boolean;
  };
};

export type EditorActionEvent = TelemetryEvent & {
  type: "editor_action";
  properties: {
    action: string;
    languageId?: string;
    fileExtension?: string;
  };
};

export type PanelToggledEvent = TelemetryEvent & {
  type: "panel_toggled";
  properties: {
    panel: string;
    visible: boolean;
  };
};

export type ThemeChangedEvent = TelemetryEvent & {
  type: "theme_changed";
  properties: {
    theme: string;
    isDark: boolean;
  };
};

export type SessionStartedEvent = TelemetryEvent & {
  type: "session_started";
  properties: {
    sessionType: "new" | "restored";
    workspaceFiles?: number;
  };
};

export type SessionEndedEvent = TelemetryEvent & {
  type: "session_ended";
  properties: {
    duration: number;
    messagesCount: number;
    toolCallsCount: number;
  };
};

// AI/LLM events
export type LLMRequestEvent = TelemetryEvent & {
  type: "llm_request";
  properties: {
    provider: string;
    model: string;
    tokensSent?: number;
    tokensReceived?: number;
    latency?: number;
    success: boolean;
    errorType?: string;
  };
};

export type ToolCallEvent = TelemetryEvent & {
  type: "tool_call";
  properties: {
    tool: string;
    success: boolean;
    duration?: number;
    errorType?: string;
  };
};

// Error events
export type ErrorEvent = TelemetryEvent & {
  type: "error";
  properties: {
    errorType: string;
    errorMessage: string;
    component?: string;
    stack?: string;
    fatal: boolean;
  };
};

export type UnhandledErrorEvent = TelemetryEvent & {
  type: "unhandled_error";
  properties: {
    errorType: string;
    errorMessage: string;
    stack?: string;
    location?: string;
  };
};

// Performance events
export type PerformanceEvent = TelemetryEvent & {
  type: "performance";
  properties: {
    metric: string;
    value: number;
    unit: "ms" | "bytes" | "count" | "percent";
    context?: string;
  };
};

export type MemoryUsageEvent = TelemetryEvent & {
  type: "memory_usage";
  properties: {
    heapUsed: number;
    heapTotal: number;
    external?: number;
  };
};

export type RenderPerformanceEvent = TelemetryEvent & {
  type: "render_performance";
  properties: {
    component: string;
    renderTime: number;
    rerenderCount: number;
  };
};

// Extension events
export type ExtensionInstalledEvent = TelemetryEvent & {
  type: "extension_installed";
  properties: {
    extensionId: string;
    version: string;
    source: "marketplace" | "local" | "url";
  };
};

export type ExtensionUninstalledEvent = TelemetryEvent & {
  type: "extension_uninstalled";
  properties: {
    extensionId: string;
    reason?: string;
  };
};

export type ExtensionErrorEvent = TelemetryEvent & {
  type: "extension_error";
  properties: {
    extensionId: string;
    errorType: string;
    errorMessage: string;
  };
};

// Navigation events
export type NavigationEvent = TelemetryEvent & {
  type: "navigation";
  properties: {
    from: string;
    to: string;
    trigger: "click" | "keybinding" | "api";
  };
};

export type FileOpenedEvent = TelemetryEvent & {
  type: "file_opened";
  properties: {
    languageId?: string;
    fileExtension?: string;
    fileSize?: number;
    source: "explorer" | "search" | "recent" | "api";
  };
};

// Search events
export type SearchPerformedEvent = TelemetryEvent & {
  type: "search_performed";
  properties: {
    searchType: "file" | "buffer" | "project" | "command";
    resultsCount: number;
    queryLength: number;
    duration: number;
  };
};

// Collaboration events
export type CollabSessionEvent = TelemetryEvent & {
  type: "collab_session";
  properties: {
    action: "joined" | "left" | "created";
    participantsCount: number;
    duration?: number;
  };
};

// Remote development events
export type RemoteConnectionEvent = TelemetryEvent & {
  type: "remote_connection";
  properties: {
    action: "connected" | "disconnected" | "failed";
    connectionType: "ssh" | "docker" | "wsl";
    duration?: number;
    errorType?: string;
  };
};

// Debug events
export type DebugSessionEvent = TelemetryEvent & {
  type: "debug_session";
  properties: {
    action: "started" | "stopped" | "paused" | "resumed";
    debuggerType: string;
    breakpointsCount: number;
    duration?: number;
  };
};

// Terminal events
export type TerminalCreatedEvent = TelemetryEvent & {
  type: "terminal_created";
  properties: {
    shell?: string;
    cwd?: string;
  };
};

// REPL events
export type REPLCellExecutedEvent = TelemetryEvent & {
  type: "repl_cell_executed";
  properties: {
    kernel: string;
    executionTime: number;
    success: boolean;
    errorType?: string;
  };
};

// ============================================================================
// Event Union Type
// ============================================================================

export type AnyTelemetryEvent =
  | AppLaunchEvent
  | AppClosedEvent
  | AppFocusedEvent
  | AppBlurredEvent
  | FeatureUsedEvent
  | CommandExecutedEvent
  | EditorActionEvent
  | PanelToggledEvent
  | ThemeChangedEvent
  | SessionStartedEvent
  | SessionEndedEvent
  | LLMRequestEvent
  | ToolCallEvent
  | ErrorEvent
  | UnhandledErrorEvent
  | PerformanceEvent
  | MemoryUsageEvent
  | RenderPerformanceEvent
  | ExtensionInstalledEvent
  | ExtensionUninstalledEvent
  | ExtensionErrorEvent
  | NavigationEvent
  | FileOpenedEvent
  | SearchPerformedEvent
  | CollabSessionEvent
  | RemoteConnectionEvent
  | DebugSessionEvent
  | TerminalCreatedEvent
  | REPLCellExecutedEvent
  | TelemetryEvent; // Generic fallback

// ============================================================================
// Event Factory Functions
// ============================================================================

function createEvent<T extends TelemetryEvent>(
  type: T["type"],
  properties: T["properties"]
): T {
  return {
    type,
    timestamp: Date.now(),
    properties,
  } as T;
}

// App lifecycle
export const events = {
  appLaunched: (props: AppLaunchEvent["properties"]): AppLaunchEvent =>
    createEvent("app_launched", props),

  appClosed: (props: AppClosedEvent["properties"]): AppClosedEvent =>
    createEvent("app_closed", props),

  appFocused: (props: AppFocusedEvent["properties"]): AppFocusedEvent =>
    createEvent("app_focused", props),

  appBlurred: (): AppBlurredEvent =>
    createEvent("app_blurred", {} as Record<string, never>),

  // Feature usage
  featureUsed: (props: FeatureUsedEvent["properties"]): FeatureUsedEvent =>
    createEvent("feature_used", props),

  commandExecuted: (props: CommandExecutedEvent["properties"]): CommandExecutedEvent =>
    createEvent("command_executed", props),

  editorAction: (props: EditorActionEvent["properties"]): EditorActionEvent =>
    createEvent("editor_action", props),

  panelToggled: (props: PanelToggledEvent["properties"]): PanelToggledEvent =>
    createEvent("panel_toggled", props),

  themeChanged: (props: ThemeChangedEvent["properties"]): ThemeChangedEvent =>
    createEvent("theme_changed", props),

  sessionStarted: (props: SessionStartedEvent["properties"]): SessionStartedEvent =>
    createEvent("session_started", props),

  sessionEnded: (props: SessionEndedEvent["properties"]): SessionEndedEvent =>
    createEvent("session_ended", props),

  // AI/LLM
  llmRequest: (props: LLMRequestEvent["properties"]): LLMRequestEvent =>
    createEvent("llm_request", props),

  toolCall: (props: ToolCallEvent["properties"]): ToolCallEvent =>
    createEvent("tool_call", props),

  // Errors
  error: (props: ErrorEvent["properties"]): ErrorEvent =>
    createEvent("error", props),

  unhandledError: (props: UnhandledErrorEvent["properties"]): UnhandledErrorEvent =>
    createEvent("unhandled_error", props),

  // Performance
  performance: (props: PerformanceEvent["properties"]): PerformanceEvent =>
    createEvent("performance", props),

  memoryUsage: (props: MemoryUsageEvent["properties"]): MemoryUsageEvent =>
    createEvent("memory_usage", props),

  renderPerformance: (props: RenderPerformanceEvent["properties"]): RenderPerformanceEvent =>
    createEvent("render_performance", props),

  // Extensions
  extensionInstalled: (props: ExtensionInstalledEvent["properties"]): ExtensionInstalledEvent =>
    createEvent("extension_installed", props),

  extensionUninstalled: (props: ExtensionUninstalledEvent["properties"]): ExtensionUninstalledEvent =>
    createEvent("extension_uninstalled", props),

  extensionError: (props: ExtensionErrorEvent["properties"]): ExtensionErrorEvent =>
    createEvent("extension_error", props),

  // Navigation
  navigation: (props: NavigationEvent["properties"]): NavigationEvent =>
    createEvent("navigation", props),

  fileOpened: (props: FileOpenedEvent["properties"]): FileOpenedEvent =>
    createEvent("file_opened", props),

  // Search
  searchPerformed: (props: SearchPerformedEvent["properties"]): SearchPerformedEvent =>
    createEvent("search_performed", props),

  // Collaboration
  collabSession: (props: CollabSessionEvent["properties"]): CollabSessionEvent =>
    createEvent("collab_session", props),

  // Remote
  remoteConnection: (props: RemoteConnectionEvent["properties"]): RemoteConnectionEvent =>
    createEvent("remote_connection", props),

  // Debug
  debugSession: (props: DebugSessionEvent["properties"]): DebugSessionEvent =>
    createEvent("debug_session", props),

  // Terminal
  terminalCreated: (props: TerminalCreatedEvent["properties"]): TerminalCreatedEvent =>
    createEvent("terminal_created", props),

  // REPL
  replCellExecuted: (props: REPLCellExecutedEvent["properties"]): REPLCellExecutedEvent =>
    createEvent("repl_cell_executed", props),

  // Generic event for custom/dynamic events
  custom: (type: string, properties: Record<string, unknown>): TelemetryEvent =>
    createEvent(type, properties),
};
