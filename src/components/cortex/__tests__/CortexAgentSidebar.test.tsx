import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@solidjs/testing-library";
import { CortexAgentSidebar } from "../CortexAgentSidebar";
import type { Agent } from "../CortexAgentSidebar";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
  emit: vi.fn().mockResolvedValue(undefined),
  once: vi.fn(),
}));

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: { icon: string; size?: number; onClick?: (e: MouseEvent) => void }) => (
    <button data-testid={`icon-btn-${props.icon}`} onClick={props.onClick}>
      {props.icon}
    </button>
  ),
}));

vi.mock("../vibe/AgentItem", () => ({
  AgentItem: (props: { name: string; status: string; isExpanded: boolean; onToggle: () => void }) => (
    <div data-testid={`agent-${props.name}`} data-status={props.status} data-expanded={props.isExpanded}>
      <button data-testid={`agent-toggle-${props.name}`} onClick={props.onToggle}>
        {props.name}
      </button>
      <span data-testid={`agent-status-${props.name}`}>{props.status}</span>
    </div>
  ),
}));

vi.mock("../vibe/ConversationItem", () => ({
  ConversationItem: (props: { title: string; changesCount?: number; isSelected: boolean; onClick: () => void }) => (
    <div
      data-testid={`conversation-${props.title}`}
      data-selected={props.isSelected}
      onClick={props.onClick}
    >
      <span>{props.title}</span>
      {props.changesCount !== undefined && <span data-testid={`changes-count-${props.title}`}>{props.changesCount}</span>}
    </div>
  ),
}));

const flushAsync = () => new Promise(r => setTimeout(r, 0));

describe("CortexAgentSidebar", () => {
  beforeEach(() => {
    vi.mocked(listen).mockResolvedValue(vi.fn());
  });

  afterEach(async () => {
    await flushAsync();
    cleanup();
    await flushAsync();
  });

  const createAgent = (overrides: Partial<Agent> = {}): Agent => ({
    id: "agent-1",
    name: "Agent 1",
    branch: "feature/task-1",
    status: "running",
    conversations: [
      { id: "conv-1", title: "Build UI", status: "active", changesCount: 3 },
    ],
    isExpanded: true,
    ...overrides,
  });

  const createAgents = (): Agent[] => [
    createAgent({
      id: "agent-1",
      name: "Agent 1",
      branch: "feature/task-1",
      status: "running",
      conversations: [
        { id: "conv-1", title: "Build UI", status: "active", changesCount: 3 },
        { id: "conv-2", title: "Fix bugs", status: "completed", changesCount: 1 },
      ],
      isExpanded: true,
    }),
    createAgent({
      id: "agent-2",
      name: "Agent 2",
      branch: "feature/task-2",
      status: "idle",
      conversations: [
        { id: "conv-3", title: "Add tests", status: "active" },
      ],
      isExpanded: false,
    }),
    createAgent({
      id: "agent-3",
      name: "Agent 3",
      branch: "feature/task-3",
      status: "completed",
      conversations: [],
      isExpanded: false,
    }),
  ];

  describe("Renders agent list", () => {
    it("should render all agents", () => {
      const agents = createAgents();
      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-Agent 1")).toBeTruthy();
      expect(getByTestId("agent-Agent 2")).toBeTruthy();
      expect(getByTestId("agent-Agent 3")).toBeTruthy();
    });

    it("should render agent names", () => {
      const agents = createAgents();
      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(container.textContent).toContain("Agent 1");
      expect(container.textContent).toContain("Agent 2");
      expect(container.textContent).toContain("Agent 3");
    });

    it("should render branch names for each agent", () => {
      const agents = createAgents();
      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(container.textContent).toContain("feature/task-1");
      expect(container.textContent).toContain("feature/task-2");
      expect(container.textContent).toContain("feature/task-3");
    });

    it("should render conversations for expanded agents", () => {
      const agents = createAgents();
      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("conversation-Build UI")).toBeTruthy();
      expect(getByTestId("conversation-Fix bugs")).toBeTruthy();
    });

    it("should not render conversations for collapsed agents", () => {
      const agents = createAgents();
      const { queryByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(queryByTestId("conversation-Add tests")).toBeNull();
    });

    it("should render empty state when no agents", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} />
      ));

      expect(container.querySelector("[data-testid^='agent-']")).toBeNull();
    });

    it("should render project name in header", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} projectName="My Project" />
      ));

      expect(container.textContent).toContain("My Project");
    });

    it("should render 'Home' when no project name", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} />
      ));

      expect(container.textContent).toContain("Home");
    });

    it("should render New workspace button", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} />
      ));

      expect(container.textContent).toContain("New workspace");
    });

    it("should render search button", () => {
      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={[]} />
      ));

      expect(getByTestId("icon-btn-search")).toBeTruthy();
    });
  });

  describe("Agent selection", () => {
    it("should call onConversationSelect when conversation is clicked", async () => {
      const onConversationSelect = vi.fn();
      const agents = [createAgent({ isExpanded: true })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} onConversationSelect={onConversationSelect} />
      ));

      await fireEvent.click(getByTestId("conversation-Build UI"));
      expect(onConversationSelect).toHaveBeenCalledWith("agent-1", "conv-1");
    });

    it("should highlight selected conversation", () => {
      const agents = [createAgent({ isExpanded: true })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} selectedConversationId="conv-1" />
      ));

      const conv = getByTestId("conversation-Build UI");
      expect(conv.getAttribute("data-selected")).toBe("true");
    });

    it("should not highlight unselected conversations", () => {
      const agents = [createAgent({
        isExpanded: true,
        conversations: [
          { id: "conv-1", title: "Build UI", status: "active" },
          { id: "conv-2", title: "Fix bugs", status: "completed" },
        ],
      })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} selectedConversationId="conv-1" />
      ));

      const unselected = getByTestId("conversation-Fix bugs");
      expect(unselected.getAttribute("data-selected")).toBe("false");
    });

    it("should call onAgentToggle when agent is toggled", async () => {
      const onAgentToggle = vi.fn();
      const agents = [createAgent()];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} onAgentToggle={onAgentToggle} />
      ));

      await fireEvent.click(getByTestId("agent-toggle-Agent 1"));
      expect(onAgentToggle).toHaveBeenCalledWith("agent-1");
    });

    it("should call onSearch when search button is clicked", async () => {
      const onSearch = vi.fn();

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={[]} onSearch={onSearch} />
      ));

      await fireEvent.click(getByTestId("icon-btn-search"));
      expect(onSearch).toHaveBeenCalled();
    });
  });

  describe("Agent status display", () => {
    it("should display running status", () => {
      const agents = [createAgent({ status: "running" })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-status-Agent 1").textContent).toBe("running");
    });

    it("should display idle status", () => {
      const agents = [createAgent({ status: "idle", name: "IdleAgent" })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-status-IdleAgent").textContent).toBe("idle");
    });

    it("should display completed status", () => {
      const agents = [createAgent({ status: "completed", name: "DoneAgent" })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-status-DoneAgent").textContent).toBe("completed");
    });

    it("should display error status", () => {
      const agents = [createAgent({ status: "error", name: "ErrorAgent" })];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-status-ErrorAgent").textContent).toBe("error");
    });

    it("should pass expanded state to AgentItem", () => {
      const agents = [
        createAgent({ name: "Expanded", isExpanded: true }),
        createAgent({ id: "agent-2", name: "Collapsed", isExpanded: false }),
      ];

      const { getByTestId } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(getByTestId("agent-Expanded").getAttribute("data-expanded")).toBe("true");
      expect(getByTestId("agent-Collapsed").getAttribute("data-expanded")).toBe("false");
    });

    it("should display progress bar for running agent with progress", () => {
      const agents = [createAgent({ status: "running", progress: 50, isExpanded: true })];

      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      const progressBar = container.querySelector("[style*='width: 50%']") || container.querySelector("[style*='width:50%']");
      expect(progressBar).toBeTruthy();
    });

    it("should display current task text", () => {
      const agents = [createAgent({ currentTask: "Analyzing codebase...", isExpanded: true })];

      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(container.textContent).toContain("Analyzing codebase...");
    });

    it("should display tool calls", () => {
      const agents = [createAgent({ toolCalls: ["read_file", "write_file"], isExpanded: true })];

      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(container.textContent).toContain("read_file");
      expect(container.textContent).toContain("write_file");
    });

    it("should show assign task link for expanded agents", () => {
      const agents = [createAgent({ isExpanded: true })];

      const { container } = render(() => (
        <CortexAgentSidebar agents={agents} />
      ));

      expect(container.textContent).toContain("Assign task");
    });
  });

  describe("Styling", () => {
    it("should apply custom class", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} class="custom-sidebar" />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.className).toContain("custom-sidebar");
    });

    it("should apply custom style", () => {
      const { container } = render(() => (
        <CortexAgentSidebar agents={[]} style={{ "background-color": "blue" }} />
      ));

      const root = container.firstChild as HTMLElement;
      expect(root?.style.backgroundColor).toBe("blue");
    });
  });
});
