/**
 * Layout Presets System - VS Code-style layout configuration presets
 * 
 * Allows users to save and restore layout configurations including:
 * - Sidebar state (width, collapsed, active tab)
 * - Right sidebar state
 * - Bottom panel state
 * - Agent panel state
 * - Chat visibility
 */

// ============================================================================
// Types
// ============================================================================

/** Sidebar tabs available in the application */
export type SidebarTab = 
  | "files" 
  | "search" 
  | "git" 
  | "extensions" 
  | "debug" 
  | "outline"
  | "agents"
  | "wiki"
  | "codemap"
  | "design"
  | "testing"
  | "remote";

/** Bottom panel tabs */
export type BottomPanelTab = 
  | "terminal" 
  | "debug-console" 
  | "ports" 
  | "preview" 
  | "problems"
  | "output"
  | "test-output";

/** Complete layout state that can be saved/restored */
export interface LayoutState {
  sidebar: {
    width: number;
    collapsed: boolean;
    activeTab: SidebarTab;
  };
  rightSidebar: {
    width: number;
    collapsed: boolean;
  };
  bottomPanel: {
    height: number;
    collapsed: boolean;
    maximized: boolean;
    activeTab: BottomPanelTab;
  };
  agentPanel: {
    width: number;
    visible: boolean;
  };
  chat: {
    width: number;
  };
  showChat: boolean;
}

/** A named layout preset */
export interface LayoutPreset {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Icon name for display */
  icon: string;
  /** Whether this is a built-in preset (cannot be deleted) */
  isBuiltin: boolean;
  /** Optional description */
  description?: string;
  /** The layout state to apply */
  state: LayoutState;
}

// ============================================================================
// Constants
// ============================================================================

/** Default layout dimensions */
export const LAYOUT_DEFAULTS = {
  sidebar: {
    width: 240,
    minWidth: 160,
    maxWidth: 500,
  },
  rightSidebar: {
    width: 280,
    minWidth: 200,
    maxWidth: 500,
  },
  bottomPanel: {
    height: 220,
    minHeight: 100,
    maxHeight: 600,
  },
  agentPanel: {
    width: 400,
    minWidth: 320,
    maxWidth: 600,
  },
  chat: {
    width: 450,
    minWidth: 300,
    maxWidth: 1200,
  },
} as const;

// ============================================================================
// Built-in Presets
// ============================================================================

/** Built-in layout presets */
export const BUILTIN_PRESETS: LayoutPreset[] = [
  {
    id: "default",
    name: "Default",
    icon: "layout",
    isBuiltin: true,
    description: "Standard layout with file explorer",
    state: {
      sidebar: { width: 240, collapsed: false, activeTab: "files" },
      rightSidebar: { width: 280, collapsed: true },
      bottomPanel: { height: 220, collapsed: true, maximized: false, activeTab: "terminal" },
      agentPanel: { width: 400, visible: false },
      chat: { width: 450 },
      showChat: true,
    },
  },
  {
    id: "focused",
    name: "Focused Coding",
    icon: "eye",
    isBuiltin: true,
    description: "Minimal distractions - just the editor",
    state: {
      sidebar: { width: 200, collapsed: true, activeTab: "files" },
      rightSidebar: { width: 280, collapsed: true },
      bottomPanel: { height: 220, collapsed: true, maximized: false, activeTab: "terminal" },
      agentPanel: { width: 400, visible: false },
      chat: { width: 450 },
      showChat: false,
    },
  },
  {
    id: "debug",
    name: "Debug Layout",
    icon: "bug",
    isBuiltin: true,
    description: "Optimized for debugging sessions",
    state: {
      sidebar: { width: 300, collapsed: false, activeTab: "debug" },
      rightSidebar: { width: 280, collapsed: true },
      bottomPanel: { height: 300, collapsed: false, maximized: false, activeTab: "debug-console" },
      agentPanel: { width: 400, visible: false },
      chat: { width: 450 },
      showChat: false,
    },
  },
  {
    id: "review",
    name: "Code Review",
    icon: "code-pull-request",
    isBuiltin: true,
    description: "Git panel and auxiliary sidebar for reviews",
    state: {
      sidebar: { width: 280, collapsed: false, activeTab: "git" },
      rightSidebar: { width: 320, collapsed: false },
      bottomPanel: { height: 220, collapsed: true, maximized: false, activeTab: "terminal" },
      agentPanel: { width: 400, visible: false },
      chat: { width: 450 },
      showChat: false,
    },
  },
  {
    id: "ai-assisted",
    name: "AI Assisted",
    icon: "sparkles",
    isBuiltin: true,
    description: "Agent panel and chat for AI-powered development",
    state: {
      sidebar: { width: 240, collapsed: false, activeTab: "files" },
      rightSidebar: { width: 280, collapsed: true },
      bottomPanel: { height: 220, collapsed: true, maximized: false, activeTab: "terminal" },
      agentPanel: { width: 420, visible: true },
      chat: { width: 500 },
      showChat: true,
    },
  },
  {
    id: "terminal-focus",
    name: "Terminal Focus",
    icon: "terminal",
    isBuiltin: true,
    description: "Large terminal panel for command-line work",
    state: {
      sidebar: { width: 200, collapsed: true, activeTab: "files" },
      rightSidebar: { width: 280, collapsed: true },
      bottomPanel: { height: 400, collapsed: false, maximized: false, activeTab: "terminal" },
      agentPanel: { width: 400, visible: false },
      chat: { width: 450 },
      showChat: false,
    },
  },
];

// ============================================================================
// Storage Keys
// ============================================================================

export const LAYOUT_PRESET_STORAGE_KEYS = {
  /** Currently active preset ID */
  activePreset: "layout_active_preset",
  /** User-created custom presets */
  customPresets: "layout_custom_presets",
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load custom presets from localStorage
 */
export function loadCustomPresets(): LayoutPreset[] {
  try {
    const stored = localStorage.getItem(LAYOUT_PRESET_STORAGE_KEYS.customPresets);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to load custom presets:", e);
  }
  return [];
}

/**
 * Save custom presets to localStorage
 */
export function saveCustomPresets(presets: LayoutPreset[]): void {
  try {
    localStorage.setItem(LAYOUT_PRESET_STORAGE_KEYS.customPresets, JSON.stringify(presets));
  } catch (e) {
    console.error("Failed to save custom presets:", e);
  }
}

/**
 * Get active preset ID from localStorage
 */
export function getActivePresetId(): string | null {
  return localStorage.getItem(LAYOUT_PRESET_STORAGE_KEYS.activePreset);
}

/**
 * Save active preset ID to localStorage
 */
export function setActivePresetId(id: string | null): void {
  if (id) {
    localStorage.setItem(LAYOUT_PRESET_STORAGE_KEYS.activePreset, id);
  } else {
    localStorage.removeItem(LAYOUT_PRESET_STORAGE_KEYS.activePreset);
  }
}

/**
 * Get all presets (built-in + custom)
 */
export function getAllPresets(customPresets: LayoutPreset[]): LayoutPreset[] {
  return [...BUILTIN_PRESETS, ...customPresets];
}

/**
 * Find a preset by ID
 */
export function findPresetById(id: string, customPresets: LayoutPreset[]): LayoutPreset | undefined {
  return getAllPresets(customPresets).find(p => p.id === id);
}

/**
 * Generate a unique ID for a custom preset
 */
export function generatePresetId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new custom preset from current layout state
 */
export function createCustomPreset(name: string, state: LayoutState, icon: string = "bookmark"): LayoutPreset {
  return {
    id: generatePresetId(),
    name,
    icon,
    isBuiltin: false,
    state,
  };
}
