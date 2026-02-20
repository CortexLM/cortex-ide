//! Breakpoint management for debug sessions

use anyhow::Result;

use crate::dap::protocol::{
    Breakpoint, DataBreakpoint, ExceptionFilterOptions, ExceptionOptions, FunctionBreakpoint,
    InstructionBreakpoint, SourceBreakpoint,
};

use super::core::DebugSession;
use super::types::{DebugSessionEvent, SessionBreakpoint};

impl DebugSession {
    /// Set breakpoints for a file
    pub async fn set_breakpoints(
        &self,
        path: &str,
        lines: Vec<i64>,
        conditions: Option<Vec<Option<String>>>,
        hit_conditions: Option<Vec<Option<String>>>,
        log_messages: Option<Vec<Option<String>>>,
    ) -> Result<Vec<SessionBreakpoint>> {
        let source_breakpoints: Vec<SourceBreakpoint> = lines
            .iter()
            .enumerate()
            .map(|(i, &line)| SourceBreakpoint {
                line,
                column: None,
                condition: conditions
                    .as_ref()
                    .and_then(|c| c.get(i).cloned().flatten()),
                hit_condition: hit_conditions
                    .as_ref()
                    .and_then(|c| c.get(i).cloned().flatten()),
                log_message: log_messages
                    .as_ref()
                    .and_then(|c| c.get(i).cloned().flatten()),
            })
            .collect();

        let adapter_breakpoints = self
            .client
            .set_breakpoints(path, source_breakpoints)
            .await?;

        let session_breakpoints: Vec<SessionBreakpoint> = adapter_breakpoints
            .into_iter()
            .zip(lines.iter())
            .map(|(bp, &requested_line)| SessionBreakpoint {
                id: bp.id,
                path: path.to_string(),
                line: bp.line.unwrap_or(requested_line),
                column: bp.column,
                verified: bp.verified,
                condition: None,
                hit_condition: None,
                log_message: None,
                message: bp.message,
            })
            .collect();

        // Update local breakpoints
        self.breakpoints
            .write()
            .await
            .insert(path.to_string(), session_breakpoints.clone());

        self.external_event_tx
            .send(DebugSessionEvent::BreakpointsChanged {
                path: path.to_string(),
                breakpoints: session_breakpoints.clone(),
            })
            .ok();

        Ok(session_breakpoints)
    }

    /// Toggle a breakpoint at a specific line
    pub async fn toggle_breakpoint(&self, path: &str, line: i64) -> Result<Vec<SessionBreakpoint>> {
        let mut breakpoints = self.breakpoints.write().await;
        let file_bps = breakpoints.entry(path.to_string()).or_insert_with(Vec::new);

        // Check if breakpoint exists at this line
        let existing_idx = file_bps.iter().position(|bp| bp.line == line);

        let lines: Vec<i64> = if let Some(idx) = existing_idx {
            // Remove existing breakpoint
            file_bps.remove(idx);
            file_bps.iter().map(|bp| bp.line).collect()
        } else {
            // Add new breakpoint
            let mut lines: Vec<i64> = file_bps.iter().map(|bp| bp.line).collect();
            lines.push(line);
            lines.sort();
            lines
        };

        drop(breakpoints);

        // Set breakpoints on adapter
        self.set_breakpoints(path, lines, None, None, None).await
    }

    /// Set function breakpoints
    pub async fn set_function_breakpoints(
        &self,
        function_names: Vec<String>,
        conditions: Option<Vec<Option<String>>>,
    ) -> Result<Vec<SessionBreakpoint>> {
        let function_breakpoints: Vec<FunctionBreakpoint> = function_names
            .iter()
            .enumerate()
            .map(|(i, name)| FunctionBreakpoint {
                name: name.clone(),
                condition: conditions
                    .as_ref()
                    .and_then(|c| c.get(i).cloned().flatten()),
                hit_condition: None,
            })
            .collect();

        let adapter_breakpoints = self
            .client
            .set_function_breakpoints(function_breakpoints)
            .await?;

        let session_breakpoints: Vec<SessionBreakpoint> = adapter_breakpoints
            .into_iter()
            .zip(function_names.iter())
            .map(|(bp, name)| SessionBreakpoint {
                id: bp.id,
                path: name.clone(), // Use function name as path for lack of better field
                line: bp.line.unwrap_or(0),
                column: bp.column,
                verified: bp.verified,
                condition: None,
                hit_condition: None,
                log_message: None,
                message: bp.message,
            })
            .collect();

        // Update local function breakpoints
        *self.function_breakpoints.write().await = session_breakpoints.clone();

        // Notify frontend (we might need a new event type or reuse BreakpointsChanged)
        // For now let's use an empty path to signify function breakpoints
        self.external_event_tx
            .send(DebugSessionEvent::BreakpointsChanged {
                path: "[functions]".to_string(),
                breakpoints: session_breakpoints.clone(),
            })
            .ok();

        Ok(session_breakpoints)
    }

    /// Set instruction breakpoints
    pub async fn set_instruction_breakpoints(
        &self,
        breakpoints: Vec<InstructionBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        self.client.set_instruction_breakpoints(breakpoints).await
    }

    /// Set data breakpoints (watchpoints)
    pub async fn set_data_breakpoints(
        &self,
        breakpoints: Vec<DataBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        self.client.set_data_breakpoints(breakpoints).await
    }

    /// Set exception breakpoints
    pub async fn set_exception_breakpoints(
        &self,
        filters: Vec<String>,
        filter_options: Option<Vec<ExceptionFilterOptions>>,
        exception_options: Option<Vec<ExceptionOptions>>,
    ) -> Result<Option<Vec<Breakpoint>>> {
        self.client
            .set_exception_breakpoints(filters, filter_options, exception_options)
            .await
    }

    /// Get all breakpoints
    pub async fn breakpoints(&self) -> std::collections::HashMap<String, Vec<SessionBreakpoint>> {
        self.breakpoints.read().await.clone()
    }
}
