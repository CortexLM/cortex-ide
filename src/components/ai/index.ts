// Existing exports
export { ChatEditingMode, ChatEditingModeCompact, useChatEditingMode } from "./ChatEditingMode";
export { ContextServerPanel, ContextServerSelector } from "./ContextServerPanel";
export { CopilotStatusIndicator, CopilotSignInModal, CopilotSettingsPanel, useCopilotCompletions } from "./CopilotStatus";
export { useEditPredictions, EditPredictionOverlay, PredictionStatusIndicator } from "./EditPredictions";
export { InlineAssistant, InlineAssistantManager, useInlineAssistant } from "./InlineAssistant";
export { LLMSelector, ModelChip } from "./LLMSelector";
export { PromptEditor } from "./PromptEditor";
export { PromptStore } from "./PromptStore";
export { QuickChat, useQuickChat } from "./QuickChat";
export { RulesEditor } from "./RulesEditor";
export { RulesLibraryPanel, RulesSelector, RulesStatusBadge } from "./RulesLibrary";
export { SlashCommandPicker, useSlashCommands, type SlashCommand } from "./SlashCommands";
export { 
  SlashCommandMenu, 
  useSlashCommandMenu, 
  SLASH_COMMANDS,
  type SlashCommand as SlashMenuCommand,
  type SlashCommandArgument,
  type SlashCommandMenuProps,
} from "./SlashCommandMenu";
export { SupermavenStatus, SupermavenStatusIndicator, CompletionPreview } from "./SupermavenStatus";
export { ACPToolsPanel, ACPToolSelector } from "./ACPToolsPanel";
export { ThreadList, type Thread, type Message, type ThreadListProps } from "./ThreadList";
export { SubAgentStatus, SubAgentStatusCompact } from "./SubAgentStatus";
export type { SubAgentStatusProps, SubAgentStatusCompactProps, SubAgent, AgentTask, AgentStatus } from "./SubAgentStatus";
export { MessageInput, type MessageInputProps, type MessageContext, type Attachment } from "./MessageInput";
export { CodeBlock, InlineCode, type CodeBlockProps, type InlineCodeProps } from "./CodeBlock";
export { MarkdownContent, type MarkdownContentProps } from "./MarkdownContent";
export { MessageView, DateSeparator, type MessageViewProps, type DateSeparatorProps } from "./MessageView";
export { MessageList, SimpleMessageList, type MessageListProps, type SimpleMessageListProps } from "./MessageList";
export { AgentPanel } from "./AgentPanel";
export { SubagentsDialog, type SubagentsDialogProps } from "./SubagentsDialog";
export { SubAgentManager } from "./SubAgentManager";
export {
  AgentActivityFeed,
  AgentActivityFeedCompact,
  type AgentActivityFeedProps,
  type AgentActivityFeedCompactProps,
  type SessionSummary,
} from "./AgentActivityFeed";
export {
  ActionEntry,
  type ActionEntryProps,
  type AgentAction,
  type AgentActionType,
  type ActionStatus,
  type ActionData,
  type FileReadData,
  type FileEditData,
  type FileCreateData,
  type FileDeleteData,
  type TerminalCommandData,
  type TerminalOutputData,
  type ThinkingData,
  type ToolStartData,
  type ToolCompleteData,
  type ToolErrorData,
} from "./ActionEntry";
