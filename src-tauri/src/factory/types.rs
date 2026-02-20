//! Agent Factory Types
//!
//! Type definitions for workflows, nodes, edges, agents, and related structures.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// Workflow Types
// =============================================================================

/// A workflow definition containing nodes and edges
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workflow {
    /// Unique identifier
    pub id: String,
    /// Display name
    pub name: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Workflow version
    pub version: String,
    /// List of nodes in the workflow
    pub nodes: Vec<WorkflowNode>,
    /// List of edges connecting nodes
    pub edges: Vec<WorkflowEdge>,
    /// Global variables for the workflow
    #[serde(default)]
    pub variables: HashMap<String, serde_json::Value>,
    /// Workflow-level settings
    #[serde(default)]
    pub settings: WorkflowSettings,
    /// Creation timestamp in milliseconds
    pub created_at: u64,
    /// Last update timestamp in milliseconds
    pub updated_at: u64,
    /// Tags for organization
    #[serde(default)]
    pub tags: Vec<String>,
    /// Whether the workflow is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

impl Default for Workflow {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: "New Workflow".to_string(),
            description: None,
            version: "1.0.0".to_string(),
            nodes: Vec::new(),
            edges: Vec::new(),
            variables: HashMap::new(),
            settings: WorkflowSettings::default(),
            created_at: 0,
            updated_at: 0,
            tags: Vec::new(),
            enabled: true,
        }
    }
}

/// Workflow-level settings
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowSettings {
    /// Maximum execution timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// Maximum number of retries for failed nodes
    #[serde(default)]
    pub max_retries: u32,
    /// Whether to continue on node failure
    #[serde(default)]
    pub continue_on_failure: bool,
    /// Enable parallel execution where possible
    #[serde(default = "default_true")]
    pub parallel_execution: bool,
    /// Interception settings
    #[serde(default)]
    pub interception: Option<InterceptionConfig>,
}

fn default_timeout() -> u64 {
    300000 // 5 minutes
}

/// A node in the workflow graph
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowNode {
    /// Unique identifier for this node
    pub id: String,
    /// Node type
    pub node_type: NodeType,
    /// Display label
    pub label: String,
    /// X position in the canvas
    pub x: f64,
    /// Y position in the canvas
    pub y: f64,
    /// Node-specific configuration
    #[serde(default)]
    pub config: serde_json::Value,
    /// Input ports
    #[serde(default)]
    pub inputs: Vec<NodePort>,
    /// Output ports
    #[serde(default)]
    pub outputs: Vec<NodePort>,
    /// Whether this node is disabled
    #[serde(default)]
    pub disabled: bool,
    /// Optional notes/comments
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// Port definition for node inputs/outputs
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodePort {
    /// Port identifier
    pub id: String,
    /// Port label
    pub label: String,
    /// Data type accepted/produced
    #[serde(default = "default_any_type")]
    pub data_type: String,
    /// Whether this port is required
    #[serde(default)]
    pub required: bool,
}

fn default_any_type() -> String {
    "any".to_string()
}

/// Types of nodes in the workflow
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    /// Start/entry point of the workflow
    Trigger(TriggerType),
    /// Executes an action
    Action(ActionType),
    /// Conditional branching
    Condition,
    /// Parallel split
    ParallelSplit,
    /// Parallel join/merge
    ParallelJoin,
    /// Loop/iteration
    Loop,
    /// Delay/wait
    Delay,
    /// Transform data
    Transform,
    /// AI Agent node
    Agent,
    /// Sub-workflow reference
    SubWorkflow,
    /// Human approval required
    Approval,
    /// End/exit point
    End,
    /// Note/comment (no execution)
    Note,
}

/// Types of triggers that can start a workflow
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TriggerType {
    /// Manual trigger
    Manual,
    /// Scheduled trigger (cron-like)
    Schedule,
    /// Webhook trigger
    Webhook,
    /// File system event trigger
    FileWatch,
    /// Git event trigger
    GitEvent,
    /// Custom event trigger
    Event,
}

/// Types of actions that can be executed
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionType {
    /// Execute shell command
    Shell,
    /// Read file
    ReadFile,
    /// Write file
    WriteFile,
    /// Delete file
    DeleteFile,
    /// HTTP request
    HttpRequest,
    /// Call AI model
    AiCall,
    /// Execute tool
    Tool,
    /// Send notification
    Notify,
    /// Custom action
    Custom,
}

/// An edge connecting two nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEdge {
    /// Unique identifier
    pub id: String,
    /// Source node ID
    pub source: String,
    /// Source port ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_port: Option<String>,
    /// Target node ID
    pub target: String,
    /// Target port ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_port: Option<String>,
    /// Optional condition for this edge (for conditional nodes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
    /// Edge label
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

// =============================================================================
// Interception Types
// =============================================================================

/// Configuration for the interception engine
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptionConfig {
    /// Whether interception is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Risk threshold for automatic approval (below this = auto-approve)
    #[serde(default = "default_risk_threshold")]
    pub auto_approve_threshold: RiskLevel,
    /// Risk threshold for automatic denial (above this = auto-deny)
    #[serde(default = "default_high_risk")]
    pub auto_deny_threshold: RiskLevel,
    /// List of interception rules
    #[serde(default)]
    pub rules: Vec<InterceptionRule>,
    /// Timeout for approval requests in milliseconds
    #[serde(default = "default_approval_timeout")]
    pub approval_timeout_ms: u64,
    /// Default action when timeout is reached
    #[serde(default)]
    pub timeout_action: TimeoutAction,
}

fn default_risk_threshold() -> RiskLevel {
    RiskLevel::Low
}

fn default_high_risk() -> RiskLevel {
    RiskLevel::Critical
}

fn default_approval_timeout() -> u64 {
    300000 // 5 minutes
}

impl Default for InterceptionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            auto_approve_threshold: RiskLevel::Low,
            auto_deny_threshold: RiskLevel::Critical,
            rules: Vec::new(),
            approval_timeout_ms: 300000,
            timeout_action: TimeoutAction::default(),
        }
    }
}

/// An interception rule
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptionRule {
    /// Rule identifier
    pub id: String,
    /// Rule name
    pub name: String,
    /// Rule description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Pattern to match (regex or glob)
    pub pattern: String,
    /// What type of action this rule applies to
    pub action_type: InterceptionActionType,
    /// Risk level assigned when this rule matches
    pub risk_level: RiskLevel,
    /// Whether the rule is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Required decision for this rule
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_decision: Option<DecisionAction>,
}

/// Types of actions that can be intercepted
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InterceptionActionType {
    FileWrite,
    FileDelete,
    ShellExec,
    HttpRequest,
    AiCall,
    ToolExec,
    All,
}

/// Risk level classification
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    None,
    Low,
    Medium,
    High,
    Critical,
}

impl Default for RiskLevel {
    fn default() -> Self {
        Self::None
    }
}

/// A supervisor's decision on an intercepted action
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupervisorDecision {
    /// Decision identifier
    pub id: String,
    /// The approval ID this decision is for
    pub approval_id: String,
    /// The action taken
    pub action: DecisionAction,
    /// Reason for the decision
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Modified parameters (for modify action)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_params: Option<serde_json::Value>,
    /// Timestamp when the decision was made
    pub decided_at: u64,
    /// Who made the decision (user ID or "system")
    pub decided_by: String,
}

/// Action taken by the supervisor
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DecisionAction {
    Approve,
    Deny,
    Modify,
    Defer,
}

/// Action to take when approval times out
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TimeoutAction {
    Deny,
    Approve,
    Pause,
}

impl Default for TimeoutAction {
    fn default() -> Self {
        Self::Deny
    }
}

// =============================================================================
// Agent Types
// =============================================================================

/// Runtime state of an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeState {
    /// Unique identifier
    pub id: String,
    /// Agent name
    pub name: String,
    /// Agent description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// System prompt for the agent
    pub system_prompt: String,
    /// Model to use
    pub model: String,
    /// Current status
    pub status: AgentStatus,
    /// Configuration
    #[serde(default)]
    pub config: AgentConfig,
    /// Current step being executed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_step: Option<StepExecution>,
    /// History of executed steps
    #[serde(default)]
    pub step_history: Vec<StepExecution>,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Creation timestamp
    pub created_at: u64,
    /// Last activity timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_at: Option<u64>,
    /// Parent workflow ID if spawned by a workflow
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    /// Parent node ID if spawned by a node
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
}

impl AgentRuntimeState {
    pub fn new(name: &str, system_prompt: &str, model: &str) -> Self {
        Self {
            id: String::new(),
            name: name.to_string(),
            description: None,
            system_prompt: system_prompt.to_string(),
            model: model.to_string(),
            status: AgentStatus::Idle,
            config: AgentConfig::default(),
            current_step: None,
            step_history: Vec::new(),
            error: None,
            created_at: Self::now_ms(),
            last_active_at: None,
            workflow_id: None,
            node_id: None,
        }
    }

    fn now_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    }
}

/// Agent configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    /// Temperature for AI model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Maximum tokens for response
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// Tools available to this agent
    #[serde(default)]
    pub tools: Vec<String>,
    /// Maximum steps before stopping
    #[serde(default = "default_max_steps")]
    pub max_steps: u32,
    /// Timeout per step in milliseconds
    #[serde(default = "default_step_timeout")]
    pub step_timeout_ms: u64,
}

fn default_max_steps() -> u32 {
    100
}

fn default_step_timeout() -> u64 {
    60000 // 1 minute
}

/// Agent status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Idle,
    Running,
    Paused,
    WaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

impl Default for AgentStatus {
    fn default() -> Self {
        Self::Idle
    }
}

/// A step execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StepExecution {
    /// Step number (1-indexed)
    pub step_number: u32,
    /// Type of step
    pub step_type: StepType,
    /// Step description/summary
    pub description: String,
    /// Input to the step
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input: Option<serde_json::Value>,
    /// Output from the step
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    /// Status of this step
    pub status: StepStatus,
    /// Error if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Start timestamp
    pub started_at: u64,
    /// End timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<u64>,
    /// Duration in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

/// Types of steps
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StepType {
    Thinking,
    ToolCall,
    FileRead,
    FileWrite,
    ShellExec,
    HttpRequest,
    WaitApproval,
    UserMessage,
    AssistantMessage,
}

/// Status of a step
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
    Cancelled,
}

// =============================================================================
// Audit Types
// =============================================================================

/// An audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    /// Unique identifier
    pub id: String,
    /// Timestamp
    pub timestamp: u64,
    /// Event type
    pub event_type: AuditEventType,
    /// Actor (user ID, agent ID, or "system")
    pub actor: String,
    /// Target resource (workflow ID, agent ID, etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    /// Action performed
    pub action: String,
    /// Detailed description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Additional metadata
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
    /// Risk level if applicable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_level: Option<RiskLevel>,
    /// Result of the action
    pub result: AuditResult,
    /// Associated workflow ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    /// Associated execution ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    /// Associated agent ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
}

/// Types of audit events
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    WorkflowCreated,
    WorkflowUpdated,
    WorkflowDeleted,
    WorkflowStarted,
    WorkflowCompleted,
    WorkflowFailed,
    WorkflowPaused,
    WorkflowResumed,
    AgentSpawned,
    AgentCompleted,
    AgentFailed,
    StepExecuted,
    InterceptionTriggered,
    ApprovalRequested,
    ApprovalGranted,
    ApprovalDenied,
    ApprovalModified,
    ApprovalTimeout,
    FileAccess,
    ShellExecution,
    ToolExecution,
    Error,
    Warning,
    Info,
}

/// Result of an audited action
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuditResult {
    Success,
    Failure,
    Pending,
    Cancelled,
}

impl Default for AuditResult {
    fn default() -> Self {
        Self::Success
    }
}

/// Filter for querying audit entries
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditFilter {
    /// Filter by event type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub event_types: Option<Vec<AuditEventType>>,
    /// Filter by actor
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
    /// Filter by workflow ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    /// Filter by execution ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    /// Filter by agent ID
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    /// Filter by risk level (minimum)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_risk_level: Option<RiskLevel>,
    /// Filter by time range start
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_timestamp: Option<u64>,
    /// Filter by time range end
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to_timestamp: Option<u64>,
    /// Maximum number of results
    #[serde(default = "default_limit")]
    pub limit: usize,
    /// Offset for pagination
    #[serde(default)]
    pub offset: usize,
}

fn default_limit() -> usize {
    100
}

// =============================================================================
// Execution Types
// =============================================================================

/// State of a workflow execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionState {
    /// Execution ID
    pub id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Current status
    pub status: ExecutionStatus,
    /// Start timestamp
    pub started_at: u64,
    /// End timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<u64>,
    /// Current node being executed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_node: Option<String>,
    /// Nodes that have been executed
    #[serde(default)]
    pub executed_nodes: Vec<NodeExecutionResult>,
    /// Variables during execution
    #[serde(default)]
    pub variables: HashMap<String, serde_json::Value>,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Agents spawned during execution
    #[serde(default)]
    pub spawned_agents: Vec<String>,
    /// Pending approvals
    #[serde(default)]
    pub pending_approvals: Vec<String>,
}

/// Result of executing a single node
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeExecutionResult {
    /// Node ID
    pub node_id: String,
    /// Status
    pub status: ExecutionStatus,
    /// Start timestamp
    pub started_at: u64,
    /// End timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<u64>,
    /// Output from the node
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
    /// Error if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Retries attempted
    #[serde(default)]
    pub retries: u32,
}

/// Status of a workflow execution
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Paused,
    WaitingApproval,
    Completed,
    Failed,
    Cancelled,
}

impl Default for ExecutionStatus {
    fn default() -> Self {
        Self::Pending
    }
}

// =============================================================================
// Approval Types
// =============================================================================

/// A pending approval request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingApproval {
    /// Approval ID
    pub id: String,
    /// Execution ID this approval is for
    pub execution_id: String,
    /// Node ID that triggered this approval
    pub node_id: String,
    /// Agent ID if triggered by an agent
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    /// Description of what needs approval
    pub description: String,
    /// Detailed context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    /// The action that needs approval
    pub action_type: InterceptionActionType,
    /// Parameters of the action
    pub action_params: serde_json::Value,
    /// Risk level assessment
    pub risk_level: RiskLevel,
    /// Rules that triggered this approval
    #[serde(default)]
    pub triggered_rules: Vec<String>,
    /// When this approval was requested
    pub requested_at: u64,
    /// When this approval expires
    pub expires_at: u64,
    /// Current status
    pub status: ApprovalStatus,
    /// Decision if made
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<SupervisorDecision>,
}

/// Status of an approval request
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Denied,
    Modified,
    Expired,
    Cancelled,
}

impl Default for ApprovalStatus {
    fn default() -> Self {
        Self::Pending
    }
}

// =============================================================================
// Export/Import Types
// =============================================================================

/// Workflow export format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowExport {
    /// Format version
    pub format_version: String,
    /// Export timestamp
    pub exported_at: u64,
    /// The workflow
    pub workflow: Workflow,
    /// Associated interception rules
    #[serde(default)]
    pub interception_rules: Vec<InterceptionRule>,
    /// Checksum for integrity
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checksum: Option<String>,
}

impl WorkflowExport {
    pub fn new(workflow: Workflow) -> Self {
        Self {
            format_version: "1.0".to_string(),
            exported_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
            workflow,
            interception_rules: Vec::new(),
            checksum: None,
        }
    }
}
