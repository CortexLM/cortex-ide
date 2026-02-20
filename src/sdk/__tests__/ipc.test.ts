import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  lspCodeAction,
  lspCodeLens,
  lspResolveCodeLens,
  lspFormatDocument,
  lspFormatRange,
  lspRename,
  lspPrepareRename,
  lspSignatureHelp,
  lspInlayHints,
  lspCallHierarchyPrepare,
  lspCallHierarchyIncoming,
  lspCallHierarchyOutgoing,
  lspTypeHierarchyPrepare,
  lspTypeHierarchySupertypes,
  lspTypeHierarchySubtypes,
  dapSetConditionalBreakpoint,
  dapSetLogpoint,
  dapSetDataBreakpoint,
  dapAddWatchExpression,
  dapRemoveWatchExpression,
  dapEvaluateWatch,
  dapDebugConsoleEval,
  dapDisassemble,
  extensionInstall,
  extensionUninstall,
  extensionEnable,
  extensionDisable,
  extensionGetPermissions,
  extensionSetPermissions,
  extensionGetLifecycleState,
  extensionTriggerHostFunction,
  extensionListInstalled,
  getDiagnosticsByFile,
  getDiagnosticsSummary,
  filterDiagnostics,
  searchTerminal,
  getTerminalProfiles,
  saveTerminalProfile,
  detectTerminalLinks,
} from "../ipc";
import type {
  LspRange,
  CodeActionContext,
  CodeLens,
  FormattingOptions,
  LspPosition,
  CallHierarchyItem,
  TypeHierarchyItem,
  ExtensionPermissions,
  TerminalProfile,
  DiagnosticsFilter,
} from "../ipc";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const mockRange: LspRange = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: 10 },
};

const mockPosition: LspPosition = { line: 5, character: 12 };

const mockFormattingOptions: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  trimTrailingWhitespace: true,
  insertFinalNewline: true,
};

const mockCallHierarchyItem: CallHierarchyItem = {
  name: "myFunction",
  kind: 12,
  uri: "file:///src/app.ts",
  range: mockRange,
  selectionRange: mockRange,
  detail: "function myFunction()",
};

const mockTypeHierarchyItem: TypeHierarchyItem = {
  name: "MyClass",
  kind: 5,
  uri: "file:///src/models.ts",
  range: mockRange,
  selectionRange: mockRange,
  detail: "class MyClass",
};

describe("IPC Wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LSP Advanced Features", () => {
    describe("lspCodeAction", () => {
      const context: CodeActionContext = {
        diagnostics: [
          {
            range: mockRange,
            message: "Unused variable",
            severity: 2,
            code: "6133",
            source: "typescript",
          },
        ],
        only: ["quickfix"],
      };

      it("should return code actions for given params", async () => {
        const mockActions = [
          { title: "Remove unused variable", kind: "quickfix", isPreferred: true },
          { title: "Add underscore prefix", kind: "quickfix" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockActions);

        const result = await lspCodeAction("ts-server-1", "file:///src/app.ts", mockRange, context);

        expect(result).toEqual(mockActions);
        expect(invoke).toHaveBeenCalledWith("lsp_code_action", {
          serverId: "ts-server-1",
          uri: "file:///src/app.ts",
          range: mockRange,
          context,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Server not running"));

        const result = await lspCodeAction("ts-server-1", "file:///src/app.ts", mockRange, context);

        expect(result).toEqual([]);
      });

      it("should pass correct command name", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspCodeAction("server-1", "file:///test.ts", mockRange, context);

        expect(invoke).toHaveBeenCalledWith("lsp_code_action", expect.objectContaining({
          serverId: "server-1",
        }));
      });
    });

    describe("lspCodeLens", () => {
      it("should return array of CodeLens", async () => {
        const mockLenses: CodeLens[] = [
          { range: mockRange, command: { title: "3 references", command: "showReferences", arguments: [] } },
          { range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } } },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockLenses);

        const result = await lspCodeLens("ts-server-1", "file:///src/app.ts");

        expect(result).toEqual(mockLenses);
        expect(result).toHaveLength(2);
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspCodeLens("server-1", "file:///test.ts");

        expect(invoke).toHaveBeenCalledWith("lsp_code_lens", {
          serverId: "server-1",
          uri: "file:///test.ts",
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Timeout"));

        const result = await lspCodeLens("ts-server-1", "file:///src/app.ts");

        expect(result).toEqual([]);
      });
    });

    describe("lspResolveCodeLens", () => {
      const unresolved: CodeLens = { range: mockRange, data: { uri: "file:///test.ts" } };

      it("should resolve a CodeLens item", async () => {
        const resolved: CodeLens = {
          range: mockRange,
          command: { title: "5 references", command: "showReferences", arguments: [] },
        };
        vi.mocked(invoke).mockResolvedValueOnce(resolved);

        const result = await lspResolveCodeLens("ts-server-1", unresolved);

        expect(result.command?.title).toBe("5 references");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(unresolved);

        await lspResolveCodeLens("server-1", unresolved);

        expect(invoke).toHaveBeenCalledWith("lsp_resolve_code_lens", {
          serverId: "server-1",
          codeLens: unresolved,
        });
      });

      it("should return original CodeLens on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Resolve failed"));

        const result = await lspResolveCodeLens("ts-server-1", unresolved);

        expect(result).toEqual(unresolved);
      });
    });

    describe("lspFormatDocument", () => {
      it("should return text edits for formatting", async () => {
        const mockEdits = [
          { range: mockRange, newText: "  const x = 1;\n" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockEdits);

        const result = await lspFormatDocument("ts-server-1", "file:///src/app.ts", mockFormattingOptions);

        expect(result).toEqual(mockEdits);
      });

      it("should call invoke with serverId, uri, and options", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspFormatDocument("server-1", "file:///test.ts", mockFormattingOptions);

        expect(invoke).toHaveBeenCalledWith("lsp_format_document", {
          serverId: "server-1",
          uri: "file:///test.ts",
          options: mockFormattingOptions,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Formatter unavailable"));

        const result = await lspFormatDocument("ts-server-1", "file:///src/app.ts", mockFormattingOptions);

        expect(result).toEqual([]);
      });
    });

    describe("lspFormatRange", () => {
      it("should return text edits for range formatting", async () => {
        const mockEdits = [
          { range: mockRange, newText: "formatted code" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockEdits);

        const result = await lspFormatRange("ts-server-1", "file:///src/app.ts", mockRange, mockFormattingOptions);

        expect(result).toEqual(mockEdits);
      });

      it("should pass range param to invoke", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspFormatRange("server-1", "file:///test.ts", mockRange, mockFormattingOptions);

        expect(invoke).toHaveBeenCalledWith("lsp_format_range", {
          serverId: "server-1",
          uri: "file:///test.ts",
          range: mockRange,
          options: mockFormattingOptions,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Range format error"));

        const result = await lspFormatRange("ts-server-1", "file:///src/app.ts", mockRange, mockFormattingOptions);

        expect(result).toEqual([]);
      });
    });

    describe("lspRename", () => {
      it("should return workspace edit with newName", async () => {
        const mockEdit = {
          changes: {
            "file:///src/app.ts": [
              { range: mockRange, newText: "newVarName" },
            ],
          },
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockEdit);

        const result = await lspRename("ts-server-1", "file:///src/app.ts", mockPosition, "newVarName");

        expect(result).toEqual(mockEdit);
      });

      it("should call invoke with newName param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await lspRename("server-1", "file:///test.ts", mockPosition, "renamedSymbol");

        expect(invoke).toHaveBeenCalledWith("lsp_rename", {
          serverId: "server-1",
          uri: "file:///test.ts",
          position: mockPosition,
          newName: "renamedSymbol",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Rename failed"));

        const result = await lspRename("ts-server-1", "file:///src/app.ts", mockPosition, "newName");

        expect(result).toBeNull();
      });
    });

    describe("lspPrepareRename", () => {
      it("should return range and placeholder", async () => {
        const mockResult = {
          range: mockRange,
          placeholder: "currentName",
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockResult);

        const result = await lspPrepareRename("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result?.range).toEqual(mockRange);
        expect(result?.placeholder).toBe("currentName");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await lspPrepareRename("server-1", "file:///test.ts", mockPosition);

        expect(invoke).toHaveBeenCalledWith("lsp_prepare_rename", {
          serverId: "server-1",
          uri: "file:///test.ts",
          position: mockPosition,
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Cannot rename"));

        const result = await lspPrepareRename("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result).toBeNull();
      });
    });

    describe("lspSignatureHelp", () => {
      it("should return SignatureHelp", async () => {
        const mockHelp = {
          signatures: [
            {
              label: "myFunction(a: number, b: string): void",
              documentation: "Does something",
              parameters: [
                { label: "a: number", documentation: "First param" },
                { label: "b: string", documentation: "Second param" },
              ],
            },
          ],
          activeSignature: 0,
          activeParameter: 1,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockHelp);

        const result = await lspSignatureHelp("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result?.signatures).toHaveLength(1);
        expect(result?.activeParameter).toBe(1);
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await lspSignatureHelp("server-1", "file:///test.ts", mockPosition);

        expect(invoke).toHaveBeenCalledWith("lsp_signature_help", {
          serverId: "server-1",
          uri: "file:///test.ts",
          position: mockPosition,
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("No signature"));

        const result = await lspSignatureHelp("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result).toBeNull();
      });
    });

    describe("lspInlayHints", () => {
      it("should return InlayHint array", async () => {
        const mockHints = [
          { position: { line: 1, character: 10 }, label: ": number", kind: 1, paddingLeft: true },
          { position: { line: 3, character: 5 }, label: "param:", kind: 2, paddingRight: true },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockHints);

        const result = await lspInlayHints("ts-server-1", "file:///src/app.ts", mockRange);

        expect(result).toHaveLength(2);
        expect(result[0].label).toBe(": number");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspInlayHints("server-1", "file:///test.ts", mockRange);

        expect(invoke).toHaveBeenCalledWith("lsp_inlay_hints", {
          serverId: "server-1",
          uri: "file:///test.ts",
          range: mockRange,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Hints error"));

        const result = await lspInlayHints("ts-server-1", "file:///src/app.ts", mockRange);

        expect(result).toEqual([]);
      });
    });

    describe("lspCallHierarchyPrepare", () => {
      it("should return CallHierarchyItem array", async () => {
        const mockItems = [mockCallHierarchyItem];
        vi.mocked(invoke).mockResolvedValueOnce(mockItems);

        const result = await lspCallHierarchyPrepare("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("myFunction");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspCallHierarchyPrepare("server-1", "file:///test.ts", mockPosition);

        expect(invoke).toHaveBeenCalledWith("lsp_call_hierarchy_prepare", {
          serverId: "server-1",
          uri: "file:///test.ts",
          position: mockPosition,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Hierarchy error"));

        const result = await lspCallHierarchyPrepare("ts-server-1", "file:///src/app.ts", mockPosition);

        expect(result).toEqual([]);
      });
    });

    describe("lspCallHierarchyIncoming", () => {
      it("should return incoming calls with item param", async () => {
        const mockCalls = [
          {
            from: { ...mockCallHierarchyItem, name: "callerFunction" },
            fromRanges: [mockRange],
          },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockCalls);

        const result = await lspCallHierarchyIncoming("ts-server-1", mockCallHierarchyItem);

        expect(result).toHaveLength(1);
        expect(result[0].from.name).toBe("callerFunction");
      });

      it("should call invoke with item param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspCallHierarchyIncoming("server-1", mockCallHierarchyItem);

        expect(invoke).toHaveBeenCalledWith("lsp_call_hierarchy_incoming", {
          serverId: "server-1",
          item: mockCallHierarchyItem,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Incoming calls error"));

        const result = await lspCallHierarchyIncoming("ts-server-1", mockCallHierarchyItem);

        expect(result).toEqual([]);
      });
    });

    describe("lspCallHierarchyOutgoing", () => {
      it("should return outgoing calls with item param", async () => {
        const mockCalls = [
          {
            to: { ...mockCallHierarchyItem, name: "calleeFunction" },
            fromRanges: [mockRange],
          },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockCalls);

        const result = await lspCallHierarchyOutgoing("ts-server-1", mockCallHierarchyItem);

        expect(result).toHaveLength(1);
        expect(result[0].to.name).toBe("calleeFunction");
      });

      it("should call invoke with item param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspCallHierarchyOutgoing("server-1", mockCallHierarchyItem);

        expect(invoke).toHaveBeenCalledWith("lsp_call_hierarchy_outgoing", {
          serverId: "server-1",
          item: mockCallHierarchyItem,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Outgoing calls error"));

        const result = await lspCallHierarchyOutgoing("ts-server-1", mockCallHierarchyItem);

        expect(result).toEqual([]);
      });
    });

    describe("lspTypeHierarchyPrepare", () => {
      it("should return TypeHierarchyItem array", async () => {
        const mockItems = [mockTypeHierarchyItem];
        vi.mocked(invoke).mockResolvedValueOnce(mockItems);

        const result = await lspTypeHierarchyPrepare("ts-server-1", "file:///src/models.ts", mockPosition);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("MyClass");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspTypeHierarchyPrepare("server-1", "file:///test.ts", mockPosition);

        expect(invoke).toHaveBeenCalledWith("lsp_type_hierarchy_prepare", {
          serverId: "server-1",
          uri: "file:///test.ts",
          position: mockPosition,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Type hierarchy error"));

        const result = await lspTypeHierarchyPrepare("ts-server-1", "file:///src/models.ts", mockPosition);

        expect(result).toEqual([]);
      });
    });

    describe("lspTypeHierarchySupertypes", () => {
      it("should return supertypes with item param", async () => {
        const mockSupertypes = [
          { ...mockTypeHierarchyItem, name: "BaseClass" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockSupertypes);

        const result = await lspTypeHierarchySupertypes("ts-server-1", mockTypeHierarchyItem);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("BaseClass");
      });

      it("should call invoke with item param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspTypeHierarchySupertypes("server-1", mockTypeHierarchyItem);

        expect(invoke).toHaveBeenCalledWith("lsp_type_hierarchy_supertypes", {
          serverId: "server-1",
          item: mockTypeHierarchyItem,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Supertypes error"));

        const result = await lspTypeHierarchySupertypes("ts-server-1", mockTypeHierarchyItem);

        expect(result).toEqual([]);
      });
    });

    describe("lspTypeHierarchySubtypes", () => {
      it("should return subtypes with item param", async () => {
        const mockSubtypes = [
          { ...mockTypeHierarchyItem, name: "DerivedClass" },
          { ...mockTypeHierarchyItem, name: "AnotherDerived" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockSubtypes);

        const result = await lspTypeHierarchySubtypes("ts-server-1", mockTypeHierarchyItem);

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("DerivedClass");
      });

      it("should call invoke with item param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await lspTypeHierarchySubtypes("server-1", mockTypeHierarchyItem);

        expect(invoke).toHaveBeenCalledWith("lsp_type_hierarchy_subtypes", {
          serverId: "server-1",
          item: mockTypeHierarchyItem,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Subtypes error"));

        const result = await lspTypeHierarchySubtypes("ts-server-1", mockTypeHierarchyItem);

        expect(result).toEqual([]);
      });
    });
  });

  describe("DAP Advanced Features", () => {
    describe("dapSetConditionalBreakpoint", () => {
      it("should set breakpoint with condition param", async () => {
        const mockBreakpoint = {
          id: 1,
          verified: true,
          line: 42,
          source: "app.ts",
          condition: "x > 10",
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockBreakpoint);

        const result = await dapSetConditionalBreakpoint("session-1", "app.ts", 42, "x > 10");

        expect(result?.id).toBe(1);
        expect(result?.condition).toBe("x > 10");
        expect(result?.verified).toBe(true);
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapSetConditionalBreakpoint("sess-1", "main.ts", 10, "count === 5");

        expect(invoke).toHaveBeenCalledWith("dap_set_conditional_breakpoint", {
          sessionId: "sess-1",
          source: "main.ts",
          line: 10,
          condition: "count === 5",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Breakpoint error"));

        const result = await dapSetConditionalBreakpoint("session-1", "app.ts", 42, "x > 10");

        expect(result).toBeNull();
      });
    });

    describe("dapSetLogpoint", () => {
      it("should set logpoint with logMessage param", async () => {
        const mockBreakpoint = {
          id: 2,
          verified: true,
          line: 15,
          source: "app.ts",
          logMessage: "Value of x: {x}",
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockBreakpoint);

        const result = await dapSetLogpoint("session-1", "app.ts", 15, "Value of x: {x}");

        expect(result?.logMessage).toBe("Value of x: {x}");
        expect(result?.line).toBe(15);
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapSetLogpoint("sess-1", "main.ts", 20, "Reached line 20");

        expect(invoke).toHaveBeenCalledWith("dap_set_logpoint", {
          sessionId: "sess-1",
          source: "main.ts",
          line: 20,
          logMessage: "Reached line 20",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Logpoint error"));

        const result = await dapSetLogpoint("session-1", "app.ts", 15, "log msg");

        expect(result).toBeNull();
      });
    });

    describe("dapSetDataBreakpoint", () => {
      it("should set data breakpoint with variableName and accessType", async () => {
        const mockBreakpoint = {
          id: 3,
          verified: true,
          variableName: "myVar",
          accessType: "write" as const,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockBreakpoint);

        const result = await dapSetDataBreakpoint("session-1", "myVar", "write");

        expect(result?.variableName).toBe("myVar");
        expect(result?.accessType).toBe("write");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapSetDataBreakpoint("sess-1", "counter", "readWrite");

        expect(invoke).toHaveBeenCalledWith("dap_set_data_breakpoint", {
          sessionId: "sess-1",
          variableName: "counter",
          accessType: "readWrite",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Data breakpoint error"));

        const result = await dapSetDataBreakpoint("session-1", "myVar", "read");

        expect(result).toBeNull();
      });
    });

    describe("dapAddWatchExpression", () => {
      it("should return watch expression", async () => {
        const mockWatch = {
          id: "watch-1",
          expression: "myObj.property",
          result: "42",
          type: "number",
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockWatch);

        const result = await dapAddWatchExpression("session-1", "myObj.property");

        expect(result?.id).toBe("watch-1");
        expect(result?.expression).toBe("myObj.property");
        expect(result?.result).toBe("42");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapAddWatchExpression("sess-1", "arr.length");

        expect(invoke).toHaveBeenCalledWith("dap_add_watch_expression", {
          sessionId: "sess-1",
          expression: "arr.length",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Watch error"));

        const result = await dapAddWatchExpression("session-1", "expr");

        expect(result).toBeNull();
      });
    });

    describe("dapRemoveWatchExpression", () => {
      it("should remove watch expression by id", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await dapRemoveWatchExpression("session-1", "watch-1");

        expect(result).toBe(true);
      });

      it("should call invoke with id param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await dapRemoveWatchExpression("sess-1", "watch-42");

        expect(invoke).toHaveBeenCalledWith("dap_remove_watch_expression", {
          sessionId: "sess-1",
          id: "watch-42",
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Remove error"));

        const result = await dapRemoveWatchExpression("session-1", "watch-1");

        expect(result).toBe(false);
      });
    });

    describe("dapEvaluateWatch", () => {
      it("should return evaluation result", async () => {
        const mockResult = {
          result: "Hello World",
          type: "string",
          variablesReference: 0,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockResult);

        const result = await dapEvaluateWatch("session-1", "greeting");

        expect(result?.result).toBe("Hello World");
        expect(result?.type).toBe("string");
      });

      it("should call invoke with optional frameId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapEvaluateWatch("sess-1", "x + y", 5);

        expect(invoke).toHaveBeenCalledWith("dap_evaluate_watch", {
          sessionId: "sess-1",
          expression: "x + y",
          frameId: 5,
        });
      });

      it("should call invoke without frameId when not provided", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapEvaluateWatch("sess-1", "x + y");

        expect(invoke).toHaveBeenCalledWith("dap_evaluate_watch", {
          sessionId: "sess-1",
          expression: "x + y",
          frameId: undefined,
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Eval error"));

        const result = await dapEvaluateWatch("session-1", "expr");

        expect(result).toBeNull();
      });
    });

    describe("dapDebugConsoleEval", () => {
      it("should evaluate expression with context", async () => {
        const mockResult = {
          result: "[1, 2, 3]",
          type: "Array",
          variablesReference: 10,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockResult);

        const result = await dapDebugConsoleEval("session-1", "myArray", "repl");

        expect(result?.result).toBe("[1, 2, 3]");
        expect(result?.type).toBe("Array");
      });

      it("should call invoke with expression and context params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapDebugConsoleEval("sess-1", "2 + 2", "watch");

        expect(invoke).toHaveBeenCalledWith("dap_debug_console_eval", {
          sessionId: "sess-1",
          expression: "2 + 2",
          context: "watch",
        });
      });

      it("should default context to repl", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await dapDebugConsoleEval("sess-1", "expr");

        expect(invoke).toHaveBeenCalledWith("dap_debug_console_eval", {
          sessionId: "sess-1",
          expression: "expr",
          context: "repl",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Console eval error"));

        const result = await dapDebugConsoleEval("session-1", "bad expr");

        expect(result).toBeNull();
      });
    });

    describe("dapDisassemble", () => {
      it("should return disassembled instructions", async () => {
        const mockInstructions = [
          { address: "0x1000", instruction: "mov eax, 1", instructionBytes: "B8 01 00 00 00", line: 10 },
          { address: "0x1005", instruction: "ret", instructionBytes: "C3" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockInstructions);

        const result = await dapDisassemble("session-1", "0x1000", 0, 10);

        expect(result).toHaveLength(2);
        expect(result[0].instruction).toBe("mov eax, 1");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await dapDisassemble("sess-1", "0x2000", 5, 20);

        expect(invoke).toHaveBeenCalledWith("dap_disassemble", {
          sessionId: "sess-1",
          memoryReference: "0x2000",
          offset: 5,
          instructionCount: 20,
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Disassemble error"));

        const result = await dapDisassemble("session-1", "0x1000", 0, 10);

        expect(result).toEqual([]);
      });
    });
  });

  describe("WASM Extension", () => {
    describe("extensionInstall", () => {
      it("should install extension from path", async () => {
        const mockInfo = {
          id: "ext-1",
          name: "My Extension",
          version: "1.0.0",
          enabled: true,
          path: "/extensions/my-ext",
          description: "A test extension",
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockInfo);

        const result = await extensionInstall("/path/to/extension.wasm");

        expect(result?.id).toBe("ext-1");
        expect(result?.name).toBe("My Extension");
      });

      it("should call invoke with path param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await extensionInstall("/downloads/ext.wasm");

        expect(invoke).toHaveBeenCalledWith("extension_install", {
          path: "/downloads/ext.wasm",
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Install failed"));

        const result = await extensionInstall("/bad/path.wasm");

        expect(result).toBeNull();
      });
    });

    describe("extensionUninstall", () => {
      it("should uninstall extension by id", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await extensionUninstall("ext-1");

        expect(result).toBe(true);
      });

      it("should call invoke with extensionId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await extensionUninstall("my-extension");

        expect(invoke).toHaveBeenCalledWith("extension_uninstall", {
          extensionId: "my-extension",
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Uninstall failed"));

        const result = await extensionUninstall("ext-1");

        expect(result).toBe(false);
      });
    });

    describe("extensionEnable", () => {
      it("should enable extension", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await extensionEnable("ext-1");

        expect(result).toBe(true);
      });

      it("should call invoke with extensionId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await extensionEnable("my-ext");

        expect(invoke).toHaveBeenCalledWith("extension_enable", {
          extensionId: "my-ext",
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Enable failed"));

        const result = await extensionEnable("ext-1");

        expect(result).toBe(false);
      });
    });

    describe("extensionDisable", () => {
      it("should disable extension", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await extensionDisable("ext-1");

        expect(result).toBe(true);
      });

      it("should call invoke with extensionId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await extensionDisable("my-ext");

        expect(invoke).toHaveBeenCalledWith("extension_disable", {
          extensionId: "my-ext",
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Disable failed"));

        const result = await extensionDisable("ext-1");

        expect(result).toBe(false);
      });
    });

    describe("extensionEnable/extensionDisable toggling", () => {
      it("should toggle extension state", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);
        const enableResult = await extensionEnable("ext-1");
        expect(enableResult).toBe(true);

        vi.mocked(invoke).mockResolvedValueOnce(undefined);
        const disableResult = await extensionDisable("ext-1");
        expect(disableResult).toBe(true);
      });
    });

    describe("extensionGetPermissions", () => {
      it("should return extension permissions", async () => {
        const mockPermissions: ExtensionPermissions = {
          fileSystem: true,
          network: true,
          process: false,
          clipboard: true,
          env: false,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockPermissions);

        const result = await extensionGetPermissions("ext-1");

        expect(result.fileSystem).toBe(true);
        expect(result.process).toBe(false);
      });

      it("should call invoke with extensionId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({
          fileSystem: false, network: false, process: false, clipboard: false, env: false,
        });

        await extensionGetPermissions("my-ext");

        expect(invoke).toHaveBeenCalledWith("extension_get_permissions", {
          extensionId: "my-ext",
        });
      });

      it("should return default permissions on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Permissions error"));

        const result = await extensionGetPermissions("ext-1");

        expect(result).toEqual({
          fileSystem: false,
          network: false,
          process: false,
          clipboard: false,
          env: false,
        });
      });
    });

    describe("extensionSetPermissions", () => {
      it("should set extension permissions", async () => {
        const permissions: ExtensionPermissions = {
          fileSystem: true,
          network: false,
          process: false,
          clipboard: true,
          env: false,
        };
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await extensionSetPermissions("ext-1", permissions);

        expect(result).toBe(true);
      });

      it("should call invoke with extensionId and permissions", async () => {
        const permissions: ExtensionPermissions = {
          fileSystem: true,
          network: true,
          process: true,
          clipboard: true,
          env: true,
        };
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await extensionSetPermissions("my-ext", permissions);

        expect(invoke).toHaveBeenCalledWith("extension_set_permissions", {
          extensionId: "my-ext",
          permissions,
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Set permissions error"));

        const result = await extensionSetPermissions("ext-1", {
          fileSystem: false, network: false, process: false, clipboard: false, env: false,
        });

        expect(result).toBe(false);
      });
    });

    describe("extensionGetLifecycleState", () => {
      it("should return lifecycle state", async () => {
        const mockState = {
          state: "active" as const,
          activatedAt: 1700000000000,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockState);

        const result = await extensionGetLifecycleState("ext-1");

        expect(result.state).toBe("active");
        expect(result.activatedAt).toBe(1700000000000);
      });

      it("should call invoke with extensionId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ state: "installed" });

        await extensionGetLifecycleState("my-ext");

        expect(invoke).toHaveBeenCalledWith("extension_get_lifecycle_state", {
          extensionId: "my-ext",
        });
      });

      it("should return error state on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Lifecycle error"));

        const result = await extensionGetLifecycleState("ext-1");

        expect(result.state).toBe("error");
        expect(result.lastError).toBe("Failed to get lifecycle state");
      });
    });

    describe("extensionTriggerHostFunction", () => {
      it("should trigger host function with functionName and args", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ success: true, data: 42 });

        const result = await extensionTriggerHostFunction("ext-1", "computeHash", ["input-data"]);

        expect(result).toEqual({ success: true, data: 42 });
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        await extensionTriggerHostFunction("my-ext", "doWork", [1, "two", true]);

        expect(invoke).toHaveBeenCalledWith("extension_trigger_host_function", {
          extensionId: "my-ext",
          functionName: "doWork",
          args: [1, "two", true],
        });
      });

      it("should return null on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Host function error"));

        const result = await extensionTriggerHostFunction("ext-1", "badFunc", []);

        expect(result).toBeNull();
      });
    });

    describe("extensionListInstalled", () => {
      it("should return array of installed extensions", async () => {
        const mockExtensions = [
          { id: "ext-1", name: "Extension One", version: "1.0.0", enabled: true, path: "/ext/one" },
          { id: "ext-2", name: "Extension Two", version: "2.0.0", enabled: false, path: "/ext/two" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockExtensions);

        const result = await extensionListInstalled();

        expect(result).toHaveLength(2);
        expect(result[0].name).toBe("Extension One");
        expect(result[1].enabled).toBe(false);
      });

      it("should call invoke with no params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await extensionListInstalled();

        expect(invoke).toHaveBeenCalledWith("extension_list_installed");
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("List error"));

        const result = await extensionListInstalled();

        expect(result).toEqual([]);
      });
    });
  });

  describe("Diagnostics", () => {
    describe("getDiagnosticsByFile", () => {
      it("should return diagnostics for a specific file uri", async () => {
        const mockDiagnostics = [
          {
            uri: "file:///src/app.ts",
            range: mockRange,
            severity: "error" as const,
            message: "Type error",
            code: "2322",
            source: "typescript",
          },
          {
            uri: "file:///src/app.ts",
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
            severity: "warning" as const,
            message: "Unused variable",
            source: "typescript",
          },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockDiagnostics);

        const result = await getDiagnosticsByFile("file:///src/app.ts");

        expect(result).toHaveLength(2);
        expect(result[0].severity).toBe("error");
      });

      it("should call invoke with uri param", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await getDiagnosticsByFile("file:///test.ts");

        expect(invoke).toHaveBeenCalledWith("diagnostics_get_by_file", {
          uri: "file:///test.ts",
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Diagnostics error"));

        const result = await getDiagnosticsByFile("file:///src/app.ts");

        expect(result).toEqual([]);
      });
    });

    describe("getDiagnosticsSummary", () => {
      it("should return summary object", async () => {
        const mockSummary = {
          totalErrors: 5,
          totalWarnings: 12,
          totalInformation: 3,
          totalHints: 1,
          fileCount: 8,
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockSummary);

        const result = await getDiagnosticsSummary();

        expect(result.totalErrors).toBe(5);
        expect(result.totalWarnings).toBe(12);
        expect(result.fileCount).toBe(8);
      });

      it("should call invoke with correct command", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({
          totalErrors: 0, totalWarnings: 0, totalInformation: 0, totalHints: 0, fileCount: 0,
        });

        await getDiagnosticsSummary();

        expect(invoke).toHaveBeenCalledWith("diagnostics_get_summary");
      });

      it("should return zero-value summary on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Summary error"));

        const result = await getDiagnosticsSummary();

        expect(result).toEqual({
          totalErrors: 0,
          totalWarnings: 0,
          totalInformation: 0,
          totalHints: 0,
          fileCount: 0,
        });
      });
    });

    describe("filterDiagnostics", () => {
      it("should filter diagnostics by severity", async () => {
        const mockDiagnostics = [
          { uri: "file:///a.ts", range: mockRange, severity: "error" as const, message: "Error 1" },
        ];
        const filter: DiagnosticsFilter = { severity: "error" };
        vi.mocked(invoke).mockResolvedValueOnce(mockDiagnostics);

        const result = await filterDiagnostics(filter);

        expect(result).toHaveLength(1);
        expect(result[0].severity).toBe("error");
      });

      it("should filter diagnostics by source", async () => {
        const filter: DiagnosticsFilter = { source: "eslint" };
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await filterDiagnostics(filter);

        expect(invoke).toHaveBeenCalledWith("diagnostics_filter", {
          filter: { source: "eslint" },
        });
      });

      it("should filter diagnostics by uri", async () => {
        const filter: DiagnosticsFilter = { uri: "file:///src/app.ts" };
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await filterDiagnostics(filter);

        expect(invoke).toHaveBeenCalledWith("diagnostics_filter", {
          filter: { uri: "file:///src/app.ts" },
        });
      });

      it("should call invoke with combined filter params", async () => {
        const filter: DiagnosticsFilter = {
          severity: "warning",
          source: "typescript",
          uri: "file:///src/utils.ts",
        };
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await filterDiagnostics(filter);

        expect(invoke).toHaveBeenCalledWith("diagnostics_filter", { filter });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Filter error"));

        const result = await filterDiagnostics({ severity: "error" });

        expect(result).toEqual([]);
      });
    });
  });

  describe("Terminal", () => {
    describe("searchTerminal", () => {
      it("should search terminal with terminalId and query", async () => {
        const mockResults = [
          { line: 5, column: 10, text: "error: file not found" },
          { line: 12, column: 0, text: "error: permission denied" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockResults);

        const result = await searchTerminal("term-1", "error");

        expect(result).toHaveLength(2);
        expect(result[0].text).toContain("error");
      });

      it("should call invoke with correct params", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await searchTerminal("terminal-42", "search query");

        expect(invoke).toHaveBeenCalledWith("terminal_search", {
          terminalId: "terminal-42",
          query: "search query",
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Search error"));

        const result = await searchTerminal("term-1", "query");

        expect(result).toEqual([]);
      });
    });

    describe("getTerminalProfiles", () => {
      it("should return profiles array", async () => {
        const mockProfiles = [
          { id: "bash", name: "Bash", shell: "/bin/bash", isDefault: true },
          { id: "zsh", name: "Zsh", shell: "/bin/zsh", args: ["-l"] },
          { id: "fish", name: "Fish", shell: "/usr/bin/fish", icon: "terminal-fish" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockProfiles);

        const result = await getTerminalProfiles();

        expect(result).toHaveLength(3);
        expect(result[0].isDefault).toBe(true);
        expect(result[1].shell).toBe("/bin/zsh");
      });

      it("should call invoke with correct command", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await getTerminalProfiles();

        expect(invoke).toHaveBeenCalledWith("terminal_get_profiles");
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Profiles error"));

        const result = await getTerminalProfiles();

        expect(result).toEqual([]);
      });
    });

    describe("saveTerminalProfile", () => {
      it("should save profile object", async () => {
        const profile: TerminalProfile = {
          id: "custom",
          name: "Custom Shell",
          shell: "/usr/local/bin/custom-shell",
          args: ["--config", "/etc/custom.conf"],
          env: { TERM: "xterm-256color" },
          icon: "terminal-custom",
        };
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        const result = await saveTerminalProfile(profile);

        expect(result).toBe(true);
      });

      it("should call invoke with profile param", async () => {
        const profile: TerminalProfile = {
          id: "pwsh",
          name: "PowerShell",
          shell: "pwsh",
        };
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await saveTerminalProfile(profile);

        expect(invoke).toHaveBeenCalledWith("terminal_save_profile", {
          profile,
        });
      });

      it("should return false on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Save error"));

        const result = await saveTerminalProfile({
          id: "bad", name: "Bad", shell: "/nonexistent",
        });

        expect(result).toBe(false);
      });
    });

    describe("detectTerminalLinks", () => {
      it("should detect links in terminal with terminalId", async () => {
        const mockLinks = [
          { startIndex: 0, length: 25, text: "/src/app.ts:10:5", uri: "file:///src/app.ts" },
          { startIndex: 30, length: 30, text: "https://example.com", uri: "https://example.com" },
        ];
        vi.mocked(invoke).mockResolvedValueOnce(mockLinks);

        const result = await detectTerminalLinks("term-1");

        expect(result).toHaveLength(2);
        expect(result[0].uri).toBe("file:///src/app.ts");
        expect(result[1].uri).toBe("https://example.com");
      });

      it("should call invoke with terminalId", async () => {
        vi.mocked(invoke).mockResolvedValueOnce([]);

        await detectTerminalLinks("terminal-99");

        expect(invoke).toHaveBeenCalledWith("terminal_detect_links", {
          terminalId: "terminal-99",
        });
      });

      it("should return empty array on error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Links error"));

        const result = await detectTerminalLinks("term-1");

        expect(result).toEqual([]);
      });
    });
  });
});
