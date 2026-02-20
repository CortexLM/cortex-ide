//! Debug session event handling

use anyhow::Result;

use crate::dap::protocol::{
    BreakpointEventBody, ExitedEventBody, OutputEventBody, StoppedEventBody, TerminatedEventBody,
};

use super::core::DebugSession;
use super::types::{DebugSessionEvent, DebugSessionState};

impl DebugSession {
    /// Handle a DAP event
    pub(super) async fn handle_event(&self, event: crate::dap::protocol::DapEvent) -> Result<()> {
        match event.event.as_str() {
            "stopped" => self.handle_stopped_event(event.body).await?,
            "continued" => self.handle_continued_event().await,
            "terminated" => self.handle_terminated_event(event.body).await,
            "exited" => self.handle_exited_event(event.body).await?,
            "output" => self.handle_output_event(event.body).await?,
            "thread" => self.handle_thread_event().await,
            "breakpoint" => self.handle_breakpoint_event(event.body).await?,
            _ => {
                tracing::debug!("Unhandled event: {}", event.event);
            }
        }
        Ok(())
    }

    async fn handle_stopped_event(&self, body: Option<serde_json::Value>) -> Result<()> {
        if let Some(body) = body {
            let stopped: StoppedEventBody = serde_json::from_value(body)?;
            let state = DebugSessionState::Stopped {
                reason: stopped.reason.clone(),
                thread_id: stopped.thread_id,
                description: stopped.description.clone(),
            };
            *self.state.write().await = state.clone();

            // Set active thread
            if let Some(thread_id) = stopped.thread_id {
                *self.active_thread_id.write().await = Some(thread_id);
            }

            self.external_event_tx
                .send(DebugSessionEvent::StateChanged { state })
                .ok();

            // Fetch threads and stack trace
            self.refresh_threads().await.ok();
            if let Some(thread_id) = stopped.thread_id {
                self.refresh_stack_trace(thread_id).await.ok();
            }
        }
        Ok(())
    }

    async fn handle_continued_event(&self) {
        *self.state.write().await = DebugSessionState::Running;
        self.external_event_tx
            .send(DebugSessionEvent::StateChanged {
                state: DebugSessionState::Running,
            })
            .ok();
    }

    async fn handle_terminated_event(&self, body: Option<serde_json::Value>) {
        let restart = body
            .and_then(|b| serde_json::from_value::<TerminatedEventBody>(b).ok())
            .and_then(|t| t.restart)
            .is_some();

        *self.state.write().await = DebugSessionState::Ended;
        self.external_event_tx
            .send(DebugSessionEvent::Terminated { restart })
            .ok();
    }

    async fn handle_exited_event(&self, body: Option<serde_json::Value>) -> Result<()> {
        if let Some(body) = body {
            let exited: ExitedEventBody = serde_json::from_value(body)?;
            *self.state.write().await = DebugSessionState::Ended;
            self.external_event_tx
                .send(DebugSessionEvent::Exited {
                    exit_code: exited.exit_code,
                })
                .ok();
        }
        Ok(())
    }

    async fn handle_output_event(&self, body: Option<serde_json::Value>) -> Result<()> {
        if let Some(body) = body {
            let output: OutputEventBody = serde_json::from_value(body)?;
            self.external_event_tx
                .send(DebugSessionEvent::Output {
                    category: output.category.unwrap_or_else(|| "console".to_string()),
                    output: output.output,
                    source: output.source.and_then(|s| s.path),
                    line: output.line,
                })
                .ok();
        }
        Ok(())
    }

    async fn handle_thread_event(&self) {
        // Thread started/exited, refresh thread list
        self.refresh_threads().await.ok();
    }

    async fn handle_breakpoint_event(&self, body: Option<serde_json::Value>) -> Result<()> {
        if let Some(body) = body {
            let bp_event: BreakpointEventBody = serde_json::from_value(body)?;
            // Update breakpoint in our local state
            if let Some(path) = bp_event
                .breakpoint
                .source
                .as_ref()
                .and_then(|s| s.path.as_ref())
            {
                let mut breakpoints = self.breakpoints.write().await;
                if let Some(file_bps) = breakpoints.get_mut(path) {
                    for bp in file_bps.iter_mut() {
                        if bp.id == bp_event.breakpoint.id {
                            bp.verified = bp_event.breakpoint.verified;
                            bp.line = bp_event.breakpoint.line.unwrap_or(bp.line);
                            bp.message = bp_event.breakpoint.message.clone();
                        }
                    }
                    self.external_event_tx
                        .send(DebugSessionEvent::BreakpointsChanged {
                            path: path.clone(),
                            breakpoints: file_bps.clone(),
                        })
                        .ok();
                }
            } else if let Some(bp_id) = bp_event.breakpoint.id {
                // Might be a function breakpoint
                let mut function_bps = self.function_breakpoints.write().await;
                let mut found = false;
                for bp in function_bps.iter_mut() {
                    if bp.id == Some(bp_id) {
                        bp.verified = bp_event.breakpoint.verified;
                        bp.message = bp_event.breakpoint.message.clone();
                        found = true;
                    }
                }
                if found {
                    self.external_event_tx
                        .send(DebugSessionEvent::BreakpointsChanged {
                            path: "[functions]".to_string(),
                            breakpoints: function_bps.clone(),
                        })
                        .ok();
                }
            }
        }
        Ok(())
    }

    /// Refresh threads list
    pub(super) async fn refresh_threads(&self) -> Result<()> {
        let threads = self.client.threads().await?;
        *self.threads.write().await = threads.clone();
        self.external_event_tx
            .send(DebugSessionEvent::ThreadsUpdated { threads })
            .ok();
        Ok(())
    }

    /// Refresh stack trace for a thread
    pub(super) async fn refresh_stack_trace(&self, thread_id: i64) -> Result<()> {
        let frames = self.client.stack_trace(thread_id).await?;
        self.stack_frames
            .write()
            .await
            .insert(thread_id, frames.clone());

        // Set active frame to top frame
        if let Some(frame) = frames.first() {
            *self.active_frame_id.write().await = Some(frame.id);
        }

        self.external_event_tx
            .send(DebugSessionEvent::StackTraceUpdated { thread_id, frames })
            .ok();
        Ok(())
    }
}
