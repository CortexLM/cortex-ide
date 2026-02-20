//! Settings types and structures for Cortex Desktop
//!
//! This module contains all settings-related types including:
//! - Individual settings categories (EditorSettings, ThemeSettings, etc.)
//! - The main CortexSettings struct that combines all categories
//! - Default implementations for all settings types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::SETTINGS_VERSION;
use super::secure_store::SecureApiKeyStore;

/// Editor-related settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f32,
    pub tab_size: u32,
    pub insert_spaces: bool,
    pub word_wrap: String,
    pub line_numbers: String,
    pub minimap_enabled: bool,
    pub minimap_width: u32,
    pub bracket_pair_colorization: bool,
    pub auto_closing_brackets: String,
    pub auto_indent: bool,
    pub format_on_save: bool,
    pub format_on_paste: bool,
    pub cursor_style: String,
    pub cursor_blink: String,
    pub render_whitespace: String,
    pub scroll_beyond_last_line: bool,
    pub smooth_scrolling: bool,
    pub mouse_wheel_zoom: bool,
    pub linked_editing: bool,
    pub rename_on_type: bool,
    pub sticky_scroll_enabled: bool,
    pub folding_enabled: bool,
    pub show_folding_controls: String,
    pub guides_indentation: bool,
    pub guides_bracket_pairs: bool,
    pub highlight_active_indent_guide: bool,
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            font_family: "JetBrains Mono, Fira Code, Consolas, monospace".to_string(),
            font_size: 14,
            line_height: 1.5,
            tab_size: 2,
            insert_spaces: true,
            word_wrap: "off".to_string(),
            line_numbers: "on".to_string(),
            minimap_enabled: true,
            minimap_width: 100,
            bracket_pair_colorization: true,
            auto_closing_brackets: "always".to_string(),
            auto_indent: true,
            format_on_save: false,
            format_on_paste: false,
            cursor_style: "line".to_string(),
            cursor_blink: "blink".to_string(),
            render_whitespace: "selection".to_string(),
            scroll_beyond_last_line: true,
            smooth_scrolling: true,
            mouse_wheel_zoom: false,
            linked_editing: true,
            rename_on_type: false,
            sticky_scroll_enabled: false,
            folding_enabled: true,
            show_folding_controls: "mouseover".to_string(),
            guides_indentation: true,
            guides_bracket_pairs: true,
            highlight_active_indent_guide: true,
        }
    }
}

/// Theme and appearance settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeSettings {
    pub theme: String,
    pub icon_theme: String,
    pub accent_color: String,
    pub ui_font_family: String,
    pub ui_font_size: u32,
    pub zoom_level: f32,
    pub sidebar_position: String,
    pub activity_bar_visible: bool,
    pub status_bar_visible: bool,
    pub tab_bar_visible: bool,
    pub breadcrumbs_enabled: bool,
}

impl Default for ThemeSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            icon_theme: "default".to_string(),
            accent_color: "#6366f1".to_string(),
            ui_font_family: "Inter, system-ui, sans-serif".to_string(),
            ui_font_size: 13,
            zoom_level: 1.0,
            sidebar_position: "left".to_string(),
            activity_bar_visible: true,
            status_bar_visible: true,
            tab_bar_visible: true,
            breadcrumbs_enabled: true,
        }
    }
}

/// Terminal settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSettings {
    pub shell_path: String,
    pub shell_args: Vec<String>,
    pub font_family: String,
    pub font_size: u32,
    pub line_height: f32,
    pub cursor_style: String,
    pub cursor_blink: bool,
    pub scrollback: u32,
    pub copy_on_selection: bool,
    pub env: HashMap<String, String>,
    pub cwd: String,
    pub integrated_gpu: bool,
    /// Enable automatic shell integration script injection for OSC 633 sequences
    #[serde(default = "default_shell_integration_enabled")]
    pub shell_integration_enabled: bool,
}

fn default_shell_integration_enabled() -> bool {
    true
}

impl Default for TerminalSettings {
    fn default() -> Self {
        let default_shell = if cfg!(windows) {
            "powershell.exe".to_string()
        } else if cfg!(target_os = "macos") {
            "/bin/zsh".to_string()
        } else {
            "/bin/bash".to_string()
        };

        Self {
            shell_path: default_shell,
            shell_args: vec![],
            font_family: "JetBrains Mono, Fira Code, Consolas, monospace".to_string(),
            font_size: 14,
            line_height: 1.2,
            cursor_style: "block".to_string(),
            cursor_blink: true,
            scrollback: 10000,
            copy_on_selection: false,
            env: HashMap::new(),
            cwd: String::new(),
            integrated_gpu: true,
            shell_integration_enabled: true,
        }
    }
}

/// AI completion settings (non-sensitive parts only)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AISettings {
    pub supermaven_enabled: bool,
    /// Whether API key is stored (actual key in keyring)
    #[serde(default)]
    pub has_supermaven_api_key: bool,
    pub copilot_enabled: bool,
    pub inline_suggest_enabled: bool,
    pub inline_suggest_show_toolbar: bool,
    pub default_provider: String,
    pub default_model: String,
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            supermaven_enabled: false,
            has_supermaven_api_key: false,
            copilot_enabled: false,
            inline_suggest_enabled: true,
            inline_suggest_show_toolbar: true,
            default_provider: "anthropic".to_string(),
            default_model: "claude-sonnet-4-20250514".to_string(),
        }
    }
}

/// Security and sandbox settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySettings {
    pub sandbox_mode: String,
    pub approval_mode: String,
    pub network_access: bool,
    pub trusted_workspaces: Vec<String>,
    pub telemetry_enabled: bool,
    pub crash_reports_enabled: bool,
}

impl Default for SecuritySettings {
    fn default() -> Self {
        Self {
            sandbox_mode: "workspace_write".to_string(),
            approval_mode: "auto".to_string(),
            network_access: true,
            trusted_workspaces: vec![],
            telemetry_enabled: false,
            crash_reports_enabled: false,
        }
    }
}

/// Debug settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugSettings {
    /// Enable hot reload during debug sessions (restart debuggee with updated code)
    #[serde(default = "default_hot_reload")]
    pub hot_reload: bool,
    /// Auto-prompt for hot reload when files change during debugging
    #[serde(default = "default_hot_reload_on_save")]
    pub hot_reload_on_save: bool,
    /// Inline values display in editor during debugging
    #[serde(default = "default_inline_values")]
    pub inline_values: bool,
}

fn default_hot_reload() -> bool {
    true
}

fn default_hot_reload_on_save() -> bool {
    false
}

fn default_inline_values() -> bool {
    true
}

impl Default for DebugSettings {
    fn default() -> Self {
        Self {
            hot_reload: true,
            hot_reload_on_save: false,
            inline_values: true,
        }
    }
}

/// Git settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitSettings {
    /// Command to run after a successful commit (e.g., "npm test", "git push")
    #[serde(default)]
    pub post_commit_command: String,
    /// Prune deleted remote-tracking branches when fetching
    #[serde(default)]
    pub prune_on_fetch: bool,
    /// Fetch all tags from remotes
    #[serde(default = "default_fetch_tags")]
    pub fetch_tags: bool,
    /// Push annotated tags when syncing/pushing
    #[serde(default)]
    pub follow_tags_when_sync: bool,
}

fn default_fetch_tags() -> bool {
    true
}

impl Default for GitSettings {
    fn default() -> Self {
        Self {
            post_commit_command: String::new(),
            prune_on_fetch: false,
            fetch_tags: true,
            follow_tags_when_sync: false,
        }
    }
}

/// HTTP Proxy settings (sensitive proxy auth stored in keyring)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSettings {
    /// HTTP proxy URL (e.g., "http://proxy.example.com:8080")
    #[serde(default)]
    pub proxy: String,
    /// Whether to verify SSL certificates when using a proxy
    #[serde(default = "default_proxy_strict_ssl")]
    pub proxy_strict_ssl: bool,
    /// Whether proxy authorization is stored (actual value in keyring)
    #[serde(default)]
    pub has_proxy_authorization: bool,
    /// Proxy support mode: "off" = no proxy, "on" = always use proxy, "fallback" = use proxy only if direct fails
    #[serde(default = "default_proxy_support")]
    pub proxy_support: String,
}

fn default_proxy_strict_ssl() -> bool {
    true
}

fn default_proxy_support() -> String {
    "fallback".to_string()
}

impl Default for HttpSettings {
    fn default() -> Self {
        Self {
            proxy: String::new(),
            proxy_strict_ssl: true,
            has_proxy_authorization: false,
            proxy_support: "fallback".to_string(),
        }
    }
}

/// Explorer/file tree settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSettings {
    /// Compact folders that contain only a single subfolder
    #[serde(default = "default_compact_folders")]
    pub compact_folders: bool,
    /// Sort folders before files
    #[serde(default = "default_sort_folders_first")]
    pub sort_folders_first: bool,
    /// Sort order: "name" | "type" | "modified"
    #[serde(default = "default_sort_order")]
    pub sort_order: String,
    /// Auto-reveal active file in explorer
    #[serde(default)]
    pub auto_reveal: bool,
    /// Show hidden files (dotfiles)
    #[serde(default)]
    pub show_hidden: bool,
}

fn default_compact_folders() -> bool {
    true
}

fn default_sort_folders_first() -> bool {
    true
}

fn default_sort_order() -> String {
    "name".to_string()
}

impl Default for ExplorerSettings {
    fn default() -> Self {
        Self {
            compact_folders: true,
            sort_folders_first: true,
            sort_order: "name".to_string(),
            auto_reveal: false,
            show_hidden: false,
        }
    }
}

/// Zen mode settings (distraction-free mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZenModeSettings {
    /// Hide activity bar in zen mode
    #[serde(default = "default_true")]
    pub hide_activity_bar: bool,
    /// Hide status bar in zen mode
    #[serde(default = "default_true")]
    pub hide_status_bar: bool,
    /// Hide tabs in zen mode
    #[serde(default = "default_true")]
    pub hide_tabs: bool,
    /// Hide line numbers in zen mode
    #[serde(default)]
    pub hide_line_numbers: bool,
    /// Center layout in zen mode
    #[serde(default = "default_true")]
    pub center_layout: bool,
    /// Full screen in zen mode
    #[serde(default = "default_true")]
    pub full_screen: bool,
    /// Restore windows when exiting zen mode
    #[serde(default = "default_true")]
    pub restore: bool,
    /// Silent notifications in zen mode
    #[serde(default = "default_true")]
    pub silent_notifications: bool,
}

fn default_true() -> bool {
    true
}

impl Default for ZenModeSettings {
    fn default() -> Self {
        Self {
            hide_activity_bar: true,
            hide_status_bar: true,
            hide_tabs: true,
            hide_line_numbers: false,
            center_layout: true,
            full_screen: true,
            restore: true,
            silent_notifications: true,
        }
    }
}

/// Screencast mode settings (for presentations/recordings)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreencastModeSettings {
    /// Show keyboard shortcuts on screen
    #[serde(default = "default_true")]
    pub keyboard_shortcuts: bool,
    /// Show commands on screen
    #[serde(default = "default_true")]
    pub commands: bool,
    /// Keyboard overlay timeout in milliseconds
    #[serde(default = "default_keyboard_timeout")]
    pub keyboard_overlay_timeout: u32,
    /// Font size for screencast overlay
    #[serde(default = "default_screencast_font_size")]
    pub font_size: u32,
    /// Mouse indicator enabled
    #[serde(default = "default_true")]
    pub mouse_indicator: bool,
    /// Vertical offset from bottom (in pixels)
    #[serde(default = "default_vertical_offset")]
    pub vertical_offset: u32,
}

fn default_keyboard_timeout() -> u32 {
    800
}

fn default_screencast_font_size() -> u32 {
    28
}

fn default_vertical_offset() -> u32 {
    20
}

impl Default for ScreencastModeSettings {
    fn default() -> Self {
        Self {
            keyboard_shortcuts: true,
            commands: true,
            keyboard_overlay_timeout: 800,
            font_size: 28,
            mouse_indicator: true,
            vertical_offset: 20,
        }
    }
}

/// Search settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSettings {
    /// Smart case - case insensitive unless uppercase is used
    #[serde(default = "default_true")]
    pub smart_case: bool,
    /// Preserve search case
    #[serde(default)]
    pub preserve_case: bool,
    /// Show line numbers in search results
    #[serde(default = "default_true")]
    pub show_line_numbers: bool,
    /// Use ignore files (.gitignore, .ignore)
    #[serde(default = "default_true")]
    pub use_ignore_files: bool,
    /// Use global ignore files
    #[serde(default = "default_true")]
    pub use_global_ignore_files: bool,
    /// Use parent ignore files
    #[serde(default = "default_true")]
    pub use_parent_ignore_files: bool,
    /// Max results to show
    #[serde(default = "default_max_results")]
    pub max_results: u32,
    /// Collapse results by default
    #[serde(default)]
    pub collapse_results: bool,
    /// Search on type (as you type)
    #[serde(default = "default_true")]
    pub search_on_type: bool,
    /// Delay before searching on type (ms)
    #[serde(default = "default_search_delay")]
    pub search_on_type_delay: u32,
}

fn default_max_results() -> u32 {
    20000
}

fn default_search_delay() -> u32 {
    300
}

impl Default for SearchSettings {
    fn default() -> Self {
        Self {
            smart_case: true,
            preserve_case: false,
            show_line_numbers: true,
            use_ignore_files: true,
            use_global_ignore_files: true,
            use_parent_ignore_files: true,
            max_results: 20000,
            collapse_results: false,
            search_on_type: true,
            search_on_type_delay: 300,
        }
    }
}

/// Command palette settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandPaletteSettings {
    /// Preserve input when reopening command palette
    #[serde(default)]
    pub preserve_input: bool,
    /// Show history in command palette
    #[serde(default = "default_true")]
    pub history: bool,
    /// History limit
    #[serde(default = "default_history_limit")]
    pub history_limit: u32,
    /// Mode to restore when reopening: "last" | "searchForFiles" | "searchForCommands"
    #[serde(default = "default_restore_mode")]
    pub restore_mode: String,
}

fn default_history_limit() -> u32 {
    50
}

fn default_restore_mode() -> String {
    "last".to_string()
}

impl Default for CommandPaletteSettings {
    fn default() -> Self {
        Self {
            preserve_input: false,
            history: true,
            history_limit: 50,
            restore_mode: "last".to_string(),
        }
    }
}

/// Workbench/window settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkbenchSettings {
    /// Open editors in new window or same window: "currentWindow" | "newWindow"
    #[serde(default = "default_open_editors_in")]
    pub open_editors_in: String,
    /// Startup editor: "welcomePage" | "none" | "newUntitledFile" | "readme"
    #[serde(default = "default_startup_editor")]
    pub startup_editor: String,
    /// Title bar style: "native" | "custom"
    #[serde(default = "default_title_bar_style")]
    pub title_bar_style: String,
    /// Window title template
    #[serde(default = "default_window_title")]
    pub window_title: String,
    /// Restore windows on startup: "none" | "folders" | "all"
    #[serde(default = "default_restore_windows")]
    pub restore_windows: String,
    /// Enable native tabs (macOS)
    #[serde(default)]
    pub native_tabs: bool,
    /// Enable editor tabs
    #[serde(default = "default_true")]
    pub editor_tabs: bool,
    /// Tab sizing mode: "fit" | "shrink" | "fixed"
    #[serde(default = "default_tab_sizing")]
    pub tab_sizing: String,
    /// Tab close button position: "left" | "right" | "off"
    #[serde(default = "default_tab_close_button")]
    pub tab_close_button: String,
}

fn default_open_editors_in() -> String {
    "currentWindow".to_string()
}

fn default_startup_editor() -> String {
    "welcomePage".to_string()
}

fn default_title_bar_style() -> String {
    "custom".to_string()
}

fn default_window_title() -> String {
    "${activeEditorShort}${separator}${rootName}".to_string()
}

fn default_restore_windows() -> String {
    "all".to_string()
}

fn default_tab_sizing() -> String {
    "fit".to_string()
}

fn default_tab_close_button() -> String {
    "right".to_string()
}

impl Default for WorkbenchSettings {
    fn default() -> Self {
        Self {
            open_editors_in: "currentWindow".to_string(),
            startup_editor: "welcomePage".to_string(),
            title_bar_style: "custom".to_string(),
            window_title: "${activeEditorShort}${separator}${rootName}".to_string(),
            restore_windows: "all".to_string(),
            native_tabs: false,
            editor_tabs: true,
            tab_sizing: "fit".to_string(),
            tab_close_button: "right".to_string(),
        }
    }
}

/// Extension settings (per-extension configuration)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionSettingsMap {
    #[serde(flatten)]
    pub extensions: HashMap<String, serde_json::Value>,
}

/// Files and workspace settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilesSettings {
    pub auto_save: String,
    pub auto_save_delay: u32,
    pub hot_exit: String,
    pub default_language: String,
    pub trim_trailing_whitespace: bool,
    pub insert_final_newline: bool,
    pub trim_final_newlines: bool,
    pub exclude: HashMap<String, bool>,
    pub watch_exclude: HashMap<String, bool>,
    pub encoding: String,
    pub eol: String,
    #[serde(default = "default_confirm_drag_drop")]
    pub confirm_drag_and_drop: bool,
}

fn default_confirm_drag_drop() -> bool {
    true
}

impl Default for FilesSettings {
    fn default() -> Self {
        let mut exclude = HashMap::new();
        exclude.insert("**/.git".to_string(), true);
        exclude.insert("**/.svn".to_string(), true);
        exclude.insert("**/.hg".to_string(), true);
        exclude.insert("**/CVS".to_string(), true);
        exclude.insert("**/.DS_Store".to_string(), true);
        exclude.insert("**/node_modules".to_string(), true);
        exclude.insert("**/target".to_string(), true);

        // Default watcher exclude patterns - these directories generate many events
        // that are typically not useful for file watching
        let mut watch_exclude = HashMap::new();
        watch_exclude.insert("**/.git/objects/**".to_string(), true);
        watch_exclude.insert("**/.git/subtree-cache/**".to_string(), true);
        watch_exclude.insert("**/node_modules/**".to_string(), true);
        watch_exclude.insert("**/.hg/store/**".to_string(), true);
        watch_exclude.insert("**/target/**".to_string(), true);
        watch_exclude.insert("**/.venv/**".to_string(), true);
        watch_exclude.insert("**/venv/**".to_string(), true);
        watch_exclude.insert("**/__pycache__/**".to_string(), true);
        watch_exclude.insert("**/.pytest_cache/**".to_string(), true);
        watch_exclude.insert("**/dist/**".to_string(), true);
        watch_exclude.insert("**/build/**".to_string(), true);
        watch_exclude.insert("**/.next/**".to_string(), true);
        watch_exclude.insert("**/.nuxt/**".to_string(), true);
        watch_exclude.insert("**/.cache/**".to_string(), true);
        watch_exclude.insert("**/coverage/**".to_string(), true);

        Self {
            auto_save: "off".to_string(),
            auto_save_delay: 1000,
            hot_exit: "onExit".to_string(),
            default_language: String::new(),
            trim_trailing_whitespace: false,
            insert_final_newline: false,
            trim_final_newlines: false,
            exclude,
            watch_exclude,
            encoding: "utf8".to_string(),
            eol: "auto".to_string(),
            confirm_drag_and_drop: true,
        }
    }
}

/// Language-specific editor settings override
/// Allows partial overrides of EditorSettings per language (e.g., "[python]": { "tabSize": 4 })
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LanguageEditorOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_height: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tab_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub insert_spaces: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_wrap: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_numbers: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimap_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bracket_pair_colorization: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_closing_brackets: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auto_indent: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_on_save: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format_on_paste: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor_style: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub render_whitespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guides_indentation: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guides_bracket_pairs: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub folding_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sticky_scroll_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_editing: Option<bool>,
}

/// Main settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CortexSettings {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default)]
    pub theme: ThemeSettings,
    #[serde(default)]
    pub terminal: TerminalSettings,
    #[serde(default)]
    pub ai: AISettings,
    #[serde(default)]
    pub security: SecuritySettings,
    #[serde(default)]
    pub debug: DebugSettings,
    #[serde(default)]
    pub files: FilesSettings,
    #[serde(default)]
    pub git: GitSettings,
    #[serde(default)]
    pub http: HttpSettings,
    #[serde(default)]
    pub explorer: ExplorerSettings,
    #[serde(default)]
    pub zen_mode: ZenModeSettings,
    #[serde(default)]
    pub screencast_mode: ScreencastModeSettings,
    #[serde(default)]
    pub search: SearchSettings,
    #[serde(default)]
    pub command_palette: CommandPaletteSettings,
    #[serde(default)]
    pub workbench: WorkbenchSettings,
    #[serde(default)]
    pub extensions: ExtensionSettingsMap,
    #[serde(default)]
    pub vim_enabled: bool,
    /// Language-specific editor settings overrides
    /// Keys are language identifiers like "[python]", "[javascript]", "[rust]"
    #[serde(default)]
    pub language_overrides: HashMap<String, LanguageEditorOverride>,
}

impl Default for CortexSettings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            editor: EditorSettings::default(),
            theme: ThemeSettings::default(),
            terminal: TerminalSettings::default(),
            ai: AISettings::default(),
            security: SecuritySettings::default(),
            debug: DebugSettings::default(),
            files: FilesSettings::default(),
            git: GitSettings::default(),
            http: HttpSettings::default(),
            explorer: ExplorerSettings::default(),
            zen_mode: ZenModeSettings::default(),
            screencast_mode: ScreencastModeSettings::default(),
            search: SearchSettings::default(),
            command_palette: CommandPaletteSettings::default(),
            workbench: WorkbenchSettings::default(),
            extensions: ExtensionSettingsMap::default(),
            vim_enabled: false,
            language_overrides: HashMap::new(),
        }
    }
}

impl CortexSettings {
    /// Migrate settings from older versions
    pub fn migrate(&mut self) {
        if self.version < SETTINGS_VERSION {
            tracing::info!(
                "Migrating settings from version {} to {}",
                self.version,
                SETTINGS_VERSION
            );

            // Migration from v1 to v2: Move API keys to keyring
            if self.version < 2 {
                // Check if we have API key flags but no keyring entries
                // This handles the case where settings file had plaintext keys
                self.ai.has_supermaven_api_key =
                    SecureApiKeyStore::has_api_key("supermaven_api_key").unwrap_or(false);
                self.http.has_proxy_authorization =
                    SecureApiKeyStore::has_api_key("proxy_authorization").unwrap_or(false);
            }

            self.version = SETTINGS_VERSION;
        }
    }
}
