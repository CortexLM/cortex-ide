// ============================================================================
// Typed Event Bus System
// ============================================================================
// Provides type-safe custom event dispatching and listening for the application
// to replace unsafe window.dispatchEvent with proper typing.

import type { CortexSettings, PartialCortexSettings, LanguageEditorOverride } from "@/context/SettingsContext";

// ============================================================================
// Event Payload Types
// ============================================================================

/** Payload for settings-related events */
export interface SettingsChangedPayload {
  section: keyof CortexSettings;
  settings?: CortexSettings[keyof CortexSettings];
}

export interface SettingsWorkspaceLoadedPayload {
  workspacePath: string;
}

export interface SettingsWorkspaceChangedPayload {
  section: keyof CortexSettings;
  key: string;
  value: unknown;
}

export interface SettingsWorkspaceResetPayload {
  section: keyof CortexSettings;
  key: string;
}

export interface SettingsFolderPayload {
  folderPath: string;
  settings?: PartialCortexSettings;
}

export interface SettingsFolderChangedPayload {
  folderPath: string;
  section: keyof CortexSettings;
  key: string;
  value: unknown;
}

export interface SettingsFileAssociationPayload {
  pattern: string;
  languageId?: string;
}

export interface SettingsLanguageOverridePayload {
  language: string;
  overrides?: LanguageEditorOverride;
}

export interface SettingsResetToDefaultPayload {
  section: keyof CortexSettings;
  key: string;
  defaultValue: unknown;
}

/** Payload for explorer events */
export interface ExplorerRevealPayload {
  path: string;
}

/** Payload for workspace events */
export interface WorkspaceFolderPayload {
  path: string;
}

/** Payload for project events */
export interface ProjectOpenedPayload {
  path: string;
}

/** Debug settings request has no payload */
export type DebugRequestSettingsPayload = void;

// ============================================================================
// Event Map - Maps event names to their payload types
// ============================================================================

export interface AppEventMap {
  // Settings events
  "settings:changed": SettingsChangedPayload;
  "settings:reset": void;
  "settings:imported": void;
  "settings:workspace-loaded": SettingsWorkspaceLoadedPayload;
  "settings:workspace-cleared": void;
  "settings:workspace-changed": SettingsWorkspaceChangedPayload;
  "settings:workspace-reset": SettingsWorkspaceResetPayload;
  "settings:folder-loaded": SettingsFolderPayload;
  "settings:folder-saved": SettingsFolderPayload;
  "settings:folder-changed": SettingsFolderChangedPayload;
  "settings:folder-reset": SettingsFolderChangedPayload;
  "settings:folder-cleared": SettingsFolderPayload;
  "settings:file-association-changed": SettingsFileAssociationPayload;
  "settings:file-association-removed": SettingsFileAssociationPayload;
  "settings:language-override-changed": SettingsLanguageOverridePayload;
  "settings:language-override-reset": SettingsLanguageOverridePayload;
  "settings:reset-to-default": SettingsResetToDefaultPayload;
  
  // Explorer events
  "explorer:reveal": ExplorerRevealPayload;
  
  // Workspace events  
  "workspace:folder-added": WorkspaceFolderPayload;
  "workspace:folder-removed": WorkspaceFolderPayload;
  
  // Project events
  "project:opened": ProjectOpenedPayload;
  "project:closed": void;
  
  // Debug events
  "debug:request-settings": void;
}

// ============================================================================
// Typed Event Classes
// ============================================================================

/** Type-safe custom event class */
export class TypedCustomEvent<K extends keyof AppEventMap> extends CustomEvent<AppEventMap[K]> {
  constructor(type: K, detail: AppEventMap[K]) {
    super(type, { detail });
  }
}

// ============================================================================
// Event Bus API
// ============================================================================

/**
 * Dispatch a typed custom event
 * @param type - The event type from AppEventMap
 * @param detail - The event payload (typed based on the event type)
 */
export function dispatchAppEvent<K extends keyof AppEventMap>(
  type: K,
  ...args: AppEventMap[K] extends void ? [] : [detail: AppEventMap[K]]
): void {
  const detail = args[0] as AppEventMap[K] | undefined;
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

/**
 * Type-safe event listener callback
 */
export type AppEventListener<K extends keyof AppEventMap> = (
  event: CustomEvent<AppEventMap[K]>
) => void;

/**
 * Add a typed event listener
 * @param type - The event type from AppEventMap
 * @param listener - The callback function
 * @param options - Standard addEventListener options
 * @returns A cleanup function to remove the listener
 */
export function addAppEventListener<K extends keyof AppEventMap>(
  type: K,
  listener: AppEventListener<K>,
  options?: boolean | AddEventListenerOptions
): () => void {
  const handler = listener as EventListener;
  window.addEventListener(type, handler, options);
  return () => window.removeEventListener(type, handler, options);
}

/**
 * Remove a typed event listener
 * @param type - The event type from AppEventMap
 * @param listener - The callback function to remove
 * @param options - Standard removeEventListener options
 */
export function removeAppEventListener<K extends keyof AppEventMap>(
  type: K,
  listener: AppEventListener<K>,
  options?: boolean | EventListenerOptions
): void {
  window.removeEventListener(type, listener as EventListener, options);
}

// ============================================================================
// Utility Types for Components
// ============================================================================

/**
 * Extract the payload type for a given event
 */
export type EventPayload<K extends keyof AppEventMap> = AppEventMap[K];

/**
 * Type guard to check if an event is a typed app event
 */
export function isAppEvent<K extends keyof AppEventMap>(
  event: Event,
  type: K
): event is CustomEvent<AppEventMap[K]> {
  return event.type === type && event instanceof CustomEvent;
}
