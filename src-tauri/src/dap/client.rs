//! DAP Client implementation
//!
//! Handles communication with a debug adapter and provides a high-level API
//! for debug operations.

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Context, Result};
use tokio::sync::{Mutex, RwLock, mpsc, oneshot};

use super::protocol::*;
use super::transport::Transport;

type ResponseCallback = oneshot::Sender<Result<DapResponse>>;
type EventHandler = Box<dyn Fn(DapEvent) + Send + Sync>;

/// DAP Client for communicating with debug adapters
pub struct DapClient {
    transport: Arc<Mutex<Transport>>,
    sequence: AtomicU64,
    pending_requests: Arc<RwLock<HashMap<u64, ResponseCallback>>>,
    event_tx: mpsc::UnboundedSender<DapEvent>,
    capabilities: Arc<RwLock<Option<Capabilities>>>,
    running: Arc<RwLock<bool>>,
}

impl DapClient {
    /// Create a new DAP client with the given transport
    pub fn new(transport: Transport, event_tx: mpsc::UnboundedSender<DapEvent>) -> Self {
        Self {
            transport: Arc::new(Mutex::new(transport)),
            sequence: AtomicU64::new(1),
            pending_requests: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            capabilities: Arc::new(RwLock::new(None)),
            running: Arc::new(RwLock::new(true)),
        }
    }

    /// Start the message receive loop in a background task
    pub fn start_receive_loop(self: Arc<Self>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            loop {
                // Check if client is still running
                if !*self.running.read().await {
                    break;
                }

                let message = {
                    let mut transport = self.transport.lock().await;
                    transport.receive().await
                };

                match message {
                    Ok(msg) => {
                        if let Err(e) = self.handle_message(msg).await {
                            tracing::error!("Error handling DAP message: {}", e);
                        }
                    }
                    Err(e) => {
                        tracing::error!("Error receiving DAP message: {}", e);
                        // Check if transport is still alive
                        let transport = self.transport.lock().await;
                        if !transport.is_alive() {
                            tracing::info!("Transport closed, stopping receive loop");
                            break;
                        }
                    }
                }
            }
        })
    }

    /// Handle a received DAP message
    async fn handle_message(&self, message: DapMessage) -> Result<()> {
        match message {
            DapMessage::Response(response) => {
                let request_seq = response.request_seq;
                let mut pending = self.pending_requests.write().await;
                if let Some(callback) = pending.remove(&request_seq) {
                    callback.send(Ok(response)).ok();
                } else {
                    tracing::warn!("Received response for unknown request: {}", request_seq);
                }
            }
            DapMessage::Event(event) => {
                self.event_tx.send(event).ok();
            }
            DapMessage::Request(request) => {
                // Reverse requests from adapter (like runInTerminal)
                tracing::info!("Received reverse request: {}", request.command);
                // Handle reverse requests if needed
            }
        }
        Ok(())
    }

    /// Get the next sequence number
    fn next_seq(&self) -> u64 {
        self.sequence.fetch_add(1, Ordering::SeqCst)
    }

    /// Send a request and wait for a response
    pub async fn request(
        &self,
        command: &str,
        arguments: Option<serde_json::Value>,
    ) -> Result<DapResponse> {
        let seq = self.next_seq();
        let request = DapMessage::Request(DapRequest {
            seq,
            command: command.to_string(),
            arguments,
        });

        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending_requests.write().await;
            pending.insert(seq, tx);
        }

        {
            let mut transport = self.transport.lock().await;
            transport.send(&request).await?;
        }

        let response = rx.await.context("Response channel closed")??;

        if !response.success {
            anyhow::bail!(
                "Request '{}' failed: {}",
                command,
                response.message.unwrap_or_default()
            );
        }

        Ok(response)
    }

    /// Initialize the debug adapter
    pub async fn initialize(&self, adapter_id: &str) -> Result<Capabilities> {
        let args = InitializeRequestArguments {
            client_id: Some("Cortex-desktop".to_string()),
            client_name: Some("Cortex".to_string()),
            adapter_id: adapter_id.to_string(),
            locale: Some("en-US".to_string()),
            lines_start_at1: Some(true),
            columns_start_at1: Some(true),
            path_format: Some("path".to_string()),
            supports_variable_type: Some(true),
            supports_variable_paging: Some(false),
            supports_run_in_terminal_request: Some(true),
            supports_memory_references: Some(true),
            supports_progress_reporting: Some(false),
            supports_invalidated_event: Some(true),
            supports_memory_event: Some(false),
            supports_start_debugging_request: Some(true),
        };

        let response = self
            .request("initialize", Some(serde_json::to_value(args)?))
            .await?;

        let capabilities: Capabilities = response
            .body
            .map(|b| serde_json::from_value(b).unwrap_or_default())
            .unwrap_or_default();

        *self.capabilities.write().await = Some(capabilities.clone());
        Ok(capabilities)
    }

    /// Send launch request to start debugging
    pub async fn launch(&self, config: serde_json::Value) -> Result<()> {
        self.request("launch", Some(config)).await?;
        Ok(())
    }

    /// Send attach request to attach to a running process
    pub async fn attach(&self, config: serde_json::Value) -> Result<()> {
        self.request("attach", Some(config)).await?;
        Ok(())
    }

    /// Send configuration done to indicate client is ready
    pub async fn configuration_done(&self) -> Result<()> {
        self.request("configurationDone", None).await?;
        Ok(())
    }

    /// Set breakpoints for a source file
    pub async fn set_breakpoints(
        &self,
        source_path: &str,
        breakpoints: Vec<SourceBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        let args = SetBreakpointsArguments {
            source: Source {
                name: source_path.split('/').next_back().map(String::from),
                path: Some(source_path.to_string()),
                source_reference: None,
                presentation_hint: None,
                origin: None,
                sources: None,
                adapter_data: None,
                checksums: None,
            },
            breakpoints: Some(breakpoints),
            lines: None,
            source_modified: None,
        };

        let response = self
            .request("setBreakpoints", Some(serde_json::to_value(args)?))
            .await?;

        let result: SetBreakpointsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(SetBreakpointsResponse {
                breakpoints: vec![],
            });

        Ok(result.breakpoints)
    }

    /// Set function breakpoints
    pub async fn set_function_breakpoints(
        &self,
        breakpoints: Vec<FunctionBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        let args = SetFunctionBreakpointsArguments { breakpoints };

        let response = self
            .request("setFunctionBreakpoints", Some(serde_json::to_value(args)?))
            .await?;

        let result: SetFunctionBreakpointsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(SetFunctionBreakpointsResponse {
                breakpoints: vec![],
            });

        Ok(result.breakpoints)
    }

    /// Continue execution
    pub async fn continue_(&self, thread_id: i64) -> Result<bool> {
        let args = ContinueArguments {
            thread_id,
            single_thread: None,
        };

        let response = self
            .request("continue", Some(serde_json::to_value(args)?))
            .await?;

        let result: ContinueResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(ContinueResponse {
                all_threads_continued: Some(true),
            });

        Ok(result.all_threads_continued.unwrap_or(true))
    }

    /// Step to next line (step over)
    pub async fn next(&self, thread_id: i64) -> Result<()> {
        let args = NextArguments {
            thread_id,
            single_thread: None,
            granularity: Some(SteppingGranularity::Line),
        };

        self.request("next", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Step into function
    pub async fn step_in(&self, thread_id: i64) -> Result<()> {
        let args = StepInArguments {
            thread_id,
            single_thread: None,
            target_id: None,
            granularity: Some(SteppingGranularity::Line),
        };

        self.request("stepIn", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Step out of function
    pub async fn step_out(&self, thread_id: i64) -> Result<()> {
        let args = StepOutArguments {
            thread_id,
            single_thread: None,
            granularity: Some(SteppingGranularity::Line),
        };

        self.request("stepOut", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Step back (reverse debugging)
    pub async fn step_back(&self, thread_id: i64) -> Result<()> {
        let args = StepBackArguments {
            thread_id,
            single_thread: None,
            granularity: Some(SteppingGranularity::Line),
        };

        self.request("stepBack", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Reverse continue (reverse debugging)
    pub async fn reverse_continue(&self, thread_id: i64) -> Result<()> {
        let args = ReverseContinueArguments {
            thread_id,
            single_thread: None,
        };

        self.request("reverseContinue", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Pause execution
    pub async fn pause(&self, thread_id: i64) -> Result<()> {
        let args = PauseArguments { thread_id };
        self.request("pause", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Get threads
    pub async fn threads(&self) -> Result<Vec<Thread>> {
        let response = self.request("threads", None).await?;

        let result: ThreadsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(ThreadsResponse { threads: vec![] });

        Ok(result.threads)
    }

    /// Get stack trace for a thread
    pub async fn stack_trace(&self, thread_id: i64) -> Result<Vec<StackFrame>> {
        let args = StackTraceArguments {
            thread_id,
            start_frame: None,
            levels: Some(100),
            format: None,
        };

        let response = self
            .request("stackTrace", Some(serde_json::to_value(args)?))
            .await?;

        let result: StackTraceResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(StackTraceResponse {
                stack_frames: vec![],
                total_frames: None,
            });

        Ok(result.stack_frames)
    }

    /// Get scopes for a stack frame
    pub async fn scopes(&self, frame_id: i64) -> Result<Vec<Scope>> {
        let args = ScopesArguments { frame_id };

        let response = self
            .request("scopes", Some(serde_json::to_value(args)?))
            .await?;

        let result: ScopesResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(ScopesResponse { scopes: vec![] });

        Ok(result.scopes)
    }

    /// Get variables for a variables reference
    pub async fn variables(&self, variables_reference: i64) -> Result<Vec<Variable>> {
        self.variables_paged(variables_reference, None, None).await
    }

    /// Get variables for a variables reference with paging support
    pub async fn variables_paged(
        &self,
        variables_reference: i64,
        start: Option<i64>,
        count: Option<i64>,
    ) -> Result<Vec<Variable>> {
        let args = VariablesArguments {
            variables_reference,
            filter: None,
            start,
            count,
            format: None,
        };

        let response = self
            .request("variables", Some(serde_json::to_value(args)?))
            .await?;

        let result: VariablesResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(VariablesResponse { variables: vec![] });

        Ok(result.variables)
    }

    /// Evaluate an expression
    pub async fn evaluate(
        &self,
        expression: &str,
        frame_id: Option<i64>,
        context: Option<&str>,
    ) -> Result<EvaluateResponse> {
        let args = EvaluateArguments {
            expression: expression.to_string(),
            frame_id,
            context: context.map(String::from),
            format: None,
        };

        let response = self
            .request("evaluate", Some(serde_json::to_value(args)?))
            .await?;

        let result: EvaluateResponse = response
            .body
            .context("Missing evaluate response body")?
            .pipe(serde_json::from_value)?;

        Ok(result)
    }

    /// Set the value of a variable
    pub async fn set_variable(
        &self,
        variables_reference: i64,
        name: &str,
        value: &str,
    ) -> Result<SetVariableResponse> {
        let args = SetVariableArguments {
            variables_reference,
            name: name.to_string(),
            value: value.to_string(),
            format: None,
        };

        let response = self
            .request("setVariable", Some(serde_json::to_value(args)?))
            .await?;

        let result: SetVariableResponse = response
            .body
            .context("Missing setVariable response body")?
            .pipe(serde_json::from_value)?;

        Ok(result)
    }

    /// Get completions for expression in debug console
    pub async fn completions(
        &self,
        frame_id: Option<i64>,
        text: &str,
        column: i64,
        line: Option<i64>,
    ) -> Result<CompletionsResponse> {
        let args = CompletionsArguments {
            frame_id,
            text: text.to_string(),
            column,
            line,
        };

        let response = self
            .request("completions", Some(serde_json::to_value(args)?))
            .await?;

        let result: CompletionsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(CompletionsResponse { targets: vec![] });

        Ok(result)
    }

    /// Step to next instruction (instruction-level stepping)
    pub async fn step_instruction(&self, thread_id: i64) -> Result<()> {
        let args = NextArguments {
            thread_id,
            single_thread: None,
            granularity: Some(SteppingGranularity::Instruction),
        };

        self.request("next", Some(serde_json::to_value(args)?))
            .await?;
        Ok(())
    }

    /// Disassemble code at a memory reference
    pub async fn disassemble(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        instruction_offset: Option<i64>,
        instruction_count: i64,
        resolve_symbols: Option<bool>,
    ) -> Result<DisassembleResponse> {
        let args = DisassembleArguments {
            memory_reference: memory_reference.to_string(),
            offset,
            instruction_offset,
            instruction_count,
            resolve_symbols,
        };

        let response = self
            .request("disassemble", Some(serde_json::to_value(args)?))
            .await?;

        let result: DisassembleResponse = response
            .body
            .context("Missing disassemble response body")?
            .pipe(serde_json::from_value)?;

        Ok(result)
    }

    /// Read memory from the debuggee
    pub async fn read_memory(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        count: i64,
    ) -> Result<ReadMemoryResponse> {
        let args = ReadMemoryArguments {
            memory_reference: memory_reference.to_string(),
            offset,
            count,
        };

        let response = self
            .request("readMemory", Some(serde_json::to_value(args)?))
            .await?;

        let result: ReadMemoryResponse = response
            .body
            .context("Missing readMemory response body")?
            .pipe(serde_json::from_value)?;

        Ok(result)
    }

    /// Write memory to the debuggee
    pub async fn write_memory(
        &self,
        memory_reference: &str,
        offset: Option<i64>,
        data: &str,
        allow_partial: Option<bool>,
    ) -> Result<WriteMemoryResponse> {
        let args = WriteMemoryArguments {
            memory_reference: memory_reference.to_string(),
            offset,
            allow_partial,
            data: data.to_string(),
        };

        let response = self
            .request("writeMemory", Some(serde_json::to_value(args)?))
            .await?;

        let result: WriteMemoryResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(WriteMemoryResponse {
                offset: None,
                bytes_written: None,
            });

        Ok(result)
    }

    /// Set instruction breakpoints
    pub async fn set_instruction_breakpoints(
        &self,
        breakpoints: Vec<InstructionBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        let args = SetInstructionBreakpointsArguments { breakpoints };

        let response = self
            .request(
                "setInstructionBreakpoints",
                Some(serde_json::to_value(args)?),
            )
            .await?;

        let result: SetInstructionBreakpointsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(SetInstructionBreakpointsResponse {
                breakpoints: vec![],
            });

        Ok(result.breakpoints)
    }

    /// Set data breakpoints (watchpoints)
    pub async fn set_data_breakpoints(
        &self,
        breakpoints: Vec<DataBreakpoint>,
    ) -> Result<Vec<Breakpoint>> {
        let args = SetDataBreakpointsArguments { breakpoints };

        let response = self
            .request("setDataBreakpoints", Some(serde_json::to_value(args)?))
            .await?;

        let result: SetDataBreakpointsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(SetDataBreakpointsResponse {
                breakpoints: vec![],
            });

        Ok(result.breakpoints)
    }

    /// Set exception breakpoints
    pub async fn set_exception_breakpoints(
        &self,
        filters: Vec<String>,
        filter_options: Option<Vec<ExceptionFilterOptions>>,
        exception_options: Option<Vec<ExceptionOptions>>,
    ) -> Result<Option<Vec<Breakpoint>>> {
        let args = SetExceptionBreakpointsArguments {
            filters,
            filter_options,
            exception_options,
        };

        let response = self
            .request("setExceptionBreakpoints", Some(serde_json::to_value(args)?))
            .await?;

        let result: SetExceptionBreakpointsResponse = response
            .body
            .map(serde_json::from_value)
            .transpose()?
            .unwrap_or(SetExceptionBreakpointsResponse { breakpoints: None });

        Ok(result.breakpoints)
    }

    /// Disconnect from the debug adapter
    pub async fn disconnect(&self, restart: bool, terminate_debuggee: bool) -> Result<()> {
        let args = serde_json::json!({
            "restart": restart,
            "terminateDebuggee": terminate_debuggee
        });

        self.request("disconnect", Some(args)).await.ok();
        *self.running.write().await = false;
        Ok(())
    }

    /// Terminate the debug session
    pub async fn terminate(&self, restart: bool) -> Result<()> {
        let args = serde_json::json!({
            "restart": restart
        });

        self.request("terminate", Some(args)).await.ok();
        *self.running.write().await = false;
        Ok(())
    }

    /// Kill the transport
    pub async fn kill(&self) -> Result<()> {
        *self.running.write().await = false;
        let mut transport = self.transport.lock().await;
        transport.kill().await
    }

    /// Get capabilities
    pub async fn capabilities(&self) -> Option<Capabilities> {
        self.capabilities.read().await.clone()
    }

    // ========================================================================
    // Additional VS Code DAP Features for 100% Parity
    // ========================================================================

    /// Restart execution from a specific stack frame (supports_restart_frame capability)
    pub async fn restart_frame(&self, frame_id: i64) -> Result<()> {
        let args = serde_json::json!({
            "frameId": frame_id,
        });
        self.request("restartFrame", Some(args)).await?;
        Ok(())
    }

    /// Get possible goto targets for a source location (supports_goto_targets_request capability)
    pub async fn goto_targets(
        &self,
        source_path: &str,
        line: i64,
        column: Option<i64>,
    ) -> Result<Vec<GotoTarget>> {
        let mut args = serde_json::json!({
            "source": { "path": source_path },
            "line": line,
        });
        if let Some(col) = column {
            args["column"] = serde_json::json!(col);
        }
        let response = self.request("gotoTargets", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        let targets = body
            .get("targets")
            .and_then(|v: &serde_json::Value| {
                serde_json::from_value::<Vec<GotoTarget>>(v.clone()).ok()
            })
            .unwrap_or_default();
        Ok(targets)
    }

    /// Jump to a specific goto target (used with goto_targets)
    pub async fn goto(&self, thread_id: i64, target_id: i64) -> Result<()> {
        let args = serde_json::json!({
            "threadId": thread_id,
            "targetId": target_id,
        });
        self.request("goto", Some(args)).await?;
        Ok(())
    }

    /// Get possible step-in targets for the current position (supports_step_in_targets_request capability)
    pub async fn step_in_targets(&self, frame_id: i64) -> Result<Vec<StepInTarget>> {
        let args = serde_json::json!({
            "frameId": frame_id,
        });
        let response = self.request("stepInTargets", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        let targets = body
            .get("targets")
            .and_then(|v: &serde_json::Value| {
                serde_json::from_value::<Vec<StepInTarget>>(v.clone()).ok()
            })
            .unwrap_or_default();
        Ok(targets)
    }

    /// Step into a specific target (when multiple step-in targets exist)
    pub async fn step_in_target(&self, thread_id: i64, target_id: i64) -> Result<()> {
        let args = serde_json::json!({
            "threadId": thread_id,
            "targetId": target_id,
            "granularity": "statement",
        });
        self.request("stepIn", Some(args)).await?;
        Ok(())
    }

    /// Terminate specific threads (supports_terminate_threads_request capability)
    pub async fn terminate_threads(&self, thread_ids: Vec<i64>) -> Result<()> {
        let args = serde_json::json!({
            "threadIds": thread_ids,
        });
        self.request("terminateThreads", Some(args)).await?;
        Ok(())
    }

    /// Set an expression value (supports_set_expression capability)
    pub async fn set_expression(
        &self,
        expression: &str,
        value: &str,
        frame_id: Option<i64>,
    ) -> Result<SetExpressionResponse> {
        let mut args = serde_json::json!({
            "expression": expression,
            "value": value,
        });
        if let Some(fid) = frame_id {
            args["frameId"] = serde_json::json!(fid);
        }
        let response = self.request("setExpression", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        Ok(SetExpressionResponse {
            value: body
                .get("value")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            type_: body
                .get("type")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            variables_reference: body.get("variablesReference").and_then(|v| v.as_i64()),
            named_variables: body.get("namedVariables").and_then(|v| v.as_i64()),
            indexed_variables: body.get("indexedVariables").and_then(|v| v.as_i64()),
        })
    }

    /// Cancel a pending request (supports_cancel_request capability)
    pub async fn cancel_request(
        &self,
        request_id: Option<i64>,
        progress_id: Option<String>,
    ) -> Result<()> {
        let mut args = serde_json::json!({});
        if let Some(rid) = request_id {
            args["requestId"] = serde_json::json!(rid);
        }
        if let Some(pid) = progress_id {
            args["progressId"] = serde_json::json!(pid);
        }
        self.request("cancel", Some(args)).await?;
        Ok(())
    }

    /// Get loaded sources (supports_loaded_sources_request capability)
    pub async fn loaded_sources(&self) -> Result<Vec<Source>> {
        let response = self.request("loadedSources", None).await?;
        let body = response.body.unwrap_or_default();
        let sources = body
            .get("sources")
            .and_then(|v: &serde_json::Value| serde_json::from_value::<Vec<Source>>(v.clone()).ok())
            .unwrap_or_default();
        Ok(sources)
    }

    /// Get source content for a source reference (for sources without a path)
    pub async fn source(
        &self,
        source_reference: i64,
        source_path: Option<&str>,
    ) -> Result<SourceResponse> {
        let mut source = serde_json::json!({ "sourceReference": source_reference });
        if let Some(path) = source_path {
            source["path"] = serde_json::json!(path);
        }
        let args = serde_json::json!({ "source": source });
        let response = self.request("source", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        Ok(SourceResponse {
            content: body
                .get("content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            mime_type: body
                .get("mimeType")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        })
    }

    /// Get exception info for the current exception (when stopped due to exception)
    pub async fn exception_info(&self, thread_id: i64) -> Result<ExceptionInfoResponse> {
        let args = serde_json::json!({ "threadId": thread_id });
        let response = self.request("exceptionInfo", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        Ok(ExceptionInfoResponse {
            exception_id: body
                .get("exceptionId")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            description: body
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            break_mode: body
                .get("breakMode")
                .and_then(|v| v.as_str())
                .unwrap_or("always")
                .to_string(),
            details: body.get("details").cloned(),
        })
    }

    /// Get data breakpoint info for a variable (check if data breakpoint can be set)
    pub async fn data_breakpoint_info(
        &self,
        variables_reference: Option<i64>,
        name: &str,
        frame_id: Option<i64>,
    ) -> Result<DataBreakpointInfoResponse> {
        let mut args = serde_json::json!({ "name": name });
        if let Some(vref) = variables_reference {
            args["variablesReference"] = serde_json::json!(vref);
        }
        if let Some(fid) = frame_id {
            args["frameId"] = serde_json::json!(fid);
        }
        let response = self.request("dataBreakpointInfo", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        Ok(DataBreakpointInfoResponse {
            data_id: body
                .get("dataId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            description: body
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            access_types: body.get("accessTypes").and_then(|v: &serde_json::Value| {
                serde_json::from_value::<Vec<String>>(v.clone()).ok()
            }),
            can_persist: body.get("canPersist").and_then(|v| v.as_bool()),
        })
    }

    /// Get modules loaded by the debuggee (supports_modules_request capability)
    pub async fn modules(&self, start: Option<i64>, count: Option<i64>) -> Result<ModulesResponse> {
        let mut args = serde_json::json!({});
        if let Some(s) = start {
            args["startModule"] = serde_json::json!(s);
        }
        if let Some(c) = count {
            args["moduleCount"] = serde_json::json!(c);
        }
        let response = self.request("modules", Some(args)).await?;
        let body = response.body.unwrap_or_default();
        Ok(ModulesResponse {
            modules: body
                .get("modules")
                .and_then(|v: &serde_json::Value| {
                    serde_json::from_value::<Vec<Module>>(v.clone()).ok()
                })
                .unwrap_or_default(),
            total_modules: body.get("totalModules").and_then(|v| v.as_i64()),
        })
    }
}

/// Extension trait for piping values
trait Pipe: Sized {
    fn pipe<T, F: FnOnce(Self) -> T>(self, f: F) -> T {
        f(self)
    }
}

impl<T> Pipe for T {}
