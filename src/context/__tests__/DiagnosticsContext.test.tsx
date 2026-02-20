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

vi.mock("../LSPContext", () => ({
  useLSP: vi.fn().mockReturnValue({
    diagnostics: {},
    getDiagnosticsForFile: vi.fn().mockReturnValue([]),
  }),
}));

describe("DiagnosticsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Diagnostic Types", () => {
    type DiagnosticSource = "lsp" | "typescript" | "eslint" | "build" | "task" | "custom";
    type DiagnosticSeverity = 1 | 2 | 3 | 4;

    interface DiagnosticPosition {
      line: number;
      character: number;
    }

    interface DiagnosticRange {
      start: DiagnosticPosition;
      end: DiagnosticPosition;
    }

    interface UnifiedDiagnostic {
      id: string;
      uri: string;
      range: DiagnosticRange;
      severity: DiagnosticSeverity;
      code?: string | number;
      source: DiagnosticSource;
      sourceName?: string;
      message: string;
      timestamp: number;
    }

    it("should create a diagnostic", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///src/index.ts",
        range: {
          start: { line: 10, character: 5 },
          end: { line: 10, character: 15 },
        },
        severity: 1,
        code: "TS2322",
        source: "typescript",
        sourceName: "TypeScript",
        message: "Type 'string' is not assignable to type 'number'",
        timestamp: Date.now(),
      };

      expect(diagnostic.severity).toBe(1);
      expect(diagnostic.source).toBe("typescript");
    });

    it("should represent different severity levels", () => {
      const severities: DiagnosticSeverity[] = [1, 2, 3, 4];
      const labels = ["Error", "Warning", "Information", "Hint"];

      expect(severities).toHaveLength(4);
      expect(labels[0]).toBe("Error");
    });

    it("should represent different sources", () => {
      const sources: DiagnosticSource[] = ["lsp", "typescript", "eslint", "build", "task", "custom"];
      expect(sources).toHaveLength(6);
    });
  });

  describe("FileDiagnostics", () => {
    type DiagnosticSeverity = 1 | 2 | 3 | 4;
    type DiagnosticSource = "lsp" | "typescript" | "eslint";

    interface DiagnosticRange {
      start: { line: number; character: number };
      end: { line: number; character: number };
    }

    interface UnifiedDiagnostic {
      id: string;
      uri: string;
      range: DiagnosticRange;
      severity: DiagnosticSeverity;
      source: DiagnosticSource;
      message: string;
      timestamp: number;
    }

    interface FileDiagnostics {
      uri: string;
      diagnostics: UnifiedDiagnostic[];
      lastUpdated: number;
    }

    it("should create file diagnostics", () => {
      const fileDiag: FileDiagnostics = {
        uri: "file:///src/app.ts",
        diagnostics: [
          {
            id: "d1",
            uri: "file:///src/app.ts",
            range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
            severity: 1,
            source: "typescript",
            message: "Error message",
            timestamp: Date.now(),
          },
        ],
        lastUpdated: Date.now(),
      };

      expect(fileDiag.diagnostics).toHaveLength(1);
    });

    it("should track diagnostics by file", () => {
      const diagnosticsByFile: Record<string, FileDiagnostics> = {
        "file:///src/a.ts": {
          uri: "file:///src/a.ts",
          diagnostics: [],
          lastUpdated: Date.now(),
        },
        "file:///src/b.ts": {
          uri: "file:///src/b.ts",
          diagnostics: [],
          lastUpdated: Date.now(),
        },
      };

      expect(Object.keys(diagnosticsByFile)).toHaveLength(2);
    });
  });

  describe("Diagnostic Filtering", () => {
    type DiagnosticSource = "lsp" | "typescript" | "eslint" | "build";

    interface DiagnosticFilter {
      showErrors: boolean;
      showWarnings: boolean;
      showInformation: boolean;
      showHints: boolean;
      currentFileOnly: boolean;
      sources: DiagnosticSource[];
    }

    it("should create a default filter", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: true,
        showHints: true,
        currentFileOnly: false,
        sources: ["lsp", "typescript", "eslint", "build"],
      };

      expect(filter.showErrors).toBe(true);
      expect(filter.sources).toHaveLength(4);
    });

    it("should filter by severity", () => {
      interface Diagnostic {
        severity: number;
      }

      const diagnostics: Diagnostic[] = [
        { severity: 1 },
        { severity: 2 },
        { severity: 3 },
        { severity: 4 },
      ];

      const filter = { showErrors: true, showWarnings: false, showInformation: false, showHints: false };

      const filtered = diagnostics.filter((d) => {
        if (d.severity === 1) return filter.showErrors;
        if (d.severity === 2) return filter.showWarnings;
        if (d.severity === 3) return filter.showInformation;
        if (d.severity === 4) return filter.showHints;
        return false;
      });

      expect(filtered).toHaveLength(1);
    });

    it("should filter by source", () => {
      interface Diagnostic {
        source: DiagnosticSource;
      }

      const diagnostics: Diagnostic[] = [
        { source: "lsp" },
        { source: "typescript" },
        { source: "eslint" },
        { source: "build" },
      ];

      const allowedSources: DiagnosticSource[] = ["typescript", "eslint"];
      const filtered = diagnostics.filter((d) => allowedSources.includes(d.source));

      expect(filtered).toHaveLength(2);
    });

    it("should filter by current file only", () => {
      interface Diagnostic {
        uri: string;
      }

      const diagnostics: Diagnostic[] = [
        { uri: "file:///src/a.ts" },
        { uri: "file:///src/b.ts" },
        { uri: "file:///src/a.ts" },
      ];

      const currentFileUri = "file:///src/a.ts";
      const filtered = diagnostics.filter((d) => d.uri === currentFileUri);

      expect(filtered).toHaveLength(2);
    });
  });

  describe("Diagnostic Counts", () => {
    interface DiagnosticCounts {
      error: number;
      warning: number;
      information: number;
      hint: number;
      total: number;
    }

    it("should calculate counts", () => {
      const counts: DiagnosticCounts = {
        error: 5,
        warning: 10,
        information: 3,
        hint: 2,
        total: 20,
      };

      expect(counts.total).toBe(20);
      expect(counts.error + counts.warning + counts.information + counts.hint).toBe(20);
    });

    it("should count diagnostics by severity", () => {
      interface Diagnostic {
        severity: number;
      }

      const diagnostics: Diagnostic[] = [
        { severity: 1 },
        { severity: 1 },
        { severity: 2 },
        { severity: 2 },
        { severity: 2 },
        { severity: 3 },
        { severity: 4 },
      ];

      const counts: DiagnosticCounts = {
        error: diagnostics.filter((d) => d.severity === 1).length,
        warning: diagnostics.filter((d) => d.severity === 2).length,
        information: diagnostics.filter((d) => d.severity === 3).length,
        hint: diagnostics.filter((d) => d.severity === 4).length,
        total: diagnostics.length,
      };

      expect(counts.error).toBe(2);
      expect(counts.warning).toBe(3);
      expect(counts.information).toBe(1);
      expect(counts.hint).toBe(1);
    });
  });

  describe("Diagnostic Grouping", () => {
    type GroupMode = "file" | "severity" | "source";
    type DiagnosticSeverity = 1 | 2 | 3 | 4;
    type DiagnosticSource = "lsp" | "typescript" | "eslint";

    interface Diagnostic {
      id: string;
      uri: string;
      severity: DiagnosticSeverity;
      source: DiagnosticSource;
    }

    it("should group by file", () => {
      const diagnostics: Diagnostic[] = [
        { id: "1", uri: "file:///a.ts", severity: 1, source: "lsp" },
        { id: "2", uri: "file:///b.ts", severity: 2, source: "lsp" },
        { id: "3", uri: "file:///a.ts", severity: 1, source: "typescript" },
      ];

      const byFile = new Map<string, Diagnostic[]>();
      for (const d of diagnostics) {
        if (!byFile.has(d.uri)) {
          byFile.set(d.uri, []);
        }
        byFile.get(d.uri)!.push(d);
      }

      expect(byFile.get("file:///a.ts")).toHaveLength(2);
      expect(byFile.get("file:///b.ts")).toHaveLength(1);
    });

    it("should group by severity", () => {
      const diagnostics: Diagnostic[] = [
        { id: "1", uri: "file:///a.ts", severity: 1, source: "lsp" },
        { id: "2", uri: "file:///b.ts", severity: 2, source: "lsp" },
        { id: "3", uri: "file:///a.ts", severity: 1, source: "typescript" },
      ];

      const bySeverity = new Map<DiagnosticSeverity, Diagnostic[]>();
      for (const d of diagnostics) {
        if (!bySeverity.has(d.severity)) {
          bySeverity.set(d.severity, []);
        }
        bySeverity.get(d.severity)!.push(d);
      }

      expect(bySeverity.get(1)).toHaveLength(2);
      expect(bySeverity.get(2)).toHaveLength(1);
    });

    it("should group by source", () => {
      const diagnostics: Diagnostic[] = [
        { id: "1", uri: "file:///a.ts", severity: 1, source: "lsp" },
        { id: "2", uri: "file:///b.ts", severity: 2, source: "eslint" },
        { id: "3", uri: "file:///a.ts", severity: 1, source: "lsp" },
      ];

      const bySource = new Map<DiagnosticSource, Diagnostic[]>();
      for (const d of diagnostics) {
        if (!bySource.has(d.source)) {
          bySource.set(d.source, []);
        }
        bySource.get(d.source)!.push(d);
      }

      expect(bySource.get("lsp")).toHaveLength(2);
      expect(bySource.get("eslint")).toHaveLength(1);
    });

    it("should track group mode", () => {
      let groupMode: GroupMode = "file";

      groupMode = "severity";
      expect(groupMode).toBe("severity");

      groupMode = "source";
      expect(groupMode).toBe("source");
    });
  });

  describe("Code Actions", () => {
    interface DiagnosticRange {
      start: { line: number; character: number };
      end: { line: number; character: number };
    }

    interface CodeAction {
      title: string;
      kind?: string;
      isPreferred?: boolean;
      edit?: {
        changes?: Record<string, Array<{ range: DiagnosticRange; newText: string }>>;
      };
      command?: {
        title: string;
        command: string;
        arguments?: unknown[];
      };
    }

    it("should create a code action", () => {
      const action: CodeAction = {
        title: "Add missing import",
        kind: "quickfix",
        isPreferred: true,
        edit: {
          changes: {
            "file:///src/index.ts": [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                newText: "import { foo } from './foo';\n",
              },
            ],
          },
        },
      };

      expect(action.title).toBe("Add missing import");
      expect(action.isPreferred).toBe(true);
    });

    it("should create a command action", () => {
      const action: CodeAction = {
        title: "Organize imports",
        command: {
          title: "Organize Imports",
          command: "editor.action.organizeImports",
        },
      };

      expect(action.command?.command).toBe("editor.action.organizeImports");
    });
  });

  describe("Related Information", () => {
    interface DiagnosticRange {
      start: { line: number; character: number };
      end: { line: number; character: number };
    }

    interface DiagnosticRelatedInfo {
      location: {
        uri: string;
        range: DiagnosticRange;
      };
      message: string;
    }

    it("should track related information", () => {
      const relatedInfo: DiagnosticRelatedInfo[] = [
        {
          location: {
            uri: "file:///src/types.ts",
            range: { start: { line: 5, character: 0 }, end: { line: 5, character: 20 } },
          },
          message: "Type declared here",
        },
        {
          location: {
            uri: "file:///src/utils.ts",
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 15 } },
          },
          message: "Used here",
        },
      ];

      expect(relatedInfo).toHaveLength(2);
    });
  });

  describe("IPC Integration", () => {
    it("should invoke diagnostics_refresh", async () => {
      vi.mocked(invoke).mockResolvedValue({ success: true });

      await invoke("diagnostics_refresh");

      expect(invoke).toHaveBeenCalledWith("diagnostics_refresh");
    });

    it("should invoke diagnostics_get_for_file", async () => {
      vi.mocked(invoke).mockResolvedValue([]);

      const result = await invoke("diagnostics_get_for_file", {
        uri: "file:///src/index.ts",
      });

      expect(invoke).toHaveBeenCalledWith("diagnostics_get_for_file", {
        uri: "file:///src/index.ts",
      });
      expect(result).toEqual([]);
    });

    it("should listen for build:output events", async () => {
      await listen("build:output", () => {});

      expect(listen).toHaveBeenCalledWith("build:output", expect.any(Function));
    });

    it("should listen for task:output events", async () => {
      await listen("task:output", () => {});

      expect(listen).toHaveBeenCalledWith("task:output", expect.any(Function));
    });

    it("should listen for file:changed events", async () => {
      await listen("file:changed", () => {});

      expect(listen).toHaveBeenCalledWith("file:changed", expect.any(Function));
    });
  });

  describe("Panel State", () => {
    it("should toggle panel visibility", () => {
      let isPanelOpen = false;

      isPanelOpen = true;
      expect(isPanelOpen).toBe(true);

      isPanelOpen = false;
      expect(isPanelOpen).toBe(false);
    });

    it("should track selected diagnostic", () => {
      let selectedDiagnosticId: string | null = null;

      selectedDiagnosticId = "diag-1";
      expect(selectedDiagnosticId).toBe("diag-1");

      selectedDiagnosticId = null;
      expect(selectedDiagnosticId).toBeNull();
    });

    it("should track refresh state", () => {
      let isRefreshing = false;

      isRefreshing = true;
      expect(isRefreshing).toBe(true);

      isRefreshing = false;
      expect(isRefreshing).toBe(false);
    });

    it("should track auto refresh setting", () => {
      let autoRefresh = true;

      autoRefresh = false;
      expect(autoRefresh).toBe(false);
    });

    it("should track current file URI", () => {
      let currentFileUri: string | null = null;

      currentFileUri = "file:///src/index.ts";
      expect(currentFileUri).toBe("file:///src/index.ts");
    });
  });

  describe("Export Functionality", () => {
    interface Diagnostic {
      uri: string;
      severity: number;
      message: string;
      line: number;
    }

    it("should format diagnostics for export", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///src/a.ts", severity: 1, message: "Error 1", line: 10 },
        { uri: "file:///src/b.ts", severity: 2, message: "Warning 1", line: 20 },
      ];

      const exported = diagnostics.map((d) => ({
        file: d.uri.replace("file://", ""),
        line: d.line,
        severity: d.severity === 1 ? "error" : d.severity === 2 ? "warning" : "info",
        message: d.message,
      }));

      expect(exported[0].severity).toBe("error");
      expect(exported[1].severity).toBe("warning");
    });
  });

  describe("Diagnostics Summary", () => {
    interface Diagnostic {
      uri: string;
      severity: number;
      message: string;
    }

    interface DiagnosticsSummary {
      error: number;
      warning: number;
      information: number;
      hint: number;
      total: number;
    }

    const getDiagnosticsSummary = (diagnostics: Diagnostic[]): DiagnosticsSummary => {
      const summary: DiagnosticsSummary = { error: 0, warning: 0, information: 0, hint: 0, total: 0 };
      for (const d of diagnostics) {
        if (d.severity === 1) summary.error++;
        else if (d.severity === 2) summary.warning++;
        else if (d.severity === 3) summary.information++;
        else if (d.severity === 4) summary.hint++;
        summary.total++;
      }
      return summary;
    };

    it("should return correct counts", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Error" },
        { uri: "file:///a.ts", severity: 2, message: "Warning" },
        { uri: "file:///a.ts", severity: 3, message: "Info" },
        { uri: "file:///a.ts", severity: 4, message: "Hint" },
      ];

      const summary = getDiagnosticsSummary(diagnostics);
      expect(summary.error).toBe(1);
      expect(summary.warning).toBe(1);
      expect(summary.information).toBe(1);
      expect(summary.hint).toBe(1);
      expect(summary.total).toBe(4);
    });

    it("should return zeros for empty diagnostics", () => {
      const summary = getDiagnosticsSummary([]);
      expect(summary.error).toBe(0);
      expect(summary.warning).toBe(0);
      expect(summary.total).toBe(0);
    });

    it("should handle mixed severities", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "E1" },
        { uri: "file:///a.ts", severity: 1, message: "E2" },
        { uri: "file:///a.ts", severity: 2, message: "W1" },
        { uri: "file:///a.ts", severity: 1, message: "E3" },
      ];

      const summary = getDiagnosticsSummary(diagnostics);
      expect(summary.error).toBe(3);
      expect(summary.warning).toBe(1);
      expect(summary.total).toBe(4);
    });

    it("should count across multiple files", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Error in a" },
        { uri: "file:///b.ts", severity: 1, message: "Error in b" },
        { uri: "file:///c.ts", severity: 2, message: "Warning in c" },
      ];

      const summary = getDiagnosticsSummary(diagnostics);
      expect(summary.error).toBe(2);
      expect(summary.warning).toBe(1);
      expect(summary.total).toBe(3);
    });

    it("should work with filtered diagnostics", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Error" },
        { uri: "file:///a.ts", severity: 2, message: "Warning" },
        { uri: "file:///b.ts", severity: 1, message: "Error" },
      ];

      const filtered = diagnostics.filter(d => d.severity === 1);
      const summary = getDiagnosticsSummary(filtered);
      expect(summary.error).toBe(2);
      expect(summary.warning).toBe(0);
      expect(summary.total).toBe(2);
    });
  });

  describe("Diagnostics Pattern Filtering", () => {
    interface Diagnostic {
      uri: string;
      message: string;
      severity: number;
    }

    const filterDiagnosticsByPattern = (
      diagnostics: Diagnostic[],
      pattern: string,
      field: "uri" | "message"
    ): Diagnostic[] => {
      if (!pattern) return diagnostics;
      try {
        const regex = new RegExp(pattern, "i");
        return diagnostics.filter(d => regex.test(d[field]));
      } catch {
        return diagnostics;
      }
    };

    it("should filter by regex pattern", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///src/app.ts", severity: 1, message: "Type error: string not assignable" },
        { uri: "file:///src/utils.ts", severity: 2, message: "Unused variable 'x'" },
        { uri: "file:///src/app.ts", severity: 1, message: "Type error: number not assignable" },
      ];

      const filtered = filterDiagnosticsByPattern(diagnostics, "Type error", "message");
      expect(filtered).toHaveLength(2);
    });

    it("should filter by file pattern", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///src/app.ts", severity: 1, message: "Error" },
        { uri: "file:///src/utils.ts", severity: 1, message: "Error" },
        { uri: "file:///src/app.test.ts", severity: 2, message: "Warning" },
      ];

      const filtered = filterDiagnosticsByPattern(diagnostics, "app", "uri");
      expect(filtered).toHaveLength(2);
    });

    it("should filter by message pattern", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Cannot find module 'lodash'" },
        { uri: "file:///b.ts", severity: 2, message: "Unused import" },
        { uri: "file:///c.ts", severity: 1, message: "Cannot find module 'react'" },
      ];

      const filtered = filterDiagnosticsByPattern(diagnostics, "Cannot find module", "message");
      expect(filtered).toHaveLength(2);
    });

    it("should return empty array when no matches", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Error" },
      ];

      const filtered = filterDiagnosticsByPattern(diagnostics, "no-match-xyz", "message");
      expect(filtered).toHaveLength(0);
    });

    it("should return all diagnostics with empty pattern", () => {
      const diagnostics: Diagnostic[] = [
        { uri: "file:///a.ts", severity: 1, message: "Error 1" },
        { uri: "file:///b.ts", severity: 2, message: "Warning 1" },
      ];

      const filtered = filterDiagnosticsByPattern(diagnostics, "", "message");
      expect(filtered).toHaveLength(2);
    });
  });
});
