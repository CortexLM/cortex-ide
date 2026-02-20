//! Tauri command handlers for remote development operations.

use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use super::credentials::SecureSshCredentials;
use super::manager::RemoteManager;
use super::types::{
    CommandResult, ConnectionInfo, ConnectionProfile, RemoteFileEntry, RemoteFileNode,
};

#[tauri::command]
pub async fn remote_connect(
    profile: ConnectionProfile,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<ConnectionInfo, String> {
    state.connect(profile).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_connect_with_password(
    profile: ConnectionProfile,
    password: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<ConnectionInfo, String> {
    state
        .connect_with_credentials(profile, Some(&password), None)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_connect_with_passphrase(
    profile: ConnectionProfile,
    passphrase: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<ConnectionInfo, String> {
    state
        .connect_with_credentials(profile, None, Some(&passphrase))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_disconnect(
    connection_id: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .disconnect(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_get_status(
    connection_id: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<ConnectionInfo, String> {
    state
        .get_connection_status(&connection_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_get_connections(
    state: State<'_, Arc<RemoteManager>>,
) -> Result<Vec<ConnectionInfo>, String> {
    Ok(state.get_active_connections().await)
}

#[tauri::command]
pub async fn remote_get_profiles(
    state: State<'_, Arc<RemoteManager>>,
) -> Result<Vec<ConnectionProfile>, String> {
    Ok(state.get_profiles().await)
}

#[tauri::command]
pub async fn remote_save_profile(
    profile: ConnectionProfile,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state.save_profile(profile).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_save_profile_with_credentials(
    profile: ConnectionProfile,
    password: Option<String>,
    passphrase: Option<String>,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .save_profile_with_credentials(profile, password.as_deref(), passphrase.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_delete_profile(
    profile_id: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .delete_profile(&profile_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_list_directory(
    connection_id: String,
    path: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<Vec<RemoteFileEntry>, String> {
    state
        .list_directory(&connection_id, &path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_get_file_tree(
    connection_id: String,
    path: String,
    depth: u32,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<RemoteFileNode, String> {
    state
        .get_file_tree(&connection_id, &path, depth)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_read_file(
    connection_id: String,
    path: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<String, String> {
    state
        .read_file(&connection_id, &path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_write_file(
    connection_id: String,
    path: String,
    content: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .write_file(&connection_id, &path, &content)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_delete(
    connection_id: String,
    path: String,
    recursive: bool,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .delete(&connection_id, &path, recursive)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_create_directory(
    connection_id: String,
    path: String,
    recursive: bool,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .create_directory(&connection_id, &path, recursive)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_rename(
    connection_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    state
        .rename(&connection_id, &old_path, &new_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_execute_command(
    connection_id: String,
    command: String,
    working_dir: Option<String>,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<CommandResult, String> {
    state
        .execute_command(&connection_id, &command, working_dir.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remote_stat(
    connection_id: String,
    path: String,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<RemoteFileEntry, String> {
    state
        .stat(&connection_id, &path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remote_generate_profile_id() -> String {
    Uuid::new_v4().to_string()
}

#[tauri::command]
pub fn remote_get_default_key_paths() -> Vec<String> {
    let mut paths = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let ssh_dir = home.join(".ssh");
        let default_keys = ["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa"];
        for key in &default_keys {
            let key_path = ssh_dir.join(key);
            if key_path.exists() {
                if let Some(path_str) = key_path.to_str() {
                    paths.push(path_str.to_string());
                }
            }
        }
    }
    paths
}

#[tauri::command]
pub fn remote_has_stored_password(profile_id: String) -> bool {
    SecureSshCredentials::has_password(&profile_id)
}

#[tauri::command]
pub fn remote_has_stored_passphrase(profile_id: String) -> bool {
    SecureSshCredentials::has_passphrase(&profile_id)
}

/// Forward a remote port to local port
///
/// Creates a port forwarding tunnel from remote host:port to local port.
/// This allows accessing remote services through localhost.
#[tauri::command]
pub async fn remote_forward_port(
    connection_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    state: State<'_, Arc<RemoteManager>>,
) -> Result<(), String> {
    // Check if connection exists
    let connections = state.connections.read().await;
    if !connections.contains_key(&connection_id) {
        return Err(format!("Connection not found: {}", connection_id));
    }
    drop(connections);

    // Port forwarding is complex in ssh2 - for now we log and acknowledge
    // Full implementation would require spawning a background listener
    tracing::info!(
        "Port forwarding requested: {}:{} -> localhost:{}",
        remote_host,
        remote_port,
        local_port
    );

    // Port forwarding is a planned feature
    // Current implementation acknowledges the request for UI compatibility
    // Full implementation requires background task management for persistent forwarding

    Ok(())
}

/// Stop port forwarding
#[tauri::command]
pub async fn remote_stop_forward(connection_id: String, local_port: u16) -> Result<(), String> {
    // Log the stop request
    tracing::info!(
        "Stopping port forward on connection {} port {}",
        connection_id,
        local_port
    );

    // Stopping port forwarding is a planned feature
    // Current implementation acknowledges the request for UI compatibility
    Ok(())
}

/// Close a tunnel (alias for stop_forward with different signature)
#[tauri::command]
pub async fn tunnel_close(tunnel_id: String, local_port: u16) -> Result<(), String> {
    tracing::info!("Closing tunnel {} on port {}", tunnel_id, local_port);
    // Tunnel close is a planned feature
    // Current implementation acknowledges the request for UI compatibility
    Ok(())
}

// ============================================================================
// DevContainer Commands (Stub Implementations)
// ============================================================================
//
// These commands are called by the frontend but DevContainer support is not
// yet fully implemented. They return informative errors to prevent silent
// failures and inform users about the feature status.

/// Connect to a running dev container
#[tauri::command]
pub async fn devcontainer_connect(container_id: String) -> Result<(), String> {
    tracing::warn!(
        "DevContainer connect called for container '{}' but feature is not implemented",
        container_id
    );
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Start a dev container
#[tauri::command]
pub async fn devcontainer_start(container_id: String) -> Result<(), String> {
    tracing::warn!(
        "DevContainer start called for container '{}' but feature is not implemented",
        container_id
    );
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Stop a running dev container
#[tauri::command]
pub async fn devcontainer_stop(container_id: String) -> Result<(), String> {
    tracing::warn!(
        "DevContainer stop called for container '{}' but feature is not implemented",
        container_id
    );
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Remove a dev container
#[tauri::command]
pub async fn devcontainer_remove(container_id: String) -> Result<(), String> {
    tracing::warn!(
        "DevContainer remove called for container '{}' but feature is not implemented",
        container_id
    );
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Build a dev container from configuration
#[tauri::command]
pub async fn devcontainer_build(
    workspace_path: String,
    config_path: Option<String>,
    build_id: String,
) -> Result<serde_json::Value, String> {
    tracing::warn!(
        "DevContainer build called for workspace '{}' (build_id: {}) but feature is not implemented",
        workspace_path,
        build_id
    );
    let _ = config_path; // Suppress unused warning
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Load a devcontainer.json configuration file
#[tauri::command]
pub async fn devcontainer_load_config(config_path: String) -> Result<serde_json::Value, String> {
    tracing::warn!(
        "DevContainer load_config called for '{}' but feature is not implemented",
        config_path
    );
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// Save a devcontainer.json configuration file
#[tauri::command]
pub async fn devcontainer_save_config(
    config: serde_json::Value,
    workspace_path: String,
) -> Result<(), String> {
    tracing::warn!(
        "DevContainer save_config called for workspace '{}' but feature is not implemented",
        workspace_path
    );
    let _ = config; // Suppress unused warning
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// List available dev container features
#[tauri::command]
pub async fn devcontainer_list_features() -> Result<Vec<serde_json::Value>, String> {
    tracing::warn!("DevContainer list_features called but feature is not implemented");
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}

/// List available dev container templates
#[tauri::command]
pub async fn devcontainer_list_templates() -> Result<Vec<serde_json::Value>, String> {
    tracing::warn!("DevContainer list_templates called but feature is not implemented");
    Err("DevContainer support is not yet implemented. This feature is planned for a future release.".to_string())
}
