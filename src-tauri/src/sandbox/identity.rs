//! Sandbox identity management for Windows.
//!
//! This module manages sandbox user identities and their credentials.

use anyhow::Result;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

use super::dpapi::{DpapiScope, decrypt_password, encrypt_password};

/// A sandbox identity with encrypted credentials.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxIdentity {
    /// Username for the sandbox user
    pub username: String,
    /// Encrypted password (DPAPI)
    #[serde(with = "base64_serde")]
    pub password_encrypted: Vec<u8>,
    /// When this identity was created
    pub created_at: u64,
}

impl SandboxIdentity {
    /// Create a new sandbox identity with encrypted password.
    pub fn new(username: String, password: &str) -> Result<Self> {
        let password_encrypted = encrypt_password(password, DpapiScope::CurrentUser)?;

        Ok(Self {
            username,
            password_encrypted,
            created_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        })
    }

    /// Decrypt and return the password.
    pub fn get_password(&self) -> Result<String> {
        decrypt_password(&self.password_encrypted)
    }
}

/// Cache for sandbox identities.
pub struct IdentityCache {
    identities: Mutex<Vec<SandboxIdentity>>,
    storage_path: PathBuf,
}

impl IdentityCache {
    /// Create a new identity cache.
    pub fn new(storage_path: PathBuf) -> Self {
        Self {
            identities: Mutex::new(Vec::new()),
            storage_path,
        }
    }

    /// Load identities from disk.
    pub fn load(&self) -> Result<()> {
        if self.storage_path.exists() {
            let content = std::fs::read_to_string(&self.storage_path)?;
            let identities: Vec<SandboxIdentity> = serde_json::from_str(&content)?;
            *self
                .identities
                .lock()
                .map_err(|_| anyhow::anyhow!("Identity store mutex poisoned during load"))? =
                identities;
        }
        Ok(())
    }

    /// Save identities to disk.
    pub fn save(&self) -> Result<()> {
        let identities = self
            .identities
            .lock()
            .map_err(|_| anyhow::anyhow!("Identity store mutex poisoned during save"))?;
        let content = serde_json::to_string_pretty(&*identities)?;

        if let Some(parent) = self.storage_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&self.storage_path, content)?;
        Ok(())
    }

    /// Get or create an identity for a given purpose.
    pub fn get_or_create(&self, purpose: &str) -> Result<SandboxIdentity> {
        let mut identities = self
            .identities
            .lock()
            .map_err(|_| anyhow::anyhow!("Identity store mutex poisoned during get_or_create"))?;

        // Look for existing identity
        if let Some(identity) = identities.iter().find(|i| i.username.contains(purpose)) {
            return Ok(identity.clone());
        }

        // Create new identity
        let username = format!("cortex_sandbox_{}", purpose);
        let password = generate_secure_password();
        let identity = SandboxIdentity::new(username, &password)?;

        identities.push(identity.clone());
        drop(identities);

        self.save()?;
        Ok(identity)
    }

    /// Remove an identity.
    pub fn remove(&self, username: &str) -> Result<bool> {
        let mut identities = self
            .identities
            .lock()
            .map_err(|_| anyhow::anyhow!("Identity store mutex poisoned during remove"))?;
        let len_before = identities.len();
        identities.retain(|i| i.username != username);
        let removed = identities.len() < len_before;
        drop(identities);

        if removed {
            self.save()?;
        }
        Ok(removed)
    }
}

/// Global identity cache.
static IDENTITY_CACHE: Lazy<IdentityCache> = Lazy::new(|| {
    let path = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("cortex")
        .join("sandbox_identities.json");

    let cache = IdentityCache::new(path);
    let _ = cache.load();
    cache
});

/// Get the global identity cache.
pub fn get_identity_cache() -> &'static IdentityCache {
    &IDENTITY_CACHE
}

/// Generate a cryptographically secure random password.
fn generate_secure_password() -> String {
    use rand::Rng;
    const CHARSET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let mut rng = rand::thread_rng();

    (0..32)
        .map(|_| {
            let idx = rng.r#gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

// Helper module for base64 serialization
mod base64_serde {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S>(bytes: &Vec<u8>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        STANDARD.encode(bytes).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        STANDARD.decode(s).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_sandbox_identity_roundtrip() {
        let identity = SandboxIdentity::new("test_user".to_string(), "test_password").unwrap();
        assert_eq!(identity.username, "test_user");
        assert_eq!(identity.get_password().unwrap(), "test_password");
    }

    #[test]
    fn test_generate_secure_password() {
        let password = generate_secure_password();
        assert_eq!(password.len(), 32);
        // Should contain various character types
        assert!(password.chars().any(|c| c.is_ascii_uppercase()));
        assert!(password.chars().any(|c| c.is_ascii_lowercase()));
    }

    #[test]
    fn test_identity_cache() {
        let dir = tempdir().unwrap();
        let cache = IdentityCache::new(dir.path().join("identities.json"));

        let identity = cache.get_or_create("test").unwrap();
        assert!(identity.username.contains("test"));

        // Should return same identity on second call
        let identity2 = cache.get_or_create("test").unwrap();
        assert_eq!(identity.username, identity2.username);
    }
}
