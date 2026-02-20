mod ai_commands;
mod collab_commands;
mod editor_commands;
mod extension_commands;
mod git_commands;
mod i18n_commands;
mod misc_commands;
mod notebook_commands;
mod remote_commands;
mod settings_commands;
mod terminal_commands;
mod workspace_commands;

#[cfg(test)]
mod tests;

use std::collections::VecDeque;
use std::net::TcpListener;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, RunEvent};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_shell::process::CommandChild;
use tokio::sync::mpsc;
use tracing::{info, warn};

use crate::activity::ActivityState;
use crate::ai::{AIState, AIToolsState, AgentState, AgentStoreState};
use crate::auto_update::AutoUpdateState;
use crate::collab::CollabState;
use crate::context_server::ContextServerState;
use crate::dap::DebuggerState;
use crate::extensions::node_host::NodeHostState;
use crate::extensions::{ExtensionsManager, ExtensionsState};
use crate::lsp::LspState;
use crate::remote::RemoteManager;
use crate::repl::{KernelEvent, KernelInfo, KernelManager, KernelSpec};
use crate::sandbox::commands::SandboxState;
use crate::timeline::TimelineState;
use crate::toolchain::ToolchainState;

/// Chains sub-module command macros into `tauri::generate_handler![]`.
///
/// Each `*_commands.rs` sub-module defines a macro with a `@commands` arm that
/// accepts a callback path and an accumulator. The chain passes the accumulated
/// command paths through each sub-module, and the final step feeds them into
/// `tauri::generate_handler![]`.
///
/// To add a new command, edit the appropriate `*_commands.rs` file.
/// To add a new command group, create a new `*_commands.rs` file and insert
/// a new chain step here.
#[macro_export]
macro_rules! cortex_commands {
    () => {
        $crate::ai_commands!(@commands collect_collab [])
    };
}

#[macro_export]
macro_rules! collect_collab {
    ([ $($acc:tt)* ]) => {
        $crate::collab_commands!(@commands collect_editor [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_editor {
    ([ $($acc:tt)* ]) => {
        $crate::editor_commands!(@commands collect_extension [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_extension {
    ([ $($acc:tt)* ]) => {
        $crate::extension_commands!(@commands collect_git [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_git {
    ([ $($acc:tt)* ]) => {
        $crate::git_commands!(@commands collect_misc [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_misc {
    ([ $($acc:tt)* ]) => {
        $crate::misc_commands!(@commands collect_notebook [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_notebook {
    ([ $($acc:tt)* ]) => {
        $crate::notebook_commands!(@commands collect_remote [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_remote {
    ([ $($acc:tt)* ]) => {
        $crate::remote_commands!(@commands collect_settings [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_settings {
    ([ $($acc:tt)* ]) => {
        $crate::settings_commands!(@commands collect_terminal [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_terminal {
    ([ $($acc:tt)* ]) => {
        $crate::terminal_commands!(@commands collect_workspace [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_workspace {
    ([ $($acc:tt)* ]) => {
        $crate::workspace_commands!(@commands collect_i18n [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_i18n {
    ([ $($acc:tt)* ]) => {
        $crate::i18n_commands!(@commands collect_final [ $($acc)* ])
    };
}

#[macro_export]
macro_rules! collect_final {
    ([ $($cmd:path,)* ]) => {
        tauri::generate_handler![ $($cmd),* ]
    };
}

pub(crate) use cortex_commands;

#[derive(Clone)]
pub struct ServerState(Arc<Mutex<Option<CommandChild>>>);

#[derive(Clone)]
pub struct LogState(Arc<Mutex<VecDeque<String>>>);

#[derive(Clone)]
pub struct PortState(Arc<Mutex<u32>>);

#[derive(Clone)]
pub struct REPLState(pub Arc<Mutex<Option<KernelManager>>>);

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerInfo {
    pub port: u32,
    pub url: String,
    pub running: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CortexConfig {
    pub model: String,
    pub provider: String,
    pub sandbox_mode: String,
    pub approval_mode: String,
}

fn find_free_port() -> Result<u32, String> {
    if TcpListener::bind("127.0.0.1:4096").is_ok() {
        return Ok(4096);
    }

    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port() as u32)
        .map_err(|e| format!("Failed to find free port: {}", e))
}

// ===== Inline Tauri Commands =====

#[tauri::command]
pub async fn start_server(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
pub async fn stop_server(_app: AppHandle) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_server_info(_app: AppHandle) -> Result<ServerInfo, String> {
    Ok(ServerInfo {
        port: 4096,
        url: "http://127.0.0.1:4096".to_string(),
        running: true,
    })
}

#[tauri::command]
pub async fn get_logs(app: AppHandle) -> Result<String, String> {
    let log_state = app.state::<LogState>();
    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;
    Ok(logs.iter().cloned().collect::<Vec<_>>().join(""))
}

#[tauri::command]
pub async fn copy_logs_to_clipboard(app: AppHandle) -> Result<(), String> {
    let log_state = app.state::<LogState>();
    let logs = log_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire log lock")?;
    let log_text = logs.iter().cloned().collect::<Vec<_>>().join("");
    app.clipboard()
        .write_text(log_text)
        .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}

#[tauri::command]
pub async fn show_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| format!("Failed to show notification: {}", e))
}

// ===== REPL Commands =====

#[tauri::command]
pub async fn repl_list_kernel_specs(app: AppHandle) -> Result<Vec<KernelSpec>, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });
        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernel_specs()),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_start_kernel(app: AppHandle, spec_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;

    if guard.is_none() {
        let (tx, mut rx) = mpsc::unbounded_channel::<KernelEvent>();
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                let _ = app_clone.emit("repl:event", &event);
            }
        });
        *guard = Some(KernelManager::new(tx));
    }

    match guard.as_mut() {
        Some(manager) => manager.start_kernel(&spec_id),
        None => Err("Kernel manager not initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_list_kernels(app: AppHandle) -> Result<Vec<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_ref() {
        Some(manager) => Ok(manager.list_kernels()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn repl_execute(
    app: AppHandle,
    kernel_id: String,
    code: String,
    cell_id: String,
) -> Result<u32, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_mut() {
        Some(manager) => manager.execute(&kernel_id, &code, &cell_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_interrupt(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_mut() {
        Some(manager) => manager.interrupt(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_shutdown_kernel(app: AppHandle, kernel_id: String) -> Result<(), String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_mut() {
        Some(manager) => manager.shutdown(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_restart_kernel(app: AppHandle, kernel_id: String) -> Result<KernelInfo, String> {
    let repl_state = app.state::<REPLState>();
    let mut guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_mut() {
        Some(manager) => manager.restart(&kernel_id),
        None => Err("No kernel manager initialized".to_string()),
    }
}

#[tauri::command]
pub async fn repl_get_kernel(
    app: AppHandle,
    kernel_id: String,
) -> Result<Option<KernelInfo>, String> {
    let repl_state = app.state::<REPLState>();
    let guard = repl_state
        .0
        .lock()
        .map_err(|_| "Failed to acquire REPL lock")?;
    match guard.as_ref() {
        Some(manager) => Ok(manager.get_kernel(&kernel_id)),
        None => Ok(None),
    }
}

// ===== State Registration =====

pub fn register_state(
    builder: tauri::Builder<tauri::Wry>,
    remote_manager: Arc<RemoteManager>,
) -> tauri::Builder<tauri::Wry> {
    builder
        .manage(ServerState(Arc::new(Mutex::new(None))))
        .manage(LogState(Arc::new(Mutex::new(VecDeque::new()))))
        .manage(PortState(Arc::new(Mutex::new(0))))
        .manage(ExtensionsState(Arc::new(parking_lot::Mutex::new(
            ExtensionsManager::new(),
        ))))
        .manage(crate::extensions::marketplace::MarketplaceState::new())
        .manage(NodeHostState::new())
        .manage(remote_manager)
        .manage(LspState::new())
        .manage(crate::diagnostics::DiagnosticsState::new())
        .manage(REPLState(Arc::new(Mutex::new(None))))
        .manage(DebuggerState::new())
        .manage(crate::dap::commands::WatchState::new())
        .manage(ToolchainState::new())
        .manage(Arc::new(AutoUpdateState::new()))
        .manage(Arc::new(crate::system_specs::LiveMetricsState::new()))
        .manage(ContextServerState::new())
        .manage(Arc::new(ActivityState::new()))
        .manage(Arc::new(TimelineState::new()))
        .manage(Arc::new(crate::action_log::ActionLogState::new()))
        .manage(crate::prompt_store::PromptStoreState::new())
        .manage(crate::acp::ACPState::new())
        .manage(AIState::new())
        .manage(AIToolsState::new())
        .manage(AgentState::new())
        .manage(AgentStoreState::new())
        .manage(crate::terminal::TerminalState::new())
        .manage(crate::terminal::TerminalProfilesState::new())
        .manage(crate::settings::SettingsState::new())
        .manage(crate::settings_sync::SettingsSyncState::new())
        .manage(Arc::new(crate::fs::FileWatcherState::new()))
        .manage(Arc::new(crate::fs::DirectoryCache::new()))
        .manage(Arc::new(crate::fs::IoSemaphore::new()))
        .manage(Arc::new(crate::batch::BatchCacheState::new()))
        .manage(crate::mcp::McpState::<tauri::Wry>::new(
            crate::mcp::McpConfig::new("Cortex Desktop").tcp("127.0.0.1", 4000),
        ))
        .manage(crate::themes::ThemeState::new())
        .manage(crate::keybindings::KeybindingsState::new())
        .manage(crate::wsl::WSLState::new())
        .manage(crate::ssh_terminal::SSHTerminalState::new())
        .manage(crate::rules_library::RulesWatcherState::new())
        .manage(crate::testing::TestWatcherState::new())
        .manage(crate::factory::FactoryState::new())
        .manage(crate::extensions::activation::ActivationState::new())
        .manage(crate::extensions::registry::RegistryState::new())
        .manage(crate::extensions::permissions::PermissionsState(
            std::sync::Arc::new(crate::extensions::permissions::PermissionsManager::new()),
        ))
        .manage(crate::extensions::plugin_api::PluginApiState::new())
        .manage(crate::extensions::api::window::WindowApiState::new())
        .manage(crate::extensions::api::workspace::WorkspaceApiState::new())
        .manage(crate::extensions::api::languages::LanguagesApiState::new())
        .manage(crate::extensions::api::debug::DebugApiState::new())
        .manage(crate::extensions::api::scm::ScmApiState::new())
        .manage(crate::workspace::manager::WorkspaceManagerState::new())
        .manage(crate::remote::port_forwarding::PortForwardingState::new())
        .manage(SandboxState::new())
        .manage(crate::remote::tunnel::TunnelState::new())
        .manage(crate::git::forge::ForgeState::new())
        .manage(CollabState::new())
}

// ===== Setup =====

pub fn setup_app(
    app: &mut tauri::App,
    remote_manager: Arc<RemoteManager>,
    startup_time: std::time::Instant,
) -> Result<(), Box<dyn std::error::Error>> {
    app.manage(crate::window::WindowManagerState::new());

    let app_handle = app.handle().clone();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;

        let app_handle_for_deep_link = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            if let Ok(Some(urls)) = app_handle_for_deep_link.deep_link().get_current() {
                let url_strings: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                if !url_strings.is_empty() {
                    info!("Handling initial deep links: {:?}", url_strings);
                    crate::deep_link::handle_deep_link(&app_handle_for_deep_link, url_strings);
                }
            }
        });

        let app_handle_for_listener = app_handle.clone();
        app.deep_link().on_open_url(move |event| {
            let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
            info!("Received deep link while running: {:?}", urls);
            crate::deep_link::handle_deep_link(&app_handle_for_listener, urls);
        });
    }

    let remote_manager_for_setup = remote_manager;

    tauri::async_runtime::spawn(async move {
        info!("Starting parallel initialization");
        let init_start = std::time::Instant::now();

        let (
            _windows_result,
            _settings_result,
            _extensions_result,
            _lsp_result,
            _profiles_result,
            _update_result,
            _ai_result,
            _mcp_result,
        ) = tokio::join!(
            async {
                let t = std::time::Instant::now();
                crate::window::restore_windows(&app_handle).await;
                info!("Windows restored in {:?}", t.elapsed());
            },
            async {
                let t = std::time::Instant::now();
                if let Err(e) = crate::settings::preload_settings(&app_handle).await {
                    warn!("Failed to preload settings: {}", e);
                }
                info!("Settings preloaded in {:?}", t.elapsed());
            },
            async {
                let t = std::time::Instant::now();
                let app_for_ext = app_handle.clone();
                if let Err(e) = tokio::task::spawn_blocking(move || {
                    crate::extensions::preload_extensions(&app_for_ext)
                })
                .await
                .unwrap_or_else(|e| Err(format!("Task join error: {}", e)))
                {
                    warn!("Failed to preload extensions: {}", e);
                }
                info!("Extensions preloaded in {:?}", t.elapsed());
            },
            async {
                let t = std::time::Instant::now();
                crate::lsp::setup_lsp_events(&app_handle);
                info!("LSP event listeners initialized in {:?}", t.elapsed());
            },
            async {
                let t = std::time::Instant::now();
                if let Err(e) = remote_manager_for_setup.load_profiles().await {
                    warn!("Failed to load SSH profiles: {}", e);
                } else {
                    info!("SSH profiles loaded in {:?}", t.elapsed());
                }
            },
            async {
                let t = std::time::Instant::now();
                crate::auto_update::init_auto_update(&app_handle, true);
                info!("Auto-update initialized in {:?}", t.elapsed());
            },
            async {
                let t = std::time::Instant::now();
                let ai_state = app_handle.state::<AIState>();
                if let Err(e) = ai_state.initialize_from_settings(&app_handle).await {
                    warn!("Failed to initialize AI providers: {}", e);
                } else {
                    info!("AI providers initialized in {:?}", t.elapsed());
                }
            },
            async {
                #[cfg(debug_assertions)]
                {
                    let t = std::time::Instant::now();
                    let mcp_state = app_handle.state::<crate::mcp::McpState<tauri::Wry>>();
                    if let Err(e) = mcp_state.start(&app_handle) {
                        warn!("Failed to start MCP server: {}", e);
                    } else {
                        info!("MCP socket server started in {:?}", t.elapsed());
                    }
                }
            }
        );

        info!(
            "Parallel initialization completed in {:?}",
            init_start.elapsed()
        );

        if let Err(e) = app_handle.emit(
            "backend:ready",
            serde_json::json!({
                "preloaded": ["settings", "extensions", "ai_providers", "windows"]
            }),
        ) {
            warn!("Failed to emit backend:ready event: {}", e);
        } else {
            info!("Backend ready - all data preloaded");
        }
    });

    info!("Setup phase completed in {:?}", startup_time.elapsed());

    Ok(())
}

// ===== Run Event Handler =====

pub fn handle_run_event(app: &AppHandle, event: RunEvent) {
    match event {
        RunEvent::Ready => {
            info!("Application ready");
        }
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::Destroyed,
            ..
        } => {
            let windows = app.webview_windows();
            if windows.is_empty() || (windows.len() == 1 && windows.contains_key(&label)) {
                info!("All windows closed, exiting application");
                app.exit(0);
            }
        }
        RunEvent::ExitRequested { .. } => {
            let window_state = app.state::<crate::window::WindowManagerState>();
            if let Ok(mut exiting) = window_state.is_exiting.lock() {
                *exiting = true;
            }

            info!("Application exit requested, cleaning up all child processes...");

            let terminal_state = app.state::<crate::terminal::TerminalState>();
            let _ = terminal_state.close_all(app);
            info!("All terminals closed on app exit");

            let ssh_state = app.state::<crate::ssh_terminal::SSHTerminalState>();
            let _ = ssh_state.close_all(app);
            info!("All SSH sessions closed on app exit");

            let lsp_state = app.state::<LspState>();
            let _ = lsp_state.stop_all_servers();
            info!("All LSP servers stopped on app exit");

            let debugger_state = app.state::<DebuggerState>();
            debugger_state.stop_all_sessions();
            info!("All debugger sessions stopped on app exit");

            let context_server_state = app.state::<ContextServerState>();
            context_server_state.disconnect_all();
            info!("All context servers disconnected on app exit");

            let test_watcher_state = app.state::<crate::testing::TestWatcherState>();
            let _ = test_watcher_state.stop_all();
            info!("All test watchers stopped on app exit");

            {
                let live_metrics_state = app.state::<Arc<crate::system_specs::LiveMetricsState>>();
                live_metrics_state.stop();
                info!("Live metrics stopped on app exit");
            }

            if let Ok(mut guard) = app.state::<REPLState>().0.lock() {
                if let Some(manager) = guard.as_mut() {
                    manager.shutdown_all();
                    info!("All REPL kernels shut down on app exit");
                }
            }

            #[cfg(debug_assertions)]
            {
                let mcp_state = app.state::<crate::mcp::McpState<tauri::Wry>>();
                let _ = mcp_state.stop();
                info!("MCP socket server stopped on app exit");
            }

            {
                let node_host_state = app.state::<NodeHostState>();
                let node_host = node_host_state.0.clone();
                tauri::async_runtime::block_on(async {
                    let mut guard = node_host.lock().await;
                    if let Some(process) = guard.take() {
                        let _ = process.stop().await;
                        info!("Node.js extension host stopped on app exit");
                    }
                });
            }

            {
                let ext_state = app.state::<ExtensionsState>();
                let manager = ext_state.0.lock();
                manager.wasm_runtime.unload_all();
                info!("WASM extension runtime stopped on app exit");
            }

            {
                let tunnel_state = app.state::<crate::remote::tunnel::TunnelState>();
                if let Err(e) = tunnel_state.0.disconnect_all() {
                    warn!("Failed to disconnect tunnels: {}", e);
                }
                info!("All remote tunnels closed on app exit");
            }

            info!("All child processes cleaned up, exiting application");
        }
        _ => {}
    }
}
