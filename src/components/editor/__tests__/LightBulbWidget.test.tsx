/**
 * LightBulbWidget Tests
 *
 * Tests for the code actions light bulb indicator component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  createMockMonaco,
  createMockMonacoEditor,
} from "@/test/utils";
import {
  LightBulbWidget,
  triggerLightBulb,
  refreshLightBulb,
} from "../LightBulbWidget";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ actions: [] }),
}));

describe("LightBulbWidget", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();

    (mockEditor as any).onDidScrollChange = vi.fn().mockReturnValue({ dispose: vi.fn() });
    (mockEditor as any).onDidChangeModel = vi.fn().mockReturnValue({ dispose: vi.fn() });

    mockEditor.getLayoutInfo = vi.fn().mockReturnValue({
      width: 800,
      height: 600,
      contentWidth: 780,
      contentHeight: 580,
      glyphMarginLeft: 0,
    });

    (mockMonaco.editor as any).getModelMarkers = vi.fn().mockReturnValue([]);

    const model = mockEditor.getModel();
    (model as any).getLanguageId = vi.fn().mockReturnValue("typescript");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Component Definition", () => {
    it("should be defined and be a function", () => {
      expect(LightBulbWidget).toBeDefined();
      expect(typeof LightBulbWidget).toBe("function");
    });
  });

  describe("Rendering", () => {
    it("should render without crashing with null editor and monaco", () => {
      expect(() => {
        render(() => (
          <LightBulbWidget editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });

    it("should render without crashing with valid editor and monaco", () => {
      expect(() => {
        render(() => (
          <LightBulbWidget
            editor={mockEditor as any}
            monaco={mockMonaco as any}
            uri="file:///test.ts"
          />
        ));
      }).not.toThrow();
    });

    it("should not show lightbulb when no code actions available (editor is null)", () => {
      const { container } = render(() => (
        <LightBulbWidget editor={null} monaco={null} />
      ));

      const lightbulb = container.querySelector(".lightbulb-widget");
      expect(lightbulb).toBeFalsy();
    });
  });

  describe("Event Dispatchers", () => {
    it("triggerLightBulb should dispatch lightbulb:trigger custom event", () => {
      const handler = vi.fn();
      window.addEventListener("lightbulb:trigger", handler);

      triggerLightBulb();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(CustomEvent));

      window.removeEventListener("lightbulb:trigger", handler);
    });

    it("refreshLightBulb should dispatch lightbulb:refresh custom event", () => {
      const handler = vi.fn();
      window.addEventListener("lightbulb:refresh", handler);

      refreshLightBulb();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(expect.any(CustomEvent));

      window.removeEventListener("lightbulb:refresh", handler);
    });
  });
});
