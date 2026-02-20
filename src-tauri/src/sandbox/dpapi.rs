#![allow(unsafe_code)]
//! Windows DPAPI (Data Protection API) for secure credential storage.
//!
//! This module provides encryption/decryption using Windows DPAPI,
//! which ties encrypted data to the current user or machine.

use anyhow::{Result, anyhow};
use std::ptr;
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CRYPT_INTEGER_BLOB, CRYPTPROTECT_LOCAL_MACHINE, CryptProtectData, CryptUnprotectData,
};

/// Encryption scope for DPAPI.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DpapiScope {
    /// Encrypt for current user only (more secure)
    CurrentUser,
    /// Encrypt for any user on this machine
    LocalMachine,
}

/// Encrypt data using DPAPI.
///
/// # Arguments
/// * `data` - The plaintext data to encrypt
/// * `scope` - Whether to encrypt for current user or local machine
///
/// # Returns
/// The encrypted data as a byte vector.
pub fn encrypt(data: &[u8], scope: DpapiScope) -> Result<Vec<u8>> {
    let mut input_blob = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut output_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let flags = match scope {
        DpapiScope::CurrentUser => 0,
        DpapiScope::LocalMachine => CRYPTPROTECT_LOCAL_MACHINE,
    };

    // SAFETY: input_blob points to valid data, output_blob is valid output
    let result = unsafe {
        CryptProtectData(
            &mut input_blob,
            ptr::null(),     // description
            ptr::null_mut(), // optional entropy
            ptr::null_mut(), // reserved
            ptr::null_mut(), // prompt struct
            flags,
            &mut output_blob,
        )
    };

    if result == 0 {
        return Err(anyhow!(
            "DPAPI encryption failed: {}",
            super::winutil::get_last_error()
        ));
    }

    // Copy the encrypted data
    let encrypted = unsafe {
        std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec()
    };

    // Free the output buffer
    // SAFETY: output_blob.pbData was allocated by CryptProtectData
    unsafe { LocalFree(output_blob.pbData as *mut _) };

    Ok(encrypted)
}

/// Decrypt data using DPAPI.
///
/// # Arguments
/// * `encrypted` - The encrypted data
///
/// # Returns
/// The decrypted plaintext data.
pub fn decrypt(encrypted: &[u8]) -> Result<Vec<u8>> {
    let mut input_blob = CRYPT_INTEGER_BLOB {
        cbData: encrypted.len() as u32,
        pbData: encrypted.as_ptr() as *mut u8,
    };

    let mut output_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    // SAFETY: input_blob points to valid data, output_blob is valid output
    let result = unsafe {
        CryptUnprotectData(
            &mut input_blob,
            ptr::null_mut(), // description output
            ptr::null_mut(), // optional entropy
            ptr::null_mut(), // reserved
            ptr::null_mut(), // prompt struct
            0,               // flags
            &mut output_blob,
        )
    };

    if result == 0 {
        return Err(anyhow!(
            "DPAPI decryption failed: {}",
            super::winutil::get_last_error()
        ));
    }

    // Copy the decrypted data
    let decrypted = unsafe {
        std::slice::from_raw_parts(output_blob.pbData, output_blob.cbData as usize).to_vec()
    };

    // Free the output buffer
    // SAFETY: output_blob.pbData was allocated by CryptUnprotectData
    unsafe { LocalFree(output_blob.pbData as *mut _) };

    Ok(decrypted)
}

/// Encrypt a string password using DPAPI.
pub fn encrypt_password(password: &str, scope: DpapiScope) -> Result<Vec<u8>> {
    encrypt(password.as_bytes(), scope)
}

/// Decrypt a password encrypted with encrypt_password.
pub fn decrypt_password(encrypted: &[u8]) -> Result<String> {
    let decrypted = decrypt(encrypted)?;
    String::from_utf8(decrypted).map_err(|e| anyhow!("Invalid UTF-8 in decrypted password: {}", e))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = b"Hello, World!";

        let encrypted = encrypt(original, DpapiScope::CurrentUser).unwrap();
        assert_ne!(encrypted, original);

        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_encrypt_decrypt_password() {
        let password = "super_secret_password_123!";

        let encrypted = encrypt_password(password, DpapiScope::CurrentUser).unwrap();
        let decrypted = decrypt_password(&encrypted).unwrap();

        assert_eq!(decrypted, password);
    }

    #[test]
    fn test_encrypt_empty() {
        let encrypted = encrypt(b"", DpapiScope::CurrentUser).unwrap();
        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, b"");
    }
}
