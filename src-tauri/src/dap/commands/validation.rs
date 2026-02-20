//! Shared validation utilities for DAP commands
//!
//! Common validation functions used across multiple command modules
//! to avoid duplication.

pub(crate) const MAX_SESSION_ID_LEN: usize = 256;

pub(crate) fn validate_session_id(session_id: &str) -> Result<(), String> {
    if session_id.trim().is_empty() {
        return Err("Session ID cannot be empty".to_string());
    }
    if session_id.len() > MAX_SESSION_ID_LEN {
        return Err(format!(
            "Session ID exceeds maximum length of {} characters",
            MAX_SESSION_ID_LEN
        ));
    }
    Ok(())
}
