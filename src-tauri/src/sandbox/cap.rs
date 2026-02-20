//! Capability SID generation for Windows sandbox.
//!
//! This module generates custom Capability SIDs used to identify
//! sandbox instances and control access via ACLs.

use anyhow::{Result, anyhow};
use std::path::Path;

/// A pair of capability SIDs for workspace access control.
#[derive(Debug, Clone)]
pub struct CapabilitySids {
    /// SID for write access to workspace
    pub workspace_write: String,
    /// SID for read-only access
    pub readonly: String,
}

impl CapabilitySids {
    /// Generate a new random capability SID.
    ///
    /// Format: S-1-15-3-<random>-<random>-<random>-<random>
    /// This is the Windows Capability SID format.
    pub fn generate_sid() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        format!(
            "S-1-15-3-{}-{}-{}-{}",
            rng.r#gen::<u32>(),
            rng.r#gen::<u32>(),
            rng.r#gen::<u32>(),
            rng.r#gen::<u32>()
        )
    }

    /// Create new capability SIDs.
    pub fn new() -> Self {
        Self {
            workspace_write: Self::generate_sid(),
            readonly: Self::generate_sid(),
        }
    }

    /// Load capability SIDs from a file, or create new ones if not found.
    pub fn load_or_create(path: &Path) -> Result<Self> {
        if path.exists() {
            let content = std::fs::read_to_string(path)?;
            Self::parse(&content)
        } else {
            let sids = Self::new();
            sids.save(path)?;
            Ok(sids)
        }
    }

    /// Save capability SIDs to a file.
    pub fn save(&self, path: &Path) -> Result<()> {
        let content = format!(
            "workspace_write={}\nreadonly={}",
            self.workspace_write, self.readonly
        );
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content)?;
        Ok(())
    }

    /// Parse capability SIDs from file content.
    fn parse(content: &str) -> Result<Self> {
        let mut workspace_write = None;
        let mut readonly = None;

        for line in content.lines() {
            let line = line.trim();
            if let Some(value) = line.strip_prefix("workspace_write=") {
                workspace_write = Some(value.to_string());
            } else if let Some(value) = line.strip_prefix("readonly=") {
                readonly = Some(value.to_string());
            }
        }

        Ok(Self {
            workspace_write: workspace_write
                .ok_or_else(|| anyhow!("Missing workspace_write SID"))?,
            readonly: readonly.ok_or_else(|| anyhow!("Missing readonly SID"))?,
        })
    }
}

impl Default for CapabilitySids {
    fn default() -> Self {
        Self::new()
    }
}

/// Validate that a string is a valid SID format.
pub fn is_valid_sid_format(sid: &str) -> bool {
    // Basic validation: starts with S-1- and has numeric components
    if !sid.starts_with("S-1-") {
        return false;
    }

    let parts: Vec<&str> = sid.split('-').collect();
    if parts.len() < 3 {
        return false;
    }

    // All parts after S-1 should be numeric
    parts[2..].iter().all(|p| p.parse::<u64>().is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_sid() {
        let sid = CapabilitySids::generate_sid();
        assert!(sid.starts_with("S-1-15-3-"));
        assert!(is_valid_sid_format(&sid));
    }

    #[test]
    fn test_capability_sids_new() {
        let sids = CapabilitySids::new();
        assert!(is_valid_sid_format(&sids.workspace_write));
        assert!(is_valid_sid_format(&sids.readonly));
        assert_ne!(sids.workspace_write, sids.readonly);
    }

    #[test]
    fn test_is_valid_sid_format() {
        assert!(is_valid_sid_format("S-1-15-3-1234-5678-9012-3456"));
        assert!(is_valid_sid_format("S-1-5-21-1234567890"));
        assert!(!is_valid_sid_format("invalid"));
        assert!(!is_valid_sid_format("S-2-1-1"));
    }
}
