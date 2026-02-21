//! Remote connection manager - thread-safe connection pool.

#[cfg(feature = "remote-ssh")]
use ssh2::{Session, Sftp};
use std::collections::HashMap;
#[cfg(feature = "remote-ssh")]
use std::io::{Read, Write};
#[cfg(feature = "remote-ssh")]
use std::net::TcpStream;
use std::path::PathBuf;
#[cfg(feature = "remote-ssh")]
use std::sync::{Arc, Mutex};
use tokio::sync::RwLock;
use tracing::info;

#[cfg(feature = "remote-ssh")]
use super::connection::SshConnection;
use super::connection::set_file_permissions;
#[cfg(feature = "remote-ssh")]
use super::credentials::SecureAuthCredentials;
use super::credentials::SecureSshCredentials;
use super::error::RemoteError;
#[cfg(feature = "remote-ssh")]
use super::types::ConnectionStatus;
use super::types::{
    AuthMethod, CommandResult, ConnectionInfo, ConnectionProfile, RemoteFileEntry, RemoteFileNode,
};

/// Remote connection manager - thread-safe connection pool
///
/// Note: SshConnection uses std::sync::Mutex (not tokio::sync::RwLock) because
/// ssh2::Session is not Send. All SSH operations must be wrapped in spawn_blocking
/// and the mutex is locked inside the blocking task to keep Session on a single thread.
pub struct RemoteManager {
    #[cfg(feature = "remote-ssh")]
    pub(crate) connections: RwLock<HashMap<String, Arc<Mutex<SshConnection>>>>,
    #[cfg(not(feature = "remote-ssh"))]
    pub(crate) connections: RwLock<HashMap<String, ()>>,
    profiles: RwLock<Vec<ConnectionProfile>>,
}

impl RemoteManager {
    pub fn new() -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
            profiles: RwLock::new(Vec::new()),
        }
    }

    /// Load saved profiles from disk (no secrets - those are in keyring)
    pub async fn load_profiles(&self) -> Result<(), RemoteError> {
        let config_path = Self::profiles_path();
        if config_path.exists() {
            let content = std::fs::read_to_string(&config_path)?;
            let loaded_profiles: Vec<ConnectionProfile> =
                serde_json::from_str(&content).map_err(|e| {
                    RemoteError::IoError(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
                })?;
            let mut profiles = self.profiles.write().await;
            *profiles = loaded_profiles;
            info!("Loaded {} SSH profiles", profiles.len());
        }
        Ok(())
    }

    /// Save profiles to disk (no secrets - those are in keyring)
    pub async fn save_profiles(&self) -> Result<(), RemoteError> {
        let config_path = Self::profiles_path();
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let profiles = self.profiles.read().await;
        let content = serde_json::to_string_pretty(&*profiles).map_err(|e| {
            RemoteError::IoError(std::io::Error::new(std::io::ErrorKind::InvalidData, e))
        })?;
        std::fs::write(&config_path, content)?;

        // Set restrictive permissions on the config file
        set_file_permissions(&config_path)?;

        info!("Saved {} SSH profiles", profiles.len());
        Ok(())
    }

    fn profiles_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Cortex-desktop")
            .join("ssh_profiles.json")
    }

    /// Get all saved profiles
    pub async fn get_profiles(&self) -> Vec<ConnectionProfile> {
        self.profiles.read().await.clone()
    }

    /// Add or update a profile (secrets stored separately in keyring)
    pub async fn save_profile(&self, profile: ConnectionProfile) -> Result<(), RemoteError> {
        let mut profiles = self.profiles.write().await;
        if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
            *existing = profile;
        } else {
            profiles.push(profile);
        }
        drop(profiles);
        self.save_profiles().await
    }

    /// Save a profile with credentials
    pub async fn save_profile_with_credentials(
        &self,
        mut profile: ConnectionProfile,
        password: Option<&str>,
        passphrase: Option<&str>,
    ) -> Result<(), RemoteError> {
        // Store credentials in keyring
        if let Some(pwd) = password {
            SecureSshCredentials::store_password(&profile.id, pwd)?;
            if let AuthMethod::Password {
                ref mut has_password,
            } = profile.auth_method
            {
                *has_password = true;
            }
        }

        if let Some(pp) = passphrase {
            SecureSshCredentials::store_passphrase(&profile.id, pp)?;
            if let AuthMethod::Key {
                ref mut has_passphrase,
                ..
            } = profile.auth_method
            {
                *has_passphrase = true;
            }
        }

        // Save profile (without secrets)
        self.save_profile(profile).await
    }

    /// Delete a profile and its credentials
    pub async fn delete_profile(&self, profile_id: &str) -> Result<(), RemoteError> {
        // Delete credentials from keyring
        SecureSshCredentials::delete_credentials(profile_id)?;

        // Delete profile
        let mut profiles = self.profiles.write().await;
        profiles.retain(|p| p.id != profile_id);
        drop(profiles);
        self.save_profiles().await
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn connect(&self, profile: ConnectionProfile) -> Result<ConnectionInfo, RemoteError> {
        let connection_id = profile.id.clone();

        info!(
            "Connecting to {}@{}:{}",
            profile.username, profile.host, profile.port
        );

        // Load credentials from keyring (this is fast, no need to spawn_blocking)
        let credentials =
            SecureAuthCredentials::load_from_keyring(&profile.id, &profile.auth_method)?;

        // Extract credential values to move into spawn_blocking
        let password = credentials.password().map(|s| s.to_string());
        let passphrase = credentials.passphrase().map(|s| s.to_string());

        // Clone profile for use in blocking task
        let profile_clone = profile.clone();

        // Perform all blocking SSH operations in spawn_blocking
        let (session, home_directory, platform) = tokio::task::spawn_blocking(move || {
            // Create TCP connection (blocking)
            let addr = format!("{}:{}", profile_clone.host, profile_clone.port);
            let tcp = TcpStream::connect(&addr).map_err(|e| {
                RemoteError::ConnectionFailed(format!("TCP connection failed: {}", e))
            })?;

            tcp.set_read_timeout(Some(std::time::Duration::from_secs(30)))
                .map_err(RemoteError::IoError)?;
            tcp.set_write_timeout(Some(std::time::Duration::from_secs(30)))
                .map_err(RemoteError::IoError)?;

            // Create SSH session
            let mut session = Session::new().map_err(|e| {
                RemoteError::ConnectionFailed(format!("Failed to create SSH session: {}", e))
            })?;

            session.set_tcp_stream(tcp);
            session.handshake().map_err(|e| {
                RemoteError::ConnectionFailed(format!("SSH handshake failed: {}", e))
            })?;

            // Authenticate using secure credentials
            match &profile_clone.auth_method {
                AuthMethod::Password { .. } => {
                    let pwd = password.as_ref().ok_or_else(|| {
                        RemoteError::AuthenticationFailed(
                            "Password not found in keyring".to_string(),
                        )
                    })?;
                    session
                        .userauth_password(&profile_clone.username, pwd)
                        .map_err(|e| {
                            RemoteError::AuthenticationFailed(format!(
                                "Password auth failed: {}",
                                e
                            ))
                        })?;
                }
                AuthMethod::Key {
                    private_key_path, ..
                } => {
                    let key_path = PathBuf::from(private_key_path);
                    if !key_path.exists() {
                        return Err(RemoteError::AuthenticationFailed(format!(
                            "Private key not found: {}",
                            private_key_path
                        )));
                    }
                    session
                        .userauth_pubkey_file(
                            &profile_clone.username,
                            None,
                            &key_path,
                            passphrase.as_deref(),
                        )
                        .map_err(|e| {
                            RemoteError::AuthenticationFailed(format!("Key auth failed: {}", e))
                        })?;
                }
                AuthMethod::Agent => {
                    let mut agent = session.agent().map_err(|e| {
                        RemoteError::AuthenticationFailed(format!("Agent connection failed: {}", e))
                    })?;
                    agent.connect().map_err(|e| {
                        RemoteError::AuthenticationFailed(format!("Agent connect failed: {}", e))
                    })?;
                    agent.list_identities().map_err(|e| {
                        RemoteError::AuthenticationFailed(format!(
                            "Agent list identities failed: {}",
                            e
                        ))
                    })?;

                    let identities = agent.identities().map_err(|e| {
                        RemoteError::AuthenticationFailed(format!(
                            "Failed to get identities: {}",
                            e
                        ))
                    })?;

                    let mut authenticated = false;
                    for identity in identities.iter() {
                        if agent.userauth(&profile_clone.username, identity).is_ok() {
                            authenticated = true;
                            break;
                        }
                    }

                    if !authenticated {
                        return Err(RemoteError::AuthenticationFailed(
                            "No valid SSH key found in agent".to_string(),
                        ));
                    }
                }
            }

            if !session.authenticated() {
                return Err(RemoteError::AuthenticationFailed(
                    "Authentication failed".to_string(),
                ));
            }

            // Get home directory and platform info
            let temp_conn = SshConnection::new(
                session.clone(),
                profile_clone.clone(),
                String::new(),
                String::new(),
            );

            let home_result = temp_conn.exec_command("echo $HOME")?;
            let home_directory = home_result.stdout.trim().to_string();

            let platform_result = temp_conn.exec_command("uname -s 2>/dev/null || echo Windows")?;
            let platform = platform_result.stdout.trim().to_string();

            Ok((session, home_directory, platform))
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))??;

        info!(
            "Successfully authenticated to {}@{}",
            profile.username, profile.host
        );

        let connection = SshConnection::new(
            session,
            profile.clone(),
            home_directory.clone(),
            platform.clone(),
        );

        // Store connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id.clone(), Arc::new(Mutex::new(connection)));
        }

        // Save profile if not exists
        {
            let profiles = self.profiles.read().await;
            if !profiles.iter().any(|p| p.id == profile.id) {
                drop(profiles);
                self.save_profile(profile.clone()).await?;
            }
        }

        Ok(ConnectionInfo {
            id: connection_id,
            profile,
            status: ConnectionStatus::Connected,
            home_directory: Some(home_directory),
            platform: Some(platform),
        })
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn connect_with_credentials(
        &self,
        mut profile: ConnectionProfile,
        password: Option<&str>,
        passphrase: Option<&str>,
    ) -> Result<ConnectionInfo, RemoteError> {
        // Store credentials first
        if let Some(pwd) = password {
            SecureSshCredentials::store_password(&profile.id, pwd)?;
            if let AuthMethod::Password {
                ref mut has_password,
            } = profile.auth_method
            {
                *has_password = true;
            }
        }

        if let Some(pp) = passphrase {
            SecureSshCredentials::store_passphrase(&profile.id, pp)?;
            if let AuthMethod::Key {
                ref mut has_passphrase,
                ..
            } = profile.auth_method
            {
                *has_passphrase = true;
            }
        }

        // Now connect
        self.connect(profile).await
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn disconnect(&self, connection_id: &str) -> Result<(), RemoteError> {
        let mut connections = self.connections.write().await;
        if connections.remove(connection_id).is_some() {
            info!("Disconnected from {}", connection_id);
            Ok(())
        } else {
            Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
        }
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn get_connection_status(
        &self,
        connection_id: &str,
    ) -> Result<ConnectionInfo, RemoteError> {
        let connections = self.connections.read().await;
        if let Some(conn) = connections.get(connection_id) {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            Ok(ConnectionInfo {
                id: connection_id.to_string(),
                profile: conn.profile.clone(),
                status: ConnectionStatus::Connected,
                home_directory: Some(conn.home_directory.clone()),
                platform: Some(conn.platform.clone()),
            })
        } else {
            Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
        }
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn get_active_connections(&self) -> Vec<ConnectionInfo> {
        let connections = self.connections.read().await;
        let mut result = Vec::new();
        for (id, conn) in connections.iter() {
            if let Ok(conn) = conn.lock() {
                result.push(ConnectionInfo {
                    id: id.clone(),
                    profile: conn.profile.clone(),
                    status: ConnectionStatus::Connected,
                    home_directory: Some(conn.home_directory.clone()),
                    platform: Some(conn.platform.clone()),
                });
            }
        }
        result
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn list_directory(
        &self,
        connection_id: &str,
        path: &str,
    ) -> Result<Vec<RemoteFileEntry>, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if path.is_empty() || path == "~" {
                conn.home_directory.clone()
            } else if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            // Verify directory exists (opendir returns error if not)
            let _dir = sftp
                .opendir(std::path::Path::new(&resolved_path))
                .map_err(|e| {
                    if e.code() == ssh2::ErrorCode::Session(-2) {
                        RemoteError::FileNotFound(resolved_path.clone())
                    } else {
                        RemoteError::SshError(e)
                    }
                })?;

            let mut entries = Vec::new();
            for entry in sftp.readdir(std::path::Path::new(&resolved_path))? {
                let (path_buf, stat) = entry;
                let name = path_buf
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                if name == "." || name == ".." {
                    continue;
                }

                let full_path = if resolved_path.ends_with('/') {
                    format!("{}{}", resolved_path, name)
                } else {
                    format!("{}/{}", resolved_path, name)
                };

                entries.push(RemoteFileEntry {
                    name,
                    path: full_path,
                    is_dir: stat.is_dir(),
                    size: stat.size.unwrap_or(0),
                    modified: stat.mtime,
                    permissions: stat.perm,
                });
            }

            // Sort: directories first, then alphabetically
            entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });

            Ok(entries)
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn get_file_tree(
        &self,
        connection_id: &str,
        path: &str,
        depth: u32,
    ) -> Result<RemoteFileNode, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if path.is_empty() || path == "~" {
                conn.home_directory.clone()
            } else if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            build_file_tree_recursive_sync(&sftp, &resolved_path, depth)
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn read_file(&self, connection_id: &str, path: &str) -> Result<String, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            let mut file = sftp
                .open(std::path::Path::new(&resolved_path))
                .map_err(|e| {
                    if e.code() == ssh2::ErrorCode::Session(-2) {
                        RemoteError::FileNotFound(resolved_path.clone())
                    } else {
                        RemoteError::SshError(e)
                    }
                })?;

            let mut content = String::new();
            file.read_to_string(&mut content)?;
            Ok(content)
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn read_file_bytes(
        &self,
        connection_id: &str,
        path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            let mut file = sftp
                .open(std::path::Path::new(&resolved_path))
                .map_err(|e| {
                    if e.code() == ssh2::ErrorCode::Session(-2) {
                        RemoteError::FileNotFound(resolved_path.clone())
                    } else {
                        RemoteError::SshError(e)
                    }
                })?;

            let mut content = Vec::new();
            file.read_to_end(&mut content)?;
            Ok(content)
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn write_file(
        &self,
        connection_id: &str,
        path: &str,
        content: &str,
    ) -> Result<(), RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();
        let content = content.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            let mut file = sftp
                .create(std::path::Path::new(&resolved_path))
                .map_err(RemoteError::SshError)?;

            file.write_all(content.as_bytes())?;
            Ok(())
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn write_file_bytes(
        &self,
        connection_id: &str,
        path: &str,
        content: &[u8],
    ) -> Result<(), RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();
        let content = content.to_vec();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            let mut file = sftp
                .create(std::path::Path::new(&resolved_path))
                .map_err(RemoteError::SshError)?;

            file.write_all(&content)?;
            Ok(())
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn delete(
        &self,
        connection_id: &str,
        path: &str,
        recursive: bool,
    ) -> Result<(), RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            let stat = sftp
                .stat(std::path::Path::new(&resolved_path))
                .map_err(|_| RemoteError::FileNotFound(resolved_path.clone()))?;

            if stat.is_dir() {
                if recursive {
                    // Use rm -rf for recursive deletion
                    conn.exec_command(&format!("rm -rf '{}'", resolved_path))?;
                } else {
                    sftp.rmdir(std::path::Path::new(&resolved_path))?;
                }
            } else {
                sftp.unlink(std::path::Path::new(&resolved_path))?;
            }

            Ok(())
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn create_directory(
        &self,
        connection_id: &str,
        path: &str,
        recursive: bool,
    ) -> Result<(), RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP/SSH operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                path
            };

            if recursive {
                conn.exec_command(&format!("mkdir -p '{}'", resolved_path))?;
            } else {
                let sftp = conn.sftp()?;
                sftp.mkdir(std::path::Path::new(&resolved_path), 0o755)?;
            }

            Ok(())
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn rename(
        &self,
        connection_id: &str,
        old_path: &str,
        new_path: &str,
    ) -> Result<(), RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let old_path = old_path.to_string();
        let new_path = new_path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_old = if let Some(stripped) = old_path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                old_path
            };

            let resolved_new = if let Some(stripped) = new_path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else {
                new_path
            };

            sftp.rename(
                std::path::Path::new(&resolved_old),
                std::path::Path::new(&resolved_new),
                None,
            )?;

            Ok(())
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn execute_command(
        &self,
        connection_id: &str,
        command: &str,
        working_dir: Option<&str>,
    ) -> Result<CommandResult, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let command = command.to_string();
        let working_dir = working_dir.map(|s| s.to_string());

        // Perform blocking SSH operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;

            let full_command = if let Some(dir) = working_dir {
                let resolved_dir = if let Some(stripped) = dir.strip_prefix("~/") {
                    format!("{}/{}", conn.home_directory, stripped)
                } else if dir == "~" {
                    conn.home_directory.clone()
                } else {
                    dir
                };
                format!("cd '{}' && {}", resolved_dir, command)
            } else {
                command
            };

            conn.exec_command(&full_command)
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    #[cfg(feature = "remote-ssh")]
    pub async fn stat(
        &self,
        connection_id: &str,
        path: &str,
    ) -> Result<RemoteFileEntry, RemoteError> {
        let conn = {
            let connections = self.connections.read().await;
            connections
                .get(connection_id)
                .cloned()
                .ok_or_else(|| RemoteError::ConnectionNotFound(connection_id.to_string()))?
        };

        let path = path.to_string();

        // Perform blocking SFTP operations in spawn_blocking
        tokio::task::spawn_blocking(move || {
            let conn = conn
                .lock()
                .map_err(|e| RemoteError::ConnectionFailed(format!("Lock poisoned: {}", e)))?;
            let sftp = conn.sftp()?;

            let resolved_path = if let Some(stripped) = path.strip_prefix("~/") {
                format!("{}/{}", conn.home_directory, stripped)
            } else if path == "~" {
                conn.home_directory.clone()
            } else {
                path
            };

            let stat = sftp
                .stat(std::path::Path::new(&resolved_path))
                .map_err(|_| RemoteError::FileNotFound(resolved_path.clone()))?;

            let name = std::path::Path::new(&resolved_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&resolved_path)
                .to_string();

            Ok(RemoteFileEntry {
                name,
                path: resolved_path,
                is_dir: stat.is_dir(),
                size: stat.size.unwrap_or(0),
                modified: stat.mtime,
                permissions: stat.perm,
            })
        })
        .await
        .map_err(|e| RemoteError::ConnectionFailed(format!("Task join error: {}", e)))?
    }

    // --- Stub implementations when remote-ssh feature is disabled ---

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn connect(
        &self,
        _profile: ConnectionProfile,
    ) -> Result<ConnectionInfo, RemoteError> {
        Err(RemoteError::ConnectionFailed(
            "SSH support is not enabled. Rebuild with the 'remote-ssh' feature.".to_string(),
        ))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn connect_with_credentials(
        &self,
        _profile: ConnectionProfile,
        _password: Option<&str>,
        _passphrase: Option<&str>,
    ) -> Result<ConnectionInfo, RemoteError> {
        Err(RemoteError::ConnectionFailed(
            "SSH support is not enabled".to_string(),
        ))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn disconnect(&self, connection_id: &str) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn get_connection_status(
        &self,
        connection_id: &str,
    ) -> Result<ConnectionInfo, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn get_active_connections(&self) -> Vec<ConnectionInfo> {
        Vec::new()
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn list_directory(
        &self,
        connection_id: &str,
        _path: &str,
    ) -> Result<Vec<RemoteFileEntry>, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn get_file_tree(
        &self,
        connection_id: &str,
        _path: &str,
        _depth: u32,
    ) -> Result<RemoteFileNode, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn read_file(&self, connection_id: &str, _path: &str) -> Result<String, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn read_file_bytes(
        &self,
        connection_id: &str,
        _path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn write_file(
        &self,
        connection_id: &str,
        _path: &str,
        _content: &str,
    ) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn write_file_bytes(
        &self,
        connection_id: &str,
        _path: &str,
        _content: &[u8],
    ) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn delete(
        &self,
        connection_id: &str,
        _path: &str,
        _recursive: bool,
    ) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn create_directory(
        &self,
        connection_id: &str,
        _path: &str,
        _recursive: bool,
    ) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn rename(
        &self,
        connection_id: &str,
        _old_path: &str,
        _new_path: &str,
    ) -> Result<(), RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn execute_command(
        &self,
        connection_id: &str,
        _command: &str,
        _working_dir: Option<&str>,
    ) -> Result<CommandResult, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }

    #[cfg(not(feature = "remote-ssh"))]
    pub async fn stat(
        &self,
        connection_id: &str,
        _path: &str,
    ) -> Result<RemoteFileEntry, RemoteError> {
        Err(RemoteError::ConnectionNotFound(connection_id.to_string()))
    }
}

#[cfg(feature = "remote-ssh")]
fn build_file_tree_recursive_sync(
    sftp: &Sftp,
    path: &str,
    depth: u32,
) -> Result<RemoteFileNode, RemoteError> {
    let stat = sftp
        .stat(std::path::Path::new(path))
        .map_err(|_| RemoteError::FileNotFound(path.to_string()))?;

    let name = std::path::Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string();

    if !stat.is_dir() {
        return Ok(RemoteFileNode {
            name,
            path: path.to_string(),
            is_dir: false,
            children: None,
        });
    }

    let children = if depth > 0 {
        let mut entries = Vec::new();
        if let Ok(dir_entries) = sftp.readdir(std::path::Path::new(path)) {
            for (entry_path, entry_stat) in dir_entries {
                let entry_name = entry_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                if entry_name == "." || entry_name == ".." {
                    continue;
                }

                let full_path = if path.ends_with('/') {
                    format!("{}{}", path, entry_name)
                } else {
                    format!("{}/{}", path, entry_name)
                };

                if entry_stat.is_dir() {
                    if let Ok(child) = build_file_tree_recursive_sync(sftp, &full_path, depth - 1) {
                        entries.push(child);
                    }
                } else {
                    entries.push(RemoteFileNode {
                        name: entry_name,
                        path: full_path,
                        is_dir: false,
                        children: None,
                    });
                }
            }
        }

        // Sort entries
        entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        });

        Some(entries)
    } else {
        None
    };

    Ok(RemoteFileNode {
        name,
        path: path.to_string(),
        is_dir: true,
        children,
    })
}
