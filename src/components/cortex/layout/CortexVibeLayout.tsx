import { CortexAgentSidebar, Agent } from "@/components/cortex/CortexAgentSidebar";
import { CortexChangesPanel, FileChange } from "@/components/cortex/CortexChangesPanel";
import { CortexConversationView, Message } from "@/components/cortex/CortexConversationView";

export interface CortexVibeLayoutProps {
  projectName: string;
  agents: Agent[];
  selectedConversationId: string | null;
  selectedAgentId: string | null;
  vibeMessages: Message[];
  fileChanges: FileChange[];
  terminalOutput: string[];
  chatInput: string;
  isProcessing: boolean;
  modelName: string;
  onConversationSelect: (agentId: string, convId: string) => void;
  onAgentToggle: (agentId: string) => void;
  onNewWorkspace: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onFileSelect: (path: string) => void;
  onRunCommand: (cmd: string) => void;
  onRun: () => void;
}

export function CortexVibeLayout(props: CortexVibeLayoutProps) {
  return (
    <>
      <CortexAgentSidebar
        projectName={props.projectName}
        agents={props.agents}
        selectedConversationId={props.selectedConversationId ?? undefined}
        onConversationSelect={props.onConversationSelect}
        onAgentToggle={props.onAgentToggle}
        onNewWorkspace={props.onNewWorkspace}
      />

      <div style={{
        flex: "1",
        display: "flex",
        background: "var(--cortex-bg-secondary)",
        border: "1px solid var(--cortex-border-default)",
        "border-radius": "var(--cortex-radius-xl)",
        overflow: "hidden",
        "min-width": "0",
      }}>
        <CortexConversationView
          conversationTitle={
            props.agents.flatMap(a => a.conversations).find(c => c.id === props.selectedConversationId)?.title || "New Conversation"
          }
          branchName={props.agents.find(a => a.id === props.selectedAgentId)?.branch}
          status={props.isProcessing ? "in_progress" : undefined}
          messages={props.vibeMessages}
          inputValue={props.chatInput}
          onInputChange={props.onInputChange}
          onSubmit={props.onSubmit}
          isProcessing={props.isProcessing}
          modelName={props.modelName}
        />

        <CortexChangesPanel
          changes={props.fileChanges}
          terminalOutput={props.terminalOutput}
          branchName={props.projectName}
          onFileClick={props.onFileSelect}
          onRunCommand={props.onRunCommand}
          onRun={props.onRun}
        />
      </div>
    </>
  );
}
