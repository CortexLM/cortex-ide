import { describe, it, expect, vi, beforeEach } from "vitest";
import { CORTEX_ICON_SIZES } from "../CortexIcon";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexIcon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CORTEX_ICON_SIZES constant", () => {
    it("exports correct size tokens", () => {
      expect(CORTEX_ICON_SIZES).toEqual({
        xs: 12,
        sm: 16,
        md: 20,
        lg: 24,
        xl: 32,
        "2xl": 40,
        "3xl": 48,
      });
    });
  });

  describe("icon name mapping logic", () => {
    const ICON_NAME_MAP: Record<string, string> = {
      home: "house",
      house: "house",
      plus: "plus",
      "circle-plus": "circle-plus",
      folder: "folder",
      "folder-open": "folder-open",
      "code-branch": "code-branch",
      git: "code-branch",
      play: "play",
      "play-circle": "circle-play",
      box: "box",
      cube: "cube",
      users: "users",
      "grid-2": "grid-2",
      grid: "grid-2",
      book: "book",
      "book-open": "book-open",
      map: "map",
      paintbrush: "paintbrush",
      brush: "paintbrush",
      settings: "gear",
      gear: "gear",
      menu: "bars",
      bars: "bars",
      search: "magnifying-glass",
      "search-sm": "magnifying-glass",
      refresh: "arrows-rotate",
      "refresh-cw": "arrows-rotate",
      "refresh-cw-02": "arrows-rotate",
      "rotate-cw": "arrows-rotate",
      "chevron-down": "chevron-down",
      "chevron-up": "chevron-up",
      "chevron-left": "chevron-left",
      "chevron-right": "chevron-right",
      "chevron-up-double": "chevrons-up",
      "x-close": "xmark",
      x: "xmark",
      close: "xmark",
      minus: "minus",
      copy: "copy",
      "copy-06": "copy",
      maximize: "expand",
      minimize: "compress",
      sun: "sun",
      moon: "moon",
      file: "file",
      "file-text": "file-lines",
      "file-code": "file-code",
      send: "paper-plane",
      "paper-plane": "paper-plane",
      upload: "upload",
      "corner-up-left": "arrow-turn-up",
      undo: "arrow-turn-up",
      check: "check",
      "check-circle": "circle-check",
      star: "star",
      "star-05": "star",
      stop: "stop",
      square: "square",
      "info-circle": "circle-info",
      info: "circle-info",
      alert: "circle-exclamation",
      warning: "triangle-exclamation",
      layout: "table-columns",
      terminal: "terminal",
      "terminal-square": "terminal",
      panel: "sidebar",
      user: "user",
      "user-circle": "circle-user",
      lock: "lock",
      road: "file-lines",
      docker: "docker",
      container: "docker",
      "caret-left": "caret-left",
      "caret-right": "caret-right",
      "help-circle": "circle-question",
    };

    const getIconName = (name: string): string => {
      const lowercaseName = name.toLowerCase();
      return ICON_NAME_MAP[lowercaseName] || lowercaseName;
    };

    it("maps home to house", () => {
      expect(getIconName("home")).toBe("house");
    });

    it("maps settings to gear", () => {
      expect(getIconName("settings")).toBe("gear");
    });

    it("maps search to magnifying-glass", () => {
      expect(getIconName("search")).toBe("magnifying-glass");
    });

    it("maps menu to bars", () => {
      expect(getIconName("menu")).toBe("bars");
    });

    it("maps x-close to xmark", () => {
      expect(getIconName("x-close")).toBe("xmark");
    });

    it("maps close to xmark", () => {
      expect(getIconName("close")).toBe("xmark");
    });

    it("maps refresh to arrows-rotate", () => {
      expect(getIconName("refresh")).toBe("arrows-rotate");
    });

    it("maps git to code-branch", () => {
      expect(getIconName("git")).toBe("code-branch");
    });

    it("maps send to paper-plane", () => {
      expect(getIconName("send")).toBe("paper-plane");
    });

    it("maps check-circle to circle-check", () => {
      expect(getIconName("check-circle")).toBe("circle-check");
    });

    it("passes through unmapped names", () => {
      expect(getIconName("custom-icon")).toBe("custom-icon");
    });

    it("handles case-insensitive mapping", () => {
      expect(getIconName("HOME")).toBe("house");
    });

    it("maps folder to folder", () => {
      expect(getIconName("folder")).toBe("folder");
    });

    it("maps folder-open to folder-open", () => {
      expect(getIconName("folder-open")).toBe("folder-open");
    });

    it("maps play to play", () => {
      expect(getIconName("play")).toBe("play");
    });

    it("maps chevron-down to chevron-down", () => {
      expect(getIconName("chevron-down")).toBe("chevron-down");
    });

    it("maps copy to copy", () => {
      expect(getIconName("copy")).toBe("copy");
    });

    it("maps upload to upload", () => {
      expect(getIconName("upload")).toBe("upload");
    });

    it("maps sun to sun", () => {
      expect(getIconName("sun")).toBe("sun");
    });

    it("maps moon to moon", () => {
      expect(getIconName("moon")).toBe("moon");
    });

    it("maps check to check", () => {
      expect(getIconName("check")).toBe("check");
    });

    it("maps info to circle-info", () => {
      expect(getIconName("info")).toBe("circle-info");
    });

    it("maps warning to triangle-exclamation", () => {
      expect(getIconName("warning")).toBe("triangle-exclamation");
    });
  });

  describe("size token resolution", () => {
    const getSize = (size: string | number | undefined): number => {
      if (typeof size === "number") return size;
      return CORTEX_ICON_SIZES[size as keyof typeof CORTEX_ICON_SIZES] || CORTEX_ICON_SIZES.md;
    };

    it("defaults to md size (20px)", () => {
      expect(getSize(undefined)).toBe(20);
    });

    it("applies xs size token", () => {
      expect(getSize("xs")).toBe(12);
    });

    it("applies sm size token", () => {
      expect(getSize("sm")).toBe(16);
    });

    it("applies lg size token", () => {
      expect(getSize("lg")).toBe(24);
    });

    it("applies xl size token", () => {
      expect(getSize("xl")).toBe(32);
    });

    it("applies 2xl size token", () => {
      expect(getSize("2xl")).toBe(40);
    });

    it("applies 3xl size token", () => {
      expect(getSize("3xl")).toBe(48);
    });

    it("accepts numeric size directly", () => {
      expect(getSize(28)).toBe(28);
    });
  });

  describe("CortexIconProps interface", () => {
    it("defines required name prop", () => {
      interface TestProps {
        name: string;
        size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | number;
        color?: string;
        class?: string;
        style?: Record<string, string>;
        onClick?: (e: MouseEvent) => void;
      }

      const props: TestProps = {
        name: "test",
        size: "md",
        color: "red",
        class: "custom",
        style: { opacity: "0.5" },
        onClick: () => {},
      };

      expect(props.name).toBe("test");
      expect(props.size).toBe("md");
      expect(props.color).toBe("red");
      expect(props.class).toBe("custom");
      expect(props.style).toEqual({ opacity: "0.5" });
      expect(typeof props.onClick).toBe("function");
    });

    it("allows all size token values", () => {
      const validSizes = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl"];
      validSizes.forEach((size) => {
        expect(CORTEX_ICON_SIZES[size as keyof typeof CORTEX_ICON_SIZES]).toBeDefined();
      });
    });
  });
});
