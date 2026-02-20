//! Tauri commands for terminal operations
//!
//! Exposes terminal functionality to the frontend via Tauri's IPC system.

use tauri::{AppHandle, Manager};
use tracing::info;

use super::process::{get_process_on_port_impl, kill_process_by_pid, list_listening_ports_impl};
use super::state::TerminalState;
use super::types::{CreateTerminalOptions, PortProcess, TerminalInfo, UpdateTerminalOptions};

// ===== Terminal Commands =====

#[tauri::command]
pub async fn terminal_create(
    app: AppHandle,
    options: Option<CreateTerminalOptions>,
) -> Result<TerminalInfo, String> {
    let state = app.state::<TerminalState>();
    state.create_terminal(&app, options.unwrap_or_default())
}

#[tauri::command]
pub async fn terminal_write(
    app: AppHandle,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.write_terminal(&terminal_id, &data)
}

#[tauri::command]
pub async fn terminal_update(
    app: AppHandle,
    terminal_id: String,
    options: UpdateTerminalOptions,
) -> Result<TerminalInfo, String> {
    let state = app.state::<TerminalState>();
    state.update_terminal(&terminal_id, options)
}

#[tauri::command]
pub async fn terminal_resize(
    app: AppHandle,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.resize_terminal(&terminal_id, cols, rows)
}

#[tauri::command]
pub async fn terminal_close(app: AppHandle, terminal_id: String) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.close_terminal(&app, &terminal_id)
}

#[tauri::command]
pub async fn terminal_list(app: AppHandle) -> Result<Vec<TerminalInfo>, String> {
    let state = app.state::<TerminalState>();
    state.list_terminals()
}

#[tauri::command]
pub async fn terminal_get(
    app: AppHandle,
    terminal_id: String,
) -> Result<Option<TerminalInfo>, String> {
    let state = app.state::<TerminalState>();
    state.get_terminal(&terminal_id)
}

#[tauri::command]
pub async fn terminal_send_interrupt(app: AppHandle, terminal_id: String) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.send_interrupt(&terminal_id)
}

#[tauri::command]
pub async fn terminal_send_eof(app: AppHandle, terminal_id: String) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.send_eof(&terminal_id)
}

#[tauri::command]
pub async fn terminal_ack(app: AppHandle, terminal_id: String, bytes: usize) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.acknowledge_output(&terminal_id, bytes)
}

#[tauri::command]
pub async fn terminal_close_all(app: AppHandle) -> Result<(), String> {
    let state = app.state::<TerminalState>();
    state.close_all(&app)
}

#[tauri::command]
pub async fn terminal_get_default_shell() -> String {
    TerminalState::get_default_shell()
}

/// Detect available shells on the system for terminal profiles
#[tauri::command]
pub async fn terminal_detect_shells() -> Result<Vec<String>, String> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        use std::path::Path;

        // Windows shell paths to check
        let potential_shells = [
            // Command Prompt
            "C:\\Windows\\System32\\cmd.exe",
            // Windows PowerShell
            "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
            // PowerShell Core (various locations)
            "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
            "C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe",
            // Git Bash
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
            // Cygwin
            "C:\\cygwin64\\bin\\bash.exe",
            "C:\\cygwin\\bin\\bash.exe",
            // MSYS2
            "C:\\msys64\\usr\\bin\\bash.exe",
            // Nushell
            "C:\\Program Files\\nu\\bin\\nu.exe",
        ];

        for shell in potential_shells {
            if Path::new(shell).exists() {
                shells.push(shell.to_string());
            }
        }

        // Check for user-installed PowerShell Core via scoop or other package managers
        if let Ok(home) = std::env::var("USERPROFILE") {
            let scoop_pwsh = format!("{}\\scoop\\apps\\pwsh\\current\\pwsh.exe", home);
            if Path::new(&scoop_pwsh).exists() {
                shells.push(scoop_pwsh);
            }
        }

        // Add WSL shells
        if let Ok(wsl_shells) = crate::wsl::WSLManager::detect_distributions() {
            for distro in wsl_shells.distros {
                // Add wsl.exe command for each distro
                shells.push(format!("wsl.exe -d {}", distro.name));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::path::Path;

        let potential_shells = [
            "/bin/bash",
            "/bin/zsh",
            "/bin/sh",
            "/usr/bin/bash",
            "/usr/bin/zsh",
            "/usr/local/bin/bash",
            "/usr/local/bin/zsh",
            "/usr/local/bin/fish",
            "/opt/homebrew/bin/bash",
            "/opt/homebrew/bin/zsh",
            "/opt/homebrew/bin/fish",
            "/opt/homebrew/bin/nu",
        ];

        for shell in potential_shells {
            if Path::new(shell).exists() {
                shells.push(shell.to_string());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::path::Path;

        let potential_shells = [
            "/bin/bash",
            "/bin/zsh",
            "/bin/sh",
            "/bin/fish",
            "/usr/bin/bash",
            "/usr/bin/zsh",
            "/usr/bin/fish",
            "/usr/local/bin/bash",
            "/usr/local/bin/zsh",
            "/usr/local/bin/fish",
            "/usr/bin/nu",
            "/usr/local/bin/nu",
        ];

        for shell in potential_shells {
            if Path::new(shell).exists() {
                shells.push(shell.to_string());
            }
        }
    }

    // Also add the default shell if not already in the list
    let default_shell = TerminalState::get_default_shell();
    if !shells.contains(&default_shell) {
        shells.insert(0, default_shell);
    }

    Ok(shells)
}

/// Check if a path exists on the filesystem
#[tauri::command]
pub async fn path_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

// ===== Port Process Management Commands =====

/// Get process information for a specific port
#[tauri::command]
pub async fn get_process_on_port(port: u16) -> Result<Option<PortProcess>, String> {
    get_process_on_port_impl(port)
}

/// Kill a process on a specific port
#[tauri::command]
pub async fn kill_process_on_port(port: u16) -> Result<bool, String> {
    let process = get_process_on_port_impl(port)?;

    match process {
        Some(p) => {
            kill_process_by_pid(p.pid)?;
            info!(
                "Killed process {} (PID: {}) on port {}",
                p.process_name, p.pid, port
            );
            Ok(true)
        }
        None => Err(format!("No process found on port {}", port)),
    }
}

/// List all listening network ports
#[tauri::command]
pub async fn list_listening_ports() -> Result<Vec<PortProcess>, String> {
    list_listening_ports_impl()
}

// ===== Terminal Link Detection Commands =====

/// Detect links in terminal output text
#[tauri::command]
pub async fn terminal_detect_links(
    text: String,
) -> Result<Vec<super::links::TerminalLink>, String> {
    Ok(super::links::detect_links(&text))
}

// ===== Terminal Search Commands =====

/// Search within terminal buffer
#[tauri::command]
pub async fn terminal_search(
    lines: Vec<String>,
    query: String,
    case_sensitive: Option<bool>,
    max_results: Option<usize>,
) -> Result<super::search::TerminalSearchResult, String> {
    Ok(super::search::search_buffer(
        &lines,
        &query,
        case_sensitive.unwrap_or(false),
        max_results,
    ))
}

// ===== Shell Integration Protocol Commands =====

/// Parse OSC 633 shell integration sequences from terminal output
#[tauri::command]
pub async fn terminal_parse_shell_integration(
    data: String,
) -> Result<Vec<super::protocol::ShellIntegrationEvent>, String> {
    Ok(super::protocol::parse_osc_633(&data))
}

/// Strip shell integration sequences from terminal output
#[tauri::command]
pub async fn terminal_strip_sequences(data: String) -> Result<String, String> {
    Ok(super::protocol::strip_osc_633(&data))
}
