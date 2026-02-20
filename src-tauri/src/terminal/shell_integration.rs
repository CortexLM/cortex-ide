//! Shell integration scripts for automatic OSC 633 sequence support
//!
//! Provides embedded shell integration scripts that enable rich terminal
//! features like command detection and working directory tracking.

use std::io::{BufWriter, Write};
use std::sync::Arc;

use parking_lot::Mutex;
use tracing::info;

// ===== Shell Integration Scripts =====
// Embedded shell integration scripts for automatic OSC 633 sequence support

/// Bash shell integration script
pub const SHELL_INTEGRATION_BASH: &str = include_str!("../resources/shell-integration-bash.sh");

/// Zsh shell integration script
pub const SHELL_INTEGRATION_ZSH: &str = include_str!("../resources/shell-integration-zsh.sh");

/// Fish shell integration script
pub const SHELL_INTEGRATION_FISH: &str = include_str!("../resources/shell-integration-fish.fish");

/// PowerShell shell integration script
pub const SHELL_INTEGRATION_PWSH: &str = include_str!("../resources/shell-integration-pwsh.ps1");

/// Inject shell integration script into a terminal
///
/// Sends the appropriate shell integration script to the terminal based on the shell type.
/// The script is sourced/executed to enable OSC 633 sequence reporting.
pub fn inject_shell_integration(
    shell: &str,
    writer: &Arc<Mutex<BufWriter<Box<dyn Write + Send>>>>,
) -> Result<(), String> {
    let shell_lower = shell.to_lowercase();

    // Determine the injection command based on shell type
    let injection = if shell_lower.contains("bash") {
        // For bash, we source the script inline using eval
        format!("eval '{}'\n", SHELL_INTEGRATION_BASH.replace('\'', "'\\''"))
    } else if shell_lower.contains("zsh") {
        // For zsh, we source the script inline using eval
        format!("eval '{}'\n", SHELL_INTEGRATION_ZSH.replace('\'', "'\\''"))
    } else if shell_lower.contains("fish") {
        // For fish, we use source with a process substitution-like approach
        // Fish doesn't support eval the same way, so we write directly
        format!("{}\n", SHELL_INTEGRATION_FISH)
    } else if shell_lower.contains("pwsh") || shell_lower.contains("powershell") {
        // PowerShell shell integration is injected via command line arguments at launch
        // (like VS Code does) to avoid the script being echoed to the terminal
        return Ok(());
    } else {
        // Unknown shell, skip injection
        return Ok(());
    };

    // Write the injection to the terminal
    let mut writer_guard = writer.lock();
    writer_guard
        .write_all(injection.as_bytes())
        .map_err(|e| format!("Failed to inject shell integration: {}", e))?;
    writer_guard
        .flush()
        .map_err(|e| format!("Failed to flush shell integration: {}", e))?;

    info!("Shell integration injected for shell: {}", shell);
    Ok(())
}
