//! Source and module inspection

use anyhow::Result;

use crate::dap::protocol::{
    DataBreakpointInfoResponse, ExceptionInfoResponse, ModulesResponse, Source, SourceResponse,
};

use super::core::DebugSession;

impl DebugSession {
    /// Get loaded sources
    pub async fn loaded_sources(&self) -> Result<Vec<Source>> {
        self.client.loaded_sources().await
    }

    /// Get source content for a source reference
    pub async fn source(
        &self,
        source_reference: i64,
        source_path: Option<&str>,
    ) -> Result<SourceResponse> {
        self.client.source(source_reference, source_path).await
    }

    /// Get exception info for the current exception
    pub async fn exception_info(&self, thread_id: i64) -> Result<ExceptionInfoResponse> {
        self.client.exception_info(thread_id).await
    }

    /// Get data breakpoint info for a variable
    pub async fn data_breakpoint_info(
        &self,
        variables_reference: Option<i64>,
        name: &str,
        frame_id: Option<i64>,
    ) -> Result<DataBreakpointInfoResponse> {
        self.client
            .data_breakpoint_info(variables_reference, name, frame_id)
            .await
    }

    /// Get modules loaded by the debuggee
    pub async fn modules(&self, start: Option<i64>, count: Option<i64>) -> Result<ModulesResponse> {
        self.client.modules(start, count).await
    }
}
