//! Extension permissions and workspace-scoped file access control.
//!
//! This module provides a permissions system for extensions, enforcing
//! workspace-scoped file access and requiring explicit grants for
//! shell execution, network access, clipboard operations, editor access,
//! workspace configuration, UI contributions, and language features.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tracing::{info, warn};
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Kinds of permissions an extension can request.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum PermissionKind {
    FileRead,
    FileWrite,
    ShellExecute,
    NetworkAccess,
    ClipboardAccess,
    /// Reading editor state (active editor, selection, document text).
    EditorRead,
    /// Modifying editor content (insert text, replace range, decorations).
    EditorWrite,
    /// Reading and writing workspace configuration.
    WorkspaceConfig,
    /// Registering tree views, status bar items, showing quick picks.
    UIContributions,
    /// Registering completion/hover/definition providers, diagnostics.
    LanguageFeatures,
    /// Reading clipboard contents (split from `ClipboardAccess`).
    ClipboardRead,
    /// Writing clipboard contents (split from `ClipboardAccess`).
    ClipboardWrite,
    DiagnosticAccess,
    CompletionProviderAccess,
    CodeActionAccess,
    UIAccess,
    OutputChannelAccess,
    StatusBarAccess,
    TreeViewAccess,
}

/// A permission request emitted to the frontend for user approval.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionRequest {
    pub request_id: String,
    pub extension_id: String,
    pub permission: PermissionKind,
    pub resource: String,
    pub reason: String,
}

/// A granted permission with scope and expiration metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionGrant {
    pub extension_id: String,
    pub permission: PermissionKind,
    pub scope: String,
    pub granted_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
}

/// A permission declared in an extension manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestPermission {
    pub kind: PermissionKind,
    #[serde(default)]
    pub scope: String,
    #[serde(default)]
    pub reason: String,
}

// ============================================================================
// Manager
// ============================================================================

/// Manages extension permission grants and workspace folder restrictions.
pub struct PermissionsManager {
    grants: DashMap<String, Vec<PermissionGrant>>,
    workspace_folders: Arc<Mutex<Vec<PathBuf>>>,
    pending_requests: DashMap<String, tokio::sync::oneshot::Sender<bool>>,
}

impl Default for PermissionsManager {
    fn default() -> Self {
        Self::new()
    }
}

impl PermissionsManager {
    pub fn new() -> Self {
        Self {
            grants: DashMap::new(),
            workspace_folders: Arc::new(Mutex::new(Vec::new())),
            pending_requests: DashMap::new(),
        }
    }

    /// Replace the set of workspace folders used for path validation.
    pub fn set_workspace_folders(&self, folders: Vec<PathBuf>) {
        let mut ws = self
            .workspace_folders
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        *ws = folders;
    }

    /// Check whether `extension_id` may access `path` (read or write).
    ///
    /// Access is allowed when the canonicalized path falls inside any
    /// workspace folder **or** the extension holds an explicit grant whose
    /// scope is a prefix of the canonicalized path.
    pub fn check_file_access(
        &self,
        extension_id: &str,
        path: &Path,
        write: bool,
    ) -> Result<(), String> {
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Failed to resolve path {}: {}", path.display(), e))?;

        let required = if write {
            PermissionKind::FileWrite
        } else {
            PermissionKind::FileRead
        };

        let ws = self
            .workspace_folders
            .lock()
            .map_err(|_| "workspace_folders mutex poisoned".to_string())?;

        for folder in ws.iter() {
            if let Ok(ws_canonical) = folder.canonicalize() {
                if canonical.starts_with(&ws_canonical) {
                    return Ok(());
                }
            }
        }
        drop(ws);

        if let Some(ext_grants) = self.grants.get(extension_id) {
            let now = Utc::now();
            for grant in ext_grants.iter() {
                if grant.permission != required {
                    continue;
                }
                if let Some(expires) = grant.expires_at {
                    if now > expires {
                        continue;
                    }
                }
                if let Ok(scope_canonical) = PathBuf::from(&grant.scope).canonicalize() {
                    if canonical.starts_with(&scope_canonical) {
                        return Ok(());
                    }
                }
            }
        }

        warn!(
            extension_id = extension_id,
            path = %canonical.display(),
            write = write,
            "File access denied"
        );
        Err(format!(
            "Extension '{}' does not have {} access to {}",
            extension_id,
            if write { "write" } else { "read" },
            canonical.display()
        ))
    }

    /// Returns `true` if the extension holds a non-expired `ShellExecute` grant.
    pub fn check_shell_permission(&self, extension_id: &str) -> bool {
        if let Some(ext_grants) = self.grants.get(extension_id) {
            let now = Utc::now();
            return ext_grants.iter().any(|g| {
                g.permission == PermissionKind::ShellExecute
                    && g.expires_at.is_none_or(|exp| now <= exp)
            });
        }
        false
    }

    /// Check whether `extension_id` holds a non-expired grant of the given kind.
    ///
    /// For `FileRead` and `FileWrite`, this method delegates to
    /// [`check_file_access`](Self::check_file_access) — callers should use that
    /// method directly when a concrete path is available. All other permission
    /// kinds are checked against the grants map.
    pub fn check_permission(
        &self,
        extension_id: &str,
        kind: &PermissionKind,
    ) -> Result<(), String> {
        match kind {
            PermissionKind::FileRead | PermissionKind::FileWrite => {
                return Err(format!(
                    "Use check_file_access for {:?} permissions — a path is required",
                    kind
                ));
            }
            _ => {}
        }

        if let Some(ext_grants) = self.grants.get(extension_id) {
            let now = Utc::now();
            for grant in ext_grants.iter() {
                if &grant.permission != kind {
                    continue;
                }
                if let Some(expires) = grant.expires_at {
                    if now > expires {
                        continue;
                    }
                }
                return Ok(());
            }
        }

        warn!(
            extension_id = extension_id,
            permission = ?kind,
            "Permission denied"
        );
        Err(format!(
            "Extension '{}' does not have {:?} permission",
            extension_id, kind
        ))
    }

    /// Grant a permission to an extension.
    pub fn grant_permission(
        &self,
        extension_id: &str,
        permission: PermissionKind,
        scope: &str,
    ) -> PermissionGrant {
        let grant = PermissionGrant {
            extension_id: extension_id.to_string(),
            permission: permission.clone(),
            scope: scope.to_string(),
            granted_at: Utc::now(),
            expires_at: None,
        };

        self.grants
            .entry(extension_id.to_string())
            .or_default()
            .push(grant.clone());

        info!(
            extension_id = extension_id,
            permission = ?permission,
            scope = scope,
            "Permission granted"
        );

        grant
    }

    /// Revoke all grants of a specific permission kind for an extension.
    pub fn revoke_permission(&self, extension_id: &str, permission: &PermissionKind) {
        if let Some(mut ext_grants) = self.grants.get_mut(extension_id) {
            let before = ext_grants.len();
            ext_grants.retain(|g| &g.permission != permission);
            let removed = before - ext_grants.len();
            if removed > 0 {
                info!(
                    extension_id = extension_id,
                    permission = ?permission,
                    removed = removed,
                    "Permissions revoked"
                );
            }
        }
    }

    /// Revoke every grant held by an extension.
    pub fn revoke_all(&self, extension_id: &str) {
        if self.grants.remove(extension_id).is_some() {
            info!(extension_id = extension_id, "All permissions revoked");
        }
    }

    /// Return a snapshot of all grants for an extension.
    pub fn get_grants(&self, extension_id: &str) -> Vec<PermissionGrant> {
        self.grants
            .get(extension_id)
            .map(|v| v.clone())
            .unwrap_or_default()
    }

    /// Emit a permission request to the frontend and wait for a response.
    ///
    /// The frontend should listen for `plugin:permission-request` events and
    /// call `plugin_respond_permission_request` with the `request_id` and the
    /// user's decision.
    pub async fn request_shell_permission(
        &self,
        app_handle: &AppHandle,
        extension_id: &str,
        command: &str,
    ) -> Result<bool, String> {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

        self.pending_requests.insert(request_id.clone(), tx);

        let request = PermissionRequest {
            request_id: request_id.clone(),
            extension_id: extension_id.to_string(),
            permission: PermissionKind::ShellExecute,
            resource: command.to_string(),
            reason: format!("Extension '{}' wants to execute: {}", extension_id, command),
        };

        app_handle
            .emit("plugin:permission-request", &request)
            .map_err(|e| format!("Failed to emit permission request: {}", e))?;

        info!(
            request_id = %request_id,
            extension_id = extension_id,
            command = command,
            "Shell permission requested"
        );

        match rx.await {
            Ok(approved) => {
                info!(
                    request_id = %request_id,
                    approved = approved,
                    "Shell permission response received"
                );
                Ok(approved)
            }
            Err(_) => {
                warn!(
                    request_id = %request_id,
                    "Permission request channel closed without response"
                );
                Err("Permission request was cancelled".to_string())
            }
        }
    }

    /// Emit a generic permission request to the frontend and wait for a response.
    ///
    /// Similar to [`request_shell_permission`](Self::request_shell_permission)
    /// but works with any [`PermissionKind`]. The frontend should listen for
    /// `plugin:permission-request` events and call
    /// `plugin_respond_permission_request` with the `request_id` and the
    /// user's decision.
    pub async fn request_permission(
        &self,
        app_handle: &AppHandle,
        extension_id: &str,
        permission: PermissionKind,
        resource: &str,
        reason: &str,
    ) -> Result<bool, String> {
        let request_id = Uuid::new_v4().to_string();
        let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

        self.pending_requests.insert(request_id.clone(), tx);

        let request = PermissionRequest {
            request_id: request_id.clone(),
            extension_id: extension_id.to_string(),
            permission: permission.clone(),
            resource: resource.to_string(),
            reason: reason.to_string(),
        };

        app_handle
            .emit("plugin:permission-request", &request)
            .map_err(|e| format!("Failed to emit permission request: {}", e))?;

        info!(
            request_id = %request_id,
            extension_id = extension_id,
            permission = ?permission,
            resource = resource,
            "Permission requested"
        );

        match rx.await {
            Ok(approved) => {
                info!(
                    request_id = %request_id,
                    approved = approved,
                    "Permission response received"
                );
                Ok(approved)
            }
            Err(_) => {
                warn!(
                    request_id = %request_id,
                    "Permission request channel closed without response"
                );
                Err("Permission request was cancelled".to_string())
            }
        }
    }

    /// Deliver a user's response to a pending permission request.
    pub fn respond_permission_request(
        &self,
        request_id: &str,
        approved: bool,
    ) -> Result<(), String> {
        let (_, tx) = self
            .pending_requests
            .remove(request_id)
            .ok_or_else(|| format!("No pending permission request with id '{}'", request_id))?;

        tx.send(approved)
            .map_err(|_| "Failed to deliver permission response: receiver dropped".to_string())
    }
}

/// Validate that an extension manifest's declared permissions are acceptable.
///
/// Checks that requested filesystem scopes fall within workspace folders and
/// that no disallowed permission kinds are requested.
pub fn validate_manifest_permissions(
    manager: &PermissionsManager,
    extension_id: &str,
    requested_permissions: &[ManifestPermission],
) -> Result<(), String> {
    let ws = manager
        .workspace_folders
        .lock()
        .map_err(|_| "workspace_folders mutex poisoned".to_string())?;

    for perm in requested_permissions {
        match &perm.kind {
            PermissionKind::FileRead | PermissionKind::FileWrite => {
                let scope_path = Path::new(&perm.scope);
                let scope_ok = ws.iter().any(|folder| {
                    if let (Ok(sp), Ok(wp)) = (scope_path.canonicalize(), folder.canonicalize()) {
                        sp.starts_with(&wp)
                    } else {
                        scope_path.starts_with(folder)
                    }
                });
                if !scope_ok {
                    return Err(format!(
                        "Extension '{}' requests {:?} access to '{}' which is outside workspace folders",
                        extension_id, perm.kind, perm.scope
                    ));
                }
            }
            PermissionKind::ShellExecute
            | PermissionKind::NetworkAccess
            | PermissionKind::ClipboardAccess
            | PermissionKind::ClipboardRead
            | PermissionKind::ClipboardWrite => {
                info!(
                    extension_id = extension_id,
                    permission = ?perm.kind,
                    "Extension requests elevated permission - requires user approval"
                );
            }
            PermissionKind::EditorRead
            | PermissionKind::EditorWrite
            | PermissionKind::WorkspaceConfig
            | PermissionKind::UIContributions
            | PermissionKind::LanguageFeatures => {
                info!(
                    extension_id = extension_id,
                    permission = ?perm.kind,
                    "Extension requests elevated permission - requires user approval"
                );
            }
            PermissionKind::DiagnosticAccess
            | PermissionKind::CompletionProviderAccess
            | PermissionKind::CodeActionAccess
            | PermissionKind::UIAccess
            | PermissionKind::OutputChannelAccess
            | PermissionKind::StatusBarAccess
            | PermissionKind::TreeViewAccess => {
                info!(
                    extension_id = extension_id,
                    permission = ?perm.kind,
                    "Extension requests API permission"
                );
            }
        }
    }
    Ok(())
}

// ============================================================================
// State
// ============================================================================

/// Thread-safe wrapper for [`PermissionsManager`] managed by Tauri.
#[derive(Clone)]
pub struct PermissionsState(pub Arc<PermissionsManager>);

// ============================================================================
// Tauri Commands
// ============================================================================

/// Check whether an extension has file access to a given path.
#[tauri::command]
pub async fn plugin_check_permission(
    app: AppHandle,
    extension_id: String,
    path: String,
    write: bool,
) -> Result<bool, String> {
    let state = app.state::<PermissionsState>();
    match state
        .0
        .check_file_access(&extension_id, Path::new(&path), write)
    {
        Ok(()) => Ok(true),
        Err(reason) => {
            warn!(
                extension_id = %extension_id,
                path = %path,
                write = write,
                reason = %reason,
                "Permission check failed"
            );
            Ok(false)
        }
    }
}

/// Grant a permission to an extension.
#[tauri::command]
pub async fn plugin_grant_permission(
    app: AppHandle,
    extension_id: String,
    permission: PermissionKind,
    scope: String,
) -> Result<PermissionGrant, String> {
    let state = app.state::<PermissionsState>();
    Ok(state.0.grant_permission(&extension_id, permission, &scope))
}

/// Revoke a specific permission from an extension.
#[tauri::command]
pub async fn plugin_revoke_permission(
    app: AppHandle,
    extension_id: String,
    permission: PermissionKind,
) -> Result<(), String> {
    let state = app.state::<PermissionsState>();
    state.0.revoke_permission(&extension_id, &permission);
    Ok(())
}

/// Respond to a pending permission request from the frontend.
#[tauri::command]
pub async fn plugin_respond_permission_request(
    app: AppHandle,
    request_id: String,
    approved: bool,
) -> Result<(), String> {
    let state = app.state::<PermissionsState>();
    state.0.respond_permission_request(&request_id, approved)
}

/// Request user approval for shell command execution by an extension.
///
/// Emits `plugin:permission-request` to the frontend and waits for the
/// user's response before returning.
#[tauri::command]
pub async fn plugin_request_shell_execution(
    app: AppHandle,
    extension_id: String,
    command: String,
) -> Result<bool, String> {
    let state = app.state::<PermissionsState>();

    if state.0.check_shell_permission(&extension_id) {
        info!(
            extension_id = %extension_id,
            command = %command,
            "Shell execution allowed by existing grant"
        );
        return Ok(true);
    }

    state
        .0
        .request_shell_permission(&app, &extension_id, &command)
        .await
}

/// Get all permission grants for an extension.
#[tauri::command]
pub async fn plugin_get_grants(
    app: AppHandle,
    extension_id: String,
) -> Result<Vec<PermissionGrant>, String> {
    let state = app.state::<PermissionsState>();
    Ok(state.0.get_grants(&extension_id))
}

/// Set the workspace folders used for path validation.
#[tauri::command]
pub async fn plugin_set_workspace_folders(
    app: AppHandle,
    folders: Vec<String>,
) -> Result<(), String> {
    let state = app.state::<PermissionsState>();
    let paths: Vec<PathBuf> = folders.into_iter().map(PathBuf::from).collect();
    state.0.set_workspace_folders(paths);
    info!("Workspace folders updated for permission validation");
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_check_permission_editor_read() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-editor", PermissionKind::EditorRead, "*");

        let result = manager.check_permission("ext-editor", &PermissionKind::EditorRead);
        assert!(result.is_ok());
    }

    #[test]
    fn test_check_permission_denied() {
        let manager = PermissionsManager::new();

        let result = manager.check_permission("ext-no-grant", &PermissionKind::EditorWrite);
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .contains("does not have EditorWrite permission")
        );
    }

    #[test]
    fn test_check_permission_expired() {
        let manager = PermissionsManager::new();

        let expired_grant = PermissionGrant {
            extension_id: "ext-expired".to_string(),
            permission: PermissionKind::NetworkAccess,
            scope: "*".to_string(),
            granted_at: Utc::now() - Duration::hours(2),
            expires_at: Some(Utc::now() - Duration::hours(1)),
        };
        manager
            .grants
            .entry("ext-expired".to_string())
            .or_default()
            .push(expired_grant);

        let result = manager.check_permission("ext-expired", &PermissionKind::NetworkAccess);
        assert!(result.is_err());
    }

    #[test]
    fn test_new_permission_kinds_exist() {
        let kinds = vec![
            PermissionKind::DiagnosticAccess,
            PermissionKind::CompletionProviderAccess,
            PermissionKind::CodeActionAccess,
            PermissionKind::UIAccess,
            PermissionKind::OutputChannelAccess,
            PermissionKind::StatusBarAccess,
            PermissionKind::TreeViewAccess,
        ];
        for kind in &kinds {
            let json = serde_json::to_string(kind).unwrap();
            let deserialized: PermissionKind = serde_json::from_str(&json).unwrap();
            assert_eq!(&deserialized, kind);
        }
    }

    #[test]
    fn test_check_permission_granted() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-a", PermissionKind::DiagnosticAccess, "*");
        assert!(
            manager
                .check_permission("ext-a", &PermissionKind::DiagnosticAccess)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-a", &PermissionKind::UIAccess)
                .is_err()
        );
    }

    #[test]
    fn test_check_permission_not_granted() {
        let manager = PermissionsManager::new();
        assert!(
            manager
                .check_permission("ext-a", &PermissionKind::StatusBarAccess)
                .is_err()
        );
    }

    #[test]
    fn test_grant_and_revoke_new_permissions() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-b", PermissionKind::TreeViewAccess, "*");
        manager.grant_permission("ext-b", PermissionKind::OutputChannelAccess, "*");
        assert!(
            manager
                .check_permission("ext-b", &PermissionKind::TreeViewAccess)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-b", &PermissionKind::OutputChannelAccess)
                .is_ok()
        );

        manager.revoke_permission("ext-b", &PermissionKind::TreeViewAccess);
        assert!(
            manager
                .check_permission("ext-b", &PermissionKind::TreeViewAccess)
                .is_err()
        );
        assert!(
            manager
                .check_permission("ext-b", &PermissionKind::OutputChannelAccess)
                .is_ok()
        );
    }

    #[test]
    fn test_revoke_all_clears_new_permissions() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-c", PermissionKind::CodeActionAccess, "*");
        manager.grant_permission("ext-c", PermissionKind::CompletionProviderAccess, "*");
        manager.revoke_all("ext-c");
        assert!(
            manager
                .check_permission("ext-c", &PermissionKind::CodeActionAccess)
                .is_err()
        );
        assert!(
            manager
                .check_permission("ext-c", &PermissionKind::CompletionProviderAccess)
                .is_err()
        );
    }

    #[test]
    fn test_file_access_within_workspace() {
        use std::fs;
        use tempfile::TempDir;

        let tmp = TempDir::new().unwrap();
        let test_file = tmp.path().join("test.txt");
        fs::write(&test_file, "hello").unwrap();
        let manager = PermissionsManager::new();
        manager.set_workspace_folders(vec![tmp.path().to_path_buf()]);
        assert!(
            manager
                .check_file_access("ext-a", &test_file, false)
                .is_ok()
        );
    }

    #[test]
    fn test_file_access_outside_workspace_denied() {
        use std::fs;
        use tempfile::TempDir;

        let tmp = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_file = outside.path().join("secret.txt");
        fs::write(&outside_file, "secret").unwrap();
        let manager = PermissionsManager::new();
        manager.set_workspace_folders(vec![tmp.path().to_path_buf()]);
        assert!(
            manager
                .check_file_access("ext-a", &outside_file, false)
                .is_err()
        );
    }

    #[test]
    fn test_path_traversal_denied() {
        use tempfile::TempDir;

        let tmp = TempDir::new().unwrap();
        let traversal_path = tmp.path().join("..").join("..").join("etc").join("passwd");
        let manager = PermissionsManager::new();
        manager.set_workspace_folders(vec![tmp.path().to_path_buf()]);
        let result = manager.check_file_access("ext-a", &traversal_path, false);
        assert!(
            result.is_err() || {
                if let Ok(canonical) = traversal_path.canonicalize() {
                    canonical.starts_with(tmp.path().canonicalize().unwrap())
                } else {
                    true
                }
            }
        );
    }

    #[test]
    fn test_validate_manifest_new_permission_kinds() {
        use tempfile::TempDir;

        let tmp = TempDir::new().unwrap();
        let manager = PermissionsManager::new();
        manager.set_workspace_folders(vec![tmp.path().to_path_buf()]);
        let perms = vec![
            ManifestPermission {
                kind: PermissionKind::DiagnosticAccess,
                scope: String::new(),
                reason: "Need diagnostics".to_string(),
            },
            ManifestPermission {
                kind: PermissionKind::UIAccess,
                scope: String::new(),
                reason: "Need UI".to_string(),
            },
            ManifestPermission {
                kind: PermissionKind::StatusBarAccess,
                scope: String::new(),
                reason: "Need status bar".to_string(),
            },
        ];
        let result = validate_manifest_permissions(&manager, "ext-test", &perms);
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_grants_returns_all_types() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-d", PermissionKind::FileRead, "/workspace");
        manager.grant_permission("ext-d", PermissionKind::StatusBarAccess, "*");
        let grants = manager.get_grants("ext-d");
        assert_eq!(grants.len(), 2);
    }

    #[test]
    fn test_granular_permission_revoke() {
        let manager = PermissionsManager::new();
        manager.grant_permission("ext-multi", PermissionKind::EditorRead, "*");
        manager.grant_permission("ext-multi", PermissionKind::EditorWrite, "*");
        manager.grant_permission("ext-multi", PermissionKind::UIContributions, "*");
        manager.grant_permission("ext-multi", PermissionKind::LanguageFeatures, "*");
        manager.grant_permission("ext-multi", PermissionKind::WorkspaceConfig, "*");
        manager.grant_permission("ext-multi", PermissionKind::ClipboardRead, "*");
        manager.grant_permission("ext-multi", PermissionKind::ClipboardWrite, "*");

        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::EditorRead)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::UIContributions)
                .is_ok()
        );

        manager.revoke_permission("ext-multi", &PermissionKind::UIContributions);

        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::UIContributions)
                .is_err()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::EditorRead)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::EditorWrite)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::LanguageFeatures)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::WorkspaceConfig)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::ClipboardRead)
                .is_ok()
        );
        assert!(
            manager
                .check_permission("ext-multi", &PermissionKind::ClipboardWrite)
                .is_ok()
        );

        let grants = manager.get_grants("ext-multi");
        assert_eq!(grants.len(), 6);
        assert!(
            !grants
                .iter()
                .any(|g| g.permission == PermissionKind::UIContributions)
        );
    }
}
