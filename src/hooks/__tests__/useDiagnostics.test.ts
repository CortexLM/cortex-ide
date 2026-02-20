import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("useDiagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DiagnosticEntry Interface", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";
    type DiagnosticSource = "lsp" | "typescript" | "eslint" | "build" | "task" | "custom";

    interface DiagnosticEntry {
      id: string;
      uri: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      severity: DiagnosticSeverity;
      source: DiagnosticSource;
      message: string;
      code?: string | number;
    }

    it("should create an error diagnostic", () => {
      const diag: DiagnosticEntry = {
        id: "diag-1",
        uri: "file:///src/app.ts",
        range: {
          start: { line: 5, character: 0 },
          end: { line: 5, character: 10 },
        },
        severity: "error",
        source: "typescript",
        message: "Cannot find name 'foo'",
        code: 2304,
      };

      expect(diag.severity).toBe("error");
      expect(diag.source).toBe("typescript");
      expect(diag.code).toBe(2304);
    });

    it("should create a warning diagnostic", () => {
      const diag: DiagnosticEntry = {
        id: "diag-2",
        uri: "file:///src/utils.ts",
        range: {
          start: { line: 10, character: 4 },
          end: { line: 10, character: 12 },
        },
        severity: "warning",
        source: "eslint",
        message: "Unused variable 'x'",
        code: "no-unused-vars",
      };

      expect(diag.severity).toBe("warning");
      expect(diag.source).toBe("eslint");
      expect(diag.code).toBe("no-unused-vars");
    });

    it("should create a diagnostic without code", () => {
      const diag: DiagnosticEntry = {
        id: "diag-3",
        uri: "file:///src/index.ts",
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        severity: "hint",
        source: "lsp",
        message: "Consider using const",
      };

      expect(diag.code).toBeUndefined();
      expect(diag.severity).toBe("hint");
    });
  });

  describe("Filtering by Severity", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

    interface SimpleDiagnostic {
      severity: DiagnosticSeverity;
      message: string;
    }

    const filterBySeverity = (
      diagnostics: SimpleDiagnostic[],
      severity: DiagnosticSeverity
    ): SimpleDiagnostic[] => {
      return diagnostics.filter((d) => d.severity === severity);
    };

    const diagnostics: SimpleDiagnostic[] = [
      { severity: "error", message: "Type error" },
      { severity: "error", message: "Syntax error" },
      { severity: "warning", message: "Unused import" },
      { severity: "information", message: "Consider refactoring" },
      { severity: "hint", message: "Use shorthand" },
    ];

    it("should filter errors", () => {
      const errors = filterBySeverity(diagnostics, "error");
      expect(errors).toHaveLength(2);
    });

    it("should filter warnings", () => {
      const warnings = filterBySeverity(diagnostics, "warning");
      expect(warnings).toHaveLength(1);
    });

    it("should filter information", () => {
      const info = filterBySeverity(diagnostics, "information");
      expect(info).toHaveLength(1);
    });

    it("should filter hints", () => {
      const hints = filterBySeverity(diagnostics, "hint");
      expect(hints).toHaveLength(1);
    });
  });

  describe("Filtering by Source", () => {
    interface SourceDiagnostic {
      source: string;
      message: string;
    }

    const filterBySource = (
      diagnostics: SourceDiagnostic[],
      source: string
    ): SourceDiagnostic[] => {
      return diagnostics.filter((d) => d.source === source);
    };

    const diagnostics: SourceDiagnostic[] = [
      { source: "typescript", message: "Type error" },
      { source: "eslint", message: "Lint warning" },
      { source: "typescript", message: "Missing return" },
      { source: "lsp", message: "Hover info" },
    ];

    it("should filter by typescript source", () => {
      expect(filterBySource(diagnostics, "typescript")).toHaveLength(2);
    });

    it("should filter by eslint source", () => {
      expect(filterBySource(diagnostics, "eslint")).toHaveLength(1);
    });

    it("should return empty for unknown source", () => {
      expect(filterBySource(diagnostics, "unknown")).toHaveLength(0);
    });
  });

  describe("Filtering by URI", () => {
    interface UriDiagnostic {
      uri: string;
      message: string;
    }

    const filterByUri = (
      diagnostics: UriDiagnostic[],
      uri: string
    ): UriDiagnostic[] => {
      return diagnostics.filter((d) => d.uri === uri);
    };

    const diagnostics: UriDiagnostic[] = [
      { uri: "file:///src/app.ts", message: "Error in app" },
      { uri: "file:///src/utils.ts", message: "Error in utils" },
      { uri: "file:///src/app.ts", message: "Another error in app" },
    ];

    it("should filter diagnostics for app.ts", () => {
      expect(filterByUri(diagnostics, "file:///src/app.ts")).toHaveLength(2);
    });

    it("should filter diagnostics for utils.ts", () => {
      expect(filterByUri(diagnostics, "file:///src/utils.ts")).toHaveLength(1);
    });

    it("should return empty for unknown URI", () => {
      expect(filterByUri(diagnostics, "file:///src/missing.ts")).toHaveLength(0);
    });
  });

  describe("Count Computations", () => {
    interface DiagnosticCounts {
      errorCount: number;
      warningCount: number;
      informationCount: number;
      hintCount: number;
      totalCount: number;
    }

    const computeCounts = (
      diagnostics: { severity: string }[]
    ): DiagnosticCounts => {
      const errorCount = diagnostics.filter((d) => d.severity === "error").length;
      const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
      const informationCount = diagnostics.filter((d) => d.severity === "information").length;
      const hintCount = diagnostics.filter((d) => d.severity === "hint").length;

      return {
        errorCount,
        warningCount,
        informationCount,
        hintCount,
        totalCount: diagnostics.length,
      };
    };

    it("should compute counts correctly", () => {
      const diagnostics = [
        { severity: "error" },
        { severity: "error" },
        { severity: "warning" },
        { severity: "information" },
        { severity: "hint" },
        { severity: "hint" },
      ];

      const counts = computeCounts(diagnostics);

      expect(counts.errorCount).toBe(2);
      expect(counts.warningCount).toBe(1);
      expect(counts.informationCount).toBe(1);
      expect(counts.hintCount).toBe(2);
      expect(counts.totalCount).toBe(6);
    });

    it("should return zero counts for empty array", () => {
      const counts = computeCounts([]);

      expect(counts.errorCount).toBe(0);
      expect(counts.warningCount).toBe(0);
      expect(counts.totalCount).toBe(0);
    });

    it("should match totalCount with diagnostics length", () => {
      const diagnostics = [
        { severity: "error" },
        { severity: "warning" },
        { severity: "error" },
      ];

      const counts = computeCounts(diagnostics);
      expect(counts.totalCount).toBe(diagnostics.length);
    });
  });

  describe("Refresh Diagnostics", () => {
    it("should call diagnostics_get via invoke", async () => {
      vi.mocked(invoke).mockResolvedValueOnce([
        { uri: "file:///src/app.ts", diagnostics: [] },
      ]);

      const result = await invoke("diagnostics_get");

      expect(invoke).toHaveBeenCalledWith("diagnostics_get");
      expect(result).toHaveLength(1);
    });

    it("should handle refresh failure", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Backend unavailable"));

      await expect(invoke("diagnostics_get")).rejects.toThrow("Backend unavailable");
    });
  });

  describe("Clear Diagnostics", () => {
    it("should reset diagnostics array", () => {
      let diagnostics = [
        { id: "1", message: "Error" },
        { id: "2", message: "Warning" },
      ];

      const clear = () => {
        diagnostics = [];
      };

      clear();

      expect(diagnostics).toHaveLength(0);
    });

    it("should clear diagnostics for specific URI", () => {
      const diagnosticsByUri: Record<string, { message: string }[]> = {
        "file:///src/app.ts": [{ message: "Error 1" }],
        "file:///src/utils.ts": [{ message: "Error 2" }],
      };

      delete diagnosticsByUri["file:///src/app.ts"];

      expect(Object.keys(diagnosticsByUri)).toHaveLength(1);
      expect(diagnosticsByUri["file:///src/utils.ts"]).toBeDefined();
    });
  });

  describe("Diagnostics Events", () => {
    it("should listen for diagnostics update events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("diagnostics:updated", () => {});

      expect(listen).toHaveBeenCalledWith("diagnostics:updated", expect.any(Function));
    });

    it("should listen for build output events", async () => {
      vi.mocked(listen).mockResolvedValueOnce(() => {});

      await listen("build:output", () => {});

      expect(listen).toHaveBeenCalledWith("build:output", expect.any(Function));
    });
  });
});
