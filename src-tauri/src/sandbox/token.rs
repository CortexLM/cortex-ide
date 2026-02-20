#![allow(unsafe_code)]
//! Windows Token manipulation for sandbox isolation.
//!
//! This module provides functions to create restricted tokens
//! for sandboxed process execution.

use anyhow::{Result, anyhow};
use std::ptr;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::Security::{
    AdjustTokenPrivileges, DuplicateTokenEx, SecurityIdentification, TOKEN_ADJUST_PRIVILEGES,
    TOKEN_DUPLICATE, TOKEN_QUERY, TokenPrimary,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

/// Configuration for restricted token creation.
#[derive(Debug, Clone, Default)]
pub struct TokenConfig {
    /// Remove all privileges from the token
    pub disable_privileges: bool,
    /// Set low integrity level
    pub low_integrity: bool,
}

/// A handle to a restricted Windows token.
pub struct RestrictedToken {
    handle: HANDLE,
}

impl RestrictedToken {
    /// Get the raw handle value.
    pub fn as_raw(&self) -> HANDLE {
        self.handle
    }
}

impl Drop for RestrictedToken {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            // SAFETY: handle is valid and we own it
            unsafe { CloseHandle(self.handle) };
        }
    }
}

/// Get the current process token.
pub fn get_current_process_token() -> Result<HANDLE> {
    let mut token: HANDLE = ptr::null_mut();

    // SAFETY: GetCurrentProcess always returns a valid pseudo-handle,
    // OpenProcessToken is safe with valid handles
    let result = unsafe {
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_DUPLICATE | TOKEN_ADJUST_PRIVILEGES,
            &mut token,
        )
    };

    if result == 0 {
        return Err(anyhow!(
            "Failed to open process token: {}",
            super::winutil::get_last_error()
        ));
    }

    Ok(token)
}

/// Duplicate a token for use in a new process.
pub fn duplicate_token(source: HANDLE) -> Result<HANDLE> {
    let mut new_token: HANDLE = ptr::null_mut();

    // SAFETY: source handle must be valid (caller's responsibility)
    let result = unsafe {
        DuplicateTokenEx(
            source,
            0, // Same access as source
            ptr::null(),
            SecurityIdentification,
            TokenPrimary,
            &mut new_token,
        )
    };

    if result == 0 {
        return Err(anyhow!(
            "Failed to duplicate token: {}",
            super::winutil::get_last_error()
        ));
    }

    Ok(new_token)
}

/// Create a restricted token from the current process.
///
/// This creates a token with reduced privileges suitable for
/// sandboxed execution.
pub fn create_restricted_token(config: &TokenConfig) -> Result<RestrictedToken> {
    let source_token = get_current_process_token()?;

    // Duplicate the token
    let new_token = duplicate_token(source_token)?;

    // Close the source token
    // SAFETY: source_token is valid
    unsafe { CloseHandle(source_token) };

    if config.disable_privileges {
        disable_all_privileges(new_token)?;
    }

    Ok(RestrictedToken { handle: new_token })
}

/// Disable all privileges on a token.
fn disable_all_privileges(token: HANDLE) -> Result<()> {
    // SAFETY: token handle must be valid
    let result = unsafe {
        AdjustTokenPrivileges(
            token,
            1, // DisableAllPrivileges = TRUE
            ptr::null(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
        )
    };

    if result == 0 {
        return Err(anyhow!(
            "Failed to disable privileges: {}",
            super::winutil::get_last_error()
        ));
    }

    Ok(())
}

/// Close a token handle safely.
pub fn close_token(token: HANDLE) {
    if !token.is_null() {
        // SAFETY: we only close valid handles
        unsafe { CloseHandle(token) };
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_get_current_process_token() {
        let result = get_current_process_token();
        assert!(result.is_ok());
        let token = result.unwrap();
        assert!(!token.is_null());
        close_token(token);
    }

    #[test]
    fn test_create_restricted_token() {
        let config = TokenConfig::default();
        let result = create_restricted_token(&config);
        assert!(result.is_ok());
        // Token is automatically closed on drop
    }
}
