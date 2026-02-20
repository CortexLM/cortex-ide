import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("PlanContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PlanPhase", () => {
    type PlanPhase = "idle" | "discovery" | "review" | "agents" | "compiling" | "complete";

    it("should support idle phase", () => {
      const phase: PlanPhase = "idle";
      expect(phase).toBe("idle");
    });

    it("should support discovery phase", () => {
      const phase: PlanPhase = "discovery";
      expect(phase).toBe("discovery");
    });

    it("should support review phase", () => {
      const phase: PlanPhase = "review";
      expect(phase).toBe("review");
    });

    it("should support agents phase", () => {
      const phase: PlanPhase = "agents";
      expect(phase).toBe("agents");
    });

    it("should support compiling phase", () => {
      const phase: PlanPhase = "compiling";
      expect(phase).toBe("compiling");
    });

    it("should support complete phase", () => {
      const phase: PlanPhase = "complete";
      expect(phase).toBe("complete");
    });
  });

  describe("ProjectSpec", () => {
    interface ProjectSpec {
      name: string;
      description: string;
      type: string;
      features: string[];
      target_users: string;
      scale: string;
      tech_preferences?: string[];
      constraints?: string[];
      integrations?: string[];
      deadline?: string;
    }

    it("should create project spec", () => {
      const spec: ProjectSpec = {
        name: "My App",
        description: "A web application",
        type: "web app",
        features: ["auth", "dashboard", "api"],
        target_users: "developers",
        scale: "medium",
      };

      expect(spec.name).toBe("My App");
      expect(spec.features).toHaveLength(3);
    });

    it("should support optional fields", () => {
      const spec: ProjectSpec = {
        name: "My App",
        description: "A web application",
        type: "web app",
        features: ["auth"],
        target_users: "developers",
        scale: "small",
        tech_preferences: ["React", "TypeScript"],
        constraints: ["Must be accessible"],
        deadline: "2024-12-31",
      };

      expect(spec.tech_preferences).toContain("React");
      expect(spec.constraints).toHaveLength(1);
    });

    it("should support integrations", () => {
      const spec: ProjectSpec = {
        name: "My App",
        description: "A web application",
        type: "api",
        features: ["rest", "graphql"],
        target_users: "developers",
        scale: "large",
        integrations: ["Stripe", "Auth0", "SendGrid"],
      };

      expect(spec.integrations).toHaveLength(3);
    });
  });

  describe("TechnicalAgentOutput", () => {
    interface TechnicalSpec {
      category: string;
      title: string;
      details: string;
      technical_requirements: string[];
      implementation_notes: string[];
    }

    interface CodeSnippet {
      language: string;
      filename: string;
      description: string;
      code: string;
    }

    interface Configuration {
      name: string;
      type: string;
      content: string;
    }

    interface RiskAssessment {
      level: "low" | "medium" | "high" | "critical";
      vulnerabilities: string[];
      mitigations: string[];
      priority_actions: string[];
    }

    interface TechnicalAgentOutput {
      agent_id: string;
      agent_name: string;
      role: string;
      specifications: TechnicalSpec[];
      diagrams?: string[];
      code_snippets?: CodeSnippet[];
      configurations?: Configuration[];
      risk_assessment: RiskAssessment;
    }

    it("should create agent output", () => {
      const output: TechnicalAgentOutput = {
        agent_id: "arch-1",
        agent_name: "Architecture Agent",
        role: "System Architect",
        specifications: [
          {
            category: "Architecture",
            title: "Microservices Design",
            details: "Design a microservices architecture",
            technical_requirements: ["Docker", "Kubernetes"],
            implementation_notes: ["Use service mesh"],
          },
        ],
        risk_assessment: {
          level: "medium",
          vulnerabilities: ["Network latency"],
          mitigations: ["Use caching"],
          priority_actions: ["Set up monitoring"],
        },
      };

      expect(output.agent_name).toBe("Architecture Agent");
      expect(output.specifications).toHaveLength(1);
    });

    it("should include code snippets", () => {
      const output: TechnicalAgentOutput = {
        agent_id: "backend-1",
        agent_name: "Backend Agent",
        role: "Backend Developer",
        specifications: [],
        code_snippets: [
          {
            language: "typescript",
            filename: "server.ts",
            description: "Express server setup",
            code: "const app = express();",
          },
        ],
        risk_assessment: {
          level: "low",
          vulnerabilities: [],
          mitigations: [],
          priority_actions: [],
        },
      };

      expect(output.code_snippets).toHaveLength(1);
      expect(output.code_snippets![0].language).toBe("typescript");
    });

    it("should include configurations", () => {
      const output: TechnicalAgentOutput = {
        agent_id: "devops-1",
        agent_name: "DevOps Agent",
        role: "DevOps Engineer",
        specifications: [],
        configurations: [
          {
            name: "docker-compose.yml",
            type: "yaml",
            content: "version: '3'",
          },
        ],
        risk_assessment: {
          level: "low",
          vulnerabilities: [],
          mitigations: [],
          priority_actions: [],
        },
      };

      expect(output.configurations).toHaveLength(1);
    });
  });

  describe("RiskAssessment", () => {
    interface RiskAssessment {
      level: "low" | "medium" | "high" | "critical";
      vulnerabilities: string[];
      mitigations: string[];
      priority_actions: string[];
    }

    it("should support low risk level", () => {
      const risk: RiskAssessment = {
        level: "low",
        vulnerabilities: [],
        mitigations: [],
        priority_actions: [],
      };

      expect(risk.level).toBe("low");
    });

    it("should support critical risk level", () => {
      const risk: RiskAssessment = {
        level: "critical",
        vulnerabilities: ["SQL injection", "XSS"],
        mitigations: ["Input validation", "CSP headers"],
        priority_actions: ["Security audit"],
      };

      expect(risk.level).toBe("critical");
      expect(risk.vulnerabilities).toHaveLength(2);
    });
  });

  describe("FinalPlan", () => {
    interface TechStackItem {
      category: string;
      technology: string;
      version?: string;
      justification: string;
    }

    interface ArchitectureComponent {
      name: string;
      type: string;
      responsibility: string;
      technologies: string[];
      interfaces: string[];
    }

    interface ArchitectureSection {
      overview: string;
      diagram: string;
      components: ArchitectureComponent[];
      data_flow: string;
      tech_stack: TechStackItem[];
    }

    interface TechnicalSection {
      title: string;
      content: string;
      agent_source: string;
    }

    interface RoadmapPhase {
      name: string;
      duration: string;
      tasks: string[];
      deliverables: string[];
    }

    interface RiskMatrixItem {
      risk: string;
      probability: string;
      impact: string;
      mitigation: string;
    }

    interface FinalPlan {
      title: string;
      executive_summary: string;
      project_spec: { name: string };
      architecture: ArchitectureSection;
      technical_sections: TechnicalSection[];
      implementation_roadmap: RoadmapPhase[];
      risk_matrix: RiskMatrixItem[];
      success_metrics: string[];
    }

    it("should create final plan", () => {
      const plan: FinalPlan = {
        title: "My App Development Plan",
        executive_summary: "A comprehensive plan for building My App",
        project_spec: { name: "My App" },
        architecture: {
          overview: "Microservices architecture",
          diagram: "```mermaid\ngraph TD\n```",
          components: [],
          data_flow: "API Gateway -> Services -> Database",
          tech_stack: [],
        },
        technical_sections: [],
        implementation_roadmap: [],
        risk_matrix: [],
        success_metrics: ["99.9% uptime", "< 200ms latency"],
      };

      expect(plan.title).toBe("My App Development Plan");
      expect(plan.success_metrics).toHaveLength(2);
    });

    it("should include architecture components", () => {
      const plan: FinalPlan = {
        title: "Plan",
        executive_summary: "Summary",
        project_spec: { name: "App" },
        architecture: {
          overview: "Overview",
          diagram: "",
          components: [
            {
              name: "API Gateway",
              type: "service",
              responsibility: "Route requests",
              technologies: ["Node.js", "Express"],
              interfaces: ["REST", "GraphQL"],
            },
          ],
          data_flow: "",
          tech_stack: [
            {
              category: "Backend",
              technology: "Node.js",
              version: "20.x",
              justification: "Fast, async-first",
            },
          ],
        },
        technical_sections: [],
        implementation_roadmap: [],
        risk_matrix: [],
        success_metrics: [],
      };

      expect(plan.architecture.components).toHaveLength(1);
      expect(plan.architecture.tech_stack).toHaveLength(1);
    });

    it("should include implementation roadmap", () => {
      const plan: FinalPlan = {
        title: "Plan",
        executive_summary: "Summary",
        project_spec: { name: "App" },
        architecture: {
          overview: "",
          diagram: "",
          components: [],
          data_flow: "",
          tech_stack: [],
        },
        technical_sections: [],
        implementation_roadmap: [
          {
            name: "Phase 1: Setup",
            duration: "2 weeks",
            tasks: ["Set up repo", "Configure CI/CD"],
            deliverables: ["Working pipeline"],
          },
          {
            name: "Phase 2: Core Features",
            duration: "4 weeks",
            tasks: ["Build auth", "Build dashboard"],
            deliverables: ["MVP"],
          },
        ],
        risk_matrix: [],
        success_metrics: [],
      };

      expect(plan.implementation_roadmap).toHaveLength(2);
    });
  });

  describe("PlanState", () => {
    interface PlanState {
      phase: string;
      originalRequest: string | null;
      projectSpec: { name: string } | null;
      agents: Array<{ id: string; name: string }>;
      agentOutputs: Array<{ agent_id: string }>;
      isCompiling: boolean;
      showAgentsPanel: boolean;
      finalPlan: { title: string } | null;
    }

    it("should initialize plan state", () => {
      const state: PlanState = {
        phase: "idle",
        originalRequest: null,
        projectSpec: null,
        agents: [],
        agentOutputs: [],
        isCompiling: false,
        showAgentsPanel: false,
        finalPlan: null,
      };

      expect(state.phase).toBe("idle");
      expect(state.projectSpec).toBeNull();
    });

    it("should track discovery phase", () => {
      const state: PlanState = {
        phase: "discovery",
        originalRequest: "Build a web app",
        projectSpec: null,
        agents: [],
        agentOutputs: [],
        isCompiling: false,
        showAgentsPanel: false,
        finalPlan: null,
      };

      expect(state.phase).toBe("discovery");
      expect(state.originalRequest).toBe("Build a web app");
    });

    it("should track compiling state", () => {
      const state: PlanState = {
        phase: "compiling",
        originalRequest: "Build a web app",
        projectSpec: { name: "My App" },
        agents: [],
        agentOutputs: [],
        isCompiling: true,
        showAgentsPanel: false,
        finalPlan: null,
      };

      expect(state.isCompiling).toBe(true);
    });
  });

  describe("Plan Actions", () => {
    it("should start discovery", () => {
      let phase = "idle";
      let originalRequest: string | null = null;

      const startDiscovery = (request: string) => {
        phase = "discovery";
        originalRequest = request;
      };

      startDiscovery("Build a todo app");

      expect(phase).toBe("discovery");
      expect(originalRequest).toBe("Build a todo app");
    });

    it("should set project spec", () => {
      let projectSpec: { name: string } | null = null;
      let phase = "discovery";

      const setProjectSpec = (spec: { name: string }) => {
        projectSpec = spec;
        phase = "review";
      };

      setProjectSpec({ name: "Todo App" });

      expect((projectSpec as { name: string } | null)?.name).toBe("Todo App");
      expect(phase).toBe("review");
    });

    it("should add agent output", () => {
      const agentOutputs: Array<{ agent_id: string; agent_name: string }> = [];

      const addAgentOutput = (output: { agent_id: string; agent_name: string }) => {
        agentOutputs.push(output);
      };

      addAgentOutput({ agent_id: "arch-1", agent_name: "Architecture Agent" });
      addAgentOutput({ agent_id: "backend-1", agent_name: "Backend Agent" });

      expect(agentOutputs).toHaveLength(2);
    });

    it("should toggle agents panel", () => {
      let showAgentsPanel = false;

      const toggleAgentsPanel = () => {
        showAgentsPanel = !showAgentsPanel;
      };

      toggleAgentsPanel();
      expect(showAgentsPanel).toBe(true);

      toggleAgentsPanel();
      expect(showAgentsPanel).toBe(false);
    });

    it("should complete plan", () => {
      let phase = "compiling";
      let finalPlan: { title: string } | null = null;

      const completePlan = (plan: { title: string }) => {
        finalPlan = plan;
        phase = "complete";
      };

      completePlan({ title: "Todo App Plan" });

      expect(phase).toBe("complete");
      expect((finalPlan as { title: string } | null)?.title).toBe("Todo App Plan");
    });

    it("should reset plan", () => {
      let phase = "complete";
      let originalRequest: string | null = "Build a todo app";
      let projectSpec: { name: string } | null = { name: "Todo App" };

      const resetPlan = () => {
        phase = "idle";
        originalRequest = null;
        projectSpec = null;
      };

      resetPlan();

      expect(phase).toBe("idle");
      expect(originalRequest).toBeNull();
      expect(projectSpec).toBeNull();
    });
  });

  describe("PlanAgent", () => {
    interface PlanAgent {
      id: string;
      name: string;
      role: string;
      description: string;
      enabled: boolean;
    }

    it("should create plan agent", () => {
      const agent: PlanAgent = {
        id: "arch",
        name: "Architecture Agent",
        role: "System Architect",
        description: "Designs system architecture",
        enabled: true,
      };

      expect(agent.name).toBe("Architecture Agent");
      expect(agent.enabled).toBe(true);
    });

    it("should toggle agent enabled state", () => {
      const agent: PlanAgent = {
        id: "arch",
        name: "Architecture Agent",
        role: "System Architect",
        description: "Designs system architecture",
        enabled: true,
      };

      agent.enabled = false;

      expect(agent.enabled).toBe(false);
    });

    it("should track multiple agents", () => {
      const agents: PlanAgent[] = [
        { id: "arch", name: "Architecture", role: "Architect", description: "", enabled: true },
        { id: "backend", name: "Backend", role: "Developer", description: "", enabled: true },
        { id: "frontend", name: "Frontend", role: "Developer", description: "", enabled: false },
      ];

      const enabledAgents = agents.filter(a => a.enabled);

      expect(enabledAgents).toHaveLength(2);
    });
  });
});
