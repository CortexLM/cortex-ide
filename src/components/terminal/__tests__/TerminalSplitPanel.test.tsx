/**
 * TerminalSplitPanel Tests
 *
 * Tests for the integrated terminal split container component.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { TerminalSplitPanel, type TerminalSplitPanelProps } from "../TerminalSplitPanel";

vi.mock("@/context/TerminalsContext", () => ({
  useTerminals: () => ({
    state: {
      terminals: [],
      groups: [],
      activeTerminalId: null,
      activeGroupId: null,
    },
    createTerminal: vi.fn().mockResolvedValue({ id: "term-1", name: "Terminal 1" }),
    closeTerminal: vi.fn(),
    setActiveTerminal: vi.fn(),
    sendInterrupt: vi.fn(),
    getGroupForTerminal: vi.fn().mockReturnValue(undefined),
    splitTerminalInGroup: vi.fn(),
    setGroupSplitRatios: vi.fn(),
    removeFromGroup: vi.fn(),
    setActiveGroup: vi.fn(),
  }),
}));

vi.mock("../TerminalSplitView", () => ({
  TerminalSplitView: (_props: Record<string, unknown>) => (
    <div data-testid="terminal-split-view" />
  ),
  SplitButton: (_props: Record<string, unknown>) => (
    <button data-testid="split-button">Split</button>
  ),
}));

vi.mock("../../ui/Icon", () => ({
  Icon: (props: { name: string; size?: number; style?: any }) => (
    <span data-testid={`icon-${props.name}`} />
  ),
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    spacing: { xs: "4px", sm: "8px", md: "12px", lg: "16px" },
    colors: {
      surface: { panel: "#2b2b2b", canvas: "#1e1e1e" },
      border: { default: "#323232" },
      text: { primary: "#bababa", muted: "#808080" },
      icon: { default: "#808080" },
      interactive: { hover: "#3c3f41" },
      accent: { primary: "#4a88c7" },
      semantic: { success: "#4caf50", error: "#f44336" },
    },
    radius: { sm: "2px", md: "4px" },
  },
}));

describe("TerminalSplitPanel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps: TerminalSplitPanelProps = {
    getTerminalContainer: vi.fn().mockReturnValue(null),
    onInitializeTerminal: vi.fn(),
    onDisposeTerminal: vi.fn(),
  };

  describe("Component Definition", () => {
    it("should be defined", () => {
      expect(TerminalSplitPanel).toBeDefined();
    });

    it("should be a function", () => {
      expect(typeof TerminalSplitPanel).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      expect(() => {
        render(() => <TerminalSplitPanel {...defaultProps} />);
      }).not.toThrow();
    });

    it("should render with optional props", () => {
      expect(() => {
        render(() => (
          <TerminalSplitPanel
            {...defaultProps}
            onClosePanel={vi.fn()}
            isFocused={() => true}
          />
        ));
      }).not.toThrow();
    });
  });

  describe("Props", () => {
    it("should accept getTerminalContainer prop", () => {
      const getContainer = vi.fn().mockReturnValue(null);
      expect(() => {
        render(() => (
          <TerminalSplitPanel {...defaultProps} getTerminalContainer={getContainer} />
        ));
      }).not.toThrow();
    });

    it("should accept onInitializeTerminal prop", () => {
      const initFn = vi.fn();
      expect(() => {
        render(() => (
          <TerminalSplitPanel {...defaultProps} onInitializeTerminal={initFn} />
        ));
      }).not.toThrow();
    });

    it("should accept onDisposeTerminal prop", () => {
      const disposeFn = vi.fn();
      expect(() => {
        render(() => (
          <TerminalSplitPanel {...defaultProps} onDisposeTerminal={disposeFn} />
        ));
      }).not.toThrow();
    });
  });
});
