import { createContext, useContext, ParentProps, createSignal, createMemo, createEffect } from "solid-js";

// ============================================================================
// Product Icon Categories
// ============================================================================

export type ProductIconCategory = 
  | "activityBar"
  | "view"
  | "action"
  | "statusBar"
  | "breadcrumb"
  | "editor"
  | "debug"
  | "scm"
  | "notification"
  | "widget";

// ============================================================================
// Product Icon Identifiers
// ============================================================================

export type ProductIconId =
  // Activity Bar Icons
  | "activity-bar-explorer"
  | "activity-bar-search"
  | "activity-bar-scm"
  | "activity-bar-debug"
  | "activity-bar-extensions"
  | "activity-bar-accounts"
  | "activity-bar-settings"
  | "activity-bar-terminal"
  | "activity-bar-ai"
  | "activity-bar-journal"
  | "activity-bar-remote"
  // View Icons
  | "view-files"
  | "view-folder"
  | "view-folder-open"
  | "view-file-code"
  | "view-file-text"
  | "view-file-media"
  | "view-file-binary"
  | "view-symlink"
  | "view-outline"
  | "view-timeline"
  // Action Icons
  | "action-close"
  | "action-close-all"
  | "action-add"
  | "action-remove"
  | "action-edit"
  | "action-save"
  | "action-refresh"
  | "action-pin"
  | "action-unpin"
  | "action-split-horizontal"
  | "action-split-vertical"
  | "action-maximize"
  | "action-minimize"
  | "action-collapse"
  | "action-expand"
  | "action-search"
  | "action-filter"
  | "action-sort"
  | "action-more"
  | "action-run"
  | "action-stop"
  | "action-debug"
  | "action-copy"
  | "action-paste"
  | "action-cut"
  | "action-undo"
  | "action-redo"
  // Status Bar Icons
  | "statusbar-error"
  | "statusbar-warning"
  | "statusbar-info"
  | "statusbar-sync"
  | "statusbar-sync-spin"
  | "statusbar-bell"
  | "statusbar-check"
  | "statusbar-feedback"
  | "statusbar-remote"
  | "statusbar-git-branch"
  | "statusbar-git-commit"
  // Breadcrumb Icons
  | "breadcrumb-separator"
  | "breadcrumb-folder"
  | "breadcrumb-file"
  | "breadcrumb-symbol"
  // Editor Icons
  | "editor-modified"
  | "editor-readonly"
  | "editor-deleted"
  | "editor-added"
  | "editor-renamed"
  | "editor-conflict"
  // Debug Icons
  | "debug-breakpoint"
  | "debug-breakpoint-disabled"
  | "debug-breakpoint-conditional"
  | "debug-breakpoint-log"
  | "debug-continue"
  | "debug-pause"
  | "debug-step-over"
  | "debug-step-into"
  | "debug-step-out"
  | "debug-restart"
  | "debug-stop"
  // SCM Icons
  | "scm-staged"
  | "scm-modified"
  | "scm-added"
  | "scm-deleted"
  | "scm-renamed"
  | "scm-untracked"
  | "scm-ignored"
  | "scm-conflict"
  // Notification Icons
  | "notification-info"
  | "notification-warning"
  | "notification-error"
  | "notification-success"
  // Widget Icons
  | "widget-close"
  | "widget-expand"
  | "widget-collapse"
  | "widget-drag";

// ============================================================================
// Icon Definition Interface
// ============================================================================

export interface ProductIconDefinition {
  fontCharacter: string;
  fontFamily?: string;
}

// ============================================================================
// Product Icon Theme Interface
// ============================================================================

export interface ProductIconTheme {
  id: string;
  label: string;
  description: string;
  fontFamily: string;
  fontPath?: string;
  icons: Record<ProductIconId, ProductIconDefinition>;
}

// ============================================================================
// Built-in Icon Theme: Default (Codicons)
// ============================================================================

const DEFAULT_CODICONS_THEME: ProductIconTheme = {
  id: "default-codicons",
  label: "Default (Codicons)",
  description: "The default VS Code-style icons using Codicons font",
  fontFamily: "codicon",
  icons: {
    // Activity Bar Icons
    "activity-bar-explorer": { fontCharacter: "\uEB60" },
    "activity-bar-search": { fontCharacter: "\uEB51" },
    "activity-bar-scm": { fontCharacter: "\uEB1F" },
    "activity-bar-debug": { fontCharacter: "\uEAFC" },
    "activity-bar-extensions": { fontCharacter: "\uEB07" },
    "activity-bar-accounts": { fontCharacter: "\uEB99" },
    "activity-bar-settings": { fontCharacter: "\uEB52" },
    "activity-bar-terminal": { fontCharacter: "\uEB63" },
    "activity-bar-ai": { fontCharacter: "\uEBCA" },
    "activity-bar-journal": { fontCharacter: "\uEB0C" },
    "activity-bar-remote": { fontCharacter: "\uEB39" },
    // View Icons
    "view-files": { fontCharacter: "\uEB60" },
    "view-folder": { fontCharacter: "\uEB64" },
    "view-folder-open": { fontCharacter: "\uEB65" },
    "view-file-code": { fontCharacter: "\uEB0D" },
    "view-file-text": { fontCharacter: "\uEB85" },
    "view-file-media": { fontCharacter: "\uEB29" },
    "view-file-binary": { fontCharacter: "\uEB05" },
    "view-symlink": { fontCharacter: "\uEB5F" },
    "view-outline": { fontCharacter: "\uEB9F" },
    "view-timeline": { fontCharacter: "\uEB61" },
    // Action Icons
    "action-close": { fontCharacter: "\uEAB8" },
    "action-close-all": { fontCharacter: "\uEAB9" },
    "action-add": { fontCharacter: "\uEA60" },
    "action-remove": { fontCharacter: "\uEB44" },
    "action-edit": { fontCharacter: "\uEA6F" },
    "action-save": { fontCharacter: "\uEB4A" },
    "action-refresh": { fontCharacter: "\uEB37" },
    "action-pin": { fontCharacter: "\uEB2E" },
    "action-unpin": { fontCharacter: "\uEB2F" },
    "action-split-horizontal": { fontCharacter: "\uEB56" },
    "action-split-vertical": { fontCharacter: "\uEB57" },
    "action-maximize": { fontCharacter: "\uEB71" },
    "action-minimize": { fontCharacter: "\uEB72" },
    "action-collapse": { fontCharacter: "\uEABA" },
    "action-expand": { fontCharacter: "\uEABB" },
    "action-search": { fontCharacter: "\uEB51" },
    "action-filter": { fontCharacter: "\uEB08" },
    "action-sort": { fontCharacter: "\uEB5C" },
    "action-more": { fontCharacter: "\uEA7C" },
    "action-run": { fontCharacter: "\uEB91" },
    "action-stop": { fontCharacter: "\uEB5E" },
    "action-debug": { fontCharacter: "\uEA71" },
    "action-copy": { fontCharacter: "\uEABE" },
    "action-paste": { fontCharacter: "\uEB4E" },
    "action-cut": { fontCharacter: "\uEB46" },
    "action-undo": { fontCharacter: "\uEB6A" },
    "action-redo": { fontCharacter: "\uEB6B" },
    // Status Bar Icons
    "statusbar-error": { fontCharacter: "\uEA87" },
    "statusbar-warning": { fontCharacter: "\uEA6C" },
    "statusbar-info": { fontCharacter: "\uEA74" },
    "statusbar-sync": { fontCharacter: "\uEB4C" },
    "statusbar-sync-spin": { fontCharacter: "\uEAF4" },
    "statusbar-bell": { fontCharacter: "\uEA79" },
    "statusbar-check": { fontCharacter: "\uEAB2" },
    "statusbar-feedback": { fontCharacter: "\uEB16" },
    "statusbar-remote": { fontCharacter: "\uEB39" },
    "statusbar-git-branch": { fontCharacter: "\uEA68" },
    "statusbar-git-commit": { fontCharacter: "\uEA69" },
    // Breadcrumb Icons
    "breadcrumb-separator": { fontCharacter: "\uEABF" },
    "breadcrumb-folder": { fontCharacter: "\uEB64" },
    "breadcrumb-file": { fontCharacter: "\uEB62" },
    "breadcrumb-symbol": { fontCharacter: "\uEA8B" },
    // Editor Icons
    "editor-modified": { fontCharacter: "\uEA73" },
    "editor-readonly": { fontCharacter: "\uEABC" },
    "editor-deleted": { fontCharacter: "\uEA81" },
    "editor-added": { fontCharacter: "\uEA60" },
    "editor-renamed": { fontCharacter: "\uEB3A" },
    "editor-conflict": { fontCharacter: "\uEADE" },
    // Debug Icons
    "debug-breakpoint": { fontCharacter: "\uEAB1" },
    "debug-breakpoint-disabled": { fontCharacter: "\uEBB0" },
    "debug-breakpoint-conditional": { fontCharacter: "\uEAAE" },
    "debug-breakpoint-log": { fontCharacter: "\uEAB0" },
    "debug-continue": { fontCharacter: "\uEACF" },
    "debug-pause": { fontCharacter: "\uEAD0" },
    "debug-step-over": { fontCharacter: "\uEAD4" },
    "debug-step-into": { fontCharacter: "\uEAD2" },
    "debug-step-out": { fontCharacter: "\uEAD3" },
    "debug-restart": { fontCharacter: "\uEAD1" },
    "debug-stop": { fontCharacter: "\uEAD5" },
    // SCM Icons
    "scm-staged": { fontCharacter: "\uEAB2" },
    "scm-modified": { fontCharacter: "\uEA73" },
    "scm-added": { fontCharacter: "\uEA60" },
    "scm-deleted": { fontCharacter: "\uEA81" },
    "scm-renamed": { fontCharacter: "\uEB3A" },
    "scm-untracked": { fontCharacter: "\uEB4D" },
    "scm-ignored": { fontCharacter: "\uEB9E" },
    "scm-conflict": { fontCharacter: "\uEADE" },
    // Notification Icons
    "notification-info": { fontCharacter: "\uEA74" },
    "notification-warning": { fontCharacter: "\uEA6C" },
    "notification-error": { fontCharacter: "\uEB45" },
    "notification-success": { fontCharacter: "\uEAB2" },
    // Widget Icons
    "widget-close": { fontCharacter: "\uEAB8" },
    "widget-expand": { fontCharacter: "\uEABB" },
    "widget-collapse": { fontCharacter: "\uEABA" },
    "widget-drag": { fontCharacter: "\uEB0E" },
  },
};

// ============================================================================
// Built-in Icon Theme: Minimal
// ============================================================================

const MINIMAL_THEME: ProductIconTheme = {
  id: "minimal",
  label: "Minimal",
  description: "A clean, minimalist icon set with simpler shapes",
  fontFamily: "codicon",
  icons: {
    // Activity Bar Icons - Using simpler, more geometric alternatives
    "activity-bar-explorer": { fontCharacter: "\uEB62" }, // file
    "activity-bar-search": { fontCharacter: "\uEB51" }, // search
    "activity-bar-scm": { fontCharacter: "\uEA68" }, // git-branch
    "activity-bar-debug": { fontCharacter: "\uEA71" }, // bug
    "activity-bar-extensions": { fontCharacter: "\uEB4B" }, // package
    "activity-bar-accounts": { fontCharacter: "\uEA89" }, // person
    "activity-bar-settings": { fontCharacter: "\uEB52" }, // settings-gear
    "activity-bar-terminal": { fontCharacter: "\uEA85" }, // terminal simple
    "activity-bar-ai": { fontCharacter: "\uEAEA" }, // lightbulb
    "activity-bar-journal": { fontCharacter: "\uEB0C" }, // note
    "activity-bar-remote": { fontCharacter: "\uEA85" }, // plug
    // View Icons
    "view-files": { fontCharacter: "\uEB62" },
    "view-folder": { fontCharacter: "\uEB64" },
    "view-folder-open": { fontCharacter: "\uEB65" },
    "view-file-code": { fontCharacter: "\uEB0D" },
    "view-file-text": { fontCharacter: "\uEB62" },
    "view-file-media": { fontCharacter: "\uEB4A" },
    "view-file-binary": { fontCharacter: "\uEA93" },
    "view-symlink": { fontCharacter: "\uEB5F" },
    "view-outline": { fontCharacter: "\uEA7B" },
    "view-timeline": { fontCharacter: "\uEB61" },
    // Action Icons
    "action-close": { fontCharacter: "\uEA76" }, // x
    "action-close-all": { fontCharacter: "\uEA76" },
    "action-add": { fontCharacter: "\uEA60" }, // plus
    "action-remove": { fontCharacter: "\uEA82" }, // dash
    "action-edit": { fontCharacter: "\uEA6F" },
    "action-save": { fontCharacter: "\uEB4A" },
    "action-refresh": { fontCharacter: "\uEB37" },
    "action-pin": { fontCharacter: "\uEB2E" },
    "action-unpin": { fontCharacter: "\uEB2F" },
    "action-split-horizontal": { fontCharacter: "\uEB56" },
    "action-split-vertical": { fontCharacter: "\uEB57" },
    "action-maximize": { fontCharacter: "\uEB90" }, // arrow-up
    "action-minimize": { fontCharacter: "\uEB92" }, // arrow-down
    "action-collapse": { fontCharacter: "\uEABC" }, // chevron-up
    "action-expand": { fontCharacter: "\uEABD" }, // chevron-down
    "action-search": { fontCharacter: "\uEB51" },
    "action-filter": { fontCharacter: "\uEB08" },
    "action-sort": { fontCharacter: "\uEB5C" },
    "action-more": { fontCharacter: "\uEA7C" },
    "action-run": { fontCharacter: "\uEB91" },
    "action-stop": { fontCharacter: "\uEBB9" }, // primitive-square
    "action-debug": { fontCharacter: "\uEA71" },
    "action-copy": { fontCharacter: "\uEABE" },
    "action-paste": { fontCharacter: "\uEB4E" },
    "action-cut": { fontCharacter: "\uEB46" },
    "action-undo": { fontCharacter: "\uEB6A" },
    "action-redo": { fontCharacter: "\uEB6B" },
    // Status Bar Icons
    "statusbar-error": { fontCharacter: "\uEA76" }, // x
    "statusbar-warning": { fontCharacter: "\uEA6C" },
    "statusbar-info": { fontCharacter: "\uEA74" },
    "statusbar-sync": { fontCharacter: "\uEB4C" },
    "statusbar-sync-spin": { fontCharacter: "\uEAF4" },
    "statusbar-bell": { fontCharacter: "\uEA79" },
    "statusbar-check": { fontCharacter: "\uEA78" }, // check
    "statusbar-feedback": { fontCharacter: "\uEB16" },
    "statusbar-remote": { fontCharacter: "\uEA85" },
    "statusbar-git-branch": { fontCharacter: "\uEA68" },
    "statusbar-git-commit": { fontCharacter: "\uEA69" },
    // Breadcrumb Icons
    "breadcrumb-separator": { fontCharacter: "\uEABF" },
    "breadcrumb-folder": { fontCharacter: "\uEB64" },
    "breadcrumb-file": { fontCharacter: "\uEB62" },
    "breadcrumb-symbol": { fontCharacter: "\uEA8B" },
    // Editor Icons
    "editor-modified": { fontCharacter: "\uEA73" },
    "editor-readonly": { fontCharacter: "\uEABC" },
    "editor-deleted": { fontCharacter: "\uEA82" }, // dash
    "editor-added": { fontCharacter: "\uEA60" }, // plus
    "editor-renamed": { fontCharacter: "\uEB3A" },
    "editor-conflict": { fontCharacter: "\uEADE" },
    // Debug Icons
    "debug-breakpoint": { fontCharacter: "\uEAB1" },
    "debug-breakpoint-disabled": { fontCharacter: "\uEBB0" },
    "debug-breakpoint-conditional": { fontCharacter: "\uEAAE" },
    "debug-breakpoint-log": { fontCharacter: "\uEAB0" },
    "debug-continue": { fontCharacter: "\uEB91" }, // play
    "debug-pause": { fontCharacter: "\uEBBC" }, // debug-pause
    "debug-step-over": { fontCharacter: "\uEAD4" },
    "debug-step-into": { fontCharacter: "\uEAD2" },
    "debug-step-out": { fontCharacter: "\uEAD3" },
    "debug-restart": { fontCharacter: "\uEB37" }, // refresh
    "debug-stop": { fontCharacter: "\uEBB9" }, // square
    // SCM Icons
    "scm-staged": { fontCharacter: "\uEA78" }, // check
    "scm-modified": { fontCharacter: "\uEA73" },
    "scm-added": { fontCharacter: "\uEA60" },
    "scm-deleted": { fontCharacter: "\uEA82" },
    "scm-renamed": { fontCharacter: "\uEB3A" },
    "scm-untracked": { fontCharacter: "\uEB4D" },
    "scm-ignored": { fontCharacter: "\uEB9E" },
    "scm-conflict": { fontCharacter: "\uEADE" },
    // Notification Icons
    "notification-info": { fontCharacter: "\uEA74" },
    "notification-warning": { fontCharacter: "\uEA6C" },
    "notification-error": { fontCharacter: "\uEA76" }, // x
    "notification-success": { fontCharacter: "\uEA78" }, // check
    // Widget Icons
    "widget-close": { fontCharacter: "\uEA76" },
    "widget-expand": { fontCharacter: "\uEABD" },
    "widget-collapse": { fontCharacter: "\uEABC" },
    "widget-drag": { fontCharacter: "\uEB0E" },
  },
};

// ============================================================================
// Built-in Icon Theme: Fluent
// ============================================================================

const FLUENT_THEME: ProductIconTheme = {
  id: "fluent",
  label: "Fluent",
  description: "Microsoft Fluent-inspired icons with rounded, friendly shapes",
  fontFamily: "codicon",
  icons: {
    // Activity Bar Icons - Using filled/alternate variants where available
    "activity-bar-explorer": { fontCharacter: "\uEB97" }, // folder-library
    "activity-bar-search": { fontCharacter: "\uEB51" },
    "activity-bar-scm": { fontCharacter: "\uEB1F" }, // source-control
    "activity-bar-debug": { fontCharacter: "\uEB42" }, // debug-alt
    "activity-bar-extensions": { fontCharacter: "\uEB07" },
    "activity-bar-accounts": { fontCharacter: "\uEB99" }, // account
    "activity-bar-settings": { fontCharacter: "\uEB98" }, // settings
    "activity-bar-terminal": { fontCharacter: "\uEB63" },
    "activity-bar-ai": { fontCharacter: "\uEB79" }, // sparkle
    "activity-bar-journal": { fontCharacter: "\uEB0C" },
    "activity-bar-remote": { fontCharacter: "\uEB39" },
    // View Icons
    "view-files": { fontCharacter: "\uEB97" },
    "view-folder": { fontCharacter: "\uEB64" },
    "view-folder-open": { fontCharacter: "\uEB65" },
    "view-file-code": { fontCharacter: "\uEB0D" },
    "view-file-text": { fontCharacter: "\uEB85" },
    "view-file-media": { fontCharacter: "\uEB29" },
    "view-file-binary": { fontCharacter: "\uEB05" },
    "view-symlink": { fontCharacter: "\uEB5F" },
    "view-outline": { fontCharacter: "\uEB9F" },
    "view-timeline": { fontCharacter: "\uEB61" },
    // Action Icons - Using circle/filled variants
    "action-close": { fontCharacter: "\uEAB8" },
    "action-close-all": { fontCharacter: "\uEAB9" },
    "action-add": { fontCharacter: "\uEABC" }, // add with circle feel
    "action-remove": { fontCharacter: "\uEB44" },
    "action-edit": { fontCharacter: "\uEA6F" },
    "action-save": { fontCharacter: "\uEB4A" },
    "action-refresh": { fontCharacter: "\uEB37" },
    "action-pin": { fontCharacter: "\uEB2E" },
    "action-unpin": { fontCharacter: "\uEB2F" },
    "action-split-horizontal": { fontCharacter: "\uEB56" },
    "action-split-vertical": { fontCharacter: "\uEB57" },
    "action-maximize": { fontCharacter: "\uEB71" },
    "action-minimize": { fontCharacter: "\uEB72" },
    "action-collapse": { fontCharacter: "\uEA99" }, // fold-up
    "action-expand": { fontCharacter: "\uEA9A" }, // fold-down
    "action-search": { fontCharacter: "\uEB51" },
    "action-filter": { fontCharacter: "\uEB08" },
    "action-sort": { fontCharacter: "\uEB5C" },
    "action-more": { fontCharacter: "\uEA7C" },
    "action-run": { fontCharacter: "\uEB91" },
    "action-stop": { fontCharacter: "\uEB5E" },
    "action-debug": { fontCharacter: "\uEB42" },
    "action-copy": { fontCharacter: "\uEABE" },
    "action-paste": { fontCharacter: "\uEB4E" },
    "action-cut": { fontCharacter: "\uEB46" },
    "action-undo": { fontCharacter: "\uEB6A" },
    "action-redo": { fontCharacter: "\uEB6B" },
    // Status Bar Icons
    "statusbar-error": { fontCharacter: "\uEB45" }, // error with circle
    "statusbar-warning": { fontCharacter: "\uEA6C" },
    "statusbar-info": { fontCharacter: "\uEA74" },
    "statusbar-sync": { fontCharacter: "\uEB4C" },
    "statusbar-sync-spin": { fontCharacter: "\uEAF4" },
    "statusbar-bell": { fontCharacter: "\uEA79" },
    "statusbar-check": { fontCharacter: "\uEBB3" }, // pass-filled
    "statusbar-feedback": { fontCharacter: "\uEB16" },
    "statusbar-remote": { fontCharacter: "\uEB39" },
    "statusbar-git-branch": { fontCharacter: "\uEA68" },
    "statusbar-git-commit": { fontCharacter: "\uEA69" },
    // Breadcrumb Icons
    "breadcrumb-separator": { fontCharacter: "\uEABF" },
    "breadcrumb-folder": { fontCharacter: "\uEB64" },
    "breadcrumb-file": { fontCharacter: "\uEB62" },
    "breadcrumb-symbol": { fontCharacter: "\uEA8B" },
    // Editor Icons
    "editor-modified": { fontCharacter: "\uEBCB" }, // circle-filled
    "editor-readonly": { fontCharacter: "\uEABC" },
    "editor-deleted": { fontCharacter: "\uEA81" },
    "editor-added": { fontCharacter: "\uEABC" },
    "editor-renamed": { fontCharacter: "\uEB3A" },
    "editor-conflict": { fontCharacter: "\uEADE" },
    // Debug Icons
    "debug-breakpoint": { fontCharacter: "\uEBCB" }, // circle-filled
    "debug-breakpoint-disabled": { fontCharacter: "\uEBCC" }, // circle-outline
    "debug-breakpoint-conditional": { fontCharacter: "\uEAAE" },
    "debug-breakpoint-log": { fontCharacter: "\uEAB0" },
    "debug-continue": { fontCharacter: "\uEACF" },
    "debug-pause": { fontCharacter: "\uEAD0" },
    "debug-step-over": { fontCharacter: "\uEAD4" },
    "debug-step-into": { fontCharacter: "\uEAD2" },
    "debug-step-out": { fontCharacter: "\uEAD3" },
    "debug-restart": { fontCharacter: "\uEAD1" },
    "debug-stop": { fontCharacter: "\uEAD5" },
    // SCM Icons
    "scm-staged": { fontCharacter: "\uEBB3" }, // pass-filled
    "scm-modified": { fontCharacter: "\uEBCB" }, // circle-filled
    "scm-added": { fontCharacter: "\uEABC" },
    "scm-deleted": { fontCharacter: "\uEA81" },
    "scm-renamed": { fontCharacter: "\uEB3A" },
    "scm-untracked": { fontCharacter: "\uEB4D" },
    "scm-ignored": { fontCharacter: "\uEB9E" },
    "scm-conflict": { fontCharacter: "\uEADE" },
    // Notification Icons
    "notification-info": { fontCharacter: "\uEA74" },
    "notification-warning": { fontCharacter: "\uEA6C" },
    "notification-error": { fontCharacter: "\uEB45" },
    "notification-success": { fontCharacter: "\uEBB3" },
    // Widget Icons
    "widget-close": { fontCharacter: "\uEAB8" },
    "widget-expand": { fontCharacter: "\uEA9A" },
    "widget-collapse": { fontCharacter: "\uEA99" },
    "widget-drag": { fontCharacter: "\uEB0E" },
  },
};

// ============================================================================
// Built-in Themes Registry
// ============================================================================

export const BUILT_IN_PRODUCT_ICON_THEMES: ProductIconTheme[] = [
  DEFAULT_CODICONS_THEME,
  MINIMAL_THEME,
  FLUENT_THEME,
];

// ============================================================================
// Storage Key
// ============================================================================

const STORAGE_KEY_PRODUCT_ICON_THEME = "cortex-product-icon-theme";
const STORAGE_KEY_CUSTOM_THEMES = "cortex-custom-product-icon-themes";

// ============================================================================
// Context Value Interface
// ============================================================================

interface ProductIconThemeContextValue {
  // Current product icon theme
  productIconTheme: () => ProductIconTheme;
  productIconThemeId: () => string;
  setProductIconTheme: (themeId: string) => void;
  
  // Available themes
  productIconThemes: () => ProductIconTheme[];
  
  // Get icon for specific ID
  getProductIcon: (iconId: ProductIconId) => ProductIconDefinition;
  
  // Get icon character (convenience method)
  getProductIconChar: (iconId: ProductIconId) => string;
  
  // Get icons by category
  getProductIconsByCategory: (category: ProductIconCategory) => Array<{
    id: ProductIconId;
    icon: ProductIconDefinition;
  }>;
  
  // Custom themes management
  addCustomProductIconTheme: (theme: ProductIconTheme) => boolean;
  removeCustomProductIconTheme: (themeId: string) => boolean;
  
  // Theme font CSS
  getThemeFontFamily: () => string;
}

const ProductIconThemeContext = createContext<ProductIconThemeContextValue>();

// ============================================================================
// Helper Functions
// ============================================================================

function loadThemeIdFromStorage(): string {
  if (typeof localStorage === "undefined") {
    return DEFAULT_CODICONS_THEME.id;
  }
  return localStorage.getItem(STORAGE_KEY_PRODUCT_ICON_THEME) || DEFAULT_CODICONS_THEME.id;
}

function saveThemeIdToStorage(themeId: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY_PRODUCT_ICON_THEME, themeId);
}

function loadCustomThemesFromStorage(): ProductIconTheme[] {
  if (typeof localStorage === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_THEMES);
    if (!stored) {
      return [];
    }
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    return parsed.filter(isValidProductIconTheme);
  } catch (err) {
    console.debug("[ProductIconTheme] Load themes failed:", err);
    return [];
  }
}

function saveCustomThemesToStorage(themes: ProductIconTheme[]): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(themes));
  } catch (err) {
    console.debug("[ProductIconTheme] Save themes failed:", err);
  }
}

function isValidProductIconTheme(theme: unknown): theme is ProductIconTheme {
  if (typeof theme !== "object" || theme === null) {
    return false;
  }
  
  const t = theme as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.label === "string" &&
    typeof t.description === "string" &&
    typeof t.fontFamily === "string" &&
    typeof t.icons === "object" &&
    t.icons !== null
  );
}

function getCategoryPrefix(category: ProductIconCategory): string {
  const prefixMap: Record<ProductIconCategory, string> = {
    activityBar: "activity-bar-",
    view: "view-",
    action: "action-",
    statusBar: "statusbar-",
    breadcrumb: "breadcrumb-",
    editor: "editor-",
    debug: "debug-",
    scm: "scm-",
    notification: "notification-",
    widget: "widget-",
  };
  return prefixMap[category];
}

// ============================================================================
// Product Icon Theme Provider Component
// ============================================================================

export function ProductIconThemeProvider(props: ParentProps) {
  const [currentThemeId, setCurrentThemeId] = createSignal(loadThemeIdFromStorage());
  const [customThemes, setCustomThemes] = createSignal<ProductIconTheme[]>(
    loadCustomThemesFromStorage()
  );

  // All available themes (built-in + custom)
  const productIconThemes = createMemo(() => [
    ...BUILT_IN_PRODUCT_ICON_THEMES,
    ...customThemes(),
  ]);

  // Current theme object
  const productIconTheme = createMemo(() => {
    const themes = productIconThemes();
    const found = themes.find((t) => t.id === currentThemeId());
    return found || DEFAULT_CODICONS_THEME;
  });

  // Set theme
  const setProductIconTheme = (themeId: string) => {
    const themes = productIconThemes();
    const exists = themes.some((t) => t.id === themeId);
    
    if (!exists) {
      console.warn(`[ProductIconTheme] Theme "${themeId}" not found, using default`);
      themeId = DEFAULT_CODICONS_THEME.id;
    }
    
    setCurrentThemeId(themeId);
    saveThemeIdToStorage(themeId);
    
    window.dispatchEvent(new CustomEvent("producticontheme:changed", {
      detail: { themeId },
    }));
  };

  // Get icon by ID
  const getProductIcon = (iconId: ProductIconId): ProductIconDefinition => {
    const theme = productIconTheme();
    const icon = theme.icons[iconId];
    
    if (!icon) {
      console.warn(`[ProductIconTheme] Icon "${iconId}" not found in theme "${theme.id}"`);
      return { fontCharacter: "\uEB62", fontFamily: theme.fontFamily }; // default file icon
    }
    
    return {
      fontCharacter: icon.fontCharacter,
      fontFamily: icon.fontFamily || theme.fontFamily,
    };
  };

  // Get icon character (convenience)
  const getProductIconChar = (iconId: ProductIconId): string => {
    return getProductIcon(iconId).fontCharacter;
  };

  // Get icons by category
  const getProductIconsByCategory = (category: ProductIconCategory) => {
    const theme = productIconTheme();
    const prefix = getCategoryPrefix(category);
    
    return Object.entries(theme.icons)
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, icon]) => ({
        id: id as ProductIconId,
        icon,
      }));
  };

  // Add custom theme
  const addCustomProductIconTheme = (theme: ProductIconTheme): boolean => {
    if (!isValidProductIconTheme(theme)) {
      console.error("[ProductIconTheme] Invalid theme structure");
      return false;
    }
    
    // Check for ID collision
    const allThemes = productIconThemes();
    if (allThemes.some((t) => t.id === theme.id)) {
      console.error(`[ProductIconTheme] Theme with ID "${theme.id}" already exists`);
      return false;
    }
    
    const updated = [...customThemes(), theme];
    setCustomThemes(updated);
    saveCustomThemesToStorage(updated);
    
    window.dispatchEvent(new CustomEvent("producticontheme:custom-added", {
      detail: { themeId: theme.id },
    }));
    
    return true;
  };

  // Remove custom theme
  const removeCustomProductIconTheme = (themeId: string): boolean => {
    const current = customThemes();
    const index = current.findIndex((t) => t.id === themeId);
    
    if (index === -1) {
      console.warn(`[ProductIconTheme] Custom theme "${themeId}" not found`);
      return false;
    }
    
    // If removing the currently active theme, switch to default
    if (currentThemeId() === themeId) {
      setProductIconTheme(DEFAULT_CODICONS_THEME.id);
    }
    
    const updated = current.filter((t) => t.id !== themeId);
    setCustomThemes(updated);
    saveCustomThemesToStorage(updated);
    
    window.dispatchEvent(new CustomEvent("producticontheme:custom-removed", {
      detail: { themeId },
    }));
    
    return true;
  };

  // Get font family
  const getThemeFontFamily = () => productIconTheme().fontFamily;

  // Apply CSS custom properties for the current theme
  createEffect(() => {
    const theme = productIconTheme();
    const root = document.documentElement;
    
    // Set font family
    root.style.setProperty("--product-icon-font", theme.fontFamily);
    
    // Set commonly used icon characters as CSS custom properties
    const iconVars: Array<[ProductIconId, string]> = [
      ["action-close", "close"],
      ["action-add", "add"],
      ["action-remove", "remove"],
      ["action-edit", "edit"],
      ["action-save", "save"],
      ["action-refresh", "refresh"],
      ["action-search", "search"],
      ["action-more", "more"],
      ["statusbar-error", "error"],
      ["statusbar-warning", "warning"],
      ["statusbar-info", "info"],
      ["statusbar-check", "check"],
    ];
    
    for (const [iconId, varName] of iconVars) {
      const icon = theme.icons[iconId];
      if (icon) {
        root.style.setProperty(`--icon-${varName}`, `"${icon.fontCharacter}"`);
      }
    }
  });

  const value: ProductIconThemeContextValue = {
    productIconTheme,
    productIconThemeId: currentThemeId,
    setProductIconTheme,
    productIconThemes,
    getProductIcon,
    getProductIconChar,
    getProductIconsByCategory,
    addCustomProductIconTheme,
    removeCustomProductIconTheme,
    getThemeFontFamily,
  };

  return (
    <ProductIconThemeContext.Provider value={value}>
      {props.children}
    </ProductIconThemeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useProductIconTheme() {
  const ctx = useContext(ProductIconThemeContext);
  if (!ctx) {
    throw new Error("useProductIconTheme must be used within ProductIconThemeProvider");
  }
  return ctx;
}

// ============================================================================
// Exported Types and Constants
// ============================================================================

export const ALL_PRODUCT_ICON_IDS: ProductIconId[] = Object.keys(
  DEFAULT_CODICONS_THEME.icons
) as ProductIconId[];

export const PRODUCT_ICON_CATEGORIES: ProductIconCategory[] = [
  "activityBar",
  "view",
  "action",
  "statusBar",
  "breadcrumb",
  "editor",
  "debug",
  "scm",
  "notification",
  "widget",
];

export const PRODUCT_ICON_CATEGORY_LABELS: Record<ProductIconCategory, string> = {
  activityBar: "Activity Bar",
  view: "View",
  action: "Actions",
  statusBar: "Status Bar",
  breadcrumb: "Breadcrumb",
  editor: "Editor",
  debug: "Debug",
  scm: "Source Control",
  notification: "Notifications",
  widget: "Widgets",
};
