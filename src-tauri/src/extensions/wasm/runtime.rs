//! WASM runtime implementation using wasmtime.

use std::collections::{HashMap, VecDeque};
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;

use tracing::{error, info, warn};
use wasmtime::*;

use super::WasmRuntimeState;
use super::host::{self, HostContext, RegisteredProviders};
use crate::extensions::permissions::PermissionsManager;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WasmExtensionStatus {
    Inactive = 0,
    Activating = 1,
    Active = 2,
    Deactivating = 3,
    Error = 4,
}

pub struct WasmExtensionState {
    pub id: String,
    pub status: WasmExtensionStatus,
    pub store: Store<ExtensionHostState>,
    pub instance: Instance,
    pub activation_time: Option<f64>,
    pub error: Option<String>,
    pub last_activity: Option<Instant>,
    pub registered_commands: Vec<String>,
}

pub struct ExtensionHostState {
    pub extension_id: String,
    pub registered_commands: Vec<String>,
    pub events: Vec<(String, String)>,
    pub host_context: HostContext,
    pub store_limits: StoreLimits,
}

#[derive(Debug, Clone)]
pub struct ResourceLimits {
    pub fuel_limit: u64,
    pub memory_limit_bytes: usize,
    pub table_elements_limit: u32,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            fuel_limit: 1_000_000_000,
            memory_limit_bytes: 256 * 1024 * 1024,
            table_elements_limit: 10_000,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct LanguageProviderRegistry {
    pub completion_providers: HashMap<String, Vec<String>>,
    pub hover_providers: HashMap<String, Vec<String>>,
    pub definition_providers: HashMap<String, Vec<String>>,
}

pub struct WasmRuntime {
    engine: Engine,
    extensions: HashMap<String, WasmExtensionState>,
    resource_limits: ResourceLimits,
    permissions: Arc<PermissionsManager>,
    provider_registry: LanguageProviderRegistry,
}

fn read_wasm_string(caller: &mut Caller<'_, ExtensionHostState>, ptr: u32, len: u32) -> String {
    let memory = caller.get_export("memory").and_then(|e| e.into_memory());
    match memory {
        Some(mem) => {
            let data = mem.data(&*caller);
            let start = ptr as usize;
            let end = start + len as usize;
            if end <= data.len() {
                std::str::from_utf8(&data[start..end])
                    .unwrap_or("<invalid utf8>")
                    .to_string()
            } else {
                "<out of bounds>".to_string()
            }
        }
        None => "<no memory>".to_string(),
    }
}

impl Default for WasmRuntime {
    fn default() -> Self {
        Self::new()
    }
}

impl WasmRuntime {
    pub fn new() -> Self {
        let mut config = Config::new();
        config.cranelift_opt_level(OptLevel::Speed);
        config.consume_fuel(true);

        #[allow(clippy::expect_used)]
        let engine = Engine::new(&config).expect("Failed to create wasmtime engine");

        Self {
            engine,
            extensions: HashMap::new(),
            resource_limits: ResourceLimits::default(),
            permissions: Arc::new(PermissionsManager::new()),
            provider_registry: LanguageProviderRegistry::default(),
        }
    }

    pub fn with_resource_limits(mut self, limits: ResourceLimits) -> Self {
        self.resource_limits = limits;
        self
    }

    pub fn with_permissions(mut self, permissions: Arc<PermissionsManager>) -> Self {
        self.permissions = permissions;
        self
    }

    pub fn load_extension(&mut self, extension_id: &str, wasm_path: &str) -> Result<(), String> {
        if self.extensions.contains_key(extension_id) {
            return Err(format!("Extension '{}' is already loaded", extension_id));
        }

        let path = Path::new(wasm_path);
        if !path.exists() {
            return Err(format!("WASM file not found: {}", wasm_path));
        }

        let wasm_bytes =
            std::fs::read(path).map_err(|e| format!("Failed to read WASM file: {}", e))?;

        let module = Module::new(&self.engine, &wasm_bytes)
            .map_err(|e| format!("Failed to compile WASM module: {}", e))?;

        let host_context = HostContext {
            extension_id: extension_id.to_string(),
            workspace_root: None,
            permissions: Arc::clone(&self.permissions),
            registered_providers: RegisteredProviders::default(),
            tree_views: Vec::new(),
            status_bar_items: HashMap::new(),
            scm_providers: Vec::new(),
            debug_adapters: Vec::new(),
        };

        let store_limits = StoreLimitsBuilder::new()
            .memory_size(self.resource_limits.memory_limit_bytes)
            .table_elements(self.resource_limits.table_elements_limit as usize)
            .build();

        let host_state = ExtensionHostState {
            extension_id: extension_id.to_string(),
            registered_commands: Vec::new(),
            events: Vec::new(),
            host_context,
            store_limits,
        };

        let mut store = Store::new(&self.engine, host_state);
        store.limiter(|state| &mut state.store_limits);
        store
            .set_fuel(self.resource_limits.fuel_limit)
            .map_err(|e| format!("Failed to set fuel: {}", e))?;

        let mut linker = Linker::new(&self.engine);

        // ====================================================================
        // host namespace
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "log",
                |mut caller: Caller<'_, ExtensionHostState>,
                 level: u32,
                 msg_ptr: u32,
                 msg_len: u32| {
                    let msg = read_wasm_string(&mut caller, msg_ptr, msg_len);
                    host::host_log(level, &msg);
                },
            )
            .map_err(|e| format!("Failed to link host.log: {}", e))?;

        linker
            .func_wrap(
                "host",
                "show-message",
                |mut caller: Caller<'_, ExtensionHostState>,
                 level: u32,
                 msg_ptr: u32,
                 msg_len: u32| {
                    let msg = read_wasm_string(&mut caller, msg_ptr, msg_len);
                    host::host_show_message(level, &msg);
                },
            )
            .map_err(|e| format!("Failed to link host.show-message: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-command",
                |mut caller: Caller<'_, ExtensionHostState>, cmd_ptr: u32, cmd_len: u32| {
                    let cmd = read_wasm_string(&mut caller, cmd_ptr, cmd_len);
                    caller.data_mut().registered_commands.push(cmd);
                },
            )
            .map_err(|e| format!("Failed to link host.register-command: {}", e))?;

        linker
            .func_wrap(
                "host",
                "emit-event",
                |mut caller: Caller<'_, ExtensionHostState>,
                 name_ptr: u32,
                 name_len: u32,
                 data_ptr: u32,
                 data_len: u32| {
                    let name = read_wasm_string(&mut caller, name_ptr, name_len);
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    caller.data_mut().events.push((name, data));
                },
            )
            .map_err(|e| format!("Failed to link host.emit-event: {}", e))?;

        linker
            .func_wrap(
                "host",
                "get-config",
                |_caller: Caller<'_, ExtensionHostState>, _key_ptr: u32, _key_len: u32| -> u32 {
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.get-config: {}", e))?;

        // ====================================================================
        // host namespace: Workspace file operations
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "read-file",
                |mut caller: Caller<'_, ExtensionHostState>,
                 root_ptr: u32,
                 root_len: u32,
                 path_ptr: u32,
                 path_len: u32|
                 -> u32 {
                    let root = read_wasm_string(&mut caller, root_ptr, root_len);
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    match host::host_read_file(&root, &path) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.read-file: {}", e))?;

        linker
            .func_wrap(
                "host",
                "write-file",
                |mut caller: Caller<'_, ExtensionHostState>,
                 root_ptr: u32,
                 root_len: u32,
                 path_ptr: u32,
                 path_len: u32,
                 content_ptr: u32,
                 content_len: u32|
                 -> u32 {
                    let root = read_wasm_string(&mut caller, root_ptr, root_len);
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let content = read_wasm_string(&mut caller, content_ptr, content_len);
                    match host::host_write_file(&root, &path, &content) {
                        Ok(()) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.write-file: {}", e))?;

        linker
            .func_wrap(
                "host",
                "stat-file",
                |mut caller: Caller<'_, ExtensionHostState>,
                 root_ptr: u32,
                 root_len: u32,
                 path_ptr: u32,
                 path_len: u32|
                 -> u32 {
                    let root = read_wasm_string(&mut caller, root_ptr, root_len);
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    match host::host_stat_file(&root, &path) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.stat-file: {}", e))?;

        linker
            .func_wrap(
                "host",
                "find-files",
                |mut caller: Caller<'_, ExtensionHostState>,
                 root_ptr: u32,
                 root_len: u32,
                 pattern_ptr: u32,
                 pattern_len: u32|
                 -> u32 {
                    let root = read_wasm_string(&mut caller, root_ptr, root_len);
                    let pattern = read_wasm_string(&mut caller, pattern_ptr, pattern_len);
                    match host::host_list_files(&root, &pattern) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.find-files: {}", e))?;

        linker
            .func_wrap(
                "host",
                "get-configuration",
                |mut caller: Caller<'_, ExtensionHostState>, key_ptr: u32, key_len: u32| -> u32 {
                    let key = read_wasm_string(&mut caller, key_ptr, key_len);
                    let _ = host::host_get_config(&key);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.get-configuration: {}", e))?;

        // ====================================================================
        // host namespace: Document operations
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "open-document",
                |mut caller: Caller<'_, ExtensionHostState>, uri_ptr: u32, uri_len: u32| -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    let _ = host::host_open_document(&uri);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.open-document: {}", e))?;

        linker
            .func_wrap(
                "host",
                "save-document",
                |mut caller: Caller<'_, ExtensionHostState>, uri_ptr: u32, uri_len: u32| -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    match host::host_save_document(&uri) {
                        Ok(()) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.save-document: {}", e))?;

        linker
            .func_wrap(
                "host",
                "get-document-text",
                |mut caller: Caller<'_, ExtensionHostState>, uri_ptr: u32, uri_len: u32| -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    match host::host_get_document_text_by_uri(&uri) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.get-document-text: {}", e))?;

        linker
            .func_wrap(
                "host",
                "document-line-at",
                |mut caller: Caller<'_, ExtensionHostState>,
                 uri_ptr: u32,
                 uri_len: u32,
                 line: u32|
                 -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    match host::host_document_line_at(&uri, line) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.document-line-at: {}", e))?;

        linker
            .func_wrap(
                "host",
                "document-position-at",
                |mut caller: Caller<'_, ExtensionHostState>,
                 uri_ptr: u32,
                 uri_len: u32,
                 offset: u32|
                 -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    match host::host_document_position_at(&uri, offset) {
                        Ok(_) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.document-position-at: {}", e))?;

        linker
            .func_wrap(
                "host",
                "apply-document-edits",
                |mut caller: Caller<'_, ExtensionHostState>,
                 uri_ptr: u32,
                 uri_len: u32,
                 edits_ptr: u32,
                 edits_len: u32|
                 -> u32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    let edits = read_wasm_string(&mut caller, edits_ptr, edits_len);
                    match host::host_apply_document_edits(&uri, &edits) {
                        Ok(()) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.apply-document-edits: {}", e))?;

        // ====================================================================
        // host namespace: Window/UI operations
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "show-quick-pick",
                |mut caller: Caller<'_, ExtensionHostState>,
                 items_ptr: u32,
                 items_len: u32|
                 -> u32 {
                    let items = read_wasm_string(&mut caller, items_ptr, items_len);
                    let _ = host::host_show_quick_pick(&items);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.show-quick-pick: {}", e))?;

        linker
            .func_wrap(
                "host",
                "show-input-box",
                |mut caller: Caller<'_, ExtensionHostState>,
                 options_ptr: u32,
                 options_len: u32|
                 -> u32 {
                    let options = read_wasm_string(&mut caller, options_ptr, options_len);
                    let _ = host::host_show_input_box(&options);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.show-input-box: {}", e))?;

        linker
            .func_wrap(
                "host",
                "create-output-channel",
                |mut caller: Caller<'_, ExtensionHostState>, name_ptr: u32, name_len: u32| -> u32 {
                    let name = read_wasm_string(&mut caller, name_ptr, name_len);
                    let _ = host::host_create_output_channel(&name);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.create-output-channel: {}", e))?;

        linker
            .func_wrap(
                "host",
                "output-channel-append",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 text_ptr: u32,
                 text_len: u32| {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    host::host_output_channel_append(&id, &text);
                },
            )
            .map_err(|e| format!("Failed to link host.output-channel-append: {}", e))?;

        linker
            .func_wrap(
                "host",
                "create-tree-view",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 title_ptr: u32,
                 title_len: u32|
                 -> u32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let title = read_wasm_string(&mut caller, title_ptr, title_len);
                    let _ = host::host_create_tree_view(&id, &title);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.create-tree-view: {}", e))?;

        linker
            .func_wrap(
                "host",
                "create-webview-panel",
                |mut caller: Caller<'_, ExtensionHostState>,
                 type_ptr: u32,
                 type_len: u32,
                 title_ptr: u32,
                 title_len: u32|
                 -> u32 {
                    let view_type = read_wasm_string(&mut caller, type_ptr, type_len);
                    let title = read_wasm_string(&mut caller, title_ptr, title_len);
                    let _ = host::host_create_webview_panel(&view_type, &title);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.create-webview-panel: {}", e))?;

        // ====================================================================
        // host namespace: Language provider registration
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "register-completion-provider",
                |mut caller: Caller<'_, ExtensionHostState>,
                 lang_ptr: u32,
                 lang_len: u32,
                 triggers_ptr: u32,
                 triggers_len: u32|
                 -> u32 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let triggers = read_wasm_string(&mut caller, triggers_ptr, triggers_len);
                    let _ = host::host_register_completion_provider(&lang, &triggers);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.register-completion-provider: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-hover-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> u32 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let _ = host::host_register_hover_provider(&lang);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.register-hover-provider: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-definition-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> u32 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let _ = host::host_register_definition_provider(&lang);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.register-definition-provider: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-code-actions-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> u32 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let _ = host::host_register_code_actions_provider(&lang);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.register-code-actions-provider: {}", e))?;

        linker
            .func_wrap(
                "host",
                "register-code-lens-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> u32 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let _ = host::host_register_code_lens_provider(&lang);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.register-code-lens-provider: {}", e))?;

        // ====================================================================
        // host namespace: Terminal operations
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "create-terminal",
                |mut caller: Caller<'_, ExtensionHostState>,
                 name_ptr: u32,
                 name_len: u32,
                 cwd_ptr: u32,
                 cwd_len: u32|
                 -> u32 {
                    let name = read_wasm_string(&mut caller, name_ptr, name_len);
                    let cwd = read_wasm_string(&mut caller, cwd_ptr, cwd_len);
                    let _ = host::host_create_terminal(&name, &cwd);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.create-terminal: {}", e))?;

        linker
            .func_wrap(
                "host",
                "terminal-send-text",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 text_ptr: u32,
                 text_len: u32|
                 -> u32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    match host::host_terminal_send_text(&id, &text) {
                        Ok(()) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.terminal-send-text: {}", e))?;

        linker
            .func_wrap(
                "host",
                "terminal-dispose",
                |mut caller: Caller<'_, ExtensionHostState>, id_ptr: u32, id_len: u32| -> u32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    match host::host_terminal_dispose(&id) {
                        Ok(()) => 0,
                        Err(_) => 1,
                    }
                },
            )
            .map_err(|e| format!("Failed to link host.terminal-dispose: {}", e))?;

        // ====================================================================
        // host namespace: Decoration operations
        // ====================================================================

        linker
            .func_wrap(
                "host",
                "create-decoration-type",
                |mut caller: Caller<'_, ExtensionHostState>,
                 options_ptr: u32,
                 options_len: u32|
                 -> u32 {
                    let options = read_wasm_string(&mut caller, options_ptr, options_len);
                    let _ = host::host_create_decoration_type(&options);
                    0
                },
            )
            .map_err(|e| format!("Failed to link host.create-decoration-type: {}", e))?;

        linker
            .func_wrap(
                "host",
                "set-decorations",
                |mut caller: Caller<'_, ExtensionHostState>,
                 uri_ptr: u32,
                 uri_len: u32,
                 type_ptr: u32,
                 type_len: u32,
                 ranges_ptr: u32,
                 ranges_len: u32| {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    let dtype = read_wasm_string(&mut caller, type_ptr, type_len);
                    let ranges = read_wasm_string(&mut caller, ranges_ptr, ranges_len);
                    host::host_set_decorations(&uri, &dtype, &ranges);
                },
            )
            .map_err(|e| format!("Failed to link host.set-decorations: {}", e))?;

        // ====================================================================
        // filesystem namespace
        // ====================================================================

        linker
            .func_wrap(
                "filesystem",
                "read-file",
                |mut caller: Caller<'_, ExtensionHostState>, path_ptr: u32, path_len: u32| -> i32 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let ctx = &caller.data().host_context;
                    match host::host_read_file_bytes(ctx, &path) {
                        Ok(_) => 0,
                        Err(e) => {
                            warn!("filesystem.read-file failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.read-file: {}", e))?;

        linker
            .func_wrap(
                "filesystem",
                "write-file",
                |mut caller: Caller<'_, ExtensionHostState>,
                 path_ptr: u32,
                 path_len: u32,
                 data_ptr: u32,
                 data_len: u32|
                 -> i32 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    let ctx = &caller.data().host_context;
                    match host::host_write_file_bytes(ctx, &path, data.as_bytes()) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("filesystem.write-file failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.write-file: {}", e))?;

        linker
            .func_wrap(
                "filesystem",
                "list-directory",
                |mut caller: Caller<'_, ExtensionHostState>, path_ptr: u32, path_len: u32| -> i32 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let ctx = &caller.data().host_context;
                    match host::host_list_directory(ctx, &path) {
                        Ok(entries) => entries.len() as i32,
                        Err(e) => {
                            warn!("filesystem.list-directory failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.list-directory: {}", e))?;

        linker
            .func_wrap(
                "filesystem",
                "watch-file",
                |mut caller: Caller<'_, ExtensionHostState>, path_ptr: u32, path_len: u32| -> i64 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let ctx = &caller.data().host_context;
                    match host::host_watch_file(ctx, &path) {
                        Ok(id) => id as i64,
                        Err(e) => {
                            warn!("filesystem.watch-file failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.watch-file: {}", e))?;

        linker
            .func_wrap(
                "filesystem",
                "stat",
                |mut caller: Caller<'_, ExtensionHostState>, path_ptr: u32, path_len: u32| -> i32 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let ctx = &caller.data().host_context;
                    match host::host_stat_file_ctx(ctx, &path) {
                        Ok(_) => 0,
                        Err(e) => {
                            warn!("filesystem.stat failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.stat: {}", e))?;

        linker
            .func_wrap(
                "filesystem",
                "delete",
                |mut caller: Caller<'_, ExtensionHostState>, path_ptr: u32, path_len: u32| -> i32 {
                    let path = read_wasm_string(&mut caller, path_ptr, path_len);
                    let ctx = &caller.data().host_context;
                    match host::host_delete_file(ctx, &path) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("filesystem.delete failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link filesystem.delete: {}", e))?;

        // ====================================================================
        // editor namespace
        // ====================================================================

        linker
            .func_wrap(
                "editor",
                "get-active-editor",
                |caller: Caller<'_, ExtensionHostState>| -> i32 {
                    let ctx = &caller.data().host_context;
                    match host::host_get_active_editor(ctx) {
                        Some(_) => 1,
                        None => 0,
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.get-active-editor: {}", e))?;

        linker
            .func_wrap(
                "editor",
                "get-selection",
                |caller: Caller<'_, ExtensionHostState>| -> i32 {
                    let ctx = &caller.data().host_context;
                    match host::host_get_selection(ctx) {
                        Some(_) => 1,
                        None => 0,
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.get-selection: {}", e))?;

        linker
            .func_wrap(
                "editor",
                "insert-text",
                |mut caller: Caller<'_, ExtensionHostState>,
                 line: u32,
                 character: u32,
                 text_ptr: u32,
                 text_len: u32|
                 -> i32 {
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    let position = host::Position { line, character };
                    let ctx = &caller.data().host_context;
                    match host::host_insert_text(ctx, &position, &text) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("editor.insert-text failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.insert-text: {}", e))?;

        linker
            .func_wrap(
                "editor",
                "replace-range",
                |mut caller: Caller<'_, ExtensionHostState>,
                 start_line: u32,
                 start_char: u32,
                 end_line: u32,
                 end_char: u32,
                 text_ptr: u32,
                 text_len: u32|
                 -> i32 {
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    let range = host::TextRange {
                        start: host::Position {
                            line: start_line,
                            character: start_char,
                        },
                        end: host::Position {
                            line: end_line,
                            character: end_char,
                        },
                    };
                    let ctx = &caller.data().host_context;
                    match host::host_replace_range(ctx, &range, &text) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("editor.replace-range failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.replace-range: {}", e))?;

        linker
            .func_wrap(
                "editor",
                "set-decorations",
                |mut caller: Caller<'_, ExtensionHostState>, data_ptr: u32, data_len: u32| -> i32 {
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    let decorations: Vec<host::Decoration> =
                        serde_json::from_str(&data).unwrap_or_default();
                    let ctx = &caller.data().host_context;
                    match host::host_set_decorations_ctx(ctx, &decorations) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("editor.set-decorations failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.set-decorations: {}", e))?;

        linker
            .func_wrap(
                "editor",
                "get-document-text",
                |mut caller: Caller<'_, ExtensionHostState>, uri_ptr: u32, uri_len: u32| -> i32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    let ctx = &caller.data().host_context;
                    match host::host_get_document_text(ctx, &uri) {
                        Ok(_) => 0,
                        Err(e) => {
                            warn!("editor.get-document-text failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link editor.get-document-text: {}", e))?;

        // ====================================================================
        // workspace namespace
        // ====================================================================

        linker
            .func_wrap(
                "workspace",
                "get-workspace-folders",
                |caller: Caller<'_, ExtensionHostState>| -> i32 {
                    let ctx = &caller.data().host_context;
                    host::host_get_workspace_folders(ctx).len() as i32
                },
            )
            .map_err(|e| format!("Failed to link workspace.get-workspace-folders: {}", e))?;

        linker
            .func_wrap(
                "workspace",
                "find-files",
                |mut caller: Caller<'_, ExtensionHostState>,
                 glob_ptr: u32,
                 glob_len: u32,
                 max: u32|
                 -> i32 {
                    let glob = read_wasm_string(&mut caller, glob_ptr, glob_len);
                    let ctx = &caller.data().host_context;
                    match host::host_find_files(ctx, &glob, max) {
                        Ok(files) => files.len() as i32,
                        Err(e) => {
                            warn!("workspace.find-files failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link workspace.find-files: {}", e))?;

        linker
            .func_wrap(
                "workspace",
                "get-configuration",
                |mut caller: Caller<'_, ExtensionHostState>,
                 section_ptr: u32,
                 section_len: u32|
                 -> i32 {
                    let section = read_wasm_string(&mut caller, section_ptr, section_len);
                    let ctx = &caller.data().host_context;
                    match host::host_get_configuration(ctx, &section) {
                        Some(_) => 1,
                        None => 0,
                    }
                },
            )
            .map_err(|e| format!("Failed to link workspace.get-configuration: {}", e))?;

        linker
            .func_wrap(
                "workspace",
                "set-configuration",
                |mut caller: Caller<'_, ExtensionHostState>,
                 section_ptr: u32,
                 section_len: u32,
                 value_ptr: u32,
                 value_len: u32|
                 -> i32 {
                    let section = read_wasm_string(&mut caller, section_ptr, section_len);
                    let value = read_wasm_string(&mut caller, value_ptr, value_len);
                    let ctx = &caller.data().host_context;
                    match host::host_set_configuration(ctx, &section, &value) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("workspace.set-configuration failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link workspace.set-configuration: {}", e))?;

        // ====================================================================
        // ui namespace
        // ====================================================================

        linker
            .func_wrap(
                "ui",
                "register-tree-view",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 title_ptr: u32,
                 title_len: u32|
                 -> i32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let title = read_wasm_string(&mut caller, title_ptr, title_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_tree_view(ctx, &id, &title) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("ui.register-tree-view failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link ui.register-tree-view: {}", e))?;

        linker
            .func_wrap(
                "ui",
                "register-status-bar-item",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 text_ptr: u32,
                 text_len: u32,
                 alignment: u32,
                 priority: u32|
                 -> i32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_status_bar_item(ctx, &id, &text, alignment, priority)
                    {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("ui.register-status-bar-item failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link ui.register-status-bar-item: {}", e))?;

        linker
            .func_wrap(
                "ui",
                "update-status-bar-item",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 text_ptr: u32,
                 text_len: u32|
                 -> i32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let text = read_wasm_string(&mut caller, text_ptr, text_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_update_status_bar_item(ctx, &id, &text) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("ui.update-status-bar-item failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link ui.update-status-bar-item: {}", e))?;

        linker
            .func_wrap(
                "ui",
                "show-quick-pick",
                |mut caller: Caller<'_, ExtensionHostState>, data_ptr: u32, data_len: u32| -> i32 {
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    let items: Vec<host::QuickPickItem> =
                        serde_json::from_str(&data).unwrap_or_default();
                    let ctx = &caller.data().host_context;
                    match host::host_show_quick_pick_ctx(ctx, &items) {
                        Ok(_) => 0,
                        Err(e) => {
                            warn!("ui.show-quick-pick failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link ui.show-quick-pick: {}", e))?;

        linker
            .func_wrap(
                "ui",
                "show-input-box",
                |mut caller: Caller<'_, ExtensionHostState>, data_ptr: u32, data_len: u32| -> i32 {
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    let options: Option<host::InputBoxOptions> = serde_json::from_str(&data).ok();
                    let ctx = &caller.data().host_context;
                    match options {
                        Some(ref opts) => match host::host_show_input_box_ctx(ctx, opts) {
                            Ok(_) => 0,
                            Err(e) => {
                                warn!("ui.show-input-box failed: {}", e);
                                1
                            }
                        },
                        None => {
                            warn!("ui.show-input-box: invalid options JSON");
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link ui.show-input-box: {}", e))?;

        // ====================================================================
        // language namespace
        // ====================================================================

        linker
            .func_wrap(
                "language",
                "register-completion-provider",
                |mut caller: Caller<'_, ExtensionHostState>,
                 lang_ptr: u32,
                 lang_len: u32,
                 triggers_ptr: u32,
                 triggers_len: u32|
                 -> i64 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let triggers_str = read_wasm_string(&mut caller, triggers_ptr, triggers_len);
                    let triggers: Vec<String> =
                        serde_json::from_str(&triggers_str).unwrap_or_default();
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_completion_provider_ctx(ctx, &lang, triggers) {
                        Ok(id) => id as i64,
                        Err(e) => {
                            warn!("language.register-completion-provider failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| {
                format!(
                    "Failed to link language.register-completion-provider: {}",
                    e
                )
            })?;

        linker
            .func_wrap(
                "language",
                "register-hover-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> i64 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_hover_provider_ctx(ctx, &lang) {
                        Ok(id) => id as i64,
                        Err(e) => {
                            warn!("language.register-hover-provider failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link language.register-hover-provider: {}", e))?;

        linker
            .func_wrap(
                "language",
                "register-definition-provider",
                |mut caller: Caller<'_, ExtensionHostState>, lang_ptr: u32, lang_len: u32| -> i64 {
                    let lang = read_wasm_string(&mut caller, lang_ptr, lang_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_definition_provider_ctx(ctx, &lang) {
                        Ok(id) => id as i64,
                        Err(e) => {
                            warn!("language.register-definition-provider failed: {}", e);
                            -1
                        }
                    }
                },
            )
            .map_err(|e| {
                format!(
                    "Failed to link language.register-definition-provider: {}",
                    e
                )
            })?;

        linker
            .func_wrap(
                "language",
                "register-diagnostics",
                |mut caller: Caller<'_, ExtensionHostState>,
                 uri_ptr: u32,
                 uri_len: u32,
                 data_ptr: u32,
                 data_len: u32|
                 -> i32 {
                    let uri = read_wasm_string(&mut caller, uri_ptr, uri_len);
                    let data = read_wasm_string(&mut caller, data_ptr, data_len);
                    let diagnostics: Vec<host::Diagnostic> =
                        serde_json::from_str(&data).unwrap_or_default();
                    let ctx = &caller.data().host_context;
                    match host::host_register_diagnostics(ctx, &uri, &diagnostics) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("language.register-diagnostics failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link language.register-diagnostics: {}", e))?;

        // ====================================================================
        // scm namespace
        // ====================================================================

        linker
            .func_wrap(
                "scm",
                "register-scm-provider",
                |mut caller: Caller<'_, ExtensionHostState>,
                 id_ptr: u32,
                 id_len: u32,
                 label_ptr: u32,
                 label_len: u32|
                 -> i32 {
                    let id = read_wasm_string(&mut caller, id_ptr, id_len);
                    let label = read_wasm_string(&mut caller, label_ptr, label_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_scm_provider(ctx, &id, &label) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("scm.register-scm-provider failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link scm.register-scm-provider: {}", e))?;

        // ====================================================================
        // debug namespace
        // ====================================================================

        linker
            .func_wrap(
                "debug",
                "register-debug-adapter",
                |mut caller: Caller<'_, ExtensionHostState>, type_ptr: u32, type_len: u32| -> i32 {
                    let type_name = read_wasm_string(&mut caller, type_ptr, type_len);
                    let ctx = &mut caller.data_mut().host_context;
                    match host::host_register_debug_adapter(ctx, &type_name) {
                        Ok(()) => 0,
                        Err(e) => {
                            warn!("debug.register-debug-adapter failed: {}", e);
                            1
                        }
                    }
                },
            )
            .map_err(|e| format!("Failed to link debug.register-debug-adapter: {}", e))?;

        // ====================================================================
        // Instantiate and activate
        // ====================================================================

        let instance = linker
            .instantiate(&mut store, &module)
            .map_err(|e| format!("Failed to instantiate WASM module: {}", e))?;

        let start = Instant::now();
        let status;
        let mut activation_error = None;

        if let Some(activate) = instance.get_func(&mut store, "activate") {
            let mut results = vec![Val::I32(0)];
            match activate.call(&mut store, &[], &mut results) {
                Ok(_) => {
                    status = WasmExtensionStatus::Active;
                    info!("WASM extension '{}' activated successfully", extension_id);
                }
                Err(e) => {
                    status = WasmExtensionStatus::Error;
                    activation_error = Some(format!("Activation failed: {}", e));
                    error!(
                        "Failed to activate WASM extension '{}': {}",
                        extension_id, e
                    );
                }
            }
        } else {
            status = WasmExtensionStatus::Active;
            info!(
                "WASM extension '{}' loaded (no activate export)",
                extension_id
            );
        }

        let activation_time = start.elapsed().as_secs_f64() * 1000.0;

        let ext_state = WasmExtensionState {
            id: extension_id.to_string(),
            status,
            store,
            instance,
            activation_time: Some(activation_time),
            error: activation_error,
            last_activity: Some(Instant::now()),
            registered_commands: Vec::new(),
        };

        self.extensions.insert(extension_id.to_string(), ext_state);
        Ok(())
    }

    pub fn unload_extension(&mut self, extension_id: &str) -> Result<(), String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if let Some(deactivate) = ext.instance.get_func(&mut ext.store, "deactivate") {
            let mut results = vec![Val::I32(0)];
            if let Err(e) = deactivate.call(&mut ext.store, &[], &mut results) {
                warn!(
                    "Error deactivating WASM extension '{}': {}",
                    extension_id, e
                );
            }
        }

        self.extensions.remove(extension_id);
        info!("WASM extension '{}' unloaded", extension_id);
        Ok(())
    }

    pub fn execute_command(
        &mut self,
        extension_id: &str,
        command: &str,
        _args_json: &str,
    ) -> Result<String, String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if ext.status != WasmExtensionStatus::Active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        ext.last_activity = Some(Instant::now());

        if let Some(exec_cmd) = ext.instance.get_func(&mut ext.store, "execute-command") {
            let mut results = vec![Val::I32(0)];
            exec_cmd
                .call(&mut ext.store, &[], &mut results)
                .map_err(|e| {
                    format!(
                        "Failed to execute command '{}' in extension '{}': {}",
                        command, extension_id, e
                    )
                })?;

            Ok("null".to_string())
        } else {
            Err(format!(
                "Extension '{}' does not export execute-command",
                extension_id
            ))
        }
    }

    pub fn notify_file_save(&mut self, path: &str) {
        let extension_ids: Vec<String> = self
            .extensions
            .iter()
            .filter(|(_, ext)| ext.status == WasmExtensionStatus::Active)
            .map(|(id, _)| id.clone())
            .collect();

        for id in extension_ids {
            if let Some(ext) = self.extensions.get_mut(&id) {
                if let Some(func) = ext.instance.get_func(&mut ext.store, "on-file-save") {
                    let mut results = [];
                    if let Err(e) = func.call(&mut ext.store, &[], &mut results) {
                        warn!("Error calling on-file-save for extension '{}': {}", id, e);
                    }
                }
            }
        }
        info!("Notified extensions of file save: {}", path);
    }

    pub fn notify_file_open(&mut self, path: &str) {
        let extension_ids: Vec<String> = self
            .extensions
            .iter()
            .filter(|(_, ext)| ext.status == WasmExtensionStatus::Active)
            .map(|(id, _)| id.clone())
            .collect();

        for id in extension_ids {
            if let Some(ext) = self.extensions.get_mut(&id) {
                if let Some(func) = ext.instance.get_func(&mut ext.store, "on-file-open") {
                    let mut results = [];
                    if let Err(e) = func.call(&mut ext.store, &[], &mut results) {
                        warn!("Error calling on-file-open for extension '{}': {}", id, e);
                    }
                }
            }
        }
        info!("Notified extensions of file open: {}", path);
    }

    pub fn notify_workspace_change(&mut self, path: &str) {
        let extension_ids: Vec<String> = self
            .extensions
            .iter()
            .filter(|(_, ext)| ext.status == WasmExtensionStatus::Active)
            .map(|(id, _)| id.clone())
            .collect();

        for id in extension_ids {
            if let Some(ext) = self.extensions.get_mut(&id) {
                ext.store.data_mut().host_context.workspace_root = Some(path.to_string());
                if let Some(func) = ext.instance.get_func(&mut ext.store, "on-workspace-change") {
                    let mut results = [];
                    if let Err(e) = func.call(&mut ext.store, &[], &mut results) {
                        warn!(
                            "Error calling on-workspace-change for extension '{}': {}",
                            id, e
                        );
                    }
                }
            }
        }
        info!("Notified extensions of workspace change: {}", path);
    }

    pub fn notify_selection_change(&mut self, text: &str) {
        let extension_ids: Vec<String> = self
            .extensions
            .iter()
            .filter(|(_, ext)| ext.status == WasmExtensionStatus::Active)
            .map(|(id, _)| id.clone())
            .collect();

        for id in extension_ids {
            if let Some(ext) = self.extensions.get_mut(&id) {
                if let Some(func) = ext.instance.get_func(&mut ext.store, "on-selection-change") {
                    let mut results = [];
                    if let Err(e) = func.call(&mut ext.store, &[], &mut results) {
                        warn!(
                            "Error calling on-selection-change for extension '{}': {}",
                            id, e
                        );
                    }
                }
            }
        }
        info!(
            "Notified extensions of selection change: len={}",
            text.len()
        );
    }

    pub fn unload_all(&self) {
        info!(
            "Unloading all WASM extensions (count: {})",
            self.extensions.len()
        );
    }

    pub fn get_states(&self) -> Vec<WasmRuntimeState> {
        self.extensions
            .values()
            .map(|ext| WasmRuntimeState {
                id: ext.id.clone(),
                status: ext.status as u32,
                activation_time: ext.activation_time,
                error: ext.error.clone(),
                last_activity: ext.last_activity.map(|t| t.elapsed().as_secs_f64()),
                memory_usage: None,
                cpu_usage: None,
            })
            .collect()
    }

    pub fn invoke_completion_provider(
        &mut self,
        extension_id: &str,
        _request_json: &str,
    ) -> Result<String, String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if ext.status != WasmExtensionStatus::Active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        if let Some(handler) = ext
            .instance
            .get_func(&mut ext.store, "on-completion-request")
        {
            let mut results = vec![Val::I32(0)];
            handler
                .call(&mut ext.store, &[], &mut results)
                .map_err(|e| format!("Completion handler failed: {}", e))?;
            Ok("[]".to_string())
        } else {
            Err(format!(
                "Extension '{}' does not export on-completion-request",
                extension_id
            ))
        }
    }

    pub fn invoke_hover_provider(
        &mut self,
        extension_id: &str,
        _request_json: &str,
    ) -> Result<String, String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if ext.status != WasmExtensionStatus::Active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        if let Some(handler) = ext.instance.get_func(&mut ext.store, "on-hover-request") {
            let mut results = vec![Val::I32(0)];
            handler
                .call(&mut ext.store, &[], &mut results)
                .map_err(|e| format!("Hover handler failed: {}", e))?;
            Ok("null".to_string())
        } else {
            Err(format!(
                "Extension '{}' does not export on-hover-request",
                extension_id
            ))
        }
    }

    pub fn invoke_definition_provider(
        &mut self,
        extension_id: &str,
        _request_json: &str,
    ) -> Result<String, String> {
        let ext = self
            .extensions
            .get_mut(extension_id)
            .ok_or_else(|| format!("Extension '{}' not loaded", extension_id))?;

        if ext.status != WasmExtensionStatus::Active {
            return Err(format!("Extension '{}' is not active", extension_id));
        }

        if let Some(handler) = ext
            .instance
            .get_func(&mut ext.store, "on-definition-request")
        {
            let mut results = vec![Val::I32(0)];
            handler
                .call(&mut ext.store, &[], &mut results)
                .map_err(|e| format!("Definition handler failed: {}", e))?;
            Ok("null".to_string())
        } else {
            Err(format!(
                "Extension '{}' does not export on-definition-request",
                extension_id
            ))
        }
    }

    pub fn get_provider_registry(&self) -> &LanguageProviderRegistry {
        &self.provider_registry
    }
}

pub fn resolve_dependencies(
    manifests: &HashMap<String, Vec<String>>,
) -> Result<Vec<String>, String> {
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut graph: HashMap<String, Vec<String>> = HashMap::new();

    for (ext_id, deps) in manifests {
        in_degree.entry(ext_id.clone()).or_insert(0);
        graph.entry(ext_id.clone()).or_default();
        for dep in deps {
            in_degree.entry(dep.clone()).or_insert(0);
            *in_degree.entry(ext_id.clone()).or_insert(0) += 1;
            graph.entry(dep.clone()).or_default().push(ext_id.clone());
        }
    }

    let mut queue: VecDeque<String> = in_degree
        .iter()
        .filter(|(_, deg)| **deg == 0)
        .map(|(name, _)| name.clone())
        .collect();

    let mut sorted = Vec::new();
    while let Some(node) = queue.pop_front() {
        sorted.push(node.clone());
        if let Some(dependents) = graph.get(&node) {
            for dep in dependents {
                if let Some(deg) = in_degree.get_mut(dep) {
                    *deg -= 1;
                    if *deg == 0 {
                        queue.push_back(dep.clone());
                    }
                }
            }
        }
    }

    if sorted.len() != in_degree.len() {
        return Err("Circular dependency detected".to_string());
    }

    Ok(sorted)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_limits_default() {
        let limits = ResourceLimits::default();
        assert_eq!(limits.fuel_limit, 1_000_000_000);
        assert_eq!(limits.memory_limit_bytes, 256 * 1024 * 1024);
        assert_eq!(limits.table_elements_limit, 10_000);
    }

    #[test]
    fn test_dependency_resolution_simple() {
        let mut manifests = HashMap::new();
        manifests.insert("A".to_string(), vec!["B".to_string()]);
        manifests.insert("B".to_string(), vec![]);

        let order = resolve_dependencies(&manifests).unwrap();
        let pos_a = order.iter().position(|x| x == "A").unwrap();
        let pos_b = order.iter().position(|x| x == "B").unwrap();
        assert!(pos_b < pos_a, "B must come before A");
    }

    #[test]
    fn test_dependency_resolution_diamond() {
        let mut manifests = HashMap::new();
        manifests.insert("A".to_string(), vec!["B".to_string(), "C".to_string()]);
        manifests.insert("B".to_string(), vec!["D".to_string()]);
        manifests.insert("C".to_string(), vec!["D".to_string()]);
        manifests.insert("D".to_string(), vec![]);

        let order = resolve_dependencies(&manifests).unwrap();
        let pos_a = order.iter().position(|x| x == "A").unwrap();
        let pos_b = order.iter().position(|x| x == "B").unwrap();
        let pos_c = order.iter().position(|x| x == "C").unwrap();
        let pos_d = order.iter().position(|x| x == "D").unwrap();
        assert!(pos_d < pos_b, "D must come before B");
        assert!(pos_d < pos_c, "D must come before C");
        assert!(pos_b < pos_a, "B must come before A");
        assert!(pos_c < pos_a, "C must come before A");
    }

    #[test]
    fn test_dependency_resolution_circular() {
        let mut manifests = HashMap::new();
        manifests.insert("A".to_string(), vec!["B".to_string()]);
        manifests.insert("B".to_string(), vec!["A".to_string()]);

        let result = resolve_dependencies(&manifests);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Circular dependency detected");
    }

    #[test]
    fn test_dependency_resolution_no_deps() {
        let mut manifests = HashMap::new();
        manifests.insert("X".to_string(), vec![]);
        manifests.insert("Y".to_string(), vec![]);
        manifests.insert("Z".to_string(), vec![]);

        let order = resolve_dependencies(&manifests).unwrap();
        assert_eq!(order.len(), 3);
        assert!(order.contains(&"X".to_string()));
        assert!(order.contains(&"Y".to_string()));
        assert!(order.contains(&"Z".to_string()));
    }

    #[test]
    fn test_language_provider_registry_default() {
        let registry = LanguageProviderRegistry::default();
        assert!(registry.completion_providers.is_empty());
        assert!(registry.hover_providers.is_empty());
        assert!(registry.definition_providers.is_empty());
    }

    #[test]
    fn test_wasm_runtime_new() {
        let runtime = WasmRuntime::new();
        assert!(runtime.extensions.is_empty());
        assert_eq!(runtime.resource_limits.fuel_limit, 1_000_000_000);
        assert!(runtime.provider_registry.completion_providers.is_empty());
    }

    #[test]
    fn test_load_nonexistent_wasm() {
        let mut runtime = WasmRuntime::new();
        let result = runtime.load_extension("test-ext", "/nonexistent/path/to/module.wasm");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("WASM file not found"),
            "Expected 'WASM file not found' error, got: {}",
            err
        );
    }

    #[test]
    fn test_load_invalid_wasm_bytes() {
        let dir = std::env::temp_dir().join(format!(
            "cortex_runtime_test_invalid_{}",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&dir);
        let wasm_path = dir.join("invalid.wasm");
        std::fs::write(&wasm_path, b"not a valid wasm module").unwrap();

        let mut runtime = WasmRuntime::new();
        let result = runtime.load_extension("bad-ext", &wasm_path.to_string_lossy());
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(
            err.contains("Failed to compile WASM module"),
            "Expected compile error, got: {}",
            err
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn test_double_load_extension() {
        let dir =
            std::env::temp_dir().join(format!("cortex_runtime_test_double_{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let wasm_path = dir.join("dummy.wasm");

        // Minimal valid WASM module: magic + version + empty module
        let minimal_wasm: Vec<u8> = vec![
            0x00, 0x61, 0x73, 0x6D, // magic: \0asm
            0x01, 0x00, 0x00, 0x00, // version: 1
        ];
        std::fs::write(&wasm_path, &minimal_wasm).unwrap();

        let mut runtime = WasmRuntime::new();
        let result1 = runtime.load_extension("dup-ext", &wasm_path.to_string_lossy());
        assert!(result1.is_ok(), "First load should succeed: {:?}", result1);

        let result2 = runtime.load_extension("dup-ext", &wasm_path.to_string_lossy());
        assert!(result2.is_err());
        let err = result2.unwrap_err();
        assert!(
            err.contains("already loaded"),
            "Expected 'already loaded' error, got: {}",
            err
        );

        let _ = std::fs::remove_dir_all(&dir);
    }
}
