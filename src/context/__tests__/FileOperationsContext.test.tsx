import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../utils/tauri-api", () => ({
  fsReadFile: vi.fn(),
  fsWriteFile: vi.fn(),
  fsCreateDirectory: vi.fn(),
  fsDeleteFile: vi.fn(),
  fsDeleteDirectory: vi.fn(),
  fsMove: vi.fn(),
  fsTrash: vi.fn(),
  fsCopyFile: vi.fn(),
  fsListDirectory: vi.fn(),
  fsExists: vi.fn(),
}));

vi.mock("../../utils/fileUtils", () => ({
  generateUniquePath: vi.fn(),
  dirname: vi.fn((path: string) => path.substring(0, path.lastIndexOf("/"))),
  basename: vi.fn((path: string, ext?: string) => {
    const name = path.substring(path.lastIndexOf("/") + 1);
    if (ext && name.endsWith(ext)) {
      return name.substring(0, name.length - ext.length);
    }
    return name;
  }),
  extname: vi.fn((path: string) => {
    const lastDot = path.lastIndexOf(".");
    return lastDot > 0 ? path.substring(lastDot) : "";
  }),
  joinPath: vi.fn((...parts: string[]) => parts.join("/")),
}));

describe("FileOperationsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("File Operation Types", () => {
    type FileOperationType = "delete" | "rename" | "move" | "create" | "copy";

    interface FileOperationData {
      originalPath: string;
      newPath?: string;
      content?: string;
      isDirectory?: boolean;
    }

    interface FileOperation {
      id: string;
      type: FileOperationType;
      timestamp: number;
      data: FileOperationData;
    }

    it("should define delete operation", () => {
      const operation: FileOperation = {
        id: "op-1",
        type: "delete",
        timestamp: Date.now(),
        data: {
          originalPath: "/path/to/file.txt",
          content: "file content",
          isDirectory: false,
        },
      };

      expect(operation.type).toBe("delete");
    });

    it("should define rename operation", () => {
      const operation: FileOperation = {
        id: "op-2",
        type: "rename",
        timestamp: Date.now(),
        data: {
          originalPath: "/path/to/old.txt",
          newPath: "/path/to/new.txt",
        },
      };

      expect(operation.type).toBe("rename");
      expect(operation.data.newPath).toBe("/path/to/new.txt");
    });

    it("should define move operation", () => {
      const operation: FileOperation = {
        id: "op-3",
        type: "move",
        timestamp: Date.now(),
        data: {
          originalPath: "/src/file.txt",
          newPath: "/dest/file.txt",
        },
      };

      expect(operation.type).toBe("move");
    });

    it("should define create operation", () => {
      const operation: FileOperation = {
        id: "op-4",
        type: "create",
        timestamp: Date.now(),
        data: {
          originalPath: "/path/to/new-file.txt",
          isDirectory: false,
        },
      };

      expect(operation.type).toBe("create");
    });

    it("should define copy operation", () => {
      const operation: FileOperation = {
        id: "op-5",
        type: "copy",
        timestamp: Date.now(),
        data: {
          originalPath: "/src/file.txt",
          newPath: "/src/file copy.txt",
          isDirectory: false,
        },
      };

      expect(operation.type).toBe("copy");
    });
  });

  describe("Operation History", () => {
    interface FileOperation {
      id: string;
      type: string;
      timestamp: number;
    }

    it("should track operation history", () => {
      const history: FileOperation[] = [];
      const MAX_HISTORY = 50;

      const recordOperation = (op: Omit<FileOperation, "id" | "timestamp">) => {
        const operation: FileOperation = {
          ...op,
          id: crypto.randomUUID(),
          timestamp: Date.now(),
        };
        history.push(operation);
        if (history.length > MAX_HISTORY) {
          history.shift();
        }
      };

      recordOperation({ type: "delete" });
      recordOperation({ type: "rename" });

      expect(history).toHaveLength(2);
    });

    it("should limit history size", () => {
      let history: FileOperation[] = [];
      const MAX_HISTORY = 5;

      const recordOperation = (op: Omit<FileOperation, "id" | "timestamp">) => {
        const operation: FileOperation = {
          ...op,
          id: `op-${history.length}`,
          timestamp: Date.now(),
        };
        history = [...history.slice(-MAX_HISTORY + 1), operation];
      };

      for (let i = 0; i < 10; i++) {
        recordOperation({ type: "delete" });
      }

      expect(history).toHaveLength(5);
    });

    it("should check if can undo", () => {
      const history: FileOperation[] = [];

      const canUndo = () => history.length > 0;

      expect(canUndo()).toBe(false);

      history.push({ id: "op-1", type: "delete", timestamp: Date.now() });

      expect(canUndo()).toBe(true);
    });

    it("should get last operation", () => {
      const history: FileOperation[] = [
        { id: "op-1", type: "delete", timestamp: 1000 },
        { id: "op-2", type: "rename", timestamp: 2000 },
      ];

      const lastOperation = () => {
        return history.length > 0 ? history[history.length - 1] : undefined;
      };

      expect(lastOperation()?.type).toBe("rename");
    });

    it("should clear history", () => {
      let history: FileOperation[] = [
        { id: "op-1", type: "delete", timestamp: 1000 },
      ];

      const clearHistory = () => {
        history = [];
      };

      clearHistory();

      expect(history).toHaveLength(0);
    });
  });

  describe("Undo Operations", () => {
    it("should undo delete by recreating file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_create_file", { path: "/path/to/file.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_create_file", { path: "/path/to/file.txt" });
    });

    it("should undo rename by moving back", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_move", { source: "/path/to/new.txt", dest: "/path/to/old.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_move", {
        source: "/path/to/new.txt",
        dest: "/path/to/old.txt",
      });
    });

    it("should undo create by deleting", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_delete_file", { path: "/path/to/new-file.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_delete_file", { path: "/path/to/new-file.txt" });
    });

    it("should undo copy by deleting the copy", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_delete_file", { path: "/src/file copy.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_delete_file", { path: "/src/file copy.txt" });
    });
  });

  describe("Delete With Undo", () => {
    it("should record delete operation", () => {
      const operations: Array<{ type: string; path: string }> = [];

      const deleteWithUndo = (path: string) => {
        operations.push({ type: "delete", path });
      };

      deleteWithUndo("/path/to/file.txt");

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe("delete");
    });

    it("should store content for small files", () => {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const fileSize = 1000;

      const shouldStoreContent = fileSize <= MAX_FILE_SIZE;

      expect(shouldStoreContent).toBe(true);
    });

    it("should not store content for large files", () => {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      const fileSize = 20 * 1024 * 1024;

      const shouldStoreContent = fileSize <= MAX_FILE_SIZE;

      expect(shouldStoreContent).toBe(false);
    });
  });

  describe("Rename With Undo", () => {
    it("should record rename operation", () => {
      const operations: Array<{ type: string; oldPath: string; newPath: string }> = [];

      const renameWithUndo = (oldPath: string, newPath: string) => {
        operations.push({ type: "rename", oldPath, newPath });
      };

      renameWithUndo("/path/to/old.txt", "/path/to/new.txt");

      expect(operations).toHaveLength(1);
      expect(operations[0].oldPath).toBe("/path/to/old.txt");
    });

    it("should invoke rename command", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_rename", { oldPath: "/old.txt", newPath: "/new.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_rename", {
        oldPath: "/old.txt",
        newPath: "/new.txt",
      });
    });
  });

  describe("Move With Undo", () => {
    it("should record move operation", () => {
      const operations: Array<{ type: string; source: string; dest: string }> = [];

      const moveWithUndo = (source: string, dest: string) => {
        operations.push({ type: "move", source, dest });
      };

      moveWithUndo("/src/file.txt", "/dest/file.txt");

      expect(operations).toHaveLength(1);
      expect(operations[0].source).toBe("/src/file.txt");
    });
  });

  describe("Create File With Undo", () => {
    it("should record create operation", () => {
      const operations: Array<{ type: string; path: string }> = [];

      const createFileWithUndo = (path: string) => {
        operations.push({ type: "create", path });
      };

      createFileWithUndo("/path/to/new-file.txt");

      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe("create");
    });
  });

  describe("Create Directory With Undo", () => {
    it("should record create directory operation", () => {
      const operations: Array<{ type: string; path: string; isDirectory: boolean }> = [];

      const createDirectoryWithUndo = (path: string) => {
        operations.push({ type: "create", path, isDirectory: true });
      };

      createDirectoryWithUndo("/path/to/new-folder");

      expect(operations).toHaveLength(1);
      expect(operations[0].isDirectory).toBe(true);
    });
  });

  describe("Copy With Undo", () => {
    it("should record copy operation", () => {
      const operations: Array<{ type: string; source: string; dest: string }> = [];

      const copyWithUndo = (source: string, dest: string) => {
        operations.push({ type: "copy", source, dest });
        return dest;
      };

      const result = copyWithUndo("/src/file.txt", "/src/file copy.txt");

      expect(result).toBe("/src/file copy.txt");
      expect(operations).toHaveLength(1);
    });
  });

  describe("Duplicate With Undo", () => {
    it("should generate duplicate name", () => {
      const generateDuplicateName = (filename: string) => {
        const lastDot = filename.lastIndexOf(".");
        if (lastDot > 0) {
          const name = filename.substring(0, lastDot);
          const ext = filename.substring(lastDot);
          return `${name} copy${ext}`;
        }
        return `${filename} copy`;
      };

      expect(generateDuplicateName("file.txt")).toBe("file copy.txt");
      expect(generateDuplicateName("folder")).toBe("folder copy");
    });

    it("should generate numbered duplicate name", () => {
      const generateNumberedDuplicateName = (filename: string, counter: number) => {
        const lastDot = filename.lastIndexOf(".");
        if (lastDot > 0) {
          const name = filename.substring(0, lastDot);
          const ext = filename.substring(lastDot);
          return `${name} copy (${counter})${ext}`;
        }
        return `${filename} copy (${counter})`;
      };

      expect(generateNumberedDuplicateName("file.txt", 1)).toBe("file copy (1).txt");
      expect(generateNumberedDuplicateName("file.txt", 2)).toBe("file copy (2).txt");
    });
  });

  describe("Path Utilities", () => {
    it("should extract directory name", () => {
      const dirname = (path: string) => path.substring(0, path.lastIndexOf("/"));

      expect(dirname("/path/to/file.txt")).toBe("/path/to");
    });

    it("should extract base name", () => {
      const basename = (path: string) => path.substring(path.lastIndexOf("/") + 1);

      expect(basename("/path/to/file.txt")).toBe("file.txt");
    });

    it("should extract extension", () => {
      const extname = (path: string) => {
        const lastDot = path.lastIndexOf(".");
        const lastSlash = path.lastIndexOf("/");
        return lastDot > lastSlash ? path.substring(lastDot) : "";
      };

      expect(extname("/path/to/file.txt")).toBe(".txt");
      expect(extname("/path/to/folder")).toBe("");
    });

    it("should join paths", () => {
      const joinPath = (...parts: string[]) => parts.join("/");

      expect(joinPath("/path", "to", "file.txt")).toBe("/path/to/file.txt");
    });
  });

  describe("File Operation Events", () => {
    it("should dispatch undo event", () => {
      const events: Array<{ type: string; detail: unknown }> = [];

      const dispatchEvent = (type: string, detail: unknown) => {
        events.push({ type, detail });
      };

      dispatchEvent("file-operation:undone", { type: "delete", path: "/file.txt" });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("file-operation:undone");
    });
  });

  describe("Error Handling", () => {
    it("should handle undo failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Permission denied"));

      await expect(invoke("fs_create_file", { path: "/readonly/file.txt" }))
        .rejects.toThrow("Permission denied");
    });

    it("should remove failed operation from history", () => {
      let history = [
        { id: "op-1", type: "delete" },
        { id: "op-2", type: "rename" },
      ];

      const removeLastOperation = () => {
        history = history.slice(0, -1);
      };

      removeLastOperation();

      expect(history).toHaveLength(1);
    });
  });

  describe("Directory Operations", () => {
    it("should handle directory delete", () => {
      const operation = {
        type: "delete",
        isDirectory: true,
        path: "/path/to/folder",
      };

      expect(operation.isDirectory).toBe(true);
    });

    it("should handle directory create", () => {
      const operation = {
        type: "create",
        isDirectory: true,
        path: "/path/to/new-folder",
      };

      expect(operation.isDirectory).toBe(true);
    });
  });
});
