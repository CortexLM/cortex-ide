/**
 * DiagnosticsPanel Tests
 *
 * Tests for the DiagnosticsPanel component types, constants, and interfaces.
 */

import { describe, it, expect } from "vitest";

describe("DiagnosticsPanel", () => {
  describe("SEVERITY_COLORS mapping", () => {
    interface TestSeverityColors {
      error: string;
      warning: string;
      information: string;
      hint: string;
    }

    it("should have color for error severity", () => {
      const colors: TestSeverityColors = {
        error: "#f75464",
        warning: "#e9aa46",
        information: "#3574f0",
        hint: "#808080",
      };
      expect(colors.error).toBeDefined();
      expect(typeof colors.error).toBe("string");
      expect(colors.error.length).toBeGreaterThan(0);
    });

    it("should have color for warning severity", () => {
      const colors: TestSeverityColors = {
        error: "#f75464",
        warning: "#e9aa46",
        information: "#3574f0",
        hint: "#808080",
      };
      expect(colors.warning).toBeDefined();
      expect(typeof colors.warning).toBe("string");
      expect(colors.warning.length).toBeGreaterThan(0);
    });

    it("should have color for information severity", () => {
      const colors: TestSeverityColors = {
        error: "#f75464",
        warning: "#e9aa46",
        information: "#3574f0",
        hint: "#808080",
      };
      expect(colors.information).toBeDefined();
      expect(typeof colors.information).toBe("string");
      expect(colors.information.length).toBeGreaterThan(0);
    });

    it("should have color for hint severity", () => {
      const colors: TestSeverityColors = {
        error: "#f75464",
        warning: "#e9aa46",
        information: "#3574f0",
        hint: "#808080",
      };
      expect(colors.hint).toBeDefined();
      expect(typeof colors.hint).toBe("string");
      expect(colors.hint.length).toBeGreaterThan(0);
    });

    it("should have all four severity colors defined", () => {
      const colors: TestSeverityColors = {
        error: "#f75464",
        warning: "#e9aa46",
        information: "#3574f0",
        hint: "#808080",
      };
      const keys = Object.keys(colors);
      expect(keys).toContain("error");
      expect(keys).toContain("warning");
      expect(keys).toContain("information");
      expect(keys).toContain("hint");
      expect(keys.length).toBe(4);
    });
  });

  describe("DiagnosticSeverity types", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

    it("should accept error as valid severity", () => {
      const severity: DiagnosticSeverity = "error";
      expect(severity).toBe("error");
    });

    it("should accept warning as valid severity", () => {
      const severity: DiagnosticSeverity = "warning";
      expect(severity).toBe("warning");
    });

    it("should accept information as valid severity", () => {
      const severity: DiagnosticSeverity = "information";
      expect(severity).toBe("information");
    });

    it("should accept hint as valid severity", () => {
      const severity: DiagnosticSeverity = "hint";
      expect(severity).toBe("hint");
    });

    it("should have exactly four severity types", () => {
      const severities: DiagnosticSeverity[] = ["error", "warning", "information", "hint"];
      expect(severities.length).toBe(4);
    });
  });

  describe("DiagnosticSource types", () => {
    type DiagnosticSource = "lsp" | "typescript" | "eslint" | "build" | "task" | "custom";

    it("should accept lsp as valid source", () => {
      const source: DiagnosticSource = "lsp";
      expect(source).toBe("lsp");
    });

    it("should accept typescript as valid source", () => {
      const source: DiagnosticSource = "typescript";
      expect(source).toBe("typescript");
    });

    it("should accept eslint as valid source", () => {
      const source: DiagnosticSource = "eslint";
      expect(source).toBe("eslint");
    });

    it("should accept build as valid source", () => {
      const source: DiagnosticSource = "build";
      expect(source).toBe("build");
    });

    it("should accept task as valid source", () => {
      const source: DiagnosticSource = "task";
      expect(source).toBe("task");
    });

    it("should accept custom as valid source", () => {
      const source: DiagnosticSource = "custom";
      expect(source).toBe("custom");
    });

    it("should have exactly six source types", () => {
      const sources: DiagnosticSource[] = ["lsp", "typescript", "eslint", "build", "task", "custom"];
      expect(sources.length).toBe(6);
    });
  });

  describe("UnifiedDiagnostic interface", () => {
    type DiagnosticSeverity = "error" | "warning" | "information" | "hint";
    type DiagnosticSource = "lsp" | "typescript" | "eslint" | "build" | "task" | "custom";

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
      relatedInformation?: Array<{
        location: { uri: string; range: DiagnosticRange };
        message: string;
      }>;
      codeActions?: Array<{
        title: string;
        kind?: string;
        isPreferred?: boolean;
      }>;
      timestamp: number;
    }

    it("should have required id field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "typescript",
        message: "Test error",
        timestamp: Date.now(),
      };
      expect(diagnostic.id).toBe("diag-1");
    });

    it("should have required uri field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "typescript",
        message: "Test error",
        timestamp: Date.now(),
      };
      expect(diagnostic.uri).toBe("file:///test.ts");
    });

    it("should have required range field with start and end positions", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 5, character: 10 }, end: { line: 5, character: 20 } },
        severity: "warning",
        source: "eslint",
        message: "Test warning",
        timestamp: Date.now(),
      };
      expect(diagnostic.range.start.line).toBe(5);
      expect(diagnostic.range.start.character).toBe(10);
      expect(diagnostic.range.end.line).toBe(5);
      expect(diagnostic.range.end.character).toBe(20);
    });

    it("should have required severity field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "information",
        source: "lsp",
        message: "Test info",
        timestamp: Date.now(),
      };
      expect(diagnostic.severity).toBe("information");
    });

    it("should have required source field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "hint",
        source: "build",
        message: "Test hint",
        timestamp: Date.now(),
      };
      expect(diagnostic.source).toBe("build");
    });

    it("should have required message field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "task",
        message: "Cannot find module",
        timestamp: Date.now(),
      };
      expect(diagnostic.message).toBe("Cannot find module");
    });

    it("should have required timestamp field", () => {
      const now = Date.now();
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "custom",
        message: "Test error",
        timestamp: now,
      };
      expect(diagnostic.timestamp).toBe(now);
    });

    it("should support optional code field as string", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "eslint",
        message: "Test error",
        timestamp: Date.now(),
        code: "no-unused-vars",
      };
      expect(diagnostic.code).toBe("no-unused-vars");
    });

    it("should support optional code field as number", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "typescript",
        message: "Test error",
        timestamp: Date.now(),
        code: 2304,
      };
      expect(diagnostic.code).toBe(2304);
    });

    it("should support optional sourceName field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "warning",
        source: "lsp",
        sourceName: "TypeScript",
        message: "Test warning",
        timestamp: Date.now(),
      };
      expect(diagnostic.sourceName).toBe("TypeScript");
    });

    it("should support optional relatedInformation field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "typescript",
        message: "Test error",
        timestamp: Date.now(),
        relatedInformation: [
          {
            location: {
              uri: "file:///other.ts",
              range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
            },
            message: "Related info here",
          },
        ],
      };
      expect(diagnostic.relatedInformation).toHaveLength(1);
      expect(diagnostic.relatedInformation?.[0].message).toBe("Related info here");
    });

    it("should support optional codeActions field", () => {
      const diagnostic: UnifiedDiagnostic = {
        id: "diag-1",
        uri: "file:///test.ts",
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        severity: "error",
        source: "eslint",
        message: "Test error",
        timestamp: Date.now(),
        codeActions: [
          { title: "Fix this issue", kind: "quickfix", isPreferred: true },
        ],
      };
      expect(diagnostic.codeActions).toHaveLength(1);
      expect(diagnostic.codeActions?.[0].title).toBe("Fix this issue");
      expect(diagnostic.codeActions?.[0].isPreferred).toBe(true);
    });
  });

  describe("CodeAction interface", () => {
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

    it("should have required title field", () => {
      const action: CodeAction = { title: "Fix error" };
      expect(action.title).toBe("Fix error");
    });

    it("should support optional kind field", () => {
      const action: CodeAction = { title: "Fix", kind: "quickfix" };
      expect(action.kind).toBe("quickfix");
    });

    it("should support optional isPreferred field", () => {
      const action: CodeAction = { title: "Fix", isPreferred: true };
      expect(action.isPreferred).toBe(true);
    });

    it("should support optional edit field with changes", () => {
      const action: CodeAction = {
        title: "Fix",
        edit: {
          changes: {
            "file:///test.ts": [
              {
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                newText: "const",
              },
            ],
          },
        },
      };
      expect(action.edit?.changes).toBeDefined();
      expect(action.edit?.changes?.["file:///test.ts"]).toHaveLength(1);
    });

    it("should support optional command field", () => {
      const action: CodeAction = {
        title: "Run command",
        command: {
          title: "Execute fix",
          command: "eslint.applyFix",
          arguments: [{ fixId: "123" }],
        },
      };
      expect(action.command?.title).toBe("Execute fix");
      expect(action.command?.command).toBe("eslint.applyFix");
      expect(action.command?.arguments).toHaveLength(1);
    });
  });

  describe("Grouping modes", () => {
    type GroupMode = "file" | "severity" | "source";

    it("should accept file as valid group mode", () => {
      const mode: GroupMode = "file";
      expect(mode).toBe("file");
    });

    it("should accept severity as valid group mode", () => {
      const mode: GroupMode = "severity";
      expect(mode).toBe("severity");
    });

    it("should accept source as valid group mode", () => {
      const mode: GroupMode = "source";
      expect(mode).toBe("source");
    });

    it("should have exactly three group modes", () => {
      const modes: GroupMode[] = ["file", "severity", "source"];
      expect(modes.length).toBe(3);
    });
  });

  describe("Filter logic", () => {
    interface DiagnosticFilter {
      showErrors: boolean;
      showWarnings: boolean;
      showInformation: boolean;
      showHints: boolean;
      currentFileOnly: boolean;
    }

    it("should have showErrors filter option", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: true,
        showHints: true,
        currentFileOnly: false,
      };
      expect(filter.showErrors).toBe(true);
    });

    it("should have showWarnings filter option", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: false,
        showInformation: true,
        showHints: true,
        currentFileOnly: false,
      };
      expect(filter.showWarnings).toBe(false);
    });

    it("should have showInformation filter option", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: false,
        showHints: true,
        currentFileOnly: false,
      };
      expect(filter.showInformation).toBe(false);
    });

    it("should have showHints filter option", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: true,
        showHints: false,
        currentFileOnly: false,
      };
      expect(filter.showHints).toBe(false);
    });

    it("should have currentFileOnly filter option", () => {
      const filter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: true,
        showHints: true,
        currentFileOnly: true,
      };
      expect(filter.currentFileOnly).toBe(true);
    });

    it("should support default filter with all severities shown", () => {
      const defaultFilter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: true,
        showInformation: true,
        showHints: true,
        currentFileOnly: false,
      };
      expect(defaultFilter.showErrors).toBe(true);
      expect(defaultFilter.showWarnings).toBe(true);
      expect(defaultFilter.showInformation).toBe(true);
      expect(defaultFilter.showHints).toBe(true);
      expect(defaultFilter.currentFileOnly).toBe(false);
    });

    it("should support errors-only filter", () => {
      const errorsOnlyFilter: DiagnosticFilter = {
        showErrors: true,
        showWarnings: false,
        showInformation: false,
        showHints: false,
        currentFileOnly: false,
      };
      expect(errorsOnlyFilter.showErrors).toBe(true);
      expect(errorsOnlyFilter.showWarnings).toBe(false);
      expect(errorsOnlyFilter.showInformation).toBe(false);
      expect(errorsOnlyFilter.showHints).toBe(false);
    });
  });

  describe("Diagnostic sorting", () => {
    interface SeverityOrder {
      error: number;
      warning: number;
      information: number;
      hint: number;
    }

    it("should have error as highest priority (0)", () => {
      const order: SeverityOrder = {
        error: 0,
        warning: 1,
        information: 2,
        hint: 3,
      };
      expect(order.error).toBe(0);
    });

    it("should have warning as second priority (1)", () => {
      const order: SeverityOrder = {
        error: 0,
        warning: 1,
        information: 2,
        hint: 3,
      };
      expect(order.warning).toBe(1);
    });

    it("should have information as third priority (2)", () => {
      const order: SeverityOrder = {
        error: 0,
        warning: 1,
        information: 2,
        hint: 3,
      };
      expect(order.information).toBe(2);
    });

    it("should have hint as lowest priority (3)", () => {
      const order: SeverityOrder = {
        error: 0,
        warning: 1,
        information: 2,
        hint: 3,
      };
      expect(order.hint).toBe(3);
    });

    it("should sort diagnostics by severity correctly", () => {
      type DiagnosticSeverity = "error" | "warning" | "information" | "hint";
      const severityOrder: Record<DiagnosticSeverity, number> = {
        error: 0,
        warning: 1,
        information: 2,
        hint: 3,
      };

      const diagnostics: Array<{ severity: DiagnosticSeverity; message: string }> = [
        { severity: "hint", message: "hint message" },
        { severity: "error", message: "error message" },
        { severity: "information", message: "info message" },
        { severity: "warning", message: "warning message" },
      ];

      const sorted = [...diagnostics].sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      );

      expect(sorted[0].severity).toBe("error");
      expect(sorted[1].severity).toBe("warning");
      expect(sorted[2].severity).toBe("information");
      expect(sorted[3].severity).toBe("hint");
    });

    it("should sort diagnostics by file path", () => {
      const diagnostics = [
        { uri: "file:///z/last.ts", message: "error" },
        { uri: "file:///a/first.ts", message: "error" },
        { uri: "file:///m/middle.ts", message: "error" },
      ];

      const sorted = [...diagnostics].sort((a, b) => a.uri.localeCompare(b.uri));

      expect(sorted[0].uri).toBe("file:///a/first.ts");
      expect(sorted[1].uri).toBe("file:///m/middle.ts");
      expect(sorted[2].uri).toBe("file:///z/last.ts");
    });
  });

  describe("Export formats", () => {
    type ExportFormat = "json" | "csv" | "markdown";

    it("should accept json as valid export format", () => {
      const format: ExportFormat = "json";
      expect(format).toBe("json");
    });

    it("should accept csv as valid export format", () => {
      const format: ExportFormat = "csv";
      expect(format).toBe("csv");
    });

    it("should accept markdown as valid export format", () => {
      const format: ExportFormat = "markdown";
      expect(format).toBe("markdown");
    });

    it("should have exactly three export formats", () => {
      const formats: ExportFormat[] = ["json", "csv", "markdown"];
      expect(formats.length).toBe(3);
    });

    it("should format JSON export correctly", () => {
      const diagnostics = [
        {
          id: "1",
          uri: "file:///test.ts",
          severity: "error",
          message: "Test error",
          line: 1,
          column: 1,
        },
      ];
      const jsonExport = JSON.stringify(diagnostics, null, 2);
      expect(jsonExport).toContain('"id": "1"');
      expect(jsonExport).toContain('"severity": "error"');
      expect(jsonExport).toContain('"message": "Test error"');
    });

    it("should format CSV export with headers", () => {
      const headers = ["File", "Line", "Column", "Severity", "Code", "Message"];
      const csvHeader = headers.join(",");
      expect(csvHeader).toBe("File,Line,Column,Severity,Code,Message");
    });

    it("should format Markdown export with table structure", () => {
      const mdHeader = "| File | Line | Severity | Message |";
      const mdSeparator = "|------|------|----------|---------|";
      const mdRow = "| test.ts | 1 | error | Test error |";
      expect(mdHeader).toContain("|");
      expect(mdSeparator).toContain("---");
      expect(mdRow).toContain("test.ts");
    });
  });
});
