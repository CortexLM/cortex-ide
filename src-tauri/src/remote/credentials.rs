//! Secure credential storage for SSH connections.

use secrecy::{ExposeSecret, SecretString};
use zeroize::ZeroizeOnDrop;

use super::error::RemoteError;
use super::types::AuthMethod;

/// Keyring service name for SSH credentials
const KEYRING_SERVICE: &str = "Cortex-desktop-ssh";

/// Secure credential storage for SSH
pub struct SecureSshCredentials;

impl SecureSshCredentials {
    /// Get keyring entry for a credential
    fn get_entry(profile_id: &str, cred_type: &str) -> Result<keyring::Entry, RemoteError> {
        let account = format!("{}:{}", profile_id, cred_type);
        keyring::Entry::new(KEYRING_SERVICE, &account)
            .map_err(|e| RemoteError::KeyringError(format!("Failed to access keyring: {e}")))
    }

    /// Store a password in the keyring
    pub fn store_password(profile_id: &str, password: &str) -> Result<(), RemoteError> {
        let entry = Self::get_entry(profile_id, "password")?;
        entry
            .set_password(password)
            .map_err(|e| RemoteError::KeyringError(format!("Failed to store password: {e}")))
    }

    /// Retrieve a password from the keyring
    pub fn get_password(profile_id: &str) -> Result<Option<SecretString>, RemoteError> {
        let entry = Self::get_entry(profile_id, "password")?;
        match entry.get_password() {
            Ok(password) => Ok(Some(SecretString::from(password))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(RemoteError::KeyringError(format!(
                "Failed to retrieve password: {e}"
            ))),
        }
    }

    /// Store a key passphrase in the keyring
    pub fn store_passphrase(profile_id: &str, passphrase: &str) -> Result<(), RemoteError> {
        let entry = Self::get_entry(profile_id, "passphrase")?;
        entry
            .set_password(passphrase)
            .map_err(|e| RemoteError::KeyringError(format!("Failed to store passphrase: {e}")))
    }

    /// Retrieve a key passphrase from the keyring
    pub fn get_passphrase(profile_id: &str) -> Result<Option<SecretString>, RemoteError> {
        let entry = Self::get_entry(profile_id, "passphrase")?;
        match entry.get_password() {
            Ok(passphrase) => Ok(Some(SecretString::from(passphrase))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(RemoteError::KeyringError(format!(
                "Failed to retrieve passphrase: {e}"
            ))),
        }
    }

    /// Delete all credentials for a profile
    pub fn delete_credentials(profile_id: &str) -> Result<(), RemoteError> {
        // Delete password
        if let Ok(entry) = Self::get_entry(profile_id, "password") {
            let _ = entry.delete_credential();
        }
        // Delete passphrase
        if let Ok(entry) = Self::get_entry(profile_id, "passphrase") {
            let _ = entry.delete_credential();
        }
        Ok(())
    }

    /// Check if password exists for a profile
    pub fn has_password(profile_id: &str) -> bool {
        Self::get_entry(profile_id, "password")
            .and_then(|entry| match entry.get_password() {
                Ok(_) => Ok(true),
                Err(keyring::Error::NoEntry) => Ok(false),
                Err(e) => Err(RemoteError::KeyringError(e.to_string())),
            })
            .unwrap_or(false)
    }

    /// Check if passphrase exists for a profile
    pub fn has_passphrase(profile_id: &str) -> bool {
        Self::get_entry(profile_id, "passphrase")
            .and_then(|entry| match entry.get_password() {
                Ok(_) => Ok(true),
                Err(keyring::Error::NoEntry) => Ok(false),
                Err(e) => Err(RemoteError::KeyringError(e.to_string())),
            })
            .unwrap_or(false)
    }
}

/// Secure SSH credentials wrapper for runtime use
#[derive(ZeroizeOnDrop)]
pub struct SecureAuthCredentials {
    /// Password for password auth (protected in memory)
    #[zeroize(skip)]
    password: Option<SecretString>,
    /// Passphrase for key auth (protected in memory)
    #[zeroize(skip)]
    passphrase: Option<SecretString>,
}

impl SecureAuthCredentials {
    /// Create empty credentials
    pub fn empty() -> Self {
        Self {
            password: None,
            passphrase: None,
        }
    }

    /// Create with password
    pub fn with_password(password: String) -> Self {
        Self {
            password: Some(SecretString::from(password)),
            passphrase: None,
        }
    }

    /// Create with passphrase
    pub fn with_passphrase(passphrase: String) -> Self {
        Self {
            password: None,
            passphrase: Some(SecretString::from(passphrase)),
        }
    }

    /// Get password (use sparingly)
    pub fn password(&self) -> Option<&str> {
        self.password.as_ref().map(|s| s.expose_secret())
    }

    /// Get passphrase (use sparingly)
    pub fn passphrase(&self) -> Option<&str> {
        self.passphrase.as_ref().map(|s| s.expose_secret())
    }

    /// Load from keyring for a profile
    pub fn load_from_keyring(
        profile_id: &str,
        auth_method: &AuthMethod,
    ) -> Result<Self, RemoteError> {
        match auth_method {
            AuthMethod::Password { has_password } if *has_password => {
                let password = SecureSshCredentials::get_password(profile_id)?;
                Ok(Self {
                    password,
                    passphrase: None,
                })
            }
            AuthMethod::Key { has_passphrase, .. } if *has_passphrase => {
                let passphrase = SecureSshCredentials::get_passphrase(profile_id)?;
                Ok(Self {
                    password: None,
                    passphrase,
                })
            }
            _ => Ok(Self::empty()),
        }
    }
}
