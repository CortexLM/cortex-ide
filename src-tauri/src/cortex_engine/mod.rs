//! Local cortex engine module providing Config, Session, and SessionHandle.
//!
//! Replaces the external `cortex-engine` crate with a minimal local implementation
//! that provides the types needed by the Tauri backend.

pub mod security;

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

use crate::cortex_protocol::{AskForApproval, ConversationId, Event, EventMsg, Op, Submission};
use async_channel::{Receiver, Sender};
use tracing::debug;

/// Main configuration struct.
#[derive(Debug, Clone)]
pub struct Config {
    /// Model to use.
    pub model: String,
    /// Model provider ID.
    pub model_provider_id: String,
    /// Working directory.
    pub cwd: PathBuf,
    /// Approval policy.
    pub approval_policy: AskForApproval,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            model: "claude-opus-4-5-20251101".to_string(),
            model_provider_id: "cortex".to_string(),
            cwd: std::env::current_dir().unwrap_or_default(),
            approval_policy: AskForApproval::default(),
        }
    }
}

/// Handle for interacting with a session.
#[derive(Clone)]
pub struct SessionHandle {
    /// Submission sender.
    pub submission_tx: Sender<Submission>,
    /// Event receiver.
    pub event_rx: Receiver<Event>,
    /// Conversation ID.
    pub conversation_id: ConversationId,
    /// Cancellation flag.
    pub cancelled: Arc<AtomicBool>,
}

/// A running session that handles conversation with the model.
pub struct Session {
    #[allow(dead_code)]
    config: Config,
    conversation_id: ConversationId,
    submission_rx: Receiver<Submission>,
    event_tx: Sender<Event>,
}

impl Session {
    /// Create a new session with channels.
    pub fn new(config: Config) -> anyhow::Result<(Self, SessionHandle)> {
        let (submission_tx, submission_rx) = async_channel::unbounded();
        let (event_tx, event_rx) = async_channel::unbounded();

        let conversation_id = ConversationId::new();
        let cancelled = Arc::new(AtomicBool::new(false));

        let session = Self {
            config,
            conversation_id,
            submission_rx,
            event_tx,
        };

        let handle = SessionHandle {
            submission_tx,
            event_rx,
            conversation_id,
            cancelled,
        };

        Ok((session, handle))
    }

    /// Main session loop — waits for submissions and shuts down on Op::Shutdown.
    pub async fn run(&mut self) -> anyhow::Result<()> {
        debug!(
            conversation_id = %self.conversation_id,
            "Session run loop started"
        );

        while let Ok(submission) = self.submission_rx.recv().await {
            match submission.op {
                Op::Shutdown => {
                    debug!(
                        conversation_id = %self.conversation_id,
                        "Session received shutdown"
                    );
                    let _ = self
                        .event_tx
                        .send(Event {
                            id: String::new(),
                            msg: EventMsg::ShutdownComplete,
                        })
                        .await;
                    break;
                }
                _ => {
                    debug!(
                        conversation_id = %self.conversation_id,
                        "Session received submission (stub)"
                    );
                }
            }
        }

        debug!(
            conversation_id = %self.conversation_id,
            "Session run loop ended"
        );

        Ok(())
    }
}
