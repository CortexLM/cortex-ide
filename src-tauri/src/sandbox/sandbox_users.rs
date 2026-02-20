#![allow(unsafe_code)]
//! Windows sandbox user management.
//!
//! This module provides functions to create and manage local Windows users
//! for sandbox isolation. Note: Creating users requires administrator privileges.

use anyhow::{Result, anyhow};
use std::ptr;
use windows_sys::Win32::NetworkManagement::NetManagement::{
    LOCALGROUP_MEMBERS_INFO_3, NERR_Success, NetLocalGroupAddMembers, NetUserAdd, NetUserDel,
    UF_DONT_EXPIRE_PASSWD, UF_SCRIPT, USER_INFO_1, USER_PRIV_USER,
};

use super::winutil::str_to_wide;

/// Information about a sandbox user.
#[derive(Debug, Clone)]
pub struct SandboxUser {
    pub username: String,
    pub password: String,
    pub created: bool,
}

impl SandboxUser {
    /// Create a new sandbox user specification.
    pub fn new(username: String, password: String) -> Self {
        Self {
            username,
            password,
            created: false,
        }
    }
}

/// Create a local Windows user for sandbox execution.
///
/// # Requirements
/// - Must be run with administrator privileges
/// - Username must not already exist
///
/// # Arguments
/// * `username` - The username to create
/// * `password` - The password for the user
///
/// # Returns
/// Ok(()) on success, Err on failure.
pub fn create_sandbox_user(username: &str, password: &str) -> Result<()> {
    let wide_username = str_to_wide(username);
    let wide_password = str_to_wide(password);

    let user_info = USER_INFO_1 {
        usri1_name: wide_username.as_ptr() as *mut u16,
        usri1_password: wide_password.as_ptr() as *mut u16,
        usri1_password_age: 0,
        usri1_priv: USER_PRIV_USER,
        usri1_home_dir: ptr::null_mut(),
        usri1_comment: ptr::null_mut(),
        usri1_flags: UF_SCRIPT | UF_DONT_EXPIRE_PASSWD,
        usri1_script_path: ptr::null_mut(),
    };

    let mut parm_err: u32 = 0;

    // SAFETY: user_info contains valid pointers to null-terminated strings
    let result = unsafe {
        NetUserAdd(
            ptr::null(), // local computer
            1,           // level
            &user_info as *const _ as *const u8,
            &mut parm_err,
        )
    };

    if result != NERR_Success {
        return Err(anyhow!(
            "Failed to create user '{}': error {} (param {})",
            username,
            result,
            parm_err
        ));
    }

    Ok(())
}

/// Delete a local Windows user.
///
/// # Requirements
/// - Must be run with administrator privileges
///
/// # Arguments
/// * `username` - The username to delete
pub fn delete_sandbox_user(username: &str) -> Result<()> {
    let wide_username = str_to_wide(username);

    // SAFETY: wide_username is null-terminated
    let result = unsafe {
        NetUserDel(
            ptr::null(), // local computer
            wide_username.as_ptr(),
        )
    };

    if result != NERR_Success {
        return Err(anyhow!(
            "Failed to delete user '{}': error {}",
            username,
            result
        ));
    }

    Ok(())
}

/// Add a user to a local group.
///
/// # Arguments
/// * `username` - The user to add
/// * `group_name` - The group to add the user to (e.g., "Users")
pub fn add_user_to_group(username: &str, group_name: &str) -> Result<()> {
    let wide_username = str_to_wide(username);
    let wide_group = str_to_wide(group_name);

    let member_info = LOCALGROUP_MEMBERS_INFO_3 {
        lgrmi3_domainandname: wide_username.as_ptr() as *mut u16,
    };

    // SAFETY: member_info contains valid pointer to null-terminated string
    let result = unsafe {
        NetLocalGroupAddMembers(
            ptr::null(), // local computer
            wide_group.as_ptr(),
            3, // level
            &member_info as *const _ as *const u8,
            1, // total entries
        )
    };

    if result != NERR_Success {
        return Err(anyhow!(
            "Failed to add '{}' to group '{}': error {}",
            username,
            group_name,
            result
        ));
    }

    Ok(())
}

/// Create a sandbox user with a secure random password.
///
/// Returns the created user with the generated password.
pub fn create_sandbox_user_with_random_password(username: &str) -> Result<SandboxUser> {
    let password = generate_secure_password();
    create_sandbox_user(username, &password)?;

    // Try to add to Users group (may fail if already member)
    let _ = add_user_to_group(username, "Users");

    Ok(SandboxUser {
        username: username.to_string(),
        password,
        created: true,
    })
}

/// Generate a cryptographically secure password.
fn generate_secure_password() -> String {
    use rand::Rng;
    const CHARSET: &[u8] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
    let mut rng = rand::thread_rng();

    (0..24)
        .map(|_| {
            let idx = rng.r#gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Check if a user exists.
pub fn user_exists(username: &str) -> bool {
    // Try to get user info - if it fails, user doesn't exist
    // For simplicity, we'll try to delete and catch the specific error
    // In production, would use NetUserGetInfo

    // This is a placeholder - proper implementation would use NetUserGetInfo
    false
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    /// Test password for unit tests. This is intentionally weak as it's only used in ignored tests.
    const TEST_PASSWORD: &str = "test_password_for_unit_tests_only";

    #[test]
    fn test_generate_secure_password() {
        let password = generate_secure_password();
        assert_eq!(password.len(), 24);
        assert!(password.chars().any(|c| c.is_ascii_uppercase()));
        assert!(password.chars().any(|c| c.is_ascii_lowercase()));
        assert!(password.chars().any(|c| c.is_ascii_digit()));
    }

    // Note: User creation tests require administrator privileges
    // and are disabled by default
    #[test]
    #[ignore]
    fn test_create_delete_user() {
        let username = "cortex_test_user_12345";
        let password = TEST_PASSWORD;

        // Clean up if exists
        let _ = delete_sandbox_user(username);

        // Create
        create_sandbox_user(username, password).unwrap();

        // Delete
        delete_sandbox_user(username).unwrap();
    }
}
