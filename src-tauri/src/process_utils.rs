//! Process utilities for spawning commands without visible windows on Windows
//!
//! This module provides helper functions to create Command instances that
//! don't show console windows on Windows when spawning processes.

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Windows flag to create process without a visible window
#[cfg(windows)]
pub const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Create a std::process::Command that doesn't show a window on Windows
pub fn command(program: &str) -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Create a tokio::process::Command that doesn't show a window on Windows
pub fn async_command(program: &str) -> tokio::process::Command {
    #[allow(unused_mut)]
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}
