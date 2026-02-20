/**
 * =============================================================================
 * QUICK ACCESS PROVIDER TYPES
 * =============================================================================
 * 
 * Shared types for Quick Access providers.
 */

import type { Component, JSX } from "solid-js";

/**
 * Button displayed on quick access items
 */
export interface QuickAccessItemButton {
  /** Icon component to render */
  icon: Component<{ style?: JSX.CSSProperties }>;
  /** Tooltip text */
  tooltip?: string;
  /** Action when clicked */
  onClick: () => void;
}

/**
 * A single item in the quick access list
 */
export interface QuickAccessItem<T = unknown> {
  /** Unique identifier */
  id: string;
  /** Primary label text */
  label: string;
  /** Secondary description (shown after label) */
  description?: string;
  /** Detailed information (shown on second line) */
  detail?: string;
  /** Icon component to render */
  icon?: Component<{ style?: JSX.CSSProperties }>;
  /** Icon color */
  iconColor?: string;
  /** Action buttons shown on the right */
  buttons?: QuickAccessItemButton[];
  /** Whether this item is a separator */
  kind?: "separator" | "default";
  /** The underlying data associated with this item */
  data?: T;
  /** Keyboard shortcut hint */
  shortcut?: string;
  /** Whether this item is disabled (not selectable) */
  disabled?: boolean;
  /** Whether this item should always be shown (bypass filtering) */
  alwaysShow?: boolean;
}

/**
 * Quick Access Provider interface - implement this to add a new prefix
 */
export interface QuickAccessProvider<T = unknown> {
  /** Provider ID */
  id: string;
  /** Prefix that triggers this provider (e.g., "?", ">", "@") */
  prefix: string;
  /** Display name for the provider */
  name: string;
  /** Description shown in help */
  description: string;
  /** Get items for this provider */
  provideItems: (query: string) => Promise<QuickAccessItem<T>[]>;
  /** Handle item selection */
  onSelect: (item: QuickAccessItem<T>) => void;
  /** Handle item button click */
  onButtonClick?: (item: QuickAccessItem<T>, button: QuickAccessItemButton, buttonIndex: number) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * Quick Access context value
 */
export interface QuickAccessContextValue {
  /** Registered providers */
  providers: Map<string, QuickAccessProvider>;
  /** Register a provider */
  registerProvider: (provider: QuickAccessProvider) => void;
  /** Unregister a provider */
  unregisterProvider: (id: string) => void;
  /** Get provider by prefix */
  getProviderByPrefix: (prefix: string) => QuickAccessProvider | undefined;
  /** Show quick access with optional initial prefix */
  show: (prefix?: string) => void;
  /** Hide quick access */
  hide: () => void;
  /** Whether quick access is visible */
  isVisible: () => boolean;
  /** Current provider prefix */
  currentPrefix: () => string;
  /** Set current prefix (switches provider) */
  setPrefix: (prefix: string) => void;
}
