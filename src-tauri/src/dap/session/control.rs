//! Debug execution control (continue, step, pause, etc.)

use anyhow::Result;

use super::core::DebugSession;
use super::types::{DebugSessionEvent, DebugSessionState};

impl DebugSession {
    /// Continue execution
    pub async fn continue_(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.continue_(thread_id).await?;
        }
        Ok(())
    }

    /// Pause execution
    pub async fn pause(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.pause(thread_id).await?;
        } else {
            // Pause first thread
            let threads = self.threads.read().await;
            if let Some(thread) = threads.first() {
                self.client.pause(thread.id).await?;
            }
        }
        Ok(())
    }

    /// Step over (next line)
    pub async fn step_over(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.next(thread_id).await?;
        }
        Ok(())
    }

    /// Step into function
    pub async fn step_into(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.step_in(thread_id).await?;
        }
        Ok(())
    }

    /// Step out of function
    pub async fn step_out(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.step_out(thread_id).await?;
        }
        Ok(())
    }

    /// Step back (reverse debugging)
    pub async fn step_back(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.step_back(thread_id).await?;
        }
        Ok(())
    }

    /// Reverse continue (reverse debugging)
    pub async fn reverse_continue(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.reverse_continue(thread_id).await?;
        }
        Ok(())
    }

    /// Step to next instruction (instruction-level stepping)
    pub async fn step_instruction(&self) -> Result<()> {
        if let Some(thread_id) = *self.active_thread_id.read().await {
            self.client.step_instruction(thread_id).await?;
        }
        Ok(())
    }

    /// Stop the debug session
    pub async fn stop(&self, terminate_debuggee: bool) -> Result<()> {
        self.client.disconnect(false, terminate_debuggee).await?;
        *self.state.write().await = DebugSessionState::Ended;
        self.external_event_tx
            .send(DebugSessionEvent::StateChanged {
                state: DebugSessionState::Ended,
            })
            .ok();
        Ok(())
    }

    /// Restart the debug session
    pub async fn restart(&mut self) -> Result<()> {
        // Stop current session
        self.client.terminate(true).await.ok();

        // Wait a bit
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        // Start again
        self.start().await
    }

    /// Terminate specific threads
    pub async fn terminate_threads(&self, thread_ids: Vec<i64>) -> Result<()> {
        self.client.terminate_threads(thread_ids).await
    }

    /// Cancel a pending request
    pub async fn cancel_request(
        &self,
        request_id: Option<i64>,
        progress_id: Option<String>,
    ) -> Result<()> {
        self.client.cancel_request(request_id, progress_id).await
    }
}
