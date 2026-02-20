//! Debug session types and data structures

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// Configuration for starting a debug session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebugSessionConfig {
    /// Unique session ID
    pub id: String,
    /// Name of this debug configuration
    pub name: String,
    /// Type of debug adapter (node, python, etc.)
    #[serde(rename = "type")]
    pub type_: String,
    /// Request type (launch or attach)
    pub request: String,
    /// Program to debug (for launch)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub program: Option<String>,
    /// Arguments to pass to the program
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    /// Working directory
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    /// Environment variables
    #[serde(skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    /// Stop on entry point
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_on_entry: Option<bool>,
    /// Console type (internalConsole, integratedTerminal, externalTerminal)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub console: Option<String>,
    /// Port for attach (for attach requests)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    /// Host for attach
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    /// Path to debug adapter executable (if custom)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_path: Option<String>,
    /// Additional adapter-specific arguments
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_args: Option<Vec<String>>,
    /// Additional configuration passed directly to the adapter
    #[serde(flatten)]
    pub additional: HashMap<String, serde_json::Value>,
}

impl DebugSessionConfig {
    /// Get the launch/attach configuration to send to the adapter
    pub fn to_adapter_config(&self) -> serde_json::Value {
        let mut config = serde_json::json!({
            "type": self.type_,
            "request": self.request,
            "name": self.name,
        });

        if let Some(program) = &self.program {
            config["program"] = serde_json::Value::String(program.clone());
        }
        if let Some(args) = &self.args {
            config["args"] = serde_json::to_value(args).unwrap_or_default();
        }
        if let Some(cwd) = &self.cwd {
            config["cwd"] = serde_json::Value::String(cwd.clone());
        }
        if let Some(env) = &self.env {
            config["env"] = serde_json::to_value(env).unwrap_or_default();
        }
        if let Some(stop_on_entry) = self.stop_on_entry {
            config["stopOnEntry"] = serde_json::Value::Bool(stop_on_entry);
        }
        if let Some(console) = &self.console {
            config["console"] = serde_json::Value::String(console.clone());
        }
        if let Some(port) = self.port {
            config["port"] = serde_json::Value::Number(port.into());
        }
        if let Some(host) = &self.host {
            config["host"] = serde_json::Value::String(host.clone());
        }

        // Merge additional config
        if let serde_json::Value::Object(map) = &mut config {
            for (key, value) in &self.additional {
                map.insert(key.clone(), value.clone());
            }
        }

        config
    }
}

/// Current state of a debug session
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DebugSessionState {
    /// Session is initializing
    Initializing,
    /// Session is running (not stopped)
    Running,
    /// Session is stopped (hit breakpoint, exception, etc.)
    Stopped {
        reason: String,
        thread_id: Option<i64>,
        description: Option<String>,
    },
    /// Session has ended
    Ended,
}

/// A breakpoint in the debug session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionBreakpoint {
    /// Unique ID assigned by the adapter
    pub id: Option<i64>,
    /// File path
    pub path: String,
    /// Line number (1-based)
    pub line: i64,
    /// Column number (optional, 1-based)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i64>,
    /// Whether the breakpoint is verified by the adapter
    pub verified: bool,
    /// Optional condition expression
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    /// Optional hit condition
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit_condition: Option<String>,
    /// Optional log message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub log_message: Option<String>,
    /// Adapter message (e.g., why breakpoint couldn't be verified)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Events emitted by a debug session for UI updates
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DebugSessionEvent {
    /// Session state changed
    StateChanged { state: DebugSessionState },
    /// Breakpoints changed
    BreakpointsChanged {
        path: String,
        breakpoints: Vec<SessionBreakpoint>,
    },
    /// Threads updated
    ThreadsUpdated {
        threads: Vec<crate::dap::protocol::Thread>,
    },
    /// Stack trace updated
    StackTraceUpdated {
        thread_id: i64,
        frames: Vec<crate::dap::protocol::StackFrame>,
    },
    /// Variables updated
    VariablesUpdated {
        variables: Vec<crate::dap::protocol::Variable>,
    },
    /// Output received
    Output {
        category: String,
        output: String,
        source: Option<String>,
        line: Option<i64>,
    },
    /// Session terminated
    Terminated { restart: bool },
    /// Session exited
    Exited { exit_code: i64 },
}
