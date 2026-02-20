//! Auto-update functionality for Cortex
//!
//! This module provides automatic update checking, downloading, and installation
//! using the tauri-plugin-updater. It supports:
//! - Automatic check on startup
//! - Manual check from menu
//! - Release notes display
//! - Skip version option
//! - Download progress tracking

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::sync::Mutex;
use tracing::{error, info, warn};

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_updater::{Update, UpdaterExt};

/// Status of the auto-update process
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "data")]
pub enum AutoUpdateStatus {
    /// No update activity
    Idle,
    /// Checking for updates
    Checking,
    /// Update available
    UpdateAvailable {
        version: String,
        current_version: String,
        release_notes: Option<String>,
        release_date: Option<String>,
    },
    /// Downloading update
    Downloading {
        version: String,
        progress: f64,
        downloaded_bytes: u64,
        total_bytes: u64,
    },
    /// Ready to install (downloaded)
    ReadyToInstall { version: String },
    /// Installing update
    Installing { version: String },
    /// Update completed, restart required
    RestartRequired { version: String },
    /// No update available
    UpToDate { current_version: String },
    /// Error occurred
    Error { message: String },
}

/// Information about an available update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub release_notes: Option<String>,
    pub release_date: Option<String>,
    pub download_url: Option<String>,
}

/// Auto-update event emitted to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct AutoUpdateEvent {
    pub status: AutoUpdateStatus,
    pub timestamp: i64,
}

/// Managed state for auto-updates
pub struct AutoUpdateState {
    /// Current status
    status: Mutex<AutoUpdateStatus>,
    /// Cached update info
    update_info: Mutex<Option<UpdateInfo>>,
    /// Whether an update is in progress
    update_in_progress: AtomicBool,
    /// Cached update object for installation
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    pending_update: Mutex<Option<Update>>,
}

impl AutoUpdateState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(AutoUpdateStatus::Idle),
            update_info: Mutex::new(None),
            update_in_progress: AtomicBool::new(false),
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            pending_update: Mutex::new(None),
        }
    }
}

impl Default for AutoUpdateState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the current version of the application
fn get_current_version<R: Runtime>(app: &AppHandle<R>) -> String {
    app.package_info().version.to_string()
}

/// Emit status update to frontend
fn emit_status<R: Runtime>(app: &AppHandle<R>, status: AutoUpdateStatus) {
    let event = AutoUpdateEvent {
        status,
        timestamp: chrono::Utc::now().timestamp_millis(),
    };
    if let Err(e) = app.emit("auto-update:status", &event) {
        error!("Failed to emit auto-update status: {}", e);
    }
}

/// Check for updates
#[tauri::command]
pub async fn check_for_updates<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, Arc<AutoUpdateState>>,
) -> Result<Option<UpdateInfo>, String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        return Err("Auto-update not supported on mobile platforms".to_string());
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Check if update is already in progress
        if state.update_in_progress.load(Ordering::SeqCst) {
            return Err("Update check already in progress".to_string());
        }

        state.update_in_progress.store(true, Ordering::SeqCst);

        // Update status
        {
            let mut status = state.status.lock().await;
            *status = AutoUpdateStatus::Checking;
        }
        emit_status(&app, AutoUpdateStatus::Checking);

        let current_version = get_current_version(&app);
        info!("Checking for updates. Current version: {}", current_version);

        // Get the updater
        let updater = match app.updater() {
            Ok(u) => u,
            Err(e) => {
                let error_msg = format!("Failed to get updater: {}", e);
                error!("{}", error_msg);
                state.update_in_progress.store(false, Ordering::SeqCst);
                let status = AutoUpdateStatus::Error {
                    message: error_msg.clone(),
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);
                return Err(error_msg);
            }
        };

        // Check for updates
        match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                let release_notes = update.body.clone();
                let release_date = update.date.map(|d| d.to_string());

                info!("Update available: {} -> {}", current_version, version);

                let update_info = UpdateInfo {
                    version: version.clone(),
                    current_version: current_version.clone(),
                    release_notes: release_notes.clone(),
                    release_date: release_date.clone(),
                    download_url: None,
                };

                // Store update info and pending update
                {
                    let mut info = state.update_info.lock().await;
                    *info = Some(update_info.clone());
                }
                {
                    let mut pending = state.pending_update.lock().await;
                    *pending = Some(update);
                }

                let status = AutoUpdateStatus::UpdateAvailable {
                    version,
                    current_version,
                    release_notes,
                    release_date,
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);

                state.update_in_progress.store(false, Ordering::SeqCst);
                Ok(Some(update_info))
            }
            Ok(None) => {
                info!("No updates available");
                let status = AutoUpdateStatus::UpToDate {
                    current_version: current_version.clone(),
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);

                state.update_in_progress.store(false, Ordering::SeqCst);
                Ok(None)
            }
            Err(e) => {
                let error_msg = format!("Failed to check for updates: {}", e);
                error!("{}", error_msg);
                let status = AutoUpdateStatus::Error {
                    message: error_msg.clone(),
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);

                state.update_in_progress.store(false, Ordering::SeqCst);
                Err(error_msg)
            }
        }
    }
}

/// Download and install the update
#[tauri::command]
pub async fn download_and_install_update<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, Arc<AutoUpdateState>>,
) -> Result<(), String> {
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        return Err("Auto-update not supported on mobile platforms".to_string());
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        // Get pending update
        let update = {
            let mut pending = state.pending_update.lock().await;
            pending.take()
        };

        let update = match update {
            Some(u) => u,
            None => {
                return Err(
                    "No pending update available. Please check for updates first.".to_string(),
                );
            }
        };

        let version = update.version.clone();
        info!("Starting download for version: {}", version);

        // Update status to downloading
        let status = AutoUpdateStatus::Downloading {
            version: version.clone(),
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: 0,
        };
        {
            let mut s = state.status.lock().await;
            *s = status.clone();
        }
        emit_status(&app, status);

        // Download with progress
        let app_clone = app.clone();
        let version_clone = version.clone();
        let mut downloaded: u64 = 0;
        let mut total: u64 = 0;

        let download_result = update
            .download(
                move |chunk_length, content_length| {
                    downloaded += chunk_length as u64;
                    if let Some(total_len) = content_length {
                        total = total_len;
                    }
                    let progress = if total > 0 {
                        (downloaded as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };

                    let status = AutoUpdateStatus::Downloading {
                        version: version_clone.clone(),
                        progress,
                        downloaded_bytes: downloaded,
                        total_bytes: total,
                    };
                    emit_status(&app_clone, status);
                },
                || {
                    info!("Download finished, preparing to install");
                },
            )
            .await;

        match download_result {
            Ok(bytes) => {
                info!("Download completed successfully, {} bytes", bytes.len());

                // Update status to installing
                let status = AutoUpdateStatus::Installing {
                    version: version.clone(),
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);

                // Install the update with the downloaded bytes
                match update.install(&bytes) {
                    Ok(()) => {
                        info!("Update installed successfully, restart required");
                        let status = AutoUpdateStatus::RestartRequired {
                            version: version.clone(),
                        };
                        {
                            let mut s = state.status.lock().await;
                            *s = status.clone();
                        }
                        emit_status(&app, status);
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to install update: {}", e);
                        error!("{}", error_msg);
                        let status = AutoUpdateStatus::Error {
                            message: error_msg.clone(),
                        };
                        {
                            let mut s = state.status.lock().await;
                            *s = status.clone();
                        }
                        emit_status(&app, status);
                        Err(error_msg)
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to download update: {}", e);
                error!("{}", error_msg);
                let status = AutoUpdateStatus::Error {
                    message: error_msg.clone(),
                };
                {
                    let mut s = state.status.lock().await;
                    *s = status.clone();
                }
                emit_status(&app, status);
                Err(error_msg)
            }
        }
    }
}

/// Get the current update status
#[tauri::command]
pub async fn get_update_status(
    state: tauri::State<'_, Arc<AutoUpdateState>>,
) -> Result<AutoUpdateStatus, String> {
    let status = state.status.lock().await;
    Ok(status.clone())
}

/// Get cached update info
#[tauri::command]
pub async fn get_update_info(
    state: tauri::State<'_, Arc<AutoUpdateState>>,
) -> Result<Option<UpdateInfo>, String> {
    let info = state.update_info.lock().await;
    Ok(info.clone())
}

/// Reset update status to idle
#[tauri::command]
pub async fn dismiss_update(
    app: AppHandle,
    state: tauri::State<'_, Arc<AutoUpdateState>>,
) -> Result<(), String> {
    {
        let mut status = state.status.lock().await;
        *status = AutoUpdateStatus::Idle;
    }
    {
        let mut info = state.update_info.lock().await;
        *info = None;
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let mut pending = state.pending_update.lock().await;
        *pending = None;
    }
    emit_status(&app, AutoUpdateStatus::Idle);
    Ok(())
}

/// Restart the application to apply updates
#[tauri::command]
pub async fn restart_app(app: AppHandle) -> Result<(), String> {
    info!("Restarting application to apply updates");
    app.restart();
}

/// Get the current application version
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    get_current_version(&app)
}

/// Get skipped version from local storage (handled by frontend)
/// This is a placeholder - actual storage is managed by frontend localStorage
#[tauri::command]
pub fn get_skipped_version() -> Option<String> {
    // Skipped version is stored in frontend localStorage
    None
}

/// Set skipped version (handled by frontend)
/// This is a placeholder - actual storage is managed by frontend localStorage
#[tauri::command]
pub fn set_skipped_version(_version: Option<String>) -> Result<(), String> {
    // Skipped version is stored in frontend localStorage
    Ok(())
}

/// Initialize auto-update and optionally check on startup
pub fn init_auto_update<R: Runtime>(app: &AppHandle<R>, check_on_startup: bool) {
    if check_on_startup {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let state = app_clone.state::<Arc<AutoUpdateState>>();
                info!("Checking for updates on startup...");

                // Get the updater
                if let Ok(updater) = app_clone.updater() {
                    match updater.check().await {
                        Ok(Some(update)) => {
                            let current_version = get_current_version(&app_clone);
                            let version = update.version.clone();
                            let release_notes = update.body.clone();
                            let release_date = update.date.map(|d| d.to_string());

                            info!(
                                "Update available on startup: {} -> {}",
                                current_version, version
                            );

                            let update_info = UpdateInfo {
                                version: version.clone(),
                                current_version: current_version.clone(),
                                release_notes: release_notes.clone(),
                                release_date: release_date.clone(),
                                download_url: None,
                            };

                            // Store update info and pending update
                            {
                                let mut info = state.update_info.lock().await;
                                *info = Some(update_info);
                            }
                            {
                                let mut pending = state.pending_update.lock().await;
                                *pending = Some(update);
                            }

                            let status = AutoUpdateStatus::UpdateAvailable {
                                version,
                                current_version,
                                release_notes,
                                release_date,
                            };
                            {
                                let mut s = state.status.lock().await;
                                *s = status.clone();
                            }
                            emit_status(&app_clone, status);
                        }
                        Ok(None) => {
                            info!("No updates available on startup");
                        }
                        Err(e) => {
                            warn!("Failed to check for updates on startup: {}", e);
                        }
                    }
                }
            }
        });
    }
}
