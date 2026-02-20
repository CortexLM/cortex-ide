/**
 * Centralized Event Names and Typed Event System
 * 
 * This module provides:
 * 1. Centralized event name constants to prevent typos
 * 2. Type-safe event dispatching and listening
 * 3. Event payload types for compile-time safety
 */

// ============================================================================
// Event Name Constants
// ============================================================================

/**
 * Centralized event names organized by feature domain.
 * Use these constants instead of hardcoded strings to prevent typos.
 */
export const EVENTS = {
  // -------------------------------------------------------------------------
  // Workspace Events
  // -------------------------------------------------------------------------
  WORKSPACE: {
    FOLDER_ADDED: 'workspace:folder-added',
    FOLDER_REMOVED: 'workspace:folder-removed',
    LOADED: 'workspace:loaded',
    CLOSED: 'workspace:closed',
    OPEN_FOLDER: 'workspace:open-folder',
    CHANGE: 'workspace:change',
    CD: 'workspace:cd',
    TRUST_CHANGED: 'workspace:trust-changed',
    TRUST_CLEARED: 'workspace:trust-cleared',
    TRUSTED_FOLDER_ADDED: 'workspace:trusted-folder-added',
    TRUSTED_FOLDER_REMOVED: 'workspace:trusted-folder-removed',
  },

  // -------------------------------------------------------------------------
  // Editor Events
  // -------------------------------------------------------------------------
  EDITOR: {
    FILE_OPENED: 'editor:file-opened',
    FILE_CLOSED: 'editor:file-closed',
    FILE_CLOSING: 'editor:file-closing',
    OPEN_FILE: 'editor:open-file',
    CURSOR_CHANGED: 'editor:cursor-changed',
    SET_CURSOR_POSITION: 'editor:set-cursor-position',
    GOTO_LINE: 'editor:goto-line',
    GOTO: 'editor:goto',
    REQUEST_FIND_REFERENCES: 'editor:request-find-references',
    NAVIGATE_TO: 'editor:navigate-to',
    SCROLL_TO_LINE: 'editor:scrollToLine',
    HIGHLIGHT: 'editor:highlight',
    AGENT_ACTIVE: 'editor:agentActive',
    AGENT_INACTIVE: 'editor:agentInactive',
    ACTION: 'editor:action',
    NEXT_TAB: 'editor:next-tab',
    PREV_TAB: 'editor:prev-tab',
    APPLY_EDIT: 'editor:apply-edit',
    CLOSE_READONLY_DEBUG_TABS: 'editor:close-readonly-debug-tabs',
    // Legacy non-namespaced events (for backward compatibility)
    CURSOR_CHANGE: 'editor-cursor-change',
    COMMAND: 'editor-command',
    FORMAT_DOCUMENT: 'editor-format-document',
    FORMAT_ON_PASTE_CHANGED: 'editor-format-on-paste-changed',
    LINKED_EDITING_CHANGED: 'editor-linked-editing-changed',
    SAVE_REQUESTED: 'editor-save-requested',
    SPLIT: 'editor-split',
    CLOSE_GROUP: 'editor-close-group',
    PIN_TAB: 'editor-pin-tab',
    UNPIN_TAB: 'editor-unpin-tab',
    TOGGLE_PIN_TAB: 'editor-toggle-pin-tab',
    FOCUS_NEXT_GROUP: 'editor-focus-next-group',
    FOCUS_PREVIOUS_GROUP: 'editor-focus-previous-group',
    UNSPLIT: 'editor-unsplit',
    TOGGLE_WORD_WRAP: 'editor-toggle-word-wrap',
    TOGGLE_MINIMAP: 'editor-toggle-minimap',
    TOGGLE_STICKY_SCROLL: 'editor-toggle-sticky-scroll',
  },

  // -------------------------------------------------------------------------
  // File Events
  // -------------------------------------------------------------------------
  FILE: {
    NEW: 'file:new',
    OPEN: 'file:open',
    SAVED: 'file:saved',
    CHANGED: 'file:changed',
    RELOAD: 'file:reload',
    RELOAD_REQUEST: 'file:reload-request',
    CREATE: 'file:create',
    SAVE_WITHOUT_FORMATTING: 'file:save-without-formatting',
  },

  // -------------------------------------------------------------------------
  // File Explorer Events
  // -------------------------------------------------------------------------
  EXPLORER: {
    REVEAL: 'explorer:reveal',
    FILE_REVEAL: 'file-explorer:reveal',
  },

  // -------------------------------------------------------------------------
  // Folder Events
  // -------------------------------------------------------------------------
  FOLDER: {
    OPEN: 'folder:open',
  },

  // -------------------------------------------------------------------------
  // Git Events
  // -------------------------------------------------------------------------
  GIT: {
    CLONE: 'git:clone',
    TOGGLE: 'git:toggle',
    REFRESH: 'git:refresh',
    OPERATION: 'git:operation',
    GO_TO_NEXT_CHANGE: 'git:go-to-next-change',
    GO_TO_PREV_CHANGE: 'git:go-to-prev-change',
  },

  // -------------------------------------------------------------------------
  // Navigation Events
  // -------------------------------------------------------------------------
  NAVIGATION: {
    BACK: 'navigation:back',
    FORWARD: 'navigation:forward',
    SIGNIFICANT: 'navigation:significant',
    GOTO_LINE: 'goto-line',
    NAVIGATE_TO_LINE: 'navigate-to-line',
    NAVIGATE_TO_LOCATION: 'navigate-to-location',
  },

  // -------------------------------------------------------------------------
  // Settings Events
  // -------------------------------------------------------------------------
  SETTINGS: {
    OPEN: 'settings:open-tab',
    CHANGED: 'settings:changed',
    RESET: 'settings:reset',
    IMPORTED: 'settings:imported',
    WORKSPACE_LOADED: 'settings:workspace-loaded',
    WORKSPACE_CLEARED: 'settings:workspace-cleared',
    WORKSPACE_CHANGED: 'settings:workspace-changed',
    WORKSPACE_RESET: 'settings:workspace-reset',
    FOLDER_LOADED: 'settings:folder-loaded',
    FOLDER_SAVED: 'settings:folder-saved',
    FOLDER_CHANGED: 'settings:folder-changed',
    FOLDER_RESET: 'settings:folder-reset',
    FOLDER_CLEARED: 'settings:folder-cleared',
    LANGUAGE_OVERRIDE_CHANGED: 'settings:language-override-changed',
    LANGUAGE_OVERRIDE_RESET: 'settings:language-override-reset',
    FILE_ASSOCIATION_CHANGED: 'settings:file-association-changed',
    FILE_ASSOCIATION_REMOVED: 'settings:file-association-removed',
    RESET_TO_DEFAULT: 'settings:reset-to-default',
    PROFILE_CHANGED: 'settings:profile-changed',
  },

  // -------------------------------------------------------------------------
  // Theme Events
  // -------------------------------------------------------------------------
  THEME: {
    TOGGLE: 'theme:toggle',
    SET: 'theme:set',
    PREVIEW_STARTED: 'theme:preview-started',
    PREVIEW_STOPPED: 'theme:preview-stopped',
    PREVIEW_APPLIED: 'theme:preview-applied',
    COLOR_CHANGED: 'theme:color-changed',
    CUSTOMIZATIONS_RESET: 'theme:customizations-reset',
    CATEGORY_RESET: 'theme:category-reset',
    CUSTOMIZATIONS_IMPORTED: 'theme:customizations-imported',
    VSCODE_EXTENSION_APPLIED: 'theme:vscode-extension-applied',
    VSCODE_EXTENSION_CLEARED: 'theme:vscode-extension-cleared',
  },

  // -------------------------------------------------------------------------
  // Terminal Events
  // -------------------------------------------------------------------------
  TERMINAL: {
    NEW: 'terminal:new',
    TOGGLE: 'terminal:toggle',
    SPLIT: 'terminal:split',
    SPLIT_CURRENT: 'terminal:split-current',
    CLEAR: 'terminal:clear',
    KILL: 'terminal:kill',
    RUN: 'terminal:run',
    SELECT_ALL: 'terminal:select-all',
    GO_TO_PREV_COMMAND: 'terminal:goToPrevCommand',
    GO_TO_NEXT_COMMAND: 'terminal:goToNextCommand',
    CREATED: 'terminal:created',
    OUTPUT: 'terminal:output',
    STATUS: 'terminal:status',
  },

  // -------------------------------------------------------------------------
  // View Events
  // -------------------------------------------------------------------------
  VIEW: {
    FOCUS: 'view:focus',
    TOGGLE_AGENT_PANEL: 'view:toggle-agent-panel',
    TOGGLE_CHAT: 'view:toggle-chat',
    ZOOM_IN: 'view:zoom-in',
    ZOOM_OUT: 'view:zoom-out',
    ZOOM_RESET: 'view:zoom-reset',
    TOGGLE_FULLSCREEN: 'view:toggle-fullscreen',
    MODE_CHANGE: 'viewmode:change',
  },

  // -------------------------------------------------------------------------
  // Sidebar Events
  // -------------------------------------------------------------------------
  SIDEBAR: {
    TOGGLE: 'sidebar:toggle',
    TOGGLE_POSITION: 'sidebar:toggle-position',
  },

  // -------------------------------------------------------------------------
  // Layout Events
  // -------------------------------------------------------------------------
  LAYOUT: {
    TOGGLE_PANEL: 'layout:toggle-panel',
    FOCUS_EXPLORER: 'layout:focus-explorer',
    FOCUS_DEBUG: 'layout:focus-debug',
    RESET: 'reset-layout',
  },

  // -------------------------------------------------------------------------
  // Search Events
  // -------------------------------------------------------------------------
  SEARCH: {
    OPEN: 'search:open',
    FOCUS_REPLACE: 'search:focus-replace',
    BUFFER_SHOW_REPLACE: 'buffer-search:show-replace',
    BUFFER_GET_SELECTION: 'buffer-search:get-selection',
    BUFFER_SELECTION_RESPONSE: 'buffer-search:selection-response',
    BUFFER_HIGHLIGHTS: 'buffer-search-highlights',
    BUFFER_GOTO: 'buffer-search-goto',
  },

  // -------------------------------------------------------------------------
  // Notification Events
  // -------------------------------------------------------------------------
  NOTIFICATION: {
    SHOW: 'notification:show',
    NEW: 'notification:new',
    ACTION: 'notification:action',
    LEGACY: 'notification',
  },

  // -------------------------------------------------------------------------
  // Toast Events
  // -------------------------------------------------------------------------
  TOAST: {
    SHOW: 'toast:show',
    ACTION: 'toast:action',
  },

  // -------------------------------------------------------------------------
  // AI / Chat Events
  // -------------------------------------------------------------------------
  AI: {
    SUBAGENTS: 'ai:subagents',
    FORK: 'ai:fork',
    SKILL: 'ai:skill',
    FILE: 'ai:file',
    SEARCH: 'ai:search',
    REQUEST_SELECTION: 'ai:request-selection',
    SELECTION_RESPONSE: 'ai:selection-response',
    REQUEST_WORKSPACE: 'ai:request-workspace',
    WORKSPACE_RESPONSE: 'ai:workspace-response',
    REQUEST_TERMINAL: 'ai:request-terminal',
    TERMINAL_RESPONSE: 'ai:terminal-response',
    SLASH_COMMAND_RESULT: 'ai:slash-command-result',
  },

  // -------------------------------------------------------------------------
  // Chat Events
  // -------------------------------------------------------------------------
  CHAT: {
    CLEAR: 'chat:clear',
    OPEN: 'chat:open',
  },

  // -------------------------------------------------------------------------
  // Agent Panel Events
  // -------------------------------------------------------------------------
  AGENT_PANEL: {
    NEW_THREAD: 'agent-panel:new-thread',
  },

  // -------------------------------------------------------------------------
  // Subagent Events
  // -------------------------------------------------------------------------
  SUBAGENT: {
    OPEN_MANAGER: 'subagent:open-manager',
    CREATE_NEW: 'subagent:create-new',
    SELECT: 'subagent:select',
    EXPORT: 'subagent:export',
    IMPORT: 'subagent:import',
    CHANGED: 'subagent:changed',
  },

  // -------------------------------------------------------------------------
  // Cortex Events
  // -------------------------------------------------------------------------
  CORTEX: {
    CLEAR_ERROR: 'cortex:clear-error',
    NAVIGATE: 'cortex:navigate',
    FILE_SAVED: 'cortex:file_saved',
    TERMINAL_CREATED: 'cortex:terminal_created',
    TERMINAL_OUTPUT: 'cortex:terminal_output',
    TERMINAL_STATUS: 'cortex:terminal_status',
    TERMINAL_LIST: 'cortex:terminal_list',
    WINDOW_OPEN_REQUEST: 'cortex:window-open-request',
    WINDOW_CLOSE_REQUEST: 'cortex:window-close-request',
    WINDOW_MERGE_REQUEST: 'cortex:window-merge-request',
    WINDOW_READY: 'cortex:window-ready',
    WINDOW_EVENT: 'cortex:window-event',
    WINDOW_BROADCAST: 'cortex:window-broadcast',
    STATE_SYNC: 'cortex:state-sync',
  },

  // -------------------------------------------------------------------------
  // Tasks Events
  // -------------------------------------------------------------------------
  TASKS: {
    OPEN_RUN_DIALOG: 'tasks:open-run-dialog',
    RUN_BUILD: 'tasks:run-build',
    RUN_TEST: 'tasks:run-test',
    OPEN_PANEL: 'tasks:open-panel',
    OPEN_CONFIG_EDITOR: 'tasks:open-config-editor',
    REFRESH: 'tasks:refresh',
    BACKGROUND_STATUS: 'task:background-status',
    PARSED_DIAGNOSTICS: 'task:parsed-diagnostics',
  },

  // -------------------------------------------------------------------------
  // Testing Events
  // -------------------------------------------------------------------------
  TESTING: {
    RUN_ALL: 'testing:run-all',
    RUN_FAILED: 'testing:run-failed',
    STOP: 'testing:stop',
    REFRESH: 'testing:refresh',
    DEBUG_TEST: 'testing:debug-test',
    COVERAGE_UPDATED: 'testing:coverage-updated',
    COVERAGE_VISIBILITY_CHANGED: 'testing:coverage-visibility-changed',
    COVERAGE_CLEARED: 'testing:coverage-cleared',
    RUN_STARTED: 'testing:run-started',
    RUN_COMPLETE: 'testing:run-complete',
    RUN_ERROR: 'testing:run-error',
    OUTPUT: 'testing:output',
    AUTO_RUN: 'testing:auto-run',
    FILE_CHANGED: 'testing:file-changed',
    WATCH_STARTED: 'testing:watch-started',
    WATCH_STOPPED: 'testing:watch-stopped',
    WATCH_ERROR: 'testing:watch-error',
    WATCH_CREATED: 'testing:watch-created',
  },

  // -------------------------------------------------------------------------
  // Debug Events
  // -------------------------------------------------------------------------
  DEBUG: {
    CLEARED: 'debug:cleared',
    REQUEST_SETTINGS: 'debug:request-settings',
    HOT_RELOAD: 'debug:hotReload',
    INLINE_VALUES_UPDATED: 'debug:inlineValuesUpdated',
    EVENT: 'debug:event',
  },

  // -------------------------------------------------------------------------
  // LSP Events
  // -------------------------------------------------------------------------
  LSP: {
    EXECUTE_COMMAND: 'lsp:execute-command',
    REQUEST_CODE_ACTIONS: 'lsp:request-code-actions',
    PROGRESS: 'lsp:progress',
  },

  // -------------------------------------------------------------------------
  // Profiles Events
  // -------------------------------------------------------------------------
  PROFILES: {
    SWITCH: 'profiles:switch',
    CREATED: 'profiles:created',
    DELETED: 'profiles:deleted',
    UPDATED: 'profiles:updated',
    SWITCHED: 'profiles:switched',
    IMPORTED: 'profiles:imported',
    TOGGLE_QUICK_SWITCH: 'profiles:toggle-quick-switch',
    OPEN_CREATE_MODAL: 'profiles:open-create-modal',
    EXPORT_CURRENT: 'profiles:export-current',
    IMPORT: 'profiles:import',
  },

  // -------------------------------------------------------------------------
  // Sync Events
  // -------------------------------------------------------------------------
  SYNC: {
    KEYBINDINGS_IMPORTED: 'keybindings:imported',
    KEYBINDINGS_PROFILE_CHANGED: 'keybindings:profile-changed',
    SNIPPETS_IMPORTED: 'snippets:imported',
    SNIPPETS_PROFILE_CHANGED: 'snippets:profile-changed',
    UI_STATE_IMPORTED: 'uistate:imported',
    UI_PROFILE_CHANGED: 'ui:profile-changed',
    EXTENSIONS_IMPORTED: 'extensions:imported',
  },

  // -------------------------------------------------------------------------
  // Screencast Mode Events
  // -------------------------------------------------------------------------
  SCREENCAST: {
    TOGGLE: 'screencast:toggle',
    ENABLE: 'screencast:enable',
    DISABLE: 'screencast:disable',
    SETTINGS_CHANGED: 'screencast:settings-changed',
  },

  // -------------------------------------------------------------------------
  // Zen Mode Events
  // -------------------------------------------------------------------------
  ZENMODE: {
    TOGGLE: 'zenmode:toggle',
    ENTER: 'zenmode:enter',
    EXIT: 'zenmode:exit',
    HIDE_LINE_NUMBERS: 'zenmode:hide-line-numbers',
    RESTORE_LINE_NUMBERS: 'zenmode:restore-line-numbers',
    HIDE_TABS: 'zenmode:hide-tabs',
    HIDE_ACTIVITY_BAR: 'zenmode:hide-activity-bar',
    HIDE_SIDEBAR: 'zenmode:hide-sidebar',
    HIDE_STATUS_BAR: 'zenmode:hide-status-bar',
    HIDE_PANEL: 'zenmode:hide-panel',
    HIDE_MENU_BAR: 'zenmode:hide-menu-bar',
    SILENCE_NOTIFICATIONS: 'zenmode:silence-notifications',
    RESTORE_STATE: 'zenmode:restore-state',
  },

  // -------------------------------------------------------------------------
  // Centered Layout Events
  // -------------------------------------------------------------------------
  CENTERED_LAYOUT: {
    TOGGLE: 'centered-layout:toggle',
    ENTER: 'centered-layout:enter',
    EXIT: 'centered-layout:exit',
  },

  // -------------------------------------------------------------------------
  // Bookmarks Events
  // -------------------------------------------------------------------------
  BOOKMARKS: {
    TOGGLE: 'bookmarks:toggle',
    NEXT: 'bookmarks:next',
    PREV: 'bookmarks:prev',
    SHOW_PANEL: 'bookmarks:show-panel',
    PANEL_OPENED: 'bookmarks:panel-opened',
    CLEAR_ALL: 'bookmarks:clear-all',
  },

  // -------------------------------------------------------------------------
  // References Events
  // -------------------------------------------------------------------------
  REFERENCES: {
    FIND: 'references:find',
    TOGGLE: 'references:toggle',
  },

  // -------------------------------------------------------------------------
  // Outline Events
  // -------------------------------------------------------------------------
  OUTLINE: {
    NAVIGATE: 'outline:navigate',
  },

  // -------------------------------------------------------------------------
  // Remote Events
  // -------------------------------------------------------------------------
  REMOTE: {
    PORT_DETECTED: 'remote:port-detected',
    TUNNEL_CREATED: 'remote:tunnel-created',
    TUNNEL_CONNECTED: 'remote:tunnel-connected',
    TUNNEL_CLOSED: 'remote:tunnel-closed',
    SHOW_WSL: 'remote:show-wsl',
    EVENT: 'remote:event',
  },

  // -------------------------------------------------------------------------
  // DevContainer Events
  // -------------------------------------------------------------------------
  DEVCONTAINER: {
    CONNECTED: 'devcontainer:connected',
    DISCONNECTED: 'devcontainer:disconnected',
    BUILD_PROGRESS: 'devcontainer:build-progress',
  },

  // -------------------------------------------------------------------------
  // Recent Projects Events
  // -------------------------------------------------------------------------
  RECENT_PROJECTS: {
    OPEN: 'recent-projects:open',
  },

  // -------------------------------------------------------------------------
  // Welcome Events
  // -------------------------------------------------------------------------
  WELCOME: {
    SHOW: 'welcome:show',
  },

  // -------------------------------------------------------------------------
  // Walkthrough Events
  // -------------------------------------------------------------------------
  WALKTHROUGHS: {
    SHOW: 'walkthroughs:show',
    SHOW_SINGLE: 'walkthrough:show',
  },

  // -------------------------------------------------------------------------
  // Command Events
  // -------------------------------------------------------------------------
COMMAND: {
    EXECUTE: 'command:execute',
    GIT_CLONE: 'command:git.clone',
    GIT_WORKTREE_ADD: 'command:git.worktreeAdd',
    GIT_WORKTREE_REMOVE: 'command:git.worktreeRemove',
    GIT_WORKTREE_LIST: 'command:git.worktreeList',
    PALETTE_TOGGLE: 'command-palette:toggle',
  },

  // -------------------------------------------------------------------------
  // Config Events
  // -------------------------------------------------------------------------
  CONFIG: {
    SET_MODEL: 'config:set-model',
  },

  // -------------------------------------------------------------------------
  // Feedback Events
  // -------------------------------------------------------------------------
  FEEDBACK: {
    OPEN: 'feedback:open',
  },

  // -------------------------------------------------------------------------
  // Dev Tools Events
  // -------------------------------------------------------------------------
  DEV: {
    OPEN_COMPONENT_PREVIEW: 'dev:open-component-preview',
    TOGGLE_DEVTOOLS: 'dev:toggle-devtools',
  },

  // -------------------------------------------------------------------------
  // Process Explorer Events
  // -------------------------------------------------------------------------
  PROCESS_EXPLORER: {
    OPEN: 'process-explorer:open',
    TOGGLE: 'process-explorer:toggle',
  },

  // -------------------------------------------------------------------------
  // Inspector Events
  // -------------------------------------------------------------------------
  INSPECTOR: {
    OPEN: 'inspector:open',
    TOGGLE: 'inspector:toggle',
  },

  // -------------------------------------------------------------------------
  // Problems Events
  // -------------------------------------------------------------------------
  PROBLEMS: {
    TOGGLE: 'problems:toggle',
  },

  // -------------------------------------------------------------------------
  // Snippet Events
  // -------------------------------------------------------------------------
  SNIPPET: {
    SESSION_START: 'snippet-session-start',
    SESSION_END: 'snippet-session-end',
    PLACEHOLDER_CHANGE: 'snippet-placeholder-change',
    MIRROR_UPDATE: 'snippet-mirror-update',
  },

  // -------------------------------------------------------------------------
  // Vim Events
  // -------------------------------------------------------------------------
  VIM: {
    MODE_CHANGE: 'vim-mode-change',
    COMMAND_EXECUTE: 'vim-command-execute',
  },

  // -------------------------------------------------------------------------
  // Emmet Events
  // -------------------------------------------------------------------------
  EMMET: {
    GET_SELECTION: 'emmet:get-selection',
    SELECTION_RESPONSE: 'emmet:selection-response',
    WRAP: 'emmet:wrap',
    BALANCE_INWARD: 'emmet:balance-inward',
    BALANCE_OUTWARD: 'emmet:balance-outward',
  },

  // -------------------------------------------------------------------------
  // Encoding Events
  // -------------------------------------------------------------------------
  ENCODING: {
    PICKER_OPEN: 'encoding-picker:open',
    FILE_RELOADED: 'encoding:file-reloaded',
    FILE_SAVED: 'encoding:file-saved',
    CHANGED: 'encoding:changed',
  },

  // -------------------------------------------------------------------------
  // Language Events
  // -------------------------------------------------------------------------
  LANGUAGE: {
    CHANGED: 'language:changed',
    CLEARED: 'language:cleared',
    SELECTOR_REQUEST_ASSOCIATIONS: 'language-selector:request-associations',
  },

  // -------------------------------------------------------------------------
  // Icon Theme Events
  // -------------------------------------------------------------------------
  ICON_THEME: {
    CHANGED: 'icon-theme:changed',
  },

  // -------------------------------------------------------------------------
  // Product Icon Theme Events
  // -------------------------------------------------------------------------
  PRODUCT_ICON_THEME: {
    CHANGED: 'producticontheme:changed',
    CUSTOM_ADDED: 'producticontheme:custom-added',
    CUSTOM_REMOVED: 'producticontheme:custom-removed',
  },

  // -------------------------------------------------------------------------
  // Toolchain Events
  // -------------------------------------------------------------------------
  TOOLCHAIN: {
    CHANGED: 'toolchain:changed',
    OPEN_SELECTOR: 'toolchain:open-selector',
    REFRESH: 'toolchain:refresh',
  },

  // -------------------------------------------------------------------------
  // Supermaven Events
  // -------------------------------------------------------------------------
  SUPERMAVEN: {
    GHOST_TEXT: 'supermaven-ghost-text',
    ACCEPT: 'supermaven-accept',
    ACCEPT_PARTIAL: 'supermaven-accept-partial',
  },

  // -------------------------------------------------------------------------
  // Copilot Events
  // -------------------------------------------------------------------------
  COPILOT: {
    INSERT_COMPLETION: 'insert-copilot-completion',
  },

  // -------------------------------------------------------------------------
  // Tab Switcher Events
  // -------------------------------------------------------------------------
  TAB_SWITCHER: {
    SELECT: 'tab-switcher:select',
  },

  // -------------------------------------------------------------------------
  // Output Events
  // -------------------------------------------------------------------------
  OUTPUT: {
    SHOW_LOG_LEVEL_PICKER: 'output:show-log-level-picker',
    REGISTER_LOG_LEVEL_COMMAND: 'output:register-log-level-command',
    LOG_LEVEL_CHANGED: 'output:log-level-changed',
    APPEND: 'output:append',
    CLEAR: 'output:clear',
    CREATED: 'output:created',
    DELETED: 'output:deleted',
  },

  // -------------------------------------------------------------------------
  // Multi-Repo Events
  // -------------------------------------------------------------------------
  MULTIREPO: {
    REPOSITORY_ADDED: 'multirepo:repository-added',
    REPOSITORY_REMOVED: 'multirepo:repository-removed',
    ACTIVE_CHANGED: 'multirepo:active-changed',
    GIT_SETTINGS_CHANGED: 'multirepo:git-settings-changed',
  },

  // -------------------------------------------------------------------------
  // Local History Events
  // -------------------------------------------------------------------------
  LOCAL_HISTORY: {
    RESTORED: 'local-history:restored',
    PERIODIC_SAVE: 'local-history:periodic-save',
  },

  // -------------------------------------------------------------------------
  // Formatter Events
  // -------------------------------------------------------------------------
  FORMATTER: {
    DEFAULT_CHANGED: 'formatter:default-changed',
    EVENT: 'formatter:event',
  },

  // -------------------------------------------------------------------------
  // File Operations Events
  // -------------------------------------------------------------------------
  FILE_OPERATION: {
    UNDO: 'file-operation:undo',
    UNDONE: 'file-operation:undone',
  },

  // -------------------------------------------------------------------------
  // Extensions Events
  // -------------------------------------------------------------------------
  EXTENSIONS: {
    SHOW_RECOMMENDATIONS: 'extensions:show-recommendations',
    EVENT: 'extension:event',
    NOTIFICATION: 'extension:notification',
  },

  // -------------------------------------------------------------------------
  // Prompt Store Events
  // -------------------------------------------------------------------------
  PROMPT_STORE: {
    INSERT: 'prompt-store:insert',
  },

  // -------------------------------------------------------------------------
  // Call Hierarchy Events
  // -------------------------------------------------------------------------
  CALL_HIERARCHY: {
    SHOW: 'call-hierarchy:show',
    SHOW_AT: 'call-hierarchy:show-at',
  },

  // -------------------------------------------------------------------------
  // Peek Widget Events
  // -------------------------------------------------------------------------
  PEEK: {
    SHOW: 'peek:show',
    HIDE: 'peek:hide',
  },

  // -------------------------------------------------------------------------
  // Monaco Events
  // -------------------------------------------------------------------------
  MONACO: {
    APPLY_EDIT: 'monaco:apply-edit',
  },

  // -------------------------------------------------------------------------
  // Diagnostics Events
  // -------------------------------------------------------------------------
  DIAGNOSTICS: {
    NAVIGATE_TO_LINE: 'navigate-to-line',
  },

  // -------------------------------------------------------------------------
  // Breadcrumbs Events
  // -------------------------------------------------------------------------
  BREADCRUMBS: {
    COPY_PATH: 'breadcrumbs:copy-path',
    COPY_RELATIVE_PATH: 'breadcrumbs:copy-relative-path',
    REVEAL_IN_EXPLORER: 'breadcrumbs:reveal-in-explorer',
    GOTO_SYMBOL: 'breadcrumbs-goto-symbol',
  },

  // -------------------------------------------------------------------------
  // Chat Editing Events
  // -------------------------------------------------------------------------
  CHAT_EDITING: {
    SESSION_STARTED: 'chat-editing:session-started',
    SESSION_ENDED: 'chat-editing:session-ended',
    SESSION_CANCELLED: 'chat-editing:session-cancelled',
    CHANGE_ADDED: 'chat-editing:change-added',
    CHANGE_ACCEPTED: 'chat-editing:change-accepted',
    CHANGE_REJECTED: 'chat-editing:change-rejected',
    ALL_ACCEPTED: 'chat-editing:all-accepted',
    ALL_REJECTED: 'chat-editing:all-rejected',
    CHANGE_APPLIED: 'chat-editing:change-applied',
    SESSION_COMPLETED: 'chat-editing:session-completed',
    SESSION_DISCARDED: 'chat-editing:session-discarded',
  },

  // -------------------------------------------------------------------------
  // Agent Follow Events
  // -------------------------------------------------------------------------
  AGENT_FOLLOW: {
    STATUS_CHANGED: 'agentFollow:statusChanged',
    LOCATION_RECORDED: 'agentFollow:locationRecorded',
  },

  // -------------------------------------------------------------------------
  // Activity Events
  // -------------------------------------------------------------------------
  ACTIVITY: {
    TASK_CANCELLED: 'activity:task-cancelled',
    LSP_PROGRESS: 'lsp:progress',
    GIT_OPERATION: 'git:operation',
    BUILD_TASK: 'build:task',
    FORMATTER_EVENT: 'formatter:event',
    EXTENSION_EVENT: 'extension:event',
    REMOTE_EVENT: 'remote:event',
    MCP_EVENT: 'mcp:event',
    REPL_EXECUTION: 'repl:execution',
    DEBUG_EVENT: 'debug:event',
  },

  // -------------------------------------------------------------------------
  // Accessibility Events
  // -------------------------------------------------------------------------
  ACCESSIBILITY: {
    ANNOUNCEMENT: 'accessibility:announcement',
  },

  // -------------------------------------------------------------------------
  // Collab Events
  // -------------------------------------------------------------------------
  COLLAB: {
    TERMINAL_OUTPUT: 'collab:terminal_output',
  },

  // -------------------------------------------------------------------------
  // Codespaces Events
  // -------------------------------------------------------------------------
  CODESPACES: {
    TOAST_SHOW: 'toast:show',
  },

  // -------------------------------------------------------------------------
  // Inline Blame Events
  // -------------------------------------------------------------------------
  INLINE_BLAME: {
    TOGGLE: 'inline-blame:toggle',
    MODE_CHANGED: 'inline-blame:mode-changed',
  },

  // -------------------------------------------------------------------------
  // Quick Chat Events
  // -------------------------------------------------------------------------
  QUICK_CHAT: {
    OPEN: 'quick-chat:open',
  },

  // -------------------------------------------------------------------------
  // Tab Bar Events
  // -------------------------------------------------------------------------
  TAB_BAR: {
    REVEAL_IN_EXPLORER: 'reveal-in-explorer',
    CREATE_NEW_FILE: 'create-new-file',
  },

  // -------------------------------------------------------------------------
  // Streaming Events
  // -------------------------------------------------------------------------
  STREAMING: {
    SCROLL_TO_LINE: 'streaming-scroll-to-line',
  },

  // -------------------------------------------------------------------------
  // Insert Events
  // -------------------------------------------------------------------------
  INSERT: {
    PREDICTION: 'insert-prediction',
  },

  // -------------------------------------------------------------------------
  // Window Events
  // -------------------------------------------------------------------------
  WINDOW: {
    CREATED: 'window:created',
    CLOSED: 'window:closed',
    FOCUSED: 'window:focused',
    MOVED: 'window:moved',
    RESIZED: 'window:resized',
    CONTENT_SYNC: 'window:content-sync',
    STATE_CHANGED: 'window:state-changed',
    MERGE_REQUEST: 'window:merge-request',
    DETACH_REQUEST: 'window:detach-request',
  },
} as const;

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * Event payload type definitions for type-safe event handling.
 */
export interface EventPayloads {
  // Workspace payloads
  [EVENTS.WORKSPACE.FOLDER_ADDED]: { path: string };
  [EVENTS.WORKSPACE.FOLDER_REMOVED]: { path: string };
  [EVENTS.WORKSPACE.LOADED]: { path: string; folders: string[] };
  [EVENTS.WORKSPACE.CLOSED]: void;
  [EVENTS.WORKSPACE.OPEN_FOLDER]: { path: string };
  [EVENTS.WORKSPACE.CHANGE]: { path: string };
  [EVENTS.WORKSPACE.CD]: string;
  [EVENTS.WORKSPACE.TRUST_CHANGED]: { path: string; trusted: boolean };
  [EVENTS.WORKSPACE.TRUST_CLEARED]: void;
  [EVENTS.WORKSPACE.TRUSTED_FOLDER_ADDED]: { path: string };
  [EVENTS.WORKSPACE.TRUSTED_FOLDER_REMOVED]: { path: string };

  // Editor payloads
  [EVENTS.EDITOR.FILE_OPENED]: { path: string; fileId: string };
  [EVENTS.EDITOR.FILE_CLOSED]: { path: string; fileId: string };
  [EVENTS.EDITOR.FILE_CLOSING]: { path: string };
  [EVENTS.EDITOR.OPEN_FILE]: { path: string; line?: number; column?: number };
  [EVENTS.EDITOR.CURSOR_CHANGED]: { filePath: string; line: number; column: number };
  [EVENTS.EDITOR.SET_CURSOR_POSITION]: { line: number; column: number };
  [EVENTS.EDITOR.GOTO_LINE]: { line: number; column?: number; path?: string };
  [EVENTS.EDITOR.GOTO]: { path: string; line: number; column?: number };
  [EVENTS.EDITOR.REQUEST_FIND_REFERENCES]: void;
  [EVENTS.EDITOR.NAVIGATE_TO]: { path: string; line: number; column?: number };
  [EVENTS.EDITOR.SCROLL_TO_LINE]: { line: number };
  [EVENTS.EDITOR.HIGHLIGHT]: { path: string; line: number; range?: { start: number; end: number } };
  [EVENTS.EDITOR.AGENT_ACTIVE]: { path: string };
  [EVENTS.EDITOR.AGENT_INACTIVE]: void;
  [EVENTS.EDITOR.ACTION]: { action: string };
  [EVENTS.EDITOR.NEXT_TAB]: void;
  [EVENTS.EDITOR.PREV_TAB]: void;
  [EVENTS.EDITOR.APPLY_EDIT]: { edit: unknown };
  [EVENTS.EDITOR.CLOSE_READONLY_DEBUG_TABS]: void;
  [EVENTS.EDITOR.CURSOR_CHANGE]: { filePath: string; line: number; column: number };
  [EVENTS.EDITOR.COMMAND]: { command: string };
  [EVENTS.EDITOR.FORMAT_DOCUMENT]: void;
  [EVENTS.EDITOR.FORMAT_ON_PASTE_CHANGED]: { enabled: boolean };
  [EVENTS.EDITOR.LINKED_EDITING_CHANGED]: { enabled: boolean };
  [EVENTS.EDITOR.SAVE_REQUESTED]: { path: string };
  [EVENTS.EDITOR.SPLIT]: { direction: 'vertical' | 'horizontal' };
  [EVENTS.EDITOR.CLOSE_GROUP]: void;
  [EVENTS.EDITOR.PIN_TAB]: void;
  [EVENTS.EDITOR.UNPIN_TAB]: void;
  [EVENTS.EDITOR.TOGGLE_PIN_TAB]: void;
  [EVENTS.EDITOR.FOCUS_NEXT_GROUP]: void;
  [EVENTS.EDITOR.FOCUS_PREVIOUS_GROUP]: void;
  [EVENTS.EDITOR.UNSPLIT]: void;
  [EVENTS.EDITOR.TOGGLE_WORD_WRAP]: void;
  [EVENTS.EDITOR.TOGGLE_MINIMAP]: void;
  [EVENTS.EDITOR.TOGGLE_STICKY_SCROLL]: void;

  // File payloads
  [EVENTS.FILE.NEW]: void;
  [EVENTS.FILE.OPEN]: { path: string };
  [EVENTS.FILE.SAVED]: { path: string };
  [EVENTS.FILE.CHANGED]: { path: string };
  [EVENTS.FILE.RELOAD]: { path: string };
  [EVENTS.FILE.RELOAD_REQUEST]: { path: string };
  [EVENTS.FILE.CREATE]: string;
  [EVENTS.FILE.SAVE_WITHOUT_FORMATTING]: void;

  // Navigation payloads
  [EVENTS.NAVIGATION.BACK]: void;
  [EVENTS.NAVIGATION.FORWARD]: void;
  [EVENTS.NAVIGATION.SIGNIFICANT]: { filePath: string; line: number; column: number };
  [EVENTS.NAVIGATION.GOTO_LINE]: { line: number; column?: number; path?: string };
  [EVENTS.NAVIGATION.NAVIGATE_TO_LINE]: { line: number; column?: number };
  [EVENTS.NAVIGATION.NAVIGATE_TO_LOCATION]: { path: string; line: number; column?: number };

  // Settings payloads
  [EVENTS.SETTINGS.OPEN]: { section?: string };
  [EVENTS.SETTINGS.CHANGED]: { section: string; settings?: unknown };
  [EVENTS.SETTINGS.RESET]: void;
  [EVENTS.SETTINGS.IMPORTED]: void;
  [EVENTS.SETTINGS.WORKSPACE_LOADED]: { workspacePath: string };
  [EVENTS.SETTINGS.WORKSPACE_CLEARED]: void;
  [EVENTS.SETTINGS.WORKSPACE_CHANGED]: { section: string; key: string; value: unknown };
  [EVENTS.SETTINGS.WORKSPACE_RESET]: { section: string; key: string };
  [EVENTS.SETTINGS.FOLDER_LOADED]: { folderPath: string; settings: unknown };
  [EVENTS.SETTINGS.FOLDER_SAVED]: { folderPath: string };
  [EVENTS.SETTINGS.FOLDER_CHANGED]: { folderPath: string; section: string; key: string; value: unknown };
  [EVENTS.SETTINGS.FOLDER_RESET]: { folderPath: string; section: string; key: string };
  [EVENTS.SETTINGS.FOLDER_CLEARED]: { folderPath: string };
  [EVENTS.SETTINGS.LANGUAGE_OVERRIDE_CHANGED]: { language: string; overrides: unknown };
  [EVENTS.SETTINGS.LANGUAGE_OVERRIDE_RESET]: { language: string };
  [EVENTS.SETTINGS.FILE_ASSOCIATION_CHANGED]: { pattern: string; languageId: string };
  [EVENTS.SETTINGS.FILE_ASSOCIATION_REMOVED]: { pattern: string };
  [EVENTS.SETTINGS.RESET_TO_DEFAULT]: { section: string; key: string; defaultValue: unknown };
  [EVENTS.SETTINGS.PROFILE_CHANGED]: { profileId: string };

  // Git payloads
  [EVENTS.GIT.CLONE]: { url?: string };
  [EVENTS.GIT.TOGGLE]: void;
  [EVENTS.GIT.REFRESH]: void;
  [EVENTS.GIT.OPERATION]: { operation: string; status: string };
  [EVENTS.GIT.GO_TO_NEXT_CHANGE]: void;
  [EVENTS.GIT.GO_TO_PREV_CHANGE]: void;

  // View payloads
  [EVENTS.VIEW.FOCUS]: { view: string; type: 'sidebar' | 'panel' };
  [EVENTS.VIEW.TOGGLE_AGENT_PANEL]: void;
  [EVENTS.VIEW.TOGGLE_CHAT]: void;
  [EVENTS.VIEW.ZOOM_IN]: void;
  [EVENTS.VIEW.ZOOM_OUT]: void;
  [EVENTS.VIEW.ZOOM_RESET]: void;
  [EVENTS.VIEW.TOGGLE_FULLSCREEN]: void;
  [EVENTS.VIEW.MODE_CHANGE]: { mode: string };

  // Terminal payloads
  [EVENTS.TERMINAL.NEW]: void;
  [EVENTS.TERMINAL.TOGGLE]: void;
  [EVENTS.TERMINAL.SPLIT]: void;
  [EVENTS.TERMINAL.SPLIT_CURRENT]: void;
  [EVENTS.TERMINAL.CLEAR]: void;
  [EVENTS.TERMINAL.KILL]: void;
  [EVENTS.TERMINAL.RUN]: string;
  [EVENTS.TERMINAL.SELECT_ALL]: void;
  [EVENTS.TERMINAL.GO_TO_PREV_COMMAND]: void;
  [EVENTS.TERMINAL.GO_TO_NEXT_COMMAND]: void;
  [EVENTS.TERMINAL.CREATED]: { terminalId: string };
  [EVENTS.TERMINAL.OUTPUT]: { terminalId: string; data: string };
  [EVENTS.TERMINAL.STATUS]: { terminalId: string; running: boolean };

  // Notification payloads
  [EVENTS.NOTIFICATION.SHOW]: { type: 'error' | 'warning' | 'info' | 'success'; title: string; message: string; duration?: number };
  [EVENTS.NOTIFICATION.NEW]: { type: string; message: string };
  [EVENTS.NOTIFICATION.ACTION]: { id: string; action: string };
  [EVENTS.NOTIFICATION.LEGACY]: { type: 'error' | 'warning' | 'info' | 'success'; title: string; message: string };

  // Theme payloads
  [EVENTS.THEME.TOGGLE]: void;
  [EVENTS.THEME.SET]: string;
  [EVENTS.THEME.PREVIEW_STARTED]: { themeId: string };
  [EVENTS.THEME.PREVIEW_STOPPED]: void;
  [EVENTS.THEME.PREVIEW_APPLIED]: { themeId: string };
  [EVENTS.THEME.COLOR_CHANGED]: { colorKey: string; value: string };
  [EVENTS.THEME.CUSTOMIZATIONS_RESET]: void;
  [EVENTS.THEME.CATEGORY_RESET]: { category: string };
  [EVENTS.THEME.CUSTOMIZATIONS_IMPORTED]: void;
  [EVENTS.THEME.VSCODE_EXTENSION_APPLIED]: { extensionId: string };
  [EVENTS.THEME.VSCODE_EXTENSION_CLEARED]: void;

  // Feedback payloads
  [EVENTS.FEEDBACK.OPEN]: { type: 'general' | 'bug' | 'feature' };

  // Tasks payloads
  [EVENTS.TASKS.OPEN_RUN_DIALOG]: void;
  [EVENTS.TASKS.RUN_BUILD]: void;
  [EVENTS.TASKS.RUN_TEST]: void;
  [EVENTS.TASKS.OPEN_PANEL]: void;
  [EVENTS.TASKS.OPEN_CONFIG_EDITOR]: void;
  [EVENTS.TASKS.REFRESH]: void;
  [EVENTS.TASKS.BACKGROUND_STATUS]: { taskId: string; status: string };
  [EVENTS.TASKS.PARSED_DIAGNOSTICS]: { diagnostics: unknown[] };

  // Subagent payloads
  [EVENTS.SUBAGENT.OPEN_MANAGER]: void;
  [EVENTS.SUBAGENT.CREATE_NEW]: void;
  [EVENTS.SUBAGENT.SELECT]: { type: string };
  [EVENTS.SUBAGENT.EXPORT]: void;
  [EVENTS.SUBAGENT.IMPORT]: void;
  [EVENTS.SUBAGENT.CHANGED]: { agentId: string; changes: unknown };

  // AI payloads
  [EVENTS.AI.SUBAGENTS]: { action: string };
  [EVENTS.AI.FORK]: void;
  [EVENTS.AI.SKILL]: { name: string };
  [EVENTS.AI.FILE]: void;
  [EVENTS.AI.SEARCH]: { query?: string };
  [EVENTS.AI.REQUEST_SELECTION]: void;
  [EVENTS.AI.SELECTION_RESPONSE]: { selection: string };
  [EVENTS.AI.REQUEST_WORKSPACE]: void;
  [EVENTS.AI.WORKSPACE_RESPONSE]: { workspace: string };
  [EVENTS.AI.REQUEST_TERMINAL]: { terminalId?: string };
  [EVENTS.AI.TERMINAL_RESPONSE]: { output: string };
  [EVENTS.AI.SLASH_COMMAND_RESULT]: { command: string; result: unknown };

  // Bookmarks payloads
  [EVENTS.BOOKMARKS.TOGGLE]: void;
  [EVENTS.BOOKMARKS.NEXT]: void;
  [EVENTS.BOOKMARKS.PREV]: void;
  [EVENTS.BOOKMARKS.SHOW_PANEL]: void;
  [EVENTS.BOOKMARKS.PANEL_OPENED]: void;
  [EVENTS.BOOKMARKS.CLEAR_ALL]: void;

  // Explorer payloads
  [EVENTS.EXPLORER.REVEAL]: { path: string };
  [EVENTS.EXPLORER.FILE_REVEAL]: { path: string };
}

// ============================================================================
// Type-Safe Event Dispatcher
// ============================================================================

/**
 * Type-safe event dispatcher.
 * Dispatches a custom event with optional typed payload.
 * 
 * @param name - Event name from EVENTS constants
 * @param detail - Optional event payload (type-checked against EventPayloads)
 * 
 * @example
 * ```typescript
 * // Dispatch event without payload
 * dispatchEvent(EVENTS.SETTINGS.RESET);
 * 
 * // Dispatch event with typed payload
 * dispatchEvent(EVENTS.WORKSPACE.FOLDER_ADDED, { path: '/path/to/folder' });
 * ```
 */
export function dispatchEvent<T extends keyof EventPayloads>(
  name: T,
  detail?: EventPayloads[T]
): void {
  const event = detail !== undefined
    ? new CustomEvent(name, { detail })
    : new CustomEvent(name);
  window.dispatchEvent(event);
}

/**
 * Untyped event dispatcher for legacy event names not in EventPayloads.
 * Use dispatchEvent for type-safe events when possible.
 * 
 * @param name - Event name string
 * @param detail - Optional event payload
 */
export function dispatchUntypedEvent<T = unknown>(name: string, detail?: T): void {
  const event = detail !== undefined
    ? new CustomEvent(name, { detail })
    : new CustomEvent(name);
  window.dispatchEvent(event);
}

// ============================================================================
// Type-Safe Event Listener
// ============================================================================

/**
 * Type-safe event listener that returns an unsubscribe function.
 * 
 * @param name - Event name from EVENTS constants
 * @param handler - Event handler with typed payload
 * @returns Cleanup function to remove the event listener
 * 
 * @example
 * ```typescript
 * // Listen for typed event
 * const unsubscribe = addEventListener(
 *   EVENTS.WORKSPACE.FOLDER_ADDED,
 *   (event) => {
 *     console.log('Folder added:', event.detail.path);
 *   }
 * );
 * 
 * // Cleanup when done
 * unsubscribe();
 * ```
 */
export function addEventListener<T extends keyof EventPayloads>(
  name: T,
  handler: (event: CustomEvent<EventPayloads[T]>) => void
): () => void {
  const typedHandler = handler as EventListener;
  window.addEventListener(name, typedHandler);
  return () => window.removeEventListener(name, typedHandler);
}

/**
 * Untyped event listener for legacy event names not in EventPayloads.
 * Use addEventListener for type-safe events when possible.
 * 
 * @param name - Event name string
 * @param handler - Event handler
 * @returns Cleanup function to remove the event listener
 */
export function addUntypedEventListener<T = unknown>(
  name: string,
  handler: (event: CustomEvent<T>) => void
): () => void {
  const typedHandler = handler as EventListener;
  window.addEventListener(name, typedHandler);
  return () => window.removeEventListener(name, typedHandler);
}

// ============================================================================
// Event Helper Types
// ============================================================================

/**
 * Extract the payload type for a given event name.
 */
export type EventPayload<T extends keyof EventPayloads> = EventPayloads[T];

/**
 * All event names as a union type.
 */
export type EventName = keyof EventPayloads;

/**
 * Helper to get all event names in a category.
 */
export type EventCategory = keyof typeof EVENTS;

/**
 * Get all event names from a specific category.
 */
export type EventsInCategory<C extends EventCategory> = typeof EVENTS[C][keyof typeof EVENTS[C]];
