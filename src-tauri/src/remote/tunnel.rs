//! Reverse tunnel support using WebSocket relay connections.
//!
//! Provides tunnel management for exposing local ports through a remote
//! WebSocket relay. Auth tokens are stored securely in the OS keychain.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::{Arc, Mutex};

use chrono::Utc;
use futures::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info, warn};
use url::Url;
use uuid::Uuid;

const KEYRING_SERVICE: &str = "Cortex-desktop-tunnel";

const MAX_TUNNEL_NAME_LENGTH: usize = 100;

static TUNNEL_NAME_RE: Lazy<Regex> = Lazy::new(|| {
    // SAFETY: This regex pattern is a compile-time constant and is always valid.
    #[allow(clippy::expect_used)]
    Regex::new(r"^[a-zA-Z0-9._\- ]+$").expect("Invalid regex")
});

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RemoteTunnelStatus {
    Inactive,
    Connecting,
    Active,
    Error,
    Closing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelAuthProvider {
    GitHub,
    Microsoft,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTunnelInfo {
    pub id: String,
    pub name: String,
    pub url: String,
    pub status: RemoteTunnelStatus,
    pub auth_provider: TunnelAuthProvider,
    pub local_port: u16,
    pub relay_url: String,
    pub created_at: String,
    pub expires_at: Option<String>,
    pub error: Option<String>,
    pub connection_code: String,
}

// ============================================================================
// Input Validation
// ============================================================================

fn validate_tunnel_url(tunnel_url: &str) -> Result<Url, String> {
    let parsed = Url::parse(tunnel_url).map_err(|e| format!("Invalid tunnel URL: {}", e))?;

    if parsed.scheme() != "wss" {
        return Err("Tunnel URL must use wss:// scheme (secure WebSocket only)".to_string());
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| "Tunnel URL must have a host".to_string())?;

    if is_private_or_loopback_host(host) {
        return Err("Tunnel URL must not point to a private or loopback address".to_string());
    }

    Ok(parsed)
}

fn is_private_or_loopback_host(host: &str) -> bool {
    if host == "localhost" || host.ends_with(".local") || host.ends_with(".internal") {
        return true;
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ipv4) => {
                ipv4.is_loopback()
                    || ipv4.is_private()
                    || ipv4.is_link_local()
                    || is_ipv4_metadata(ipv4)
                    || ipv4.is_broadcast()
                    || ipv4.is_unspecified()
            }
            IpAddr::V6(ipv6) => {
                ipv6.is_loopback() || ipv6.is_unspecified() || is_ipv6_private(ipv6)
            }
        };
    }

    false
}

fn is_ipv4_metadata(ip: Ipv4Addr) -> bool {
    ip.octets()[0] == 169 && ip.octets()[1] == 254
}

fn is_ipv6_private(ip: Ipv6Addr) -> bool {
    let segments = ip.segments();
    (segments[0] & 0xfe00) == 0xfc00
}

fn validate_local_port(port: u16) -> Result<(), String> {
    if port == 0 {
        return Err("Local port must be between 1 and 65535".to_string());
    }
    Ok(())
}

fn validate_tunnel_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Tunnel name cannot be empty".to_string());
    }
    if name.len() > MAX_TUNNEL_NAME_LENGTH {
        return Err(format!(
            "Tunnel name exceeds maximum length of {} characters",
            MAX_TUNNEL_NAME_LENGTH
        ));
    }
    if !TUNNEL_NAME_RE.is_match(name) {
        return Err(
            "Tunnel name contains invalid characters (only alphanumeric, '.', '-', '_', space allowed)"
                .to_string(),
        );
    }
    Ok(())
}

// ============================================================================
// Tunnel Manager
// ============================================================================

pub struct TunnelManager {
    tunnels: Arc<Mutex<HashMap<String, RemoteTunnelInfo>>>,
    relay_tasks: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

#[derive(Clone)]
pub struct TunnelState(pub Arc<TunnelManager>);

impl TunnelState {
    pub fn new() -> Self {
        Self(Arc::new(TunnelManager::new()))
    }
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
            relay_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn store_auth_token(tunnel_id: &str, provider: &TunnelAuthProvider) -> Result<(), String> {
        let account = format!("{}:{}", tunnel_id, "auth_token");
        let entry = keyring::Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| format!("Failed to access keyring: {e}"))?;
        let provider_tag = match provider {
            TunnelAuthProvider::GitHub => "github",
            TunnelAuthProvider::Microsoft => "microsoft",
        };
        entry
            .set_password(provider_tag)
            .map_err(|e| format!("Failed to store auth token: {e}"))?;
        Ok(())
    }

    fn delete_auth_token(tunnel_id: &str) {
        let account = format!("{}:{}", tunnel_id, "auth_token");
        if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, &account) {
            let _ = entry.delete_credential();
        }
    }

    fn generate_connection_code() -> String {
        let bytes = Uuid::new_v4();
        let hex = format!("{:x}", bytes.as_u128());
        hex[..8].to_string()
    }

    fn build_relay_url(connection_code: &str) -> String {
        format!("wss://relay.cortex.dev/tunnel/{connection_code}")
    }

    fn update_tunnel_status(
        tunnels: &Arc<Mutex<HashMap<String, RemoteTunnelInfo>>>,
        tunnel_id: &str,
        status: RemoteTunnelStatus,
        error_msg: Option<String>,
    ) {
        if let Ok(mut map) = tunnels.lock() {
            if let Some(tunnel) = map.get_mut(tunnel_id) {
                tunnel.status = status;
                tunnel.error = error_msg;
            }
        }
    }

    fn spawn_relay_task(
        tunnels: Arc<Mutex<HashMap<String, RemoteTunnelInfo>>>,
        tunnel_id: String,
        relay_url: String,
        local_port: u16,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            Self::update_tunnel_status(&tunnels, &tunnel_id, RemoteTunnelStatus::Connecting, None);

            let ws_result = tokio_tungstenite::connect_async(&relay_url).await;
            let ws_stream = match ws_result {
                Ok((stream, _)) => {
                    info!(tunnel_id = %tunnel_id, "Connected to relay");
                    Self::update_tunnel_status(
                        &tunnels,
                        &tunnel_id,
                        RemoteTunnelStatus::Active,
                        None,
                    );
                    stream
                }
                Err(e) => {
                    let msg = format!("Failed to connect to relay: {e}");
                    error!(tunnel_id = %tunnel_id, "{}", msg);
                    Self::update_tunnel_status(
                        &tunnels,
                        &tunnel_id,
                        RemoteTunnelStatus::Error,
                        Some(msg),
                    );
                    return;
                }
            };

            let (mut ws_sink, mut ws_source) = ws_stream.split();

            let local_addr = format!("127.0.0.1:{local_port}");
            let tcp_result = TcpStream::connect(&local_addr).await;
            let tcp_stream = match tcp_result {
                Ok(stream) => stream,
                Err(e) => {
                    let msg = format!("Failed to connect to local port {local_port}: {e}");
                    error!(tunnel_id = %tunnel_id, "{}", msg);
                    Self::update_tunnel_status(
                        &tunnels,
                        &tunnel_id,
                        RemoteTunnelStatus::Error,
                        Some(msg),
                    );
                    return;
                }
            };

            let (tcp_read, tcp_write) = tcp_stream.into_split();
            let mut tcp_read = tokio::io::BufReader::new(tcp_read);
            let mut tcp_write = tokio::io::BufWriter::new(tcp_write);

            let tid_ws = tunnel_id.clone();
            let ws_to_tcp = async {
                use tokio::io::AsyncWriteExt;
                while let Some(msg) = ws_source.next().await {
                    match msg {
                        Ok(Message::Binary(data)) => {
                            if let Err(e) = tcp_write.write_all(&data).await {
                                warn!(tunnel_id = %tid_ws, "TCP write error: {e}");
                                break;
                            }
                            if let Err(e) = tcp_write.flush().await {
                                warn!(tunnel_id = %tid_ws, "TCP flush error: {e}");
                                break;
                            }
                        }
                        Ok(Message::Close(_)) => {
                            info!(tunnel_id = %tid_ws, "Relay closed connection");
                            break;
                        }
                        Ok(_) => {}
                        Err(e) => {
                            warn!(tunnel_id = %tid_ws, "WebSocket receive error: {e}");
                            break;
                        }
                    }
                }
            };

            let tid_tcp = tunnel_id.clone();
            let tcp_to_ws = async {
                use tokio::io::AsyncReadExt;
                let mut buf = vec![0u8; 8192];
                loop {
                    match tcp_read.read(&mut buf).await {
                        Ok(0) => {
                            info!(tunnel_id = %tid_tcp, "Local TCP connection closed");
                            break;
                        }
                        Ok(n) => {
                            if let Err(e) = ws_sink.send(Message::Binary(buf[..n].into())).await {
                                warn!(tunnel_id = %tid_tcp, "WebSocket send error: {e}");
                                break;
                            }
                        }
                        Err(e) => {
                            warn!(tunnel_id = %tid_tcp, "TCP read error: {e}");
                            break;
                        }
                    }
                }
            };

            tokio::select! {
                _ = ws_to_tcp => {},
                _ = tcp_to_ws => {},
            }

            Self::update_tunnel_status(&tunnels, &tunnel_id, RemoteTunnelStatus::Inactive, None);
            info!(tunnel_id = %tunnel_id, "Relay task ended");
        })
    }

    pub async fn create(
        &self,
        local_port: u16,
        auth_provider: TunnelAuthProvider,
        name: Option<String>,
    ) -> Result<RemoteTunnelInfo, String> {
        validate_local_port(local_port)?;
        if let Some(ref n) = name {
            validate_tunnel_name(n)?;
        }

        let id = Uuid::new_v4().to_string();
        let connection_code = Self::generate_connection_code();
        let relay_url = Self::build_relay_url(&connection_code);
        let tunnel_name = name.unwrap_or_else(|| format!("tunnel-{}", &id[..8]));
        let now = Utc::now().to_rfc3339();

        Self::store_auth_token(&id, &auth_provider)?;

        let tunnel = RemoteTunnelInfo {
            id: id.clone(),
            name: tunnel_name,
            url: format!("https://relay.cortex.dev/t/{connection_code}"),
            status: RemoteTunnelStatus::Connecting,
            auth_provider,
            local_port,
            relay_url: relay_url.clone(),
            created_at: now,
            expires_at: None,
            error: None,
            connection_code,
        };

        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tunnels.insert(id.clone(), tunnel.clone());
        }

        let handle =
            Self::spawn_relay_task(self.tunnels.clone(), id.clone(), relay_url, local_port);

        {
            let mut tasks = self
                .relay_tasks
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tasks.insert(id.clone(), handle);
        }

        info!(tunnel_id = %id, local_port = local_port, "Created remote tunnel");
        Ok(tunnel)
    }

    pub async fn connect(&self, tunnel_url: String) -> Result<RemoteTunnelInfo, String> {
        let validated_url = validate_tunnel_url(&tunnel_url)?;
        let safe_url = validated_url.to_string();

        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let tunnel = RemoteTunnelInfo {
            id: id.clone(),
            name: format!("remote-{}", &id[..8]),
            url: safe_url.clone(),
            status: RemoteTunnelStatus::Connecting,
            auth_provider: TunnelAuthProvider::GitHub,
            local_port: 0,
            relay_url: safe_url.clone(),
            created_at: now,
            expires_at: None,
            error: None,
            connection_code: String::new(),
        };

        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tunnels.insert(id.clone(), tunnel.clone());
        }

        let tunnels = self.tunnels.clone();
        let tid = id.clone();
        let url = safe_url;

        let handle = tokio::spawn(async move {
            Self::update_tunnel_status(&tunnels, &tid, RemoteTunnelStatus::Connecting, None);

            let ws_result = tokio_tungstenite::connect_async(&url).await;
            match ws_result {
                Ok((stream, _)) => {
                    info!(tunnel_id = %tid, "Connected to tunnel");
                    Self::update_tunnel_status(&tunnels, &tid, RemoteTunnelStatus::Active, None);

                    let (_ws_sink, mut ws_source) = stream.split();
                    while let Some(msg) = ws_source.next().await {
                        match msg {
                            Ok(Message::Close(_)) => {
                                info!(tunnel_id = %tid, "Tunnel connection closed");
                                break;
                            }
                            Err(e) => {
                                let msg = format!("Tunnel connection error: {e}");
                                warn!(tunnel_id = %tid, "{}", msg);
                                Self::update_tunnel_status(
                                    &tunnels,
                                    &tid,
                                    RemoteTunnelStatus::Error,
                                    Some(msg),
                                );
                                return;
                            }
                            _ => {}
                        }
                    }

                    Self::update_tunnel_status(&tunnels, &tid, RemoteTunnelStatus::Inactive, None);
                }
                Err(e) => {
                    let msg = format!("Failed to connect to tunnel: {e}");
                    error!(tunnel_id = %tid, "{}", msg);
                    Self::update_tunnel_status(
                        &tunnels,
                        &tid,
                        RemoteTunnelStatus::Error,
                        Some(msg),
                    );
                }
            }
        });

        {
            let mut tasks = self
                .relay_tasks
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tasks.insert(id.clone(), handle);
        }

        info!(tunnel_id = %id, "Connecting to remote tunnel");
        Ok(tunnel)
    }

    pub async fn disconnect(&self, tunnel_id: &str) -> Result<(), String> {
        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            let tunnel = tunnels
                .get_mut(tunnel_id)
                .ok_or_else(|| format!("Tunnel not found: {tunnel_id}"))?;
            tunnel.status = RemoteTunnelStatus::Closing;
        }

        {
            let mut tasks = self
                .relay_tasks
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            if let Some(handle) = tasks.remove(tunnel_id) {
                handle.abort();
            }
        }

        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tunnels.remove(tunnel_id);
        }

        Self::delete_auth_token(tunnel_id);
        info!(tunnel_id = %tunnel_id, "Disconnected remote tunnel");
        Ok(())
    }

    pub fn status(&self, tunnel_id: &str) -> Result<RemoteTunnelInfo, String> {
        let tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        tunnels
            .get(tunnel_id)
            .cloned()
            .ok_or_else(|| format!("Tunnel not found: {tunnel_id}"))
    }

    pub fn list(&self) -> Result<Vec<RemoteTunnelInfo>, String> {
        let tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        Ok(tunnels.values().cloned().collect())
    }

    pub fn disconnect_all(&self) -> Result<(), String> {
        let tunnel_ids: Vec<String> = {
            let tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tunnels.keys().cloned().collect()
        };

        {
            let mut tasks = self
                .relay_tasks
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            for handle in tasks.values() {
                handle.abort();
            }
            tasks.clear();
        }

        for id in &tunnel_ids {
            Self::delete_auth_token(id);
        }

        {
            let mut tunnels = self
                .tunnels
                .lock()
                .map_err(|e| format!("Failed to acquire lock: {e}"))?;
            tunnels.clear();
        }

        info!("Disconnected all remote tunnels ({})", tunnel_ids.len());
        Ok(())
    }
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn remote_tunnel_create(
    local_port: u16,
    auth_provider: TunnelAuthProvider,
    name: Option<String>,
    state: tauri::State<'_, TunnelState>,
) -> Result<RemoteTunnelInfo, String> {
    state.0.create(local_port, auth_provider, name).await
}

#[tauri::command]
pub async fn remote_tunnel_connect(
    tunnel_url: String,
    state: tauri::State<'_, TunnelState>,
) -> Result<RemoteTunnelInfo, String> {
    state.0.connect(tunnel_url).await
}

#[tauri::command]
pub async fn remote_tunnel_disconnect(
    tunnel_id: String,
    state: tauri::State<'_, TunnelState>,
) -> Result<(), String> {
    state.0.disconnect(&tunnel_id).await
}

#[tauri::command]
pub async fn remote_tunnel_status(
    tunnel_id: String,
    state: tauri::State<'_, TunnelState>,
) -> Result<RemoteTunnelInfo, String> {
    state.0.status(&tunnel_id)
}

#[tauri::command]
pub async fn remote_tunnel_list(
    state: tauri::State<'_, TunnelState>,
) -> Result<Vec<RemoteTunnelInfo>, String> {
    state.0.list()
}
