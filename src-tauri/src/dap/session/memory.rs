//! Memory and disassembly operations

use anyhow::Result;

use crate::dap::protocol::{DisassembleResponse, ReadMemoryResponse, WriteMemoryResponse};

use super::core::DebugSession;

impl DebugSession {
    /// Disassemble code at a memory reference
    pub async fn disassemble(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        instruction_offset: Option<i64>,
        instruction_count: i64,
        resolve_symbols: Option<bool>,
    ) -> Result<DisassembleResponse> {
        self.client
            .disassemble(
                memory_reference,
                offset,
                instruction_offset,
                instruction_count,
                resolve_symbols,
            )
            .await
    }

    /// Read memory from the debuggee
    pub async fn read_memory(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        count: i64,
    ) -> Result<ReadMemoryResponse> {
        self.client
            .read_memory(memory_reference, offset, count)
            .await
    }

    /// Write memory to the debuggee
    pub async fn write_memory(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        data: &str,
        allow_partial: Option<bool>,
    ) -> Result<WriteMemoryResponse> {
        self.client
            .write_memory(memory_reference, offset, data, allow_partial)
            .await
    }
}
