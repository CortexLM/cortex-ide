use std::fmt;
use std::path::PathBuf;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ConversationId(Uuid);

impl ConversationId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn from_string(s: &str) -> Result<Self, uuid::Error> {
        Ok(Self(Uuid::parse_str(s)?))
    }

    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl Default for ConversationId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for ConversationId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for ConversationId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_string(s)
    }
}

impl From<Uuid> for ConversationId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

impl From<ConversationId> for Uuid {
    fn from(id: ConversationId) -> Self {
        id.0
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AskForApproval {
    #[serde(rename = "untrusted")]
    UnlessTrusted,
    OnFailure,
    #[default]
    OnRequest,
    Never,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReviewDecision {
    Approved,
    ApprovedForSession,
    #[default]
    Denied,
    Abort,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningEffort {
    Low,
    #[default]
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReasoningSummary {
    #[default]
    None,
    Brief,
    Detailed,
    Auto,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum SandboxPolicy {
    #[serde(rename = "danger-full-access")]
    DangerFullAccess,
    #[serde(rename = "read-only")]
    ReadOnly,
    #[serde(rename = "workspace-write")]
    WorkspaceWrite {
        #[serde(default, skip_serializing_if = "Vec::is_empty")]
        writable_roots: Vec<PathBuf>,
        #[serde(default)]
        network_access: bool,
        #[serde(default)]
        exclude_tmpdir_env_var: bool,
        #[serde(default)]
        exclude_slash_tmp: bool,
    },
}

impl Default for SandboxPolicy {
    fn default() -> Self {
        Self::WorkspaceWrite {
            writable_roots: vec![],
            network_access: false,
            exclude_tmpdir_env_var: false,
            exclude_slash_tmp: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UserInput {
    Text {
        text: String,
    },
    Image {
        data: String,
        media_type: String,
    },
    ImageUrl {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<String>,
    },
    File {
        path: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        content: Option<String>,
    },
}

impl UserInput {
    pub fn text(text: impl Into<String>) -> Self {
        Self::Text { text: text.into() }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    pub id: String,
    pub op: Op,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
#[non_exhaustive]
pub enum Op {
    Interrupt,
    UserInput {
        items: Vec<UserInput>,
    },
    UserTurn {
        items: Vec<UserInput>,
        cwd: PathBuf,
        approval_policy: AskForApproval,
        sandbox_policy: SandboxPolicy,
        model: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        effort: Option<ReasoningEffort>,
        summary: ReasoningSummary,
        final_output_json_schema: Option<serde_json::Value>,
    },
    OverrideTurnContext {
        #[serde(skip_serializing_if = "Option::is_none")]
        cwd: Option<PathBuf>,
        #[serde(skip_serializing_if = "Option::is_none")]
        approval_policy: Option<AskForApproval>,
        #[serde(skip_serializing_if = "Option::is_none")]
        sandbox_policy: Option<SandboxPolicy>,
        #[serde(skip_serializing_if = "Option::is_none")]
        model: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        effort: Option<Option<ReasoningEffort>>,
        #[serde(skip_serializing_if = "Option::is_none")]
        summary: Option<ReasoningSummary>,
    },
    ExecApproval {
        id: String,
        decision: ReviewDecision,
    },
    PatchApproval {
        id: String,
        decision: ReviewDecision,
    },
    ResolveElicitation {
        server_name: String,
        request_id: String,
        decision: ElicitationAction,
    },
    AddToHistory {
        text: String,
    },
    GetHistoryEntryRequest {
        offset: usize,
        log_id: u64,
    },
    ListMcpTools,
    ReloadMcpServers,
    EnableMcpServer {
        name: String,
    },
    DisableMcpServer {
        name: String,
    },
    ListCustomPrompts,
    Compact,
    Undo,
    Redo,
    ForkSession {
        #[serde(skip_serializing_if = "Option::is_none")]
        fork_point_message_id: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        message_index: Option<usize>,
    },
    GetSessionTimeline,
    Review {
        review_request: serde_json::Value,
    },
    Shutdown,
    SwitchAgent {
        name: String,
    },
    RunUserShellCommand {
        command: String,
    },
    Share,
    Unshare,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ElicitationAction {
    Approve,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub msg: EventMsg,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
#[non_exhaustive]
pub enum EventMsg {
    SessionConfigured(Box<SessionConfiguredEvent>),
    TaskStarted(TaskStartedEvent),
    TaskComplete(TaskCompleteEvent),
    TurnAborted(TurnAbortedEvent),
    ShutdownComplete,

    AgentMessage(AgentMessageEvent),
    AgentMessageDelta(AgentMessageDeltaEvent),
    UserMessage(UserMessageEvent),

    AgentReasoning(AgentReasoningEvent),
    AgentReasoningDelta(AgentReasoningDeltaEvent),
    AgentReasoningRawContent(AgentReasoningRawContentEvent),
    AgentReasoningRawContentDelta(AgentReasoningRawContentDeltaEvent),
    AgentReasoningSectionBreak(AgentReasoningSectionBreakEvent),

    ExecCommandBegin(ExecCommandBeginEvent),
    ExecCommandOutputDelta(ExecCommandOutputDeltaEvent),
    ExecCommandEnd(Box<ExecCommandEndEvent>),

    ExecApprovalRequest(ExecApprovalRequestEvent),
    ApplyPatchApprovalRequest(serde_json::Value),
    ElicitationRequest(serde_json::Value),

    McpToolCallBegin(serde_json::Value),
    McpToolCallEnd(serde_json::Value),
    McpStartupUpdate(serde_json::Value),
    McpStartupComplete(serde_json::Value),
    McpListToolsResponse(Box<serde_json::Value>),

    PatchApplyBegin(serde_json::Value),
    PatchApplyEnd(serde_json::Value),

    TokenCount(TokenCountEvent),

    Error(ErrorEvent),
    Warning(WarningEvent),
    StreamError(serde_json::Value),

    TurnDiff(serde_json::Value),
    GetHistoryEntryResponse(serde_json::Value),
    ListCustomPromptsResponse(serde_json::Value),
    BackgroundEvent(serde_json::Value),

    UndoStarted(serde_json::Value),
    UndoCompleted(serde_json::Value),

    RedoStarted(serde_json::Value),
    RedoCompleted(serde_json::Value),

    EnteredReviewMode(serde_json::Value),
    ExitedReviewMode(serde_json::Value),

    SessionForked(serde_json::Value),
    TimelineUpdated(serde_json::Value),

    DeprecationNotice(serde_json::Value),

    WebSearchBegin(serde_json::Value),
    WebSearchEnd(serde_json::Value),

    ViewImageToolCall(serde_json::Value),

    PlanUpdate(serde_json::Value),

    SessionShared(serde_json::Value),
    SessionUnshared(serde_json::Value),

    ItemStarted(serde_json::Value),
    ItemCompleted(serde_json::Value),
    AgentMessageContentDelta(serde_json::Value),
    ReasoningContentDelta(serde_json::Value),
    ReasoningRawContentDelta(serde_json::Value),
    RawResponseItem(serde_json::Value),

    MessageWithPartsCreated(serde_json::Value),
    MessageWithPartsCompleted(serde_json::Value),
    PartUpdated(serde_json::Value),
    PartRemoved(serde_json::Value),
    PartDelta(serde_json::Value),

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfiguredEvent {
    pub session_id: ConversationId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<ConversationId>,
    pub model: String,
    #[serde(default)]
    pub model_provider_id: String,
    pub approval_policy: AskForApproval,
    pub sandbox_policy: SandboxPolicy,
    pub cwd: PathBuf,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_effort: Option<ReasoningEffort>,
    #[serde(default)]
    pub history_log_id: u64,
    #[serde(default)]
    pub history_entry_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_messages: Option<Vec<EventMsg>>,
    #[serde(default)]
    pub rollout_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskStartedEvent {
    pub model_context_window: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskCompleteEvent {
    pub last_agent_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TurnAbortedEvent {
    pub reason: TurnAbortReason,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TurnAbortReason {
    Interrupted,
    Replaced,
    ReviewEnded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEvent {
    pub message: String,
    #[serde(default)]
    pub cortex_error_info: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarningEvent {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessageEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessageDeltaEvent {
    pub delta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessageEvent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReasoningEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReasoningDeltaEvent {
    pub delta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReasoningRawContentEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReasoningRawContentDeltaEvent {
    pub delta: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentReasoningSectionBreakEvent {
    #[serde(default)]
    pub item_id: String,
    #[serde(default)]
    pub summary_index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecCommandBeginEvent {
    pub call_id: String,
    #[serde(default)]
    pub turn_id: String,
    #[serde(default)]
    pub command: Vec<String>,
    #[serde(default)]
    pub cwd: PathBuf,
    #[serde(default)]
    pub parsed_cmd: Vec<ParsedCommand>,
    #[serde(default)]
    pub source: ExecCommandSource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interaction_input: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_arguments: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedCommand {
    pub program: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExecCommandSource {
    #[default]
    Agent,
    UserShell,
    UnifiedExecStartup,
    UnifiedExecInteraction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ExecOutputStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecCommandOutputDeltaEvent {
    pub call_id: String,
    pub stream: ExecOutputStream,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecCommandEndEvent {
    pub call_id: String,
    #[serde(default)]
    pub turn_id: String,
    pub command: Vec<String>,
    #[serde(default)]
    pub cwd: PathBuf,
    #[serde(default)]
    pub parsed_cmd: Vec<ParsedCommand>,
    #[serde(default)]
    pub source: ExecCommandSource,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub interaction_input: Option<String>,
    #[serde(default)]
    pub stdout: String,
    #[serde(default)]
    pub stderr: String,
    #[serde(default)]
    pub aggregated_output: String,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub formatted_output: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecApprovalRequestEvent {
    pub call_id: String,
    #[serde(default)]
    pub turn_id: String,
    pub command: Vec<String>,
    pub cwd: PathBuf,
    #[serde(default)]
    pub sandbox_assessment: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenCountEvent {
    pub info: Option<TokenUsageInfo>,
    pub rate_limits: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsageInfo {
    pub total_token_usage: TokenUsage,
    pub last_token_usage: TokenUsage,
    pub model_context_window: Option<i64>,
    #[serde(default)]
    pub context_tokens: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: i64,
    pub cached_input_tokens: i64,
    pub output_tokens: i64,
    pub reasoning_output_tokens: i64,
    pub total_tokens: i64,
}
