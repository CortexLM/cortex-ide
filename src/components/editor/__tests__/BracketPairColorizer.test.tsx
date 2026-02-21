/**
 * BracketPairColorizer Tests
 *
 * Tests for the bracket pair colorization configuration component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  cleanup,
  createMockMonaco,
  createMockMonacoEditor,
} from "@/test/utils";
import { BracketPairColorizer } from "../BracketPairColorizer";

describe("BracketPairColorizer", () => {
  let mockEditor: ReturnType<typeof createMockMonacoEditor>;
  let mockMonaco: ReturnType<typeof createMockMonaco>;

  beforeEach(() => {
    mockEditor = createMockMonacoEditor();
    mockMonaco = createMockMonaco();

    (mockEditor as any).updateOptions = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should return null (renderless component)", () => {
      const { container } = render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect(container.innerHTML).toBe("");
    });

    it("should not throw when editor is null", () => {
      expect(() => {
        render(() => (
          <BracketPairColorizer editor={null} monaco={null} />
        ));
      }).not.toThrow();
    });
  });

  describe("Colorization Options", () => {
    it("should apply bracket pair colorization when enabled", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={true}
        />
      ));

      expect((mockEditor as any).updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          bracketPairColorization: expect.objectContaining({
            enabled: true,
          }),
        })
      );
    });

    it("should disable bracket pair colorization when disabled", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={false}
        />
      ));

      expect((mockEditor as any).updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          bracketPairColorization: expect.objectContaining({
            enabled: false,
          }),
        })
      );
    });

    it("should enable guides when colorization is enabled", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={true}
        />
      ));

      expect((mockEditor as any).updateOptions).toHaveBeenCalledWith(
        expect.objectContaining({
          guides: expect.objectContaining({
            bracketPairs: true,
            highlightActiveBracketPair: true,
          }),
        })
      );
    });
  });

  describe("Custom Colors", () => {
    it("should define theme with custom colors", () => {
      const customColors = ["#ff0000", "#00ff00", "#0000ff"];

      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={true}
          colors={customColors}
        />
      ));

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
        "cortex-dark-brackets",
        expect.objectContaining({
          base: "vs-dark",
          inherit: true,
          rules: expect.arrayContaining([
            expect.objectContaining({ token: "bracket.depth1", foreground: "ff0000" }),
            expect.objectContaining({ token: "bracket.depth2", foreground: "00ff00" }),
            expect.objectContaining({ token: "bracket.depth3", foreground: "0000ff" }),
          ]),
        })
      );
    });

    it("should not define theme when disabled", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={false}
          colors={["#ff0000"]}
        />
      ));

      expect(mockMonaco.editor.defineTheme).not.toHaveBeenCalled();
    });
  });

  describe("Event Listener", () => {
    it("should listen for editor-toggle-bracket-colorizer event", () => {
      const addEventSpy = vi.spyOn(window, "addEventListener");

      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
        />
      ));

      expect(addEventSpy).toHaveBeenCalledWith(
        "editor:toggle-bracket-colorizer",
        expect.any(Function)
      );

      addEventSpy.mockRestore();
    });

    it("should re-apply options on toggle event", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={true}
        />
      ));

      (mockEditor as any).updateOptions.mockClear();

      window.dispatchEvent(new Event("editor:toggle-bracket-colorizer"));

      expect((mockEditor as any).updateOptions).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing monaco gracefully", () => {
      expect(() => {
        render(() => (
          <BracketPairColorizer
            editor={mockEditor as any}
            monaco={null}
          />
        ));
      }).not.toThrow();
    });

    it("should use default colors when none provided", () => {
      render(() => (
        <BracketPairColorizer
          editor={mockEditor as any}
          monaco={mockMonaco as any}
          enabled={true}
        />
      ));

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
        "cortex-dark-brackets",
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ token: "bracket.depth1" }),
          ]),
        })
      );
    });
  });
});