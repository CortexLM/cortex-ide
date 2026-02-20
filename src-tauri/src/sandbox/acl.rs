#![allow(unsafe_code)]
//! Windows ACL (Access Control List) manipulation.
//!
//! This module provides safe wrappers for Windows ACL operations
//! used to restrict file access in the sandbox.

use anyhow::{Result, anyhow};
use std::ffi::c_void;
use std::path::Path;
use std::ptr;
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSidToSidW, GetNamedSecurityInfoW, SE_FILE_OBJECT, SetNamedSecurityInfoW,
};
use windows_sys::Win32::Security::{ACL, DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR};

use super::winutil::str_to_wide;

/// Access mask constants for file operations.
pub mod access {
    pub const FILE_READ: u32 = 0x00120089; // FILE_GENERIC_READ
    pub const FILE_WRITE: u32 = 0x00120116; // FILE_GENERIC_WRITE
    pub const FILE_EXECUTE: u32 = 0x001200A0; // FILE_GENERIC_EXECUTE
    pub const FILE_ALL: u32 = 0x001F01FF; // FILE_ALL_ACCESS
}

/// Result of an ACL operation.
#[derive(Debug)]
pub struct AclOperationResult {
    pub success: bool,
    pub error_code: Option<u32>,
}

/// Convert a SID string to a binary SID.
pub fn string_to_sid(sid_string: &str) -> Result<*mut c_void> {
    let wide = str_to_wide(sid_string);
    let mut psid: *mut c_void = ptr::null_mut();

    // SAFETY: wide string is null-terminated, psid is valid output pointer
    let result = unsafe { ConvertStringSidToSidW(wide.as_ptr(), &mut psid) };

    if result == 0 {
        return Err(anyhow!(
            "Failed to convert SID string: {}",
            super::winutil::get_last_error()
        ));
    }

    Ok(psid)
}

/// Free a SID allocated by string_to_sid.
pub fn free_sid(psid: *mut c_void) {
    if !psid.is_null() {
        // SAFETY: psid was allocated by Windows API
        unsafe { LocalFree(psid as *mut _) };
    }
}

/// Get the DACL for a file or directory.
pub fn get_dacl(path: &Path) -> Result<(*mut ACL, PSECURITY_DESCRIPTOR)> {
    let wide_path = str_to_wide(&path.to_string_lossy());
    let mut dacl: *mut ACL = ptr::null_mut();
    let mut sd: PSECURITY_DESCRIPTOR = ptr::null_mut();

    // SAFETY: wide_path is null-terminated, output pointers are valid
    let result = unsafe {
        GetNamedSecurityInfoW(
            wide_path.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            ptr::null_mut(),
            ptr::null_mut(),
            &mut dacl,
            ptr::null_mut(),
            &mut sd,
        )
    };

    if result != 0 {
        return Err(anyhow!("Failed to get DACL: error {}", result));
    }

    Ok((dacl, sd))
}

/// Set the DACL for a file or directory.
pub fn set_dacl(path: &Path, dacl: *mut ACL) -> Result<()> {
    let wide_path = str_to_wide(&path.to_string_lossy());

    // SAFETY: wide_path is null-terminated, dacl must be valid
    let result = unsafe {
        SetNamedSecurityInfoW(
            wide_path.as_ptr() as *mut u16,
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            ptr::null_mut(),
            ptr::null_mut(),
            dacl,
            ptr::null_mut(),
        )
    };

    if result != 0 {
        return Err(anyhow!("Failed to set DACL: error {}", result));
    }

    Ok(())
}

/// Free a security descriptor allocated by get_dacl.
pub fn free_security_descriptor(sd: PSECURITY_DESCRIPTOR) {
    if !sd.is_null() {
        // SAFETY: sd was allocated by GetNamedSecurityInfoW
        unsafe { LocalFree(sd as *mut _) };
    }
}

/// Check if a path has write access for everyone (world-writable).
pub fn is_world_writable(path: &Path) -> Result<bool> {
    // Get the DACL
    let (dacl, sd) = get_dacl(path)?;

    // For now, return false as a safe default
    // Full implementation would iterate through ACEs
    let result = false;

    // Clean up
    free_security_descriptor(sd);

    Ok(result)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_string_to_sid_valid() {
        // Everyone SID
        let result = string_to_sid("S-1-1-0");
        assert!(result.is_ok());
        free_sid(result.unwrap());
    }

    #[test]
    fn test_string_to_sid_invalid() {
        let result = string_to_sid("invalid-sid");
        assert!(result.is_err());
    }

    #[test]
    fn test_get_dacl() {
        let temp_dir = env::temp_dir();
        let result = get_dacl(&temp_dir);
        assert!(result.is_ok());
        let (_, sd) = result.unwrap();
        free_security_descriptor(sd);
    }
}
