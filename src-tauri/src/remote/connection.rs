//! SSH connection wrapper and utilities.

use ssh2::{Session, Sftp};
use std::io::Read;
use std::path::PathBuf;

use super::error::RemoteError;
use super::types::{CommandResult, ConnectionProfile};

/// Internal SSH connection wrapper
pub struct SshConnection {
    pub session: Session,
    pub profile: ConnectionProfile,
    pub home_directory: String,
    pub platform: String,
}

impl SshConnection {
    pub fn new(
        session: Session,
        profile: ConnectionProfile,
        home_directory: String,
        platform: String,
    ) -> Self {
        Self {
            session,
            profile,
            home_directory,
            platform,
        }
    }

    pub fn sftp(&self) -> Result<Sftp, RemoteError> {
        self.session.sftp().map_err(RemoteError::SshError)
    }

    pub fn exec_command(&self, command: &str) -> Result<CommandResult, RemoteError> {
        let mut channel = self.session.channel_session()?;
        channel.exec(command)?;

        let mut stdout = String::new();
        let mut stderr = String::new();

        channel.read_to_string(&mut stdout)?;
        channel.stderr().read_to_string(&mut stderr)?;

        channel.wait_close()?;
        let exit_code = channel.exit_status()?;

        Ok(CommandResult {
            stdout,
            stderr,
            exit_code,
        })
    }
}

/// Set restrictive file permissions (0600 on Unix)
pub fn set_file_permissions(path: &PathBuf) -> Result<(), RemoteError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        std::fs::set_permissions(path, perms).map_err(|e| {
            RemoteError::IoError(std::io::Error::new(std::io::ErrorKind::PermissionDenied, e))
        })?;
    }

    #[cfg(not(unix))]
    {
        let _ = path; // Suppress unused warning on Windows
    }

    Ok(())
}
