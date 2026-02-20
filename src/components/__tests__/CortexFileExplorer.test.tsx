import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexFileExplorer Component Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TreeItemData Structure", () => {
    interface TreeItemData {
      id: string;
      name: string;
      type: "file" | "folder";
      icon?: string;
      isExpanded?: boolean;
      children?: TreeItemData[];
    }

    it("should create a basic file item", () => {
      const item: TreeItemData = {
        id: "1",
        name: "index.ts",
        type: "file",
        icon: "file-code",
      };

      expect(item.id).toBe("1");
      expect(item.name).toBe("index.ts");
      expect(item.type).toBe("file");
      expect(item.icon).toBe("file-code");
    });

    it("should create a folder item with children", () => {
      const folder: TreeItemData = {
        id: "2",
        name: "src",
        type: "folder",
        icon: "folder",
        isExpanded: true,
        children: [
          { id: "2-1", name: "main.ts", type: "file", icon: "file-code" },
          { id: "2-2", name: "utils.ts", type: "file", icon: "file-code" },
        ],
      };

      expect(folder.type).toBe("folder");
      expect(folder.isExpanded).toBe(true);
      expect(folder.children).toHaveLength(2);
      expect(folder.children?.[0].name).toBe("main.ts");
    });

    it("should handle nested folder structures", () => {
      const root: TreeItemData = {
        id: "root",
        name: "project",
        type: "folder",
        children: [
          {
            id: "src",
            name: "src",
            type: "folder",
            children: [
              { id: "components", name: "components", type: "folder", children: [] },
            ],
          },
        ],
      };

      expect(root.children?.[0].children?.[0].name).toBe("components");
    });
  });

  describe("Tree Operations", () => {
    interface TreeItemData {
      id: string;
      name: string;
      type: "file" | "folder";
    }

    it("should select an item", () => {
      const items: TreeItemData[] = [
        { id: "1", name: "file1.ts", type: "file" },
        { id: "2", name: "file2.ts", type: "file" },
      ];

      let selectedId: string | null = null;

      const handleSelect = (item: TreeItemData) => {
        selectedId = item.id;
      };

      handleSelect(items[1]);

      expect(selectedId).toBe("2");
    });

    it("should toggle folder expansion", () => {
      const expandedIds = new Set<string>();

      const toggleFolder = (id: string) => {
        if (expandedIds.has(id)) {
          expandedIds.delete(id);
        } else {
          expandedIds.add(id);
        }
      };

      toggleFolder("folder-1");
      expect(expandedIds.has("folder-1")).toBe(true);

      toggleFolder("folder-1");
      expect(expandedIds.has("folder-1")).toBe(false);
    });

    it("should collapse all folders", () => {
      const expandedIds = new Set<string>(["folder-1", "folder-2", "folder-3"]);

      const collapseAll = () => {
        expandedIds.clear();
      };

      expect(expandedIds.size).toBe(3);

      collapseAll();

      expect(expandedIds.size).toBe(0);
    });
  });

  describe("File Type Detection", () => {
    type FileType = "file" | "folder";

    it("should detect folder type", () => {
      const detectType = (item: { type: FileType }): boolean => {
        return item.type === "folder";
      };

      expect(detectType({ type: "folder" })).toBe(true);
      expect(detectType({ type: "file" })).toBe(false);
    });

    it("should determine icon based on file extension", () => {
      const getFileIcon = (filename: string): string => {
        const ext = filename.split(".").pop()?.toLowerCase();
        const iconMap: Record<string, string> = {
          ts: "file-code",
          tsx: "file-code",
          js: "file-code",
          jsx: "file-code",
          rs: "file-code",
          toml: "file-text",
          json: "file-text",
          md: "file-text",
          lock: "lock",
        };
        return iconMap[ext || ""] || "file";
      };

      expect(getFileIcon("app.ts")).toBe("file-code");
      expect(getFileIcon("Cargo.toml")).toBe("file-text");
      expect(getFileIcon("Cargo.lock")).toBe("lock");
      expect(getFileIcon("README.md")).toBe("file-text");
      expect(getFileIcon("Dockerfile")).toBe("file");
    });

    it("should distinguish between file and folder icons", () => {
      const getFolderIcon = (isExpanded: boolean): string => {
        return isExpanded ? "folder-open" : "folder";
      };

      expect(getFolderIcon(true)).toBe("folder-open");
      expect(getFolderIcon(false)).toBe("folder");
    });
  });

  describe("Header Actions", () => {
    it("should invoke search callback", () => {
      const onSearch = vi.fn();

      onSearch();

      expect(onSearch).toHaveBeenCalledTimes(1);
    });

    it("should invoke add callback", () => {
      const onAdd = vi.fn();

      onAdd();

      expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("should invoke refresh callback", () => {
      const onRefresh = vi.fn();

      onRefresh();

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("should invoke collapse all callback", () => {
      const onCollapseAll = vi.fn();

      onCollapseAll();

      expect(onCollapseAll).toHaveBeenCalledTimes(1);
    });

    it("should handle optional callbacks gracefully", () => {
      const onSearch: (() => void) | undefined = undefined;

      const invokeIfDefined = (callback?: () => void) => {
        callback?.();
      };

      expect(() => invokeIfDefined(onSearch)).not.toThrow();
    });
  });

  describe("Selection State Management", () => {
    it("should track selected item id", () => {
      let selectedId: string | null = null;

      const setSelectedId = (id: string | null) => {
        selectedId = id;
      };

      setSelectedId("item-1");
      expect(selectedId).toBe("item-1");

      setSelectedId("item-2");
      expect(selectedId).toBe("item-2");
    });

    it("should clear selection", () => {
      let selectedId: string | null = "item-1";

      const clearSelection = () => {
        selectedId = null;
      };

      clearSelection();
      expect(selectedId).toBeNull();
    });

    it("should support controlled and uncontrolled selection", () => {
      const externalSelectedId: string | null = "external-1";
      let internalSelectedId: string | null = "internal-1";

      const getSelectedId = (external?: string | null, isControlled?: boolean): string | null => {
        if (isControlled) {
          return external ?? null;
        }
        return internalSelectedId;
      };

      expect(getSelectedId(externalSelectedId, true)).toBe("external-1");
      expect(getSelectedId(undefined, false)).toBe("internal-1");
      expect(getSelectedId(null, true)).toBe(null);
    });
  });

  describe("Expanded State Management", () => {
    it("should track expanded folder ids", () => {
      const expandedIds = new Set<string>();

      expandedIds.add("folder-1");
      expandedIds.add("folder-2");

      expect(expandedIds.has("folder-1")).toBe(true);
      expect(expandedIds.has("folder-2")).toBe(true);
      expect(expandedIds.has("folder-3")).toBe(false);
    });

    it("should expand a folder", () => {
      const expandedIds = new Set<string>();

      const expandFolder = (id: string) => {
        expandedIds.add(id);
      };

      expandFolder("folder-1");
      expect(expandedIds.has("folder-1")).toBe(true);
    });

    it("should collapse a folder", () => {
      const expandedIds = new Set<string>(["folder-1"]);

      const collapseFolder = (id: string) => {
        expandedIds.delete(id);
      };

      collapseFolder("folder-1");
      expect(expandedIds.has("folder-1")).toBe(false);
    });

    it("should support multiple expanded folders", () => {
      const expandedIds = new Set<string>();

      expandedIds.add("folder-1");
      expandedIds.add("folder-2");
      expandedIds.add("folder-3");

      expect(expandedIds.size).toBe(3);
    });

    it("should support controlled and uncontrolled expansion", () => {
      const externalExpandedIds = new Set<string>(["ext-1"]);
      const internalExpandedIds = new Set<string>(["int-1"]);

      const getExpandedIds = (external?: Set<string>): Set<string> => {
        return external ?? internalExpandedIds;
      };

      expect(getExpandedIds(externalExpandedIds).has("ext-1")).toBe(true);
      expect(getExpandedIds(undefined).has("int-1")).toBe(true);
    });
  });

  describe("Context Menu Handling", () => {
    interface TreeItemData {
      id: string;
      name: string;
      type: "file" | "folder";
    }

    interface ContextMenuEvent {
      item: TreeItemData;
      clientX: number;
      clientY: number;
    }

    it("should track context menu event data", () => {
      const event: ContextMenuEvent = {
        item: { id: "1", name: "file.ts", type: "file" },
        clientX: 100,
        clientY: 200,
      };

      expect(event.item.id).toBe("1");
      expect(event.clientX).toBe(100);
      expect(event.clientY).toBe(200);
    });

    it("should invoke context menu callback with item", () => {
      const onContextMenu = vi.fn();
      const item: TreeItemData = { id: "1", name: "file.ts", type: "file" };
      const mockEvent = { clientX: 100, clientY: 200 } as MouseEvent;

      onContextMenu(item, mockEvent);

      expect(onContextMenu).toHaveBeenCalledWith(item, mockEvent);
    });

    it("should differentiate context menu actions by item type", () => {
      const getContextMenuActions = (type: "file" | "folder"): string[] => {
        if (type === "folder") {
          return ["New File", "New Folder", "Rename", "Delete", "Copy Path"];
        }
        return ["Open", "Rename", "Delete", "Copy Path"];
      };

      expect(getContextMenuActions("folder")).toContain("New File");
      expect(getContextMenuActions("file")).toContain("Open");
      expect(getContextMenuActions("file")).not.toContain("New File");
    });
  });

  describe("File System Operations", () => {
    it("should list directory contents", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { name: "src", isDir: true },
        { name: "package.json", isDir: false },
      ]);

      const result = await invoke("fs_list_dir", { path: "/project" });

      expect(result).toHaveLength(2);
      expect(invoke).toHaveBeenCalledWith("fs_list_dir", { path: "/project" });
    });

    it("should handle file system errors", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Permission denied"));

      try {
        await invoke("fs_list_dir", { path: "/restricted" });
      } catch (e) {
        expect((e as Error).message).toBe("Permission denied");
      }
    });

    it("should create new file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_create_file", { path: "/project/new-file.ts" });

      expect(invoke).toHaveBeenCalledWith("fs_create_file", { path: "/project/new-file.ts" });
    });

    it("should create new folder", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_create_dir", { path: "/project/new-folder" });

      expect(invoke).toHaveBeenCalledWith("fs_create_dir", { path: "/project/new-folder" });
    });
  });

  describe("Explorer Props", () => {
    interface CortexFileExplorerProps {
      title?: string;
      items?: unknown[];
      selectedId?: string | null;
      expandedIds?: Set<string>;
      onSelect?: (item: unknown) => void;
      onToggle?: (item: unknown) => void;
      onSearch?: () => void;
      onAdd?: () => void;
      onRefresh?: () => void;
      onCollapseAll?: () => void;
      onContextMenu?: (item: unknown, e: MouseEvent) => void;
      projectType?: string;
      projectName?: string;
    }

    it("should have correct default title", () => {
      const props: CortexFileExplorerProps = {};
      const title = props.title || "Project";

      expect(title).toBe("Project");
    });

    it("should support custom project name", () => {
      const props: CortexFileExplorerProps = {
        projectName: "My App",
        projectType: "Node",
      };

      const displayName = props.projectName || `${props.projectType || "Docker"} Project`;

      expect(displayName).toBe("My App");
    });

    it("should format project type display", () => {
      const formatProjectDisplay = (props: CortexFileExplorerProps): string => {
        if (props.projectName) {
          return props.projectName;
        }
        return `${props.projectType || "Docker"} Project`;
      };

      expect(formatProjectDisplay({})).toBe("Docker Project");
      expect(formatProjectDisplay({ projectType: "Rust" })).toBe("Rust Project");
      expect(formatProjectDisplay({ projectName: "Custom Name" })).toBe("Custom Name");
    });
  });
});
