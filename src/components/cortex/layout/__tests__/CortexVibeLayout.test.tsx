import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";
import type { CortexVibeLayoutProps } from "../CortexVibeLayout";
import type { Agent } from "@/components/cortex/CortexAgentSidebar";
import type { FileChange } from "@/components/cortex/CortexChangesPanel";
import type { Message } from "@/components/cortex/CortexConversationView";

let capturedAgentSidebarProps: Record<string, unknown> = {};
let capturedConversationViewProps: Record<string, unknown> = {};
let capturedChangesPanelProps: Record<string, unknown> = {};

vi.mock("@/components/cortex/CortexAgentSidebar", () => ({
  CortexAgentSidebar: (props: Record<string, unknown>) => {
    capturedAgentSidebarProps = props;
    return <div data-testid="agent-sidebar" />;
  },
}));

vi.mock("@/components/cortex/CortexConversationView", () => ({
  CortexConversationView: (props: Record<string, unknown>) => {
    capturedConversationViewProps = props;
    return <div data-testid="conversation-view" />;
  },
}));

vi.mock("@/components/cortex/CortexChangesPanel", () => ({
  CortexChangesPanel: (props: Record<string, unknown>) => {
    capturedChangesPanelProps = props;
    return <div data-testid="changes-panel" />;
  },
}));

function createAgents(): Agent[] {
  return [
    {
      id: "agent-1",
      name: "Coder",
      branch: "feature/auth",
      status: "running",
      conversations: [
        { id: "conv-1", title: "Auth Implementation", status: "active", changesCount: 3 },
        { id: "conv-2", title: "Tests", status: "completed", changesCount: 1 },
      ],
    },
    {
      id: "agent-2",
      name: "Reviewer",
      branch: "review/auth",
      status: "idle",
      conversations: [
        { id: "conv-3", title: "Code Review", status: "active" },
      ],
    },
  ];
}

function createMessages(): Message[] {
  return [
    { id: "msg-1", role: "user", content: "Implement auth" },
    { id: "msg-2", role: "assistant", content: "Working on it..." },
  ];
}

function createFileChanges(): FileChange[] {
  return [
    { path: "src/auth.ts", additions: 50, deletions: 10, status: "modified" },
    { path: "src/login.ts", additions: 100, deletions: 0, status: "added" },
  ];
}

function createDefaultProps(overrides: Partial<CortexVibeLayoutProps> = {}): CortexVibeLayoutProps {
  return {
    projectName: "my-project",
    agents: createAgents(),
    selectedConversationId: "conv-1",
    selectedAgentId: "agent-1",
    vibeMessages: createMessages(),
    fileChanges: createFileChanges(),
    terminalOutput: ["$ npm test", "All tests passed"],
    chatInput: "",
    isProcessing: false,
    modelName: "claude-4",
    onConversationSelect: vi.fn(),
    onAgentToggle: vi.fn(),
    onNewWorkspace: vi.fn(),
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    onFileSelect: vi.fn(),
    onRunCommand: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };
}

describe("CortexVibeLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    capturedAgentSidebarProps = {};
    capturedConversationViewProps = {};
    capturedChangesPanelProps = {};
  });

  describe("Rendering", () => {
    it("should render AgentSidebar", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexVibeLayout {...props} />);
      expect(container.querySelector('[data-testid="agent-sidebar"]')).toBeTruthy();
    });

    it("should render ConversationView", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexVibeLayout {...props} />);
      expect(container.querySelector('[data-testid="conversation-view"]')).toBeTruthy();
    });

    it("should render ChangesPanel", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexVibeLayout {...props} />);
      expect(container.querySelector('[data-testid="changes-panel"]')).toBeTruthy();
    });

    it("should render all three sections simultaneously", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps();
      const { container } = render(() => <CortexVibeLayout {...props} />);
      expect(container.querySelector('[data-testid="agent-sidebar"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="conversation-view"]')).toBeTruthy();
      expect(container.querySelector('[data-testid="changes-panel"]')).toBeTruthy();
    });
  });

  describe("Props Passing — CortexAgentSidebar", () => {
    it("should pass projectName", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ projectName: "cortex-ide" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.projectName).toBe("cortex-ide");
    });

    it("should pass agents array", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const agents = createAgents();
      const props = createDefaultProps({ agents });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.agents).toBe(agents);
    });

    it("should pass selectedConversationId or undefined when null", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedConversationId: null });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.selectedConversationId).toBeUndefined();
    });

    it("should pass selectedConversationId when provided", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedConversationId: "conv-2" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.selectedConversationId).toBe("conv-2");
    });

    it("should pass onConversationSelect callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onConversationSelect = vi.fn();
      const props = createDefaultProps({ onConversationSelect });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.onConversationSelect).toBe(onConversationSelect);
    });

    it("should pass onAgentToggle callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onAgentToggle = vi.fn();
      const props = createDefaultProps({ onAgentToggle });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.onAgentToggle).toBe(onAgentToggle);
    });

    it("should pass onNewWorkspace callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onNewWorkspace = vi.fn();
      const props = createDefaultProps({ onNewWorkspace });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedAgentSidebarProps.onNewWorkspace).toBe(onNewWorkspace);
    });
  });

  describe("Props Passing — CortexConversationView", () => {
    it("should derive conversationTitle from matching conversation", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedConversationId: "conv-1" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.conversationTitle).toBe("Auth Implementation");
    });

    it("should use 'New Conversation' when no matching conversation found", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedConversationId: "nonexistent" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.conversationTitle).toBe("New Conversation");
    });

    it("should use 'New Conversation' when selectedConversationId is null", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedConversationId: null });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.conversationTitle).toBe("New Conversation");
    });

    it("should derive branchName from selected agent", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedAgentId: "agent-1" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.branchName).toBe("feature/auth");
    });

    it("should pass undefined branchName when no agent matches", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ selectedAgentId: "nonexistent" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.branchName).toBeUndefined();
    });

    it("should pass 'in_progress' status when isProcessing is true", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ isProcessing: true });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.status).toBe("in_progress");
    });

    it("should pass undefined status when isProcessing is false", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ isProcessing: false });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.status).toBeUndefined();
    });

    it("should pass vibeMessages as messages", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const messages = createMessages();
      const props = createDefaultProps({ vibeMessages: messages });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.messages).toBe(messages);
    });

    it("should pass chatInput as inputValue", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ chatInput: "hello world" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.inputValue).toBe("hello world");
    });

    it("should pass onInputChange callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onInputChange = vi.fn();
      const props = createDefaultProps({ onInputChange });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.onInputChange).toBe(onInputChange);
    });

    it("should pass onSubmit callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onSubmit = vi.fn();
      const props = createDefaultProps({ onSubmit });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.onSubmit).toBe(onSubmit);
    });

    it("should pass isProcessing", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ isProcessing: true });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.isProcessing).toBe(true);
    });

    it("should pass modelName", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ modelName: "gpt-4o" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedConversationViewProps.modelName).toBe("gpt-4o");
    });
  });

  describe("Props Passing — CortexChangesPanel", () => {
    it("should pass fileChanges as changes", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const fileChanges = createFileChanges();
      const props = createDefaultProps({ fileChanges });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.changes).toBe(fileChanges);
    });

    it("should pass terminalOutput", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const terminalOutput = ["$ build", "Done"];
      const props = createDefaultProps({ terminalOutput });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.terminalOutput).toBe(terminalOutput);
    });

    it("should pass projectName as branchName", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const props = createDefaultProps({ projectName: "cortex-ide" });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.branchName).toBe("cortex-ide");
    });

    it("should pass onFileSelect as onFileClick", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onFileSelect = vi.fn();
      const props = createDefaultProps({ onFileSelect });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.onFileClick).toBe(onFileSelect);
    });

    it("should pass onRunCommand callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onRunCommand = vi.fn();
      const props = createDefaultProps({ onRunCommand });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.onRunCommand).toBe(onRunCommand);
    });

    it("should pass onRun callback", async () => {
      const { CortexVibeLayout } = await import("../CortexVibeLayout");
      const onRun = vi.fn();
      const props = createDefaultProps({ onRun });
      render(() => <CortexVibeLayout {...props} />);
      expect(capturedChangesPanelProps.onRun).toBe(onRun);
    });
  });
});
