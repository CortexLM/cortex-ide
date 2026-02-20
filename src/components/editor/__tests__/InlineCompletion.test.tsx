/**
 * InlineCompletion Tests
 *
 * Tests for the inline AI completion ghost text component.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@/test/utils";
import { InlineCompletion } from "../InlineCompletion";

vi.mock("@/hooks/useInlineCompletions", () => ({
  useInlineCompletions: () => ({
    status: () => ({ provider: "test", enabled: true }),
    isLoading: () => false,
    isActive: () => false,
    completionCount: () => 0,
    currentIndex: () => 0,
    registerWithMonaco: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    registerKeybindings: vi.fn().mockReturnValue([]),
    getEditorOptions: vi.fn().mockReturnValue({}),
    configure: vi.fn(),
  }),
}));

describe("InlineCompletion", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Component Definition", () => {
    it("should be defined and be a function", () => {
      expect(InlineCompletion).toBeDefined();
      expect(typeof InlineCompletion).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render without crashing with null editor and monaco", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });

    it("should render without crashing with enabled prop", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} enabled={true} />
        ));
      }).not.toThrow();
    });

    it("should render without crashing with disabled prop", () => {
      expect(() => {
        render(() => (
          <InlineCompletion editor={null} monaco={null} enabled={false} />
        ));
      }).not.toThrow();
    });
  });

  describe("Exports", () => {
    it("should export InlineCompletion as a function component", () => {
      expect(typeof InlineCompletion).toBe("function");
      expect(InlineCompletion.length).toBeGreaterThanOrEqual(0);
    });
  });
});
