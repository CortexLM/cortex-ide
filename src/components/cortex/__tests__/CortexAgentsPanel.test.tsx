import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@solidjs/testing-library";
import { invoke } from "@tauri-apps/api/core";
import { CortexAgentsPanel } from "../CortexAgentsPanel";
import type { SubAgent, SubAgentStatus } from "@/types";

vi.mock("../primitives/CortexIcon", () => ({
  CortexIcon: (props: { name: string; size?: number; color?: string }) => (
    <span data-testid={`icon-${props.name}`} data-size={props.size} />
  ),
}));

vi.mock("../primitives/CortexIconButton", () => ({
  CortexIconButton: (props: {
    icon: string;
    size?: number;
    onClick?: () => void;
    title?: string;
  }) => (
    <button
      data-testid={`icon-btn-${props.icon}`}
      onClick={props.onClick}
      title={props.title}
    />
  ),
}));

const mockInvoke = vi.mocked(invoke);

const createAgent = (
  overrides: Partial<SubAgent> = {}
): SubAgent => ({
  id: "agent-1",
  name: "Coder",
  description: "Writes code",
  status: "idle" as SubAgentStatus,
  systemPrompt: "You are a coding assistant.",
  ...overrides,
});

describe("CortexAgentsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockInvoke.mockResolvedValue(undefined as never);
  });

  describe("Rendering", () => {
    it("should render the panel header", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("AI Agents");
      });
      expect(container.querySelector('[data-testid="icon-users"]')).toBeTruthy();
    });

    it("should render template buttons", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Templates");
      });
      expect(container.textContent).toContain("Coder");
      expect(container.textContent).toContain("Reviewer");
      expect(container.textContent).toContain("Researcher");
      expect(container.textContent).toContain("Tester");
    });

    it("should render empty state when no agents", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("No agents spawned yet");
      });
    });

    it("should render refresh button", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        const refreshBtn = container.querySelector(
          '[data-testid="icon-btn-refresh-cw"]'
        );
        expect(refreshBtn).toBeTruthy();
      });
    });
  });

  describe("Agent List", () => {
    it("should render agents returned from agent_list", async () => {
      const agents: SubAgent[] = [
        createAgent({ id: "a1", name: "Agent Alpha", status: "running" }),
        createAgent({ id: "a2", name: "Agent Beta", status: "idle" }),
        createAgent({ id: "a3", name: "Agent Gamma", status: "completed" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Agent Alpha");
        expect(container.textContent).toContain("Agent Beta");
        expect(container.textContent).toContain("Agent Gamma");
      });
    });

    it("should display agent count in section header", async () => {
      const agents = [
        createAgent({ id: "a1", name: "One" }),
        createAgent({ id: "a2", name: "Two" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Agents (2)");
      });
    });
  });

  describe("Agent Selection", () => {
    it("should select an agent when clicked", async () => {
      const agents = [
        createAgent({ id: "a1", name: "Agent Alpha", status: "idle" }),
        createAgent({ id: "a2", name: "Agent Beta", status: "running" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Agent Alpha");
      });

      const agentButtons = container.querySelectorAll(
        'button[style*="text-align: left"]'
      );
      const agentBtns = Array.from(agentButtons).filter(
        (b) =>
          b.textContent?.includes("Agent Alpha") ||
          b.textContent?.includes("Agent Beta")
      );

      expect(agentBtns.length).toBeGreaterThanOrEqual(2);

      await fireEvent.click(agentBtns[0]);

      await waitFor(() => {
        expect(container.textContent).toContain("Configuration");
      });
    });

    it("should show configuration section for selected agent", async () => {
      const agents = [
        createAgent({
          id: "a1",
          name: "My Agent",
          systemPrompt: "Be helpful",
          status: "idle",
        }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("My Agent");
      });

      const agentBtns = Array.from(
        container.querySelectorAll('button[style*="text-align: left"]')
      ).filter((b) => b.textContent?.includes("My Agent"));

      await fireEvent.click(agentBtns[0]);

      await waitFor(() => {
        expect(container.textContent).toContain("Configuration");
        expect(container.textContent).toContain("Name");
        expect(container.textContent).toContain("System Prompt");
        expect(container.textContent).toContain("Run Task");
      });
    });
  });

  describe("Agent Status Indicators", () => {
    it("should display correct status labels", async () => {
      const agents: SubAgent[] = [
        createAgent({ id: "a1", name: "Runner", status: "running" }),
        createAgent({ id: "a2", name: "Idler", status: "idle" }),
        createAgent({ id: "a3", name: "Completer", status: "completed" }),
        createAgent({ id: "a4", name: "Failer", status: "failed" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Running");
        expect(container.textContent).toContain("Idle");
        expect(container.textContent).toContain("Done");
        expect(container.textContent).toContain("Failed");
      });
    });

    it("should render status indicator dots with correct colors", async () => {
      const agents: SubAgent[] = [
        createAgent({ id: "a1", name: "Runner", status: "running" }),
        createAgent({ id: "a2", name: "Failer", status: "failed" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Runner");
      });

      const dots = container.querySelectorAll(
        'div[style*="border-radius: 50%"][style*="width: 8px"]'
      );
      expect(dots.length).toBe(2);

      const runningDot = dots[0] as HTMLElement;
      const failedDot = dots[1] as HTMLElement;
      expect(runningDot.style.background).toMatch(/(#B2FF22|rgb\(178,\s*255,\s*34\))/i);
      expect(failedDot.style.background).toMatch(/(#EF4444|rgb\(239,\s*68,\s*68\))/i);
    });

    it("should render status badge with correct color styling", async () => {
      const agents: SubAgent[] = [
        createAgent({ id: "a1", name: "Runner", status: "running" }),
      ];
      mockInvoke.mockResolvedValueOnce(agents as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        const badge = Array.from(container.querySelectorAll("span")).find(
          (s) => s.textContent === "Running"
        );
        expect(badge).toBeTruthy();
        expect(badge!.style.color).toMatch(/(#B2FF22|rgb\(178,\s*255,\s*34\))/i);
      });
    });
  });

  describe("Create Agent Actions", () => {
    it("should call agent_spawn when a template is clicked", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const spawnedAgent = createAgent({
        id: "new-agent",
        name: "Coder",
        status: "idle",
      });
      mockInvoke.mockResolvedValueOnce(spawnedAgent as never);
      mockInvoke.mockResolvedValueOnce([spawnedAgent] as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Coder");
      });

      const templateButtons = Array.from(
        container.querySelectorAll("button")
      ).filter(
        (b) =>
          b.textContent?.includes("Coder") &&
          b.textContent?.includes("Writes and refactors code")
      );

      expect(templateButtons.length).toBeGreaterThanOrEqual(1);
      await fireEvent.click(templateButtons[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("agent_spawn", {
          name: "Coder",
          systemPrompt:
            "You are a coding assistant. Write clean, well-tested code.",
          parentId: null,
        });
      });
    });

    it("should show error message when spawn fails", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      mockInvoke.mockRejectedValueOnce(
        new Error("Spawn failed") as never
      );

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Coder");
      });

      const templateButtons = Array.from(
        container.querySelectorAll("button")
      ).filter(
        (b) =>
          b.textContent?.includes("Coder") &&
          b.textContent?.includes("Writes and refactors code")
      );

      await fireEvent.click(templateButtons[0]);

      await waitFor(() => {
        expect(container.textContent).toContain("Error: Spawn failed");
      });
    });
  });

  describe("Configure Agent Actions", () => {
    it("should call agent_run_task when Run button is clicked", async () => {
      const agent = createAgent({
        id: "a1",
        name: "Test Agent",
        status: "idle",
      });
      mockInvoke.mockResolvedValueOnce([agent] as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Test Agent");
      });

      const agentBtns = Array.from(
        container.querySelectorAll('button[style*="text-align: left"]')
      ).filter((b) => b.textContent?.includes("Test Agent"));
      await fireEvent.click(agentBtns[0]);

      await waitFor(() => {
        expect(container.textContent).toContain("Run Task");
      });

      const input = container.querySelector(
        'input[placeholder="Enter a task prompt..."]'
      ) as HTMLInputElement;
      expect(input).toBeTruthy();

      await fireEvent.input(input, { target: { value: "Fix the bug" } });

      mockInvoke.mockResolvedValueOnce(undefined as never);
      mockInvoke.mockResolvedValueOnce([agent] as never);

      const runBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "Run"
      );
      expect(runBtn).toBeTruthy();
      await fireEvent.click(runBtn!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("agent_run_task", {
          agentId: "a1",
          prompt: "Fix the bug",
          context: [],
        });
      });
    });

    it("should disable Run button when task prompt is empty", async () => {
      const agent = createAgent({ id: "a1", name: "Agent", status: "idle" });
      mockInvoke.mockResolvedValueOnce([agent] as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Agent");
      });

      const agentBtns = Array.from(
        container.querySelectorAll('button[style*="text-align: left"]')
      ).filter((b) => b.textContent?.includes("Agent"));
      await fireEvent.click(agentBtns[0]);

      await waitFor(() => {
        const runBtn = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent === "Run"
        );
        expect(runBtn).toBeTruthy();
        expect(runBtn!.disabled).toBe(true);
      });
    });

    it("should call fetchAgents when refresh button is clicked", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);

      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("AI Agents");
      });

      mockInvoke.mockResolvedValueOnce([] as never);

      const refreshBtn = container.querySelector(
        '[data-testid="icon-btn-refresh-cw"]'
      );
      expect(refreshBtn).toBeTruthy();
      await fireEvent.click(refreshBtn!);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("agent_list");
        expect(mockInvoke).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Template Descriptions", () => {
    it("should render template descriptions", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Writes and refactors code");
        expect(container.textContent).toContain("Reviews code for issues");
        expect(container.textContent).toContain("Researches documentation");
        expect(container.textContent).toContain("Writes and runs tests");
      });
    });
  });

  describe("Section Toggling", () => {
    it("should toggle templates section when header is clicked", async () => {
      mockInvoke.mockResolvedValueOnce([] as never);
      const { container } = render(() => <CortexAgentsPanel />);

      await waitFor(() => {
        expect(container.textContent).toContain("Coder");
      });

      const sectionHeaders = Array.from(
        container.querySelectorAll('div[style*="cursor: pointer"]')
      ).filter((el) => el.textContent?.includes("Templates"));

      expect(sectionHeaders.length).toBeGreaterThanOrEqual(1);
      await fireEvent.click(sectionHeaders[0]);

      expect(container.textContent).not.toContain(
        "Writes and refactors code"
      );
    });
  });
});
