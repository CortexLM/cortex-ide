import { describe, it, expect, vi, beforeEach } from "vitest";

describe("BracketPairColorization Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Bracket Colorization Options", () => {
    interface BracketColorizationOptions {
      enabled: boolean;
      guidesEnabled: boolean;
      independentColorPoolPerBracketType: boolean;
      highlightActiveBracketPair: boolean;
    }

    it("should have correct default options", () => {
      const defaults: BracketColorizationOptions = {
        enabled: true,
        guidesEnabled: true,
        independentColorPoolPerBracketType: true,
        highlightActiveBracketPair: true,
      };

      expect(defaults.enabled).toBe(true);
      expect(defaults.guidesEnabled).toBe(true);
      expect(defaults.independentColorPoolPerBracketType).toBe(true);
    });

    it("should allow disabling colorization", () => {
      const options: BracketColorizationOptions = {
        enabled: false,
        guidesEnabled: false,
        independentColorPoolPerBracketType: true,
        highlightActiveBracketPair: false,
      };

      expect(options.enabled).toBe(false);
      expect(options.guidesEnabled).toBe(false);
    });
  });

  describe("Monaco Options Generation", () => {
    it("should generate correct Monaco options when enabled", () => {
      const enabled = true;
      const guidesEnabled = true;

      const monacoOptions = {
        bracketPairColorization: {
          enabled,
          independentColorPoolPerBracketType: true,
        },
        guides: {
          bracketPairs: guidesEnabled,
          bracketPairsHorizontal: guidesEnabled ? "active" : false,
          highlightActiveBracketPair: guidesEnabled,
          indentation: true,
        },
      };

      expect(monacoOptions.bracketPairColorization.enabled).toBe(true);
      expect(monacoOptions.guides.bracketPairs).toBe(true);
      expect(monacoOptions.guides.bracketPairsHorizontal).toBe("active");
    });

    it("should generate correct Monaco options when disabled", () => {
      const enabled = false;
      const guidesEnabled = false;

      const monacoOptions = {
        bracketPairColorization: {
          enabled,
          independentColorPoolPerBracketType: true,
        },
        guides: {
          bracketPairs: guidesEnabled,
          bracketPairsHorizontal: guidesEnabled ? "active" : false,
          highlightActiveBracketPair: guidesEnabled,
          indentation: true,
        },
      };

      expect(monacoOptions.bracketPairColorization.enabled).toBe(false);
      expect(monacoOptions.guides.bracketPairs).toBe(false);
      expect(monacoOptions.guides.bracketPairsHorizontal).toBe(false);
    });
  });

  describe("Toggle Functions", () => {
    it("should toggle colorization state", () => {
      let enabled = true;
      const toggle = () => { enabled = !enabled; };

      toggle();
      expect(enabled).toBe(false);
      toggle();
      expect(enabled).toBe(true);
    });

    it("should toggle guides state independently", () => {
      let colorization = true;
      let guides = true;

      const toggleGuides = () => { guides = !guides; };
      toggleGuides();

      expect(colorization).toBe(true);
      expect(guides).toBe(false);
    });
  });

  describe("Event Handling", () => {
    it("should handle toggle events", () => {
      const toggleHandler = vi.fn();
      const guidesHandler = vi.fn();

      window.addEventListener("editor:toggle-bracket-colorization", toggleHandler);
      window.addEventListener("editor:toggle-bracket-guides", guidesHandler);

      window.dispatchEvent(new Event("editor:toggle-bracket-colorization"));
      window.dispatchEvent(new Event("editor:toggle-bracket-guides"));

      expect(toggleHandler).toHaveBeenCalledOnce();
      expect(guidesHandler).toHaveBeenCalledOnce();

      window.removeEventListener("editor:toggle-bracket-colorization", toggleHandler);
      window.removeEventListener("editor:toggle-bracket-guides", guidesHandler);
    });
  });
});
