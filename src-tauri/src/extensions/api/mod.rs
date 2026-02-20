//! Plugin API surface exposed as Tauri IPC commands.
//!
//! This module organises the runtime API that extensions (WASM plugins) can
//! invoke through the Tauri command bridge.  Each sub-module groups related
//! functionality:
//!
//! - **commands** – plugin command registration and execution
//! - **window**   – UI primitives (messages, quick pick, input box, output channels, status bar, progress)
//! - **workspace** – workspace configuration, text documents, file watchers, edits
//! - **languages** – language feature provider registration (completion, hover, definition, diagnostics)
//! - **debug**     – debug configuration providers and session lifecycle events
//! - **scm**       – source control provider registration

pub mod commands;
pub mod debug;
pub mod languages;
pub mod scm;
pub mod window;
pub mod workspace;
