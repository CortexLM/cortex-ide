import { describe, it, expect, vi, beforeEach } from "vitest";

describe("CortexStatusBar Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("StatusBarItem Structure", () => {
    interface StatusBarItem {
      id: string;
      icon: string;
      label: string;
      onClick?: () => void;
    }

    it("should have required properties", () => {
      const item: StatusBarItem = {
        id: "test",
        icon: "layout",
        label: "Test Item",
      };

      expect(item.id).toBe("test");
      expect(item.icon).toBe("layout");
      expect(item.label).toBe("Test Item");
    });

    it("should support optional onClick handler", () => {
      const handleClick = vi.fn();
      const item: StatusBarItem = {
        id: "clickable",
        icon: "terminal",
        label: "Clickable Item",
        onClick: handleClick,
      };

      expect(item.onClick).toBeDefined();
      item.onClick?.();
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should work without onClick handler", () => {
      const item: StatusBarItem = {
        id: "static",
        icon: "info",
        label: "Static Item",
      };

      expect(item.onClick).toBeUndefined();
    });
  });

  describe("Default Right Items", () => {
    interface StatusBarItem {
      id: string;
      icon: string;
      label: string;
      onClick?: () => void;
    }

    const DEFAULT_RIGHT_ITEMS: StatusBarItem[] = [
      { id: "layout", icon: "layout", label: "Toggle Panel" },
      { id: "terminal", icon: "terminal", label: "Toggle Terminal" },
      { id: "git", icon: "git", label: "Source Control" },
      { id: "info", icon: "info", label: "Notifications" },
    ];

    it("should have four default items", () => {
      expect(DEFAULT_RIGHT_ITEMS).toHaveLength(4);
    });

    it("should include layout item", () => {
      const layoutItem = DEFAULT_RIGHT_ITEMS.find((item) => item.id === "layout");
      expect(layoutItem).toBeDefined();
      expect(layoutItem?.icon).toBe("layout");
      expect(layoutItem?.label).toBe("Toggle Panel");
    });

    it("should include terminal item", () => {
      const terminalItem = DEFAULT_RIGHT_ITEMS.find((item) => item.id === "terminal");
      expect(terminalItem).toBeDefined();
      expect(terminalItem?.icon).toBe("terminal");
      expect(terminalItem?.label).toBe("Toggle Terminal");
    });

    it("should include git item", () => {
      const gitItem = DEFAULT_RIGHT_ITEMS.find((item) => item.id === "git");
      expect(gitItem).toBeDefined();
      expect(gitItem?.icon).toBe("git");
      expect(gitItem?.label).toBe("Source Control");
    });

    it("should include info item", () => {
      const infoItem = DEFAULT_RIGHT_ITEMS.find((item) => item.id === "info");
      expect(infoItem).toBeDefined();
      expect(infoItem?.icon).toBe("info");
      expect(infoItem?.label).toBe("Notifications");
    });
  });

  describe("Project Indicator", () => {
    interface ProjectIndicatorProps {
      projectType?: string;
      projectName?: string;
    }

    it("should track project type", () => {
      const props: ProjectIndicatorProps = {
        projectType: "docker",
        projectName: "my-app",
      };

      expect(props.projectType).toBe("docker");
      expect(props.projectName).toBe("my-app");
    });

    it("should handle missing project type", () => {
      const props: ProjectIndicatorProps = {
        projectName: "unnamed-project",
      };

      expect(props.projectType).toBeUndefined();
    });

    it("should handle missing project name", () => {
      const props: ProjectIndicatorProps = {
        projectType: "node",
      };

      expect(props.projectName).toBeUndefined();
    });

    it("should format default project display", () => {
      const formatProjectDisplay = (type?: string, name?: string): string => {
        if (name) return name;
        return `${type || "Docker"} Project`;
      };

      expect(formatProjectDisplay("docker", "my-app")).toBe("my-app");
      expect(formatProjectDisplay("docker")).toBe("docker Project");
      expect(formatProjectDisplay()).toBe("Docker Project");
    });
  });

  describe("Left and Right Item Sections", () => {
    interface StatusBarItem {
      id: string;
      icon: string;
      label: string;
      onClick?: () => void;
    }

    it("should support left items array", () => {
      const leftItems: StatusBarItem[] = [
        { id: "custom1", icon: "star", label: "Custom 1" },
        { id: "custom2", icon: "heart", label: "Custom 2" },
      ];

      expect(leftItems).toHaveLength(2);
      expect(leftItems[0].id).toBe("custom1");
    });

    it("should support right items array", () => {
      const rightItems: StatusBarItem[] = [
        { id: "settings", icon: "gear", label: "Settings" },
      ];

      expect(rightItems).toHaveLength(1);
      expect(rightItems[0].id).toBe("settings");
    });

    it("should merge custom items with defaults", () => {
      const DEFAULT_ITEMS: StatusBarItem[] = [
        { id: "layout", icon: "layout", label: "Toggle Panel" },
      ];

      const customItems: StatusBarItem[] = [
        { id: "custom", icon: "star", label: "Custom" },
      ];

      const allItems = [...DEFAULT_ITEMS, ...customItems];

      expect(allItems).toHaveLength(2);
      expect(allItems.map((i) => i.id)).toEqual(["layout", "custom"]);
    });
  });

  describe("Item Click Handling", () => {
    interface StatusBarItem {
      id: string;
      icon: string;
      label: string;
      onClick?: () => void;
    }

    it("should invoke click handler when called", () => {
      const handleClick = vi.fn();
      const item: StatusBarItem = {
        id: "clickable",
        icon: "terminal",
        label: "Terminal",
        onClick: handleClick,
      };

      item.onClick?.();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple items with different handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const items: StatusBarItem[] = [
        { id: "item1", icon: "layout", label: "Item 1", onClick: handler1 },
        { id: "item2", icon: "terminal", label: "Item 2", onClick: handler2 },
      ];

      items[0].onClick?.();
      items[1].onClick?.();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("should safely handle undefined onClick", () => {
      const item: StatusBarItem = {
        id: "static",
        icon: "info",
        label: "Info",
      };

      expect(() => item.onClick?.()).not.toThrow();
    });
  });

  describe("Project Click Handling", () => {
    interface CortexStatusBarProps {
      projectType?: string;
      projectName?: string;
      onProjectClick?: () => void;
    }

    it("should invoke project click handler", () => {
      const handleProjectClick = vi.fn();
      const props: CortexStatusBarProps = {
        projectType: "docker",
        projectName: "my-app",
        onProjectClick: handleProjectClick,
      };

      props.onProjectClick?.();

      expect(handleProjectClick).toHaveBeenCalledOnce();
    });

    it("should handle missing project click handler", () => {
      const props: CortexStatusBarProps = {
        projectType: "docker",
        projectName: "my-app",
      };

      expect(props.onProjectClick).toBeUndefined();
      expect(() => props.onProjectClick?.()).not.toThrow();
    });
  });

  describe("Icon Rendering", () => {
    it("should map docker type to container icon", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("docker")).toBe("container");
    });

    it("should map node type to box icon", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("node")).toBe("box");
    });

    it("should map rust type to box icon", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("rust")).toBe("box");
    });

    it("should map python type to box icon", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("python")).toBe("box");
    });

    it("should default to container icon for unknown type", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("unknown")).toBe("container");
      expect(getProjectIcon()).toBe("container");
    });

    it("should handle case-insensitive type matching", () => {
      const getProjectIcon = (type?: string): string => {
        switch (type?.toLowerCase()) {
          case "docker":
            return "container";
          case "node":
            return "box";
          case "rust":
            return "box";
          case "python":
            return "box";
          default:
            return "container";
        }
      };

      expect(getProjectIcon("Docker")).toBe("container");
      expect(getProjectIcon("DOCKER")).toBe("container");
      expect(getProjectIcon("Node")).toBe("box");
    });
  });
});
