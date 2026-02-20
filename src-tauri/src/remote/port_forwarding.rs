//! Port forwarding (SSH tunnel) management.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TunnelStatus {
    Active,
    Connecting,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelInfo {
    pub id: String,
    pub connection_id: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub status: TunnelStatus,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Clone)]
pub struct PortForwardingState {
    tunnels: Arc<Mutex<HashMap<String, TunnelInfo>>>,
}

impl PortForwardingState {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn add_tunnel(&self, tunnel: TunnelInfo) -> Result<(), String> {
        let mut tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        tunnels.insert(tunnel.id.clone(), tunnel);
        Ok(())
    }

    pub fn remove_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        let mut tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        tunnels
            .remove(tunnel_id)
            .ok_or_else(|| format!("Tunnel not found: {tunnel_id}"))?;
        Ok(())
    }

    pub fn get_tunnel(&self, tunnel_id: &str) -> Result<Option<TunnelInfo>, String> {
        let tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        Ok(tunnels.get(tunnel_id).cloned())
    }

    pub fn list_tunnels(&self) -> Result<Vec<TunnelInfo>, String> {
        let tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        Ok(tunnels.values().cloned().collect())
    }

    pub fn update_status(
        &self,
        tunnel_id: &str,
        status: TunnelStatus,
        error: Option<String>,
    ) -> Result<(), String> {
        let mut tunnels = self
            .tunnels
            .lock()
            .map_err(|e| format!("Failed to acquire lock: {e}"))?;
        let tunnel = tunnels
            .get_mut(tunnel_id)
            .ok_or_else(|| format!("Tunnel not found: {tunnel_id}"))?;
        tunnel.status = status;
        tunnel.error = error;
        Ok(())
    }
}
