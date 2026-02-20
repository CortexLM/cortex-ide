//! Terminal constants and configuration values
//!
//! Contains performance tuning constants for the terminal PTY system.

/// Output batching interval in milliseconds (60fps = ~16ms)
pub const OUTPUT_BATCH_INTERVAL_MS: u64 = 16;

/// Maximum output buffer size before forced flush (4KB chunks)
pub const OUTPUT_BUFFER_MAX_SIZE: usize = 4096;

/// Read buffer size for PTY output
pub const PTY_READ_BUFFER_SIZE: usize = 8192;

/// Maximum pending bytes before pausing output (100KB - matches VS Code's HighWatermarkChars)
/// Lower value prevents excessive buffering that causes TUI rendering issues
pub const FLOW_CONTROL_MAX_PENDING: usize = 100_000;

/// Bytes threshold before expecting acknowledgment (5KB - matches VS Code's LowWatermarkChars)
pub const FLOW_CONTROL_ACK_THRESHOLD: usize = 5_000;

/// Environment variables that are considered dangerous and filtered out
/// These env vars can be used for code injection attacks
pub const DANGEROUS_ENV_VARS: &[&str] = &[
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "LD_AUDIT",
    "LD_DEBUG",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "DYLD_FRAMEWORK_PATH",
    "PYTHONPATH",
    "PYTHONSTARTUP",
    "NODE_OPTIONS",
    "ELECTRON_RUN_AS_NODE",
    "BASH_ENV",
    "ENV",
    "ZDOTDIR",
];
