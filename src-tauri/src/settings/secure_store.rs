//! Secure API key storage using OS keyring
//!
//! This module provides secure storage for sensitive data like API keys
//! using the operating system's native keyring (Keychain on macOS,
//! Credential Manager on Windows, Secret Service on Linux).

use secrecy::SecretString;

use super::KEYRING_SERVICE;

/// Secure API key storage manager
pub struct SecureApiKeyStore;

impl SecureApiKeyStore {
    /// Get keyring entry for an API key
    fn get_entry(key_name: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, key_name)
            .map_err(|e| format!("Failed to access keyring: {e}"))
    }

    /// Store an API key securely in the keyring
    pub fn set_api_key(key_name: &str, api_key: &str) -> Result<(), String> {
        let entry = Self::get_entry(key_name)?;
        entry
            .set_password(api_key)
            .map_err(|e| format!("Failed to store API key: {e}"))
    }

    /// Retrieve an API key from the keyring
    pub fn get_api_key(key_name: &str) -> Result<Option<SecretString>, String> {
        let entry = Self::get_entry(key_name)?;
        match entry.get_password() {
            Ok(key) => Ok(Some(SecretString::from(key))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("Failed to retrieve API key: {e}")),
        }
    }

    /// Delete an API key from the keyring
    pub fn delete_api_key(key_name: &str) -> Result<bool, String> {
        let entry = Self::get_entry(key_name)?;
        match entry.delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(format!("Failed to delete API key: {e}")),
        }
    }

    /// Check if an API key exists
    pub fn has_api_key(key_name: &str) -> Result<bool, String> {
        let entry = Self::get_entry(key_name)?;
        match entry.get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(format!("Failed to check API key: {e}")),
        }
    }
}

/// Get API key for internal use (returns actual value as SecretString)
pub fn get_api_key_internal(key_name: &str) -> Option<SecretString> {
    SecureApiKeyStore::get_api_key(key_name).ok().flatten()
}
