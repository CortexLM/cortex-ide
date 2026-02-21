//! Memory and disassembly commands
//!
//! This module contains Tauri commands for low-level memory operations:
//! reading/writing memory and disassembling code.

use tauri::State;

use super::super::protocol::{ReadMemoryResponse, WriteMemoryResponse};
use super::state::DebuggerState;
use super::types::DisassembleResult;
use super::validation::validate_session_id;
use crate::LazyState;

const MAX_MEMORY_READ_BYTES: i64 = 1_048_576;
const MAX_WRITE_DATA_LEN: usize = 10_485_760;
const MAX_INSTRUCTION_COUNT: i64 = 10_000;
const MAX_MEMORY_REF_LEN: usize = 256;

fn validate_memory_reference(memory_reference: &str) -> Result<(), String> {
    if memory_reference.trim().is_empty() {
        return Err("Memory reference cannot be empty".to_string());
    }
    if memory_reference.len() > MAX_MEMORY_REF_LEN {
        return Err(format!(
            "Memory reference exceeds maximum length of {} characters",
            MAX_MEMORY_REF_LEN
        ));
    }
    Ok(())
}

fn validate_count(count: i64) -> Result<(), String> {
    if count <= 0 {
        return Err("Count must be a positive integer".to_string());
    }
    if count > MAX_MEMORY_READ_BYTES {
        return Err(format!(
            "Count exceeds maximum of {} bytes",
            MAX_MEMORY_READ_BYTES
        ));
    }
    Ok(())
}

fn validate_instruction_count(instruction_count: i64) -> Result<(), String> {
    if instruction_count <= 0 {
        return Err("Instruction count must be a positive integer".to_string());
    }
    if instruction_count > MAX_INSTRUCTION_COUNT {
        return Err(format!(
            "Instruction count exceeds maximum of {}",
            MAX_INSTRUCTION_COUNT
        ));
    }
    Ok(())
}

/// Disassemble code at a memory reference
#[tauri::command]
pub async fn debug_disassemble(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    instruction_offset: Option<i64>,
    instruction_count: i64,
    resolve_symbols: Option<bool>,
) -> Result<DisassembleResult, String> {
    validate_session_id(&session_id)?;
    validate_memory_reference(&memory_reference)?;
    validate_instruction_count(instruction_count)?;

    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    let result = session
        .disassemble(
            &memory_reference,
            offset,
            instruction_offset,
            instruction_count,
            resolve_symbols,
        )
        .await
        .map_err(|e| format!("Failed to disassemble: {}", e))?;

    Ok(DisassembleResult {
        instructions: result.instructions,
    })
}

/// Read memory from the debuggee
#[tauri::command]
pub async fn debug_read_memory(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    count: i64,
) -> Result<ReadMemoryResponse, String> {
    validate_session_id(&session_id)?;
    validate_memory_reference(&memory_reference)?;
    validate_count(count)?;

    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .read_memory(&memory_reference, offset, count)
        .await
        .map_err(|e| format!("Failed to read memory: {}", e))
}

/// Write memory to the debuggee
#[tauri::command]
pub async fn debug_write_memory(
    state: State<'_, LazyState<DebuggerState>>,
    session_id: String,
    memory_reference: String,
    offset: Option<i64>,
    data: String,
    allow_partial: Option<bool>,
) -> Result<WriteMemoryResponse, String> {
    validate_session_id(&session_id)?;
    validate_memory_reference(&memory_reference)?;
    if data.is_empty() {
        return Err("Data cannot be empty".to_string());
    }
    if data.len() > MAX_WRITE_DATA_LEN {
        return Err(format!(
            "Data exceeds maximum length of {} bytes",
            MAX_WRITE_DATA_LEN
        ));
    }

    let sessions = state.get().sessions.read().await;
    let session = sessions
        .get(&session_id)
        .ok_or_else(|| format!("Session not found: {}", session_id))?;

    let session = session.read().await;
    session
        .write_memory(&memory_reference, offset, &data, allow_partial)
        .await
        .map_err(|e| format!("Failed to write memory: {}", e))
}
