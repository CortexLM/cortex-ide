//! Flow control for terminal output backpressure
//!
//! Implements flow control mechanisms to prevent the terminal from being
//! overwhelmed by fast output, using a token-bucket style approach.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use tauri::{AppHandle, Emitter};
use tracing::warn;

use super::constants::{
    FLOW_CONTROL_ACK_THRESHOLD, FLOW_CONTROL_MAX_PENDING, OUTPUT_BUFFER_MAX_SIZE,
};
use super::types::TerminalOutput;

/// Flow controller for terminal output backpressure
///
/// Prevents the terminal from being overwhelmed by fast output
/// by tracking pending bytes and pausing output when threshold is exceeded.
pub struct FlowController {
    pending_bytes: AtomicUsize,
    max_pending: usize,
    #[allow(dead_code)]
    ack_threshold: usize,
}

impl FlowController {
    pub fn new() -> Self {
        Self {
            pending_bytes: AtomicUsize::new(0),
            max_pending: FLOW_CONTROL_MAX_PENDING,
            ack_threshold: FLOW_CONTROL_ACK_THRESHOLD,
        }
    }

    /// Check if output should be paused due to backpressure
    pub fn should_pause(&self) -> bool {
        self.pending_bytes.load(Ordering::Relaxed) > self.max_pending
    }

    /// Add bytes to pending count when output is sent
    pub fn add_pending(&self, bytes: usize) {
        self.pending_bytes.fetch_add(bytes, Ordering::Relaxed);
    }

    /// Acknowledge bytes have been processed by frontend
    pub fn acknowledge(&self, bytes: usize) {
        // Use saturating subtraction to prevent underflow
        let current = self.pending_bytes.load(Ordering::Relaxed);
        let new_value = current.saturating_sub(bytes);
        self.pending_bytes.store(new_value, Ordering::Relaxed);
    }

    /// Get current pending bytes count
    #[allow(dead_code)]
    pub fn pending(&self) -> usize {
        self.pending_bytes.load(Ordering::Relaxed)
    }
}

impl Default for FlowController {
    fn default() -> Self {
        Self::new()
    }
}

/// Output batcher for throttling terminal output events
pub struct OutputBatcher {
    buffer: String,
    #[allow(dead_code)]
    last_flush: Instant,
    terminal_id: String,
    app_handle: AppHandle,
    flow_controller: Option<Arc<FlowController>>,
}

impl OutputBatcher {
    pub fn new(terminal_id: String, app_handle: AppHandle) -> Self {
        Self {
            buffer: String::with_capacity(OUTPUT_BUFFER_MAX_SIZE),
            last_flush: Instant::now(),
            terminal_id,
            app_handle,
            flow_controller: None,
        }
    }

    pub fn with_flow_controller(mut self, flow_controller: Arc<FlowController>) -> Self {
        self.flow_controller = Some(flow_controller);
        self
    }

    /// Add data to the buffer and flush if needed
    pub fn push(&mut self, data: &str) {
        self.buffer.push_str(data);

        // For TUI apps: flush immediately for any output to ensure real-time display
        // This is critical for interactive TUI applications like htop, vim, claude-tui
        // The small IPC overhead is worth the responsiveness gain
        self.flush();
    }

    /// Force flush the buffer
    pub fn flush(&mut self) {
        if self.buffer.is_empty() {
            return;
        }

        let data = std::mem::take(&mut self.buffer);
        let data_len = data.len();

        let output = TerminalOutput {
            terminal_id: self.terminal_id.clone(),
            data,
        };

        if let Err(e) = self.app_handle.emit("terminal:output", &output) {
            warn!("Failed to emit terminal output: {}", e);
        } else {
            // Track pending bytes for flow control
            if let Some(ref fc) = self.flow_controller {
                fc.add_pending(data_len);
            }
        }

        self.last_flush = Instant::now();
        self.buffer.reserve(OUTPUT_BUFFER_MAX_SIZE);
    }
}
