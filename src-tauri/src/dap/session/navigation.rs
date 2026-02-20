//! Execution navigation (goto, step-in targets, restart frame)

use anyhow::Result;

use crate::dap::protocol::{GotoTarget, StepInTarget};

use super::core::DebugSession;

impl DebugSession {
    /// Restart execution from a specific stack frame
    pub async fn restart_frame(&self, frame_id: i64) -> Result<()> {
        self.client.restart_frame(frame_id).await
    }

    /// Get possible goto targets for a source location
    pub async fn goto_targets(
        &self,
        source_path: &str,
        line: i64,
        column: Option<i64>,
    ) -> Result<Vec<GotoTarget>> {
        self.client.goto_targets(source_path, line, column).await
    }

    /// Jump to a specific goto target
    pub async fn goto(&self, thread_id: i64, target_id: i64) -> Result<()> {
        self.client.goto(thread_id, target_id).await
    }

    /// Get possible step-in targets for the current position
    pub async fn step_in_targets(&self, frame_id: i64) -> Result<Vec<StepInTarget>> {
        self.client.step_in_targets(frame_id).await
    }

    /// Step into a specific target
    pub async fn step_in_target(&self, thread_id: i64, target_id: i64) -> Result<()> {
        self.client.step_in_target(thread_id, target_id).await
    }
}
