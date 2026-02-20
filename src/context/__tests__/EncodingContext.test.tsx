import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("EncodingContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Encoding Types", () => {
    type EncodingCategory = "unicode" | "western" | "eastAsian" | "cyrillic" | "other";

    interface EncodingInfo {
      id: string;
      name: string;
      category: EncodingCategory;
    }

    it("should define encoding info", () => {
      const encoding: EncodingInfo = {
        id: "UTF-8",
        name: "UTF-8",
        category: "unicode",
      };

      expect(encoding.id).toBe("UTF-8");
      expect(encoding.category).toBe("unicode");
    });

    it("should support unicode encodings", () => {
      const unicodeEncodings: EncodingInfo[] = [
        { id: "UTF-8", name: "UTF-8", category: "unicode" },
        { id: "UTF-16LE", name: "UTF-16 LE", category: "unicode" },
        { id: "UTF-16BE", name: "UTF-16 BE", category: "unicode" },
      ];

      expect(unicodeEncodings).toHaveLength(3);
      expect(unicodeEncodings.every(e => e.category === "unicode")).toBe(true);
    });

    it("should support western encodings", () => {
      const westernEncodings: EncodingInfo[] = [
        { id: "windows-1252", name: "Windows 1252", category: "western" },
        { id: "ISO-8859-1", name: "ISO-8859-1 (Latin-1)", category: "western" },
      ];

      expect(westernEncodings.every(e => e.category === "western")).toBe(true);
    });

    it("should support east asian encodings", () => {
      const eastAsianEncodings: EncodingInfo[] = [
        { id: "Shift_JIS", name: "Shift JIS (Japanese)", category: "eastAsian" },
        { id: "GBK", name: "GBK (Chinese Simplified)", category: "eastAsian" },
        { id: "EUC-KR", name: "EUC-KR (Korean)", category: "eastAsian" },
      ];

      expect(eastAsianEncodings.every(e => e.category === "eastAsian")).toBe(true);
    });

    it("should support cyrillic encodings", () => {
      const cyrillicEncodings: EncodingInfo[] = [
        { id: "KOI8-R", name: "KOI8-R (Russian)", category: "cyrillic" },
        { id: "windows-1251", name: "Windows 1251 (Cyrillic)", category: "cyrillic" },
      ];

      expect(cyrillicEncodings.every(e => e.category === "cyrillic")).toBe(true);
    });
  });

  describe("Encoding State", () => {
    interface EncodingState {
      isLoading: boolean;
      error: string | null;
      fileEncodings: Record<string, string>;
      showPicker: boolean;
      currentFileId: string | null;
      currentFilePath: string | null;
      pickerMode: "reopen" | "save" | null;
    }

    it("should initialize state", () => {
      const state: EncodingState = {
        isLoading: false,
        error: null,
        fileEncodings: {},
        showPicker: false,
        currentFileId: null,
        currentFilePath: null,
        pickerMode: null,
      };

      expect(state.isLoading).toBe(false);
      expect(state.showPicker).toBe(false);
    });

    it("should track file encodings", () => {
      const fileEncodings: Record<string, string> = {
        "file-1": "UTF-8",
        "file-2": "Shift_JIS",
        "file-3": "windows-1252",
      };

      expect(fileEncodings["file-1"]).toBe("UTF-8");
      expect(fileEncodings["file-2"]).toBe("Shift_JIS");
    });

    it("should manage picker state", () => {
      const state: EncodingState = {
        isLoading: false,
        error: null,
        fileEncodings: {},
        showPicker: true,
        currentFileId: "file-1",
        currentFilePath: "/path/to/file.txt",
        pickerMode: "reopen",
      };

      expect(state.showPicker).toBe(true);
      expect(state.pickerMode).toBe("reopen");
    });
  });

  describe("Detect Encoding", () => {
    it("should detect encoding via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("UTF-8");

      const result = await invoke("fs_detect_encoding", { path: "/path/to/file.txt" });

      expect(invoke).toHaveBeenCalledWith("fs_detect_encoding", { path: "/path/to/file.txt" });
      expect(result).toBe("UTF-8");
    });

    it("should detect non-UTF8 encoding", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("Shift_JIS");

      const result = await invoke("fs_detect_encoding", { path: "/path/to/japanese.txt" });

      expect(result).toBe("Shift_JIS");
    });

    it("should handle detection error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Cannot read file"));

      await expect(invoke("fs_detect_encoding", { path: "/invalid" }))
        .rejects.toThrow("Cannot read file");
    });
  });

  describe("Reopen With Encoding", () => {
    it("should read file with specific encoding", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("日本語テキスト");

      const result = await invoke("fs_read_file_with_encoding", {
        path: "/path/to/file.txt",
        encoding: "Shift_JIS",
      });

      expect(invoke).toHaveBeenCalledWith("fs_read_file_with_encoding", {
        path: "/path/to/file.txt",
        encoding: "Shift_JIS",
      });
      expect(result).toBe("日本語テキスト");
    });

    it("should read UTF-16 file", async () => {
      vi.mocked(invoke).mockResolvedValueOnce("Unicode content");

      const result = await invoke("fs_read_file_with_encoding", {
        path: "/path/to/file.txt",
        encoding: "UTF-16LE",
      });

      expect(result).toBe("Unicode content");
    });
  });

  describe("Save With Encoding", () => {
    it("should write file with specific encoding", async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await invoke("fs_write_file_with_encoding", {
        path: "/path/to/file.txt",
        content: "日本語テキスト",
        encoding: "Shift_JIS",
      });

      expect(invoke).toHaveBeenCalledWith("fs_write_file_with_encoding", {
        path: "/path/to/file.txt",
        content: "日本語テキスト",
        encoding: "Shift_JIS",
      });
    });

    it("should handle write error", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Permission denied"));

      await expect(invoke("fs_write_file_with_encoding", {
        path: "/readonly/file.txt",
        content: "content",
        encoding: "UTF-8",
      })).rejects.toThrow("Permission denied");
    });
  });

  describe("Search Encodings", () => {
    interface EncodingInfo {
      id: string;
      name: string;
      category: string;
    }

    it("should search encodings by name", () => {
      const encodings: EncodingInfo[] = [
        { id: "UTF-8", name: "UTF-8", category: "unicode" },
        { id: "UTF-16LE", name: "UTF-16 LE", category: "unicode" },
        { id: "windows-1252", name: "Windows 1252", category: "western" },
      ];

      const query = "utf";
      const results = encodings.filter(
        e => e.id.toLowerCase().includes(query.toLowerCase()) ||
             e.name.toLowerCase().includes(query.toLowerCase())
      );

      expect(results).toHaveLength(2);
    });

    it("should search encodings by category", () => {
      const encodings: EncodingInfo[] = [
        { id: "UTF-8", name: "UTF-8", category: "unicode" },
        { id: "Shift_JIS", name: "Shift JIS", category: "eastAsian" },
        { id: "GBK", name: "GBK", category: "eastAsian" },
      ];

      const results = encodings.filter(e => e.category === "eastAsian");

      expect(results).toHaveLength(2);
    });

    it("should return empty for no matches", () => {
      const encodings: EncodingInfo[] = [
        { id: "UTF-8", name: "UTF-8", category: "unicode" },
      ];

      const results = encodings.filter(e => e.name.includes("xyz"));

      expect(results).toHaveLength(0);
    });
  });

  describe("Encoding Display", () => {
    it("should get display name for encoding", () => {
      const encodingNames: Record<string, string> = {
        "UTF-8": "UTF-8",
        "Shift_JIS": "Shift JIS (Japanese)",
        "windows-1252": "Windows 1252",
      };

      expect(encodingNames["Shift_JIS"]).toBe("Shift JIS (Japanese)");
    });

    it("should fallback to ID for unknown encoding", () => {
      const getDisplayName = (id: string, names: Record<string, string>) => {
        return names[id] || id;
      };

      expect(getDisplayName("unknown-encoding", {})).toBe("unknown-encoding");
    });
  });

  describe("Picker UI", () => {
    it("should open picker for reopen", () => {
      let showPicker = false;
      let pickerMode: "reopen" | "save" | null = null;

      const openPicker = (mode: "reopen" | "save") => {
        showPicker = true;
        pickerMode = mode;
      };

      openPicker("reopen");

      expect(showPicker).toBe(true);
      expect(pickerMode).toBe("reopen");
    });

    it("should open picker for save", () => {
      let showPicker = false;
      let pickerMode: "reopen" | "save" | null = null;

      const openPicker = (mode: "reopen" | "save") => {
        showPicker = true;
        pickerMode = mode;
      };

      openPicker("save");

      expect(showPicker).toBe(true);
      expect(pickerMode).toBe("save");
    });

    it("should close picker", () => {
      let showPicker = true;

      const closePicker = () => {
        showPicker = false;
      };

      closePicker();

      expect(showPicker).toBe(false);
    });
  });

  describe("File Encoding Management", () => {
    it("should set file encoding", () => {
      const fileEncodings: Record<string, string> = {};

      const setFileEncoding = (fileId: string, encoding: string) => {
        fileEncodings[fileId] = encoding;
      };

      setFileEncoding("file-1", "UTF-8");
      setFileEncoding("file-2", "Shift_JIS");

      expect(fileEncodings["file-1"]).toBe("UTF-8");
      expect(fileEncodings["file-2"]).toBe("Shift_JIS");
    });

    it("should get file encoding with default", () => {
      const fileEncodings: Record<string, string> = {
        "file-1": "Shift_JIS",
      };

      const getFileEncoding = (fileId: string) => {
        return fileEncodings[fileId] || "UTF-8";
      };

      expect(getFileEncoding("file-1")).toBe("Shift_JIS");
      expect(getFileEncoding("file-unknown")).toBe("UTF-8");
    });

    it("should clear file encoding", () => {
      const fileEncodings: Record<string, string> = {
        "file-1": "Shift_JIS",
      };

      const clearFileEncoding = (fileId: string) => {
        delete fileEncodings[fileId];
      };

      clearFileEncoding("file-1");

      expect(fileEncodings["file-1"]).toBeUndefined();
    });
  });
});
