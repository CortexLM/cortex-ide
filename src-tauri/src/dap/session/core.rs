//! Core debug session struct and lifecycle management

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{RwLock, mpsc};

use crate::dap::client::DapClient;
use crate::dap::protocol::{Capabilities, DapEvent, StackFrame, Thread};
use crate::dap::transport::Transport;

use super::adapter::get_adapter_command;
use super::types::{DebugSessionConfig, DebugSessionEvent, DebugSessionState, SessionBreakpoint};

/// A debug session
pub struct DebugSession {
    /// Session configuration
    pub config: DebugSessionConfig,
    /// DAP client
    pub(super) client: Arc<DapClient>,
    /// Current state
    pub(super) state: Arc<RwLock<DebugSessionState>>,
    /// Breakpoints by file path
    pub(super) breakpoints: Arc<RwLock<HashMap<String, Vec<SessionBreakpoint>>>>,
    /// Function breakpoints
    pub(super) function_breakpoints: Arc<RwLock<Vec<SessionBreakpoint>>>,
    /// Current threads
    pub(super) threads: Arc<RwLock<Vec<Thread>>>,
    /// Current stack frames (per thread)
    pub(super) stack_frames: Arc<RwLock<HashMap<i64, Vec<StackFrame>>>>,
    /// Current active thread ID
    pub(super) active_thread_id: Arc<RwLock<Option<i64>>>,
    /// Current active frame ID
    pub(super) active_frame_id: Arc<RwLock<Option<i64>>>,
    /// Event receiver
    event_rx: mpsc::UnboundedReceiver<DapEvent>,
    /// Event sender for external consumers
    pub(super) external_event_tx: mpsc::UnboundedSender<DebugSessionEvent>,
    /// Adapter capabilities
    capabilities: Arc<RwLock<Option<Capabilities>>>,
}

impl DebugSession {
    /// Create a new debug session
    pub async fn new(
        config: DebugSessionConfig,
        external_event_tx: mpsc::UnboundedSender<DebugSessionEvent>,
    ) -> Result<Self> {
        let (event_tx, event_rx) = mpsc::unbounded_channel();

        // Determine adapter command based on type
        let (command, args) = get_adapter_command(&config)?;

        // Create transport
        let transport =
            Transport::spawn_stdio(&command, &args, config.cwd.as_deref(), config.env.as_ref())
                .await?;

        let client = Arc::new(DapClient::new(transport, event_tx));

        Ok(Self {
            config,
            client,
            state: Arc::new(RwLock::new(DebugSessionState::Initializing)),
            breakpoints: Arc::new(RwLock::new(HashMap::new())),
            function_breakpoints: Arc::new(RwLock::new(vec![])),
            threads: Arc::new(RwLock::new(vec![])),
            stack_frames: Arc::new(RwLock::new(HashMap::new())),
            active_thread_id: Arc::new(RwLock::new(None)),
            active_frame_id: Arc::new(RwLock::new(None)),
            event_rx,
            external_event_tx,
            capabilities: Arc::new(RwLock::new(None)),
        })
    }

    /// Start the debug session
    pub async fn start(&mut self) -> Result<()> {
        // Start the message receive loop
        let client = self.client.clone();
        client.start_receive_loop();

        // Initialize the adapter
        let capabilities = self.client.initialize(&self.config.type_).await?;
        *self.capabilities.write().await = Some(capabilities.clone());

        // Send launch or attach request
        let adapter_config = self.config.to_adapter_config();
        if self.config.request == "attach" {
            self.client.attach(adapter_config).await?;
        } else {
            self.client.launch(adapter_config).await?;
        }

        // Send configuration done if supported
        if capabilities
            .supports_configuration_done_request
            .unwrap_or(false)
        {
            self.client.configuration_done().await?;
        }

        // Update state
        *self.state.write().await = DebugSessionState::Running;
        self.external_event_tx
            .send(DebugSessionEvent::StateChanged {
                state: DebugSessionState::Running,
            })
            .ok();

        Ok(())
    }

    /// Process events from the adapter
    pub async fn process_events(&mut self) {
        while let Some(event) = self.event_rx.recv().await {
            if let Err(e) = self.handle_event(event).await {
                tracing::error!("Error handling event: {}", e);
            }
        }
    }

    /// Get current state
    pub async fn state(&self) -> DebugSessionState {
        self.state.read().await.clone()
    }

    /// Get current threads
    pub async fn threads(&self) -> Vec<Thread> {
        self.threads.read().await.clone()
    }

    /// Get stack frames for a thread
    pub async fn stack_frames(&self, thread_id: i64) -> Vec<StackFrame> {
        self.stack_frames
            .read()
            .await
            .get(&thread_id)
            .cloned()
            .unwrap_or_default()
    }

    /// Set active thread
    pub async fn set_active_thread(&self, thread_id: i64) {
        *self.active_thread_id.write().await = Some(thread_id);
        self.refresh_stack_trace(thread_id).await.ok();
    }

    /// Set active frame
    pub async fn set_active_frame(&self, frame_id: i64) {
        *self.active_frame_id.write().await = Some(frame_id);
    }

    /// Get active thread ID
    pub async fn active_thread_id(&self) -> Option<i64> {
        *self.active_thread_id.read().await
    }

    /// Get active frame ID
    pub async fn active_frame_id(&self) -> Option<i64> {
        *self.active_frame_id.read().await
    }

    /// Get adapter capabilities
    pub async fn capabilities(&self) -> Option<Capabilities> {
        self.capabilities.read().await.clone()
    }
}
