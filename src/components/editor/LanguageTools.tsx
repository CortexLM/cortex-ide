/**
 * Language Tools Component
 *
 * Provides code actions, refactoring, and quick fixes for Monaco Editor
 * integrated with LSP. Features include:
 * - Code actions menu (quick fixes)
 * - Refactoring options (extract method/variable, organize imports)
 * - Ctrl+. keyboard shortcut for quick actions
 * - Light bulb indicator at cursor position
 * - Preview changes before apply
 * - Undo refactoring support
 * - Context menu integration
 * 
 * VS Code Specifications:
 * - Light bulb: 3 color variants (standard var(--cortex-warning), auto-fix var(--cortex-info), AI accent)
 * - Rename widget: z-index 100 (highest)
 * - Parameter hints: z-index 39, max-width 440px
 * - Suggest widget: z-index 40
 * - Code actions menu: flex layout, 3px border-radius
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onCleanup,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";
import type * as Monaco from "monaco-editor";
import { invoke } from "@tauri-apps/api/core";
import { useLSP, type Range, type TextEdit } from "@/context/LSPContext";
import { useEditor } from "@/context/EditorContext";

// ============================================================================
// Types
// ============================================================================

/** Code action kinds following LSP specification */
export type CodeActionKind = string;

/** A single code action from LSP */
export interface CodeAction {
  title: string;
  kind?: CodeActionKind;
  diagnostics?: Array<{
    range: Range;
    message: string;
    severity?: number;
  }>;
  isPreferred?: boolean;
  disabled?: { reason: string };
  edit?: WorkspaceEdit;
  command?: Command;
  data?: unknown;
}

/** A command that can be executed */
export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

/** Workspace edit containing document changes */
export interface WorkspaceEdit {
  changes?: Record<string, TextEdit[]>;
  documentChanges?: Array<TextDocumentEdit | CreateFile | RenameFile | DeleteFile>;
}

/** Text document edit */
export interface TextDocumentEdit {
  textDocument: { uri: string; version?: number | null };
  edits: TextEdit[];
}

/** Create file operation */
export interface CreateFile {
  kind: "create";
  uri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

/** Rename file operation */
export interface RenameFile {
  kind: "rename";
  oldUri: string;
  newUri: string;
  options?: { overwrite?: boolean; ignoreIfExists?: boolean };
}

/** Delete file operation */
export interface DeleteFile {
  kind: "delete";
  uri: string;
  options?: { recursive?: boolean; ignoreIfNotExists?: boolean };
}

/** Code action response from LSP */
export interface CodeActionResponse {
  actions: CodeAction[];
}

/** Code action context for requesting actions */
export interface CodeActionContext {
  diagnostics: Array<{
    range: Range;
    message: string;
    severity?: number;
    code?: string;
    source?: string;
  }>;
  only?: CodeActionKind[];
  triggerKind?: 1 | 2; // 1 = Invoked, 2 = Automatic
}

/** Preview state for showing changes before applying */
interface PreviewState {
  action: CodeAction;
  originalContent: string;
  previewContent: string;
  uri: string;
  edits: TextEdit[];
}

/** Undo entry for reverting refactorings */
interface UndoEntry {
  id: string;
  timestamp: number;
  actionTitle: string;
  uri: string;
  originalContent: string;
  newContent: string;
}

/** Component state */
interface LanguageToolsState {
  isOpen: boolean;
  isLoading: boolean;
  actions: CodeAction[];
  selectedIndex: number;
  position: { x: number; y: number } | null;
  lightbulbPosition: { x: number; y: number; line: number } | null;
  preview: PreviewState | null;
  undoStack: UndoEntry[];
  error: string | null;
}

// ============================================================================
// Props
// ============================================================================

export interface LanguageToolsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monaco: typeof Monaco | null;
  serverId?: string;
  uri?: string;
}

// ============================================================================
// Icons
// ============================================================================

function LightbulbIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a5 5 0 0 0-5 5c0 1.7.83 3.18 2.1 4.1.14.11.23.28.23.46v1.94a.5.5 0 0 0 .5.5h4.34a.5.5 0 0 0 .5-.5v-1.94c0-.18.09-.35.23-.46A5 5 0 0 0 8 1zM6.5 14a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3z" />
    </svg>
  );
}

function QuickFixIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.5 3A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13h7a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 11.5 3h-7zm2.354 2.146a.5.5 0 0 1 0 .708L5.707 7l1.147 1.146a.5.5 0 0 1-.708.708l-1.5-1.5a.5.5 0 0 1 0-.708l1.5-1.5a.5.5 0 0 1 .708 0zm2.292 0a.5.5 0 0 1 .708 0l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708-.708L10.293 7 9.146 5.854a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

function RefactorIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.5 0a.5.5 0 0 1 .5.5V2h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V3h-1.5a.5.5 0 0 1 0-1H13V.5a.5.5 0 0 1 .5-.5z" />
      <path d="M2 3a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v3a.5.5 0 0 1-1 0V3a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4.5a.5.5 0 0 1 0 1H4a2 2 0 0 1-2-2V3z" />
      <path d="M9.146 9.146a.5.5 0 0 1 .708 0L11 10.293l1.146-1.147a.5.5 0 0 1 .708.708l-1.147 1.146 1.147 1.146a.5.5 0 0 1-.708.708L11 11.707l-1.146 1.147a.5.5 0 0 1-.708-.708l1.147-1.146-1.147-1.146a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

function ExtractIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
      <path d="M5 8.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5z" />
    </svg>
  );
}

function OrganizeImportsIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M3.5 1a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-9zM4 2h8v12H4V2z" />
      <path d="M6 4h4v1H6V4zm0 2h4v1H6V6zm0 2h4v1H6V8z" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z" />
      <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z" />
    </svg>
  );
}

function PreviewIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
      <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
    </svg>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Get icon component for code action kind */
function getActionIcon(kind?: CodeActionKind): () => ReturnType<typeof LightbulbIcon> {
  if (!kind) return QuickFixIcon;
  if (kind.startsWith("refactor.extract")) return ExtractIcon;
  if (kind.startsWith("refactor")) return RefactorIcon;
  if (kind.startsWith("source.organizeImports")) return OrganizeImportsIcon;
  if (kind === "quickfix") return QuickFixIcon;
  return LightbulbIcon;
}

/** Get display label for code action kind */
function getKindLabel(kind?: CodeActionKind): string {
  if (!kind) return "Quick Fix";
  if (kind === "quickfix") return "Quick Fix";
  if (kind === "refactor.extract") return "Extract";
  if (kind === "refactor.inline") return "Inline";
  if (kind === "refactor.rewrite") return "Rewrite";
  if (kind.startsWith("refactor")) return "Refactor";
  if (kind === "source.organizeImports") return "Organize Imports";
  if (kind === "source.fixAll") return "Fix All";
  if (kind.startsWith("source")) return "Source Action";
  return kind;
}

/** Apply text edits to content */
function applyEdits(content: string, edits: TextEdit[]): string {
  // Sort edits in reverse order by position to avoid offset issues
  const sortedEdits = [...edits].sort((a, b) => {
    const lineCompare = b.range.start.line - a.range.start.line;
    if (lineCompare !== 0) return lineCompare;
    return b.range.start.character - a.range.start.character;
  });

  const lines = content.split("\n");

  for (const edit of sortedEdits) {
    const { range, newText } = edit;
    const startLine = range.start.line;
    const endLine = range.end.line;
    const startChar = range.start.character;
    const endChar = range.end.character;

    // Handle multi-line edits
    if (startLine === endLine) {
      const line = lines[startLine] || "";
      lines[startLine] = line.slice(0, startChar) + newText + line.slice(endChar);
    } else {
      const startLineContent = (lines[startLine] || "").slice(0, startChar);
      const endLineContent = (lines[endLine] || "").slice(endChar);
      const newLines = (startLineContent + newText + endLineContent).split("\n");
      lines.splice(startLine, endLine - startLine + 1, ...newLines);
    }
  }

  return lines.join("\n");
}

/** Generate unique ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function LanguageTools(props: LanguageToolsProps) {
  const lsp = useLSP();
  const editorContext = useEditor();

  const [state, setState] = createStore<LanguageToolsState>({
    isOpen: false,
    isLoading: false,
    actions: [],
    selectedIndex: 0,
    position: null,
    lightbulbPosition: null,
    preview: null,
    undoStack: [],
    error: null,
  });

  const [contextMenuVisible, setContextMenuVisible] = createSignal(false);
  const [contextMenuPosition, setContextMenuPosition] = createSignal<{ x: number; y: number } | null>(null);

  let menuRef: HTMLDivElement | undefined;
  let lightbulbTimeout: ReturnType<typeof setTimeout> | undefined;

  // Get current file URI
  const currentUri = createMemo(() => {
    if (props.uri) return props.uri;
    const activeFile = editorContext.state.openFiles.find(
      (f) => f.id === editorContext.state.activeFileId
    );
    return activeFile ? `file://${activeFile.path.replace(/\\/g, "/")}` : null;
  });

  // Get server ID for current file
  const currentServerId = createMemo(() => {
    if (props.serverId) return props.serverId;
    const uri = currentUri();
    if (!uri) return null;
    const server = lsp.getServerForFile(uri.replace("file://", ""));
    return server?.id ?? null;
  });

  // Group actions by kind
  const groupedActions = createMemo(() => {
    const groups: Record<string, CodeAction[]> = {
      quickfix: [],
      refactor: [],
      source: [],
      other: [],
    };

    for (const action of state.actions) {
      if (action.kind?.startsWith("quickfix")) {
        groups.quickfix.push(action);
      } else if (action.kind?.startsWith("refactor")) {
        groups.refactor.push(action);
      } else if (action.kind?.startsWith("source")) {
        groups.source.push(action);
      } else {
        groups.other.push(action);
      }
    }

    return groups;
  });

  // Check if there are any actions available
  const hasActions = createMemo(() => state.actions.length > 0);

  // ===========================================================================
  // LSP Communication
  // ===========================================================================

  /** Request code actions from LSP */
  async function requestCodeActions(
    range: Range,
    context?: CodeActionContext
  ): Promise<CodeAction[]> {
    const serverId = currentServerId();
    const uri = currentUri();

    if (!serverId || !uri) {
      return [];
    }

    try {
      // Get diagnostics for the range
      const diagnostics = lsp.getDiagnosticsForFile(uri);
      const rangeDiagnostics = diagnostics.filter((d) => {
        return (
          d.range.start.line <= range.end.line &&
          d.range.end.line >= range.start.line
        );
      });

      const response = await invoke<CodeActionResponse>("lsp_code_actions", {
        serverId,
        params: {
          uri,
          range,
          context: context ?? {
            diagnostics: rangeDiagnostics.map((d) => ({
              range: d.range,
              message: d.message,
              severity: d.severity === "error" ? 1 : d.severity === "warning" ? 2 : 3,
              code: d.code,
              source: d.source,
            })),
            triggerKind: 1,
          },
        },
      });

      return response.actions ?? [];
    } catch (error) {
      console.error("Failed to get code actions:", error);
      return [];
    }
  }

  /** Execute a code action */
  async function executeAction(action: CodeAction): Promise<void> {
    const uri = currentUri();
    if (!uri) return;

    // Store current content for undo
    const activeFile = editorContext.state.openFiles.find(
      (f) => f.id === editorContext.state.activeFileId
    );
    if (!activeFile) return;

    const originalContent = activeFile.content;

    try {
      // Apply workspace edit if present
      if (action.edit) {
        await applyWorkspaceEdit(action.edit);
      }

      // Execute command if present
      if (action.command) {
        await executeCommand(action.command);
      }

      // Add to undo stack
      const newContent = editorContext.state.openFiles.find(
        (f) => f.id === editorContext.state.activeFileId
      )?.content;

      if (newContent && newContent !== originalContent) {
        const undoEntry: UndoEntry = {
          id: generateId(),
          timestamp: Date.now(),
          actionTitle: action.title,
          uri,
          originalContent,
          newContent,
        };

        setState("undoStack", (stack) => [undoEntry, ...stack.slice(0, 49)]);
      }

      closeMenu();
    } catch (error) {
      console.error("Failed to execute code action:", error);
      setState("error", error instanceof Error ? error.message : String(error));
    }
  }

  /** Apply a workspace edit */
  async function applyWorkspaceEdit(edit: WorkspaceEdit): Promise<void> {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;

    // Handle changes map
    if (edit.changes) {
      const model = editor.getModel();
      if (!model) return;

      const currentUri = model.uri.toString();
      const edits = edit.changes[currentUri];

      if (edits && edits.length > 0) {
        const monacoEdits: Monaco.editor.IIdentifiedSingleEditOperation[] = edits.map((e) => ({
          range: new monaco.Range(
            e.range.start.line + 1,
            e.range.start.character + 1,
            e.range.end.line + 1,
            e.range.end.character + 1
          ),
          text: e.newText,
        }));

        editor.executeEdits("language-tools", monacoEdits);
      }
    }

    // Handle document changes
    if (edit.documentChanges) {
      for (const change of edit.documentChanges) {
        if ("kind" in change) {
          // File operations (create, rename, delete)
          if (change.kind === "create") {
            await invoke("fs_create_file", { path: change.uri.replace("file://", "") });
          } else if (change.kind === "rename") {
            await invoke("fs_rename", {
              oldPath: change.oldUri.replace("file://", ""),
              newPath: change.newUri.replace("file://", ""),
            });
          } else if (change.kind === "delete") {
            await invoke("fs_delete_file", { path: change.uri.replace("file://", "") });
          }
        } else {
          // Text document edit
          const docEdit = change as TextDocumentEdit;
          const model = props.editor?.getModel();

          if (model && model.uri.toString() === docEdit.textDocument.uri && props.monaco) {
            const monacoEdits: Monaco.editor.IIdentifiedSingleEditOperation[] = docEdit.edits.map(
              (e) => ({
                range: new props.monaco!.Range(
                  e.range.start.line + 1,
                  e.range.start.character + 1,
                  e.range.end.line + 1,
                  e.range.end.character + 1
                ),
                text: e.newText,
              })
            );

            editor.executeEdits("language-tools", monacoEdits);
          }
        }
      }
    }
  }

  /** Execute a command */
  async function executeCommand(command: Command): Promise<void> {
    const serverId = currentServerId();
    if (!serverId) return;

    await invoke("lsp_execute_command", {
      serverId,
      command: command.command,
      arguments: command.arguments,
    });
  }

  // ===========================================================================
  // UI Actions
  // ===========================================================================

  /** Open the code actions menu */
  async function openMenu(): Promise<void> {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;

    const selection = editor.getSelection();
    if (!selection) return;

    // Get position for the menu
    const position = editor.getPosition();
    if (!position) return;

    const scrolledPosition = editor.getScrolledVisiblePosition(position);
    if (!scrolledPosition) return;

    const editorDomNode = editor.getDomNode();
    if (!editorDomNode) return;

    const editorRect = editorDomNode.getBoundingClientRect();

    const range: Range = {
      start: { line: selection.startLineNumber - 1, character: selection.startColumn - 1 },
      end: { line: selection.endLineNumber - 1, character: selection.endColumn - 1 },
    };

    batch(() => {
      setState("isLoading", true);
      setState("isOpen", true);
      setState("position", {
        x: editorRect.left + scrolledPosition.left,
        y: editorRect.top + scrolledPosition.top + scrolledPosition.height,
      });
      setState("selectedIndex", 0);
      setState("error", null);
    });

    const actions = await requestCodeActions(range);

    batch(() => {
      setState("actions", actions);
      setState("isLoading", false);
    });
  }

  /** Close the code actions menu */
  function closeMenu(): void {
    batch(() => {
      setState("isOpen", false);
      setState("actions", []);
      setState("position", null);
      setState("preview", null);
      setState("error", null);
    });
  }

  /** Show preview for an action */
  async function showPreview(action: CodeAction): Promise<void> {
    const uri = currentUri();
    if (!uri) return;

    const activeFile = editorContext.state.openFiles.find(
      (f) => f.id === editorContext.state.activeFileId
    );
    if (!activeFile) return;

    const originalContent = activeFile.content;
    let edits: TextEdit[] = [];

    if (action.edit?.changes) {
      edits = action.edit.changes[uri] ?? [];
    } else if (action.edit?.documentChanges) {
      for (const change of action.edit.documentChanges) {
        if (!("kind" in change)) {
          const docEdit = change as TextDocumentEdit;
          if (docEdit.textDocument.uri === uri) {
            edits = docEdit.edits;
            break;
          }
        }
      }
    }

    if (edits.length === 0) {
      // No preview available, execute directly
      return;
    }

    const previewContent = applyEdits(originalContent, edits);

    setState("preview", {
      action,
      originalContent,
      previewContent,
      uri,
      edits,
    });
  }

  /** Cancel preview */
  function cancelPreview(): void {
    setState("preview", null);
  }

  /** Apply previewed changes */
  async function applyPreview(): Promise<void> {
    const preview = state.preview;
    if (!preview) return;

    await executeAction(preview.action);
    setState("preview", null);
  }

  /** Undo last refactoring */
  function undoRefactoring(): void {
    const lastUndo = state.undoStack[0];
    if (!lastUndo) return;

    const activeFile = editorContext.state.openFiles.find(
      (f) => f.id === editorContext.state.activeFileId
    );
    if (!activeFile) return;

    // Restore original content
    editorContext.updateFileContent(activeFile.id, lastUndo.originalContent);

    // Remove from undo stack
    setState("undoStack", (stack) => stack.slice(1));
  }

  /** Update lightbulb position */
  async function updateLightbulb(): Promise<void> {
    const { editor, monaco } = props;
    if (!editor || !monaco) {
      setState("lightbulbPosition", null);
      return;
    }

    const position = editor.getPosition();
    if (!position) {
      setState("lightbulbPosition", null);
      return;
    }

    // Debounce the check
    if (lightbulbTimeout) {
      clearTimeout(lightbulbTimeout);
    }

    lightbulbTimeout = setTimeout(async () => {
      const range: Range = {
        start: { line: position.lineNumber - 1, character: 0 },
        end: { line: position.lineNumber - 1, character: 1000 },
      };

      const actions = await requestCodeActions(range);

      if (actions.length > 0) {
        const scrolledPosition = editor.getScrolledVisiblePosition(position);
        if (!scrolledPosition) {
          setState("lightbulbPosition", null);
          return;
        }

        const editorDomNode = editor.getDomNode();
        if (!editorDomNode) {
          setState("lightbulbPosition", null);
          return;
        }

        const editorRect = editorDomNode.getBoundingClientRect();

        setState("lightbulbPosition", {
          x: editorRect.left + 4,
          y: editorRect.top + scrolledPosition.top,
          line: position.lineNumber,
        });
      } else {
        setState("lightbulbPosition", null);
      }
    }, 300);
  }

  // ===========================================================================
  // Built-in Refactoring Actions
  // ===========================================================================

  /** Extract selected code to a new function/method */
  async function extractFunction(): Promise<void> {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;

    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;

    const model = editor.getModel();
    if (!model) return;

    const selectedText = model.getValueInRange(selection);
    const indent = model.getLineFirstNonWhitespaceColumn(selection.startLineNumber) - 1;
    const indentStr = " ".repeat(indent);

    // Generate function name
    const functionName = "extractedFunction";

    // Create the function
    const functionDef = `${indentStr}function ${functionName}() {\n${indentStr}  ${selectedText.split("\n").join("\n  ")}\n${indentStr}}\n\n`;

    // Replace selection with function call
    editor.executeEdits("extract-function", [
      {
        range: selection,
        text: `${functionName}()`,
      },
      {
        range: new monaco.Range(selection.startLineNumber, 1, selection.startLineNumber, 1),
        text: functionDef,
      },
    ]);

    closeMenu();
  }

  /** Extract selected code to a new variable */
  async function extractVariable(): Promise<void> {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;

    const selection = editor.getSelection();
    if (!selection || selection.isEmpty()) return;

    const model = editor.getModel();
    if (!model) return;

    const selectedText = model.getValueInRange(selection);
    const indent = model.getLineFirstNonWhitespaceColumn(selection.startLineNumber) - 1;
    const indentStr = " ".repeat(indent);

    // Generate variable name
    const variableName = "extractedVariable";

    // Create the variable declaration
    const variableDecl = `${indentStr}const ${variableName} = ${selectedText};\n`;

    // Replace selection with variable reference
    editor.executeEdits("extract-variable", [
      {
        range: selection,
        text: variableName,
      },
      {
        range: new monaco.Range(selection.startLineNumber, 1, selection.startLineNumber, 1),
        text: variableDecl,
      },
    ]);

    closeMenu();
  }

  /** Organize imports using LSP or built-in logic */
  async function organizeImports(): Promise<void> {
    const serverId = currentServerId();
    const uri = currentUri();

    if (serverId && uri) {
      // Try LSP organize imports
      const actions = await requestCodeActions(
        { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        { diagnostics: [], only: ["source.organizeImports"], triggerKind: 1 }
      );

      const organizeAction = actions.find(
        (a) => a.kind === "source.organizeImports" || a.title.toLowerCase().includes("organize")
      );

      if (organizeAction) {
        await executeAction(organizeAction);
        return;
      }
    }

    // Fallback: basic import sorting
    const { editor, monaco } = props;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const content = model.getValue();
    const lines = content.split("\n");

    // Find import block
    const importLines: { index: number; line: string }[] = [];
    let firstImportIndex = -1;
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("import ")) {
        if (firstImportIndex === -1) firstImportIndex = i;
        lastImportIndex = i;
        importLines.push({ index: i, line: lines[i] });
      } else if (firstImportIndex !== -1 && line !== "" && !line.startsWith("//")) {
        break;
      }
    }

    if (importLines.length === 0) return;

    // Sort imports alphabetically
    const sortedImports = [...importLines].sort((a, b) => {
      const aFrom = a.line.match(/from\s+['"](.+)['"]/)?.[1] ?? "";
      const bFrom = b.line.match(/from\s+['"](.+)['"]/)?.[1] ?? "";
      return aFrom.localeCompare(bFrom);
    });

    // Check if already sorted
    const alreadySorted = importLines.every(
      (imp, idx) => imp.line === sortedImports[idx].line
    );
    if (alreadySorted) return;

    // Replace import block
    const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [
      {
        range: new monaco.Range(
          firstImportIndex + 1,
          1,
          lastImportIndex + 1,
          lines[lastImportIndex].length + 1
        ),
        text: sortedImports.map((i) => i.line).join("\n"),
      },
    ];

    editor.executeEdits("organize-imports", edits);
    closeMenu();
  }

  // ===========================================================================
  // Context Menu
  // ===========================================================================

  /** Open context menu at position */
  function openContextMenu(x: number, y: number): void {
    setContextMenuPosition({ x, y });
    setContextMenuVisible(true);
  }

  /** Close context menu */
  function closeContextMenu(): void {
    setContextMenuVisible(false);
    setContextMenuPosition(null);
  }

  /** Get context menu items */
  function getContextMenuItems(): Array<{
    label: string;
    icon: () => ReturnType<typeof LightbulbIcon>;
    action: () => void;
    disabled?: boolean;
    separator?: boolean;
  }> {
    return [
      {
        label: "Quick Fix... (Ctrl+.)",
        icon: QuickFixIcon,
        action: openMenu,
      },
      {
        label: "Refactor...",
        icon: RefactorIcon,
        action: openMenu,
        separator: true,
      },
      {
        label: "Extract Function",
        icon: ExtractIcon,
        action: extractFunction,
        disabled: !props.editor?.getSelection() || props.editor.getSelection()?.isEmpty(),
      },
      {
        label: "Extract Variable",
        icon: ExtractIcon,
        action: extractVariable,
        disabled: !props.editor?.getSelection() || props.editor.getSelection()?.isEmpty(),
      },
      {
        label: "Organize Imports",
        icon: OrganizeImportsIcon,
        action: organizeImports,
        separator: true,
      },
      {
        label: "Undo Refactoring",
        icon: UndoIcon,
        action: undoRefactoring,
        disabled: state.undoStack.length === 0,
      },
    ];
  }

  // ===========================================================================
  // Keyboard Navigation
  // ===========================================================================

  function handleKeyDown(e: KeyboardEvent): void {
    if (!state.isOpen) return;

    const actions = state.actions;
    const currentIndex = state.selectedIndex;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setState("selectedIndex", Math.min(currentIndex + 1, actions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setState("selectedIndex", Math.max(currentIndex - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (actions[currentIndex]) {
          executeAction(actions[currentIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        if (state.preview) {
          cancelPreview();
        } else {
          closeMenu();
        }
        break;
      case "Tab":
        e.preventDefault();
        if (actions[currentIndex]) {
          showPreview(actions[currentIndex]);
        }
        break;
    }
  }

  // ===========================================================================
  // Effects and Event Listeners
  // ===========================================================================

  // Track previous editor to prevent redundant setup
  let previousEditorId: string | null = null;

  // Setup editor event listeners
  createEffect(() => {
    const { editor, monaco } = props;
    if (!editor || !monaco) return;
    
    // Prevent redundant setup for same editor
    const editorId = editor.getId();
    if (editorId === previousEditorId) return;
    previousEditorId = editorId;

    const disposables: Monaco.IDisposable[] = [];

    // Ctrl+. to open code actions (returns command ID, not IDisposable)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period, () => {
      openMenu();
    });

    // Register code action provider keyboard shortcut
    editor.addAction({
      id: "language-tools.quickFix",
      label: "Quick Fix",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 1,
      run: () => openMenu(),
    });

    // Register refactoring actions
    editor.addAction({
      id: "language-tools.extractFunction",
      label: "Extract to Function",
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 2,
      precondition: "editorHasSelection",
      run: () => extractFunction(),
    });

    editor.addAction({
      id: "language-tools.extractVariable",
      label: "Extract to Variable",
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 3,
      precondition: "editorHasSelection",
      run: () => extractVariable(),
    });

    editor.addAction({
      id: "language-tools.organizeImports",
      label: "Organize Imports",
      keybindings: [
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyO,
      ],
      contextMenuGroupId: "1_modification",
      contextMenuOrder: 4,
      run: () => organizeImports(),
    });

    // Cursor position change - update lightbulb
    disposables.push(
      editor.onDidChangeCursorPosition(() => {
        updateLightbulb();
      })
    );

    // Model content change - update lightbulb
    disposables.push(
      editor.onDidChangeModelContent(() => {
        updateLightbulb();
      })
    );

    // Right-click context menu
    disposables.push(
      editor.onContextMenu((e) => {
        e.event.preventDefault();
        openContextMenu(e.event.posx, e.event.posy);
      })
    );

    // Click outside to close
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef && !menuRef.contains(e.target as Node)) {
        closeMenu();
      }
      closeContextMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    onCleanup(() => {
      disposables.forEach((d) => d?.dispose?.());
      document.removeEventListener("mousedown", handleClickOutside);
      if (lightbulbTimeout) {
        clearTimeout(lightbulbTimeout);
      }
    });
  });

  // Global keyboard handler
  createEffect(() => {
    if (state.isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
    }
  });

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <>
      {/* Lightbulb Indicator - VS Code: 3 color variants */}
      <Show when={state.lightbulbPosition && !state.isOpen}>
        <button
          class="lightbulb-widget standard"
          style={{
            /* VS Code light bulb specs */
            position: "fixed",
            "z-index": "50",
            left: `${state.lightbulbPosition!.x}px`,
            top: `${state.lightbulbPosition!.y}px`,
            padding: "4px",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            /* Standard light bulb color: var(--cortex-warning) */
            color: "var(--editor-lightbulb-foreground, var(--cortex-warning))",
            "border-radius": "var(--cortex-radius-sm)",
            transition: "background-color 150ms",
          }}
          onClick={openMenu}
          title="Quick actions available (Ctrl+.)"
        >
          <LightbulbIcon />
        </button>
      </Show>

      {/* Code Actions Menu - VS Code: z-index 40, 3px border-radius */}
      <Show when={state.isOpen && state.position}>
        <div
          ref={menuRef}
          class="suggest-widget"
          style={{
            /* VS Code suggest widget specs */
            position: "fixed",
            "z-index": "40",
            left: `${state.position!.x}px`,
            top: `${state.position!.y}px`,
            "min-width": "280px",
            "max-width": "400px",
            "max-height": "400px",
            display: "flex",
            "flex-direction": "column",
            "border-radius": "var(--cortex-radius-sm)",
            "border-style": "solid",
            "border-width": "1px",
            "border-color": "var(--border-weak)",
            background: "var(--surface-raised)",
            "box-shadow": "0 0 8px 2px rgba(0, 0, 0, 0.36)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-3 py-2 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <span class="text-xs font-medium" style={{ color: "var(--text-base)" }}>
              Code Actions
            </span>
            <div class="flex items-center gap-1 text-xs" style={{ color: "var(--text-weak)" }}>
              <kbd class="px-1.5 py-0.5 rounded" style={{ background: "var(--background-base)" }}>
                ↑↓
              </kbd>
              <span>navigate</span>
              <kbd class="px-1.5 py-0.5 rounded ml-2" style={{ background: "var(--background-base)" }}>
                Tab
              </kbd>
              <span>preview</span>
            </div>
          </div>

          {/* Loading state */}
          <Show when={state.isLoading}>
            <div class="px-4 py-8 text-center">
              <div
                class="inline-block w-5 h-5 border-2 rounded-full animate-spin"
                style={{
                  "border-color": "var(--text-weak)",
                  "border-top-color": "transparent",
                }}
              />
              <p class="mt-2 text-xs" style={{ color: "var(--text-weak)" }}>
                Loading code actions...
              </p>
            </div>
          </Show>

          {/* No actions */}
          <Show when={!state.isLoading && !hasActions()}>
            <div class="px-4 py-8 text-center">
              <p class="text-sm" style={{ color: "var(--text-weak)" }}>
                No code actions available
              </p>
            </div>
          </Show>

          {/* Actions list */}
          <Show when={!state.isLoading && hasActions()}>
            <div class="max-h-[320px] overflow-y-auto">
              {/* Quick Fixes */}
              <Show when={groupedActions().quickfix.length > 0}>
                <div class="px-2 py-1">
                  <div
                    class="px-2 py-1 text-xs font-medium"
                    style={{ color: "var(--text-weak)" }}
                  >
                    Quick Fixes
                  </div>
                  <For each={groupedActions().quickfix}>
                    {(action, index) => (
                      <ActionItem
                        action={action}
                        isSelected={state.selectedIndex === index()}
                        onSelect={() => setState("selectedIndex", index())}
                        onExecute={() => executeAction(action)}
                        onPreview={() => showPreview(action)}
                      />
                    )}
                  </For>
                </div>
              </Show>

              {/* Refactorings */}
              <Show when={groupedActions().refactor.length > 0}>
                <div class="px-2 py-1">
                  <div
                    class="px-2 py-1 text-xs font-medium"
                    style={{ color: "var(--text-weak)" }}
                  >
                    Refactorings
                  </div>
                  <For each={groupedActions().refactor}>
                    {(action, index) => {
                      const actualIndex = () =>
                        groupedActions().quickfix.length + index();
                      return (
                        <ActionItem
                          action={action}
                          isSelected={state.selectedIndex === actualIndex()}
                          onSelect={() => setState("selectedIndex", actualIndex())}
                          onExecute={() => executeAction(action)}
                          onPreview={() => showPreview(action)}
                        />
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Source Actions */}
              <Show when={groupedActions().source.length > 0}>
                <div class="px-2 py-1">
                  <div
                    class="px-2 py-1 text-xs font-medium"
                    style={{ color: "var(--text-weak)" }}
                  >
                    Source Actions
                  </div>
                  <For each={groupedActions().source}>
                    {(action, index) => {
                      const actualIndex = () =>
                        groupedActions().quickfix.length +
                        groupedActions().refactor.length +
                        index();
                      return (
                        <ActionItem
                          action={action}
                          isSelected={state.selectedIndex === actualIndex()}
                          onSelect={() => setState("selectedIndex", actualIndex())}
                          onExecute={() => executeAction(action)}
                          onPreview={() => showPreview(action)}
                        />
                      );
                    }}
                  </For>
                </div>
              </Show>

              {/* Other Actions */}
              <Show when={groupedActions().other.length > 0}>
                <div class="px-2 py-1">
                  <div
                    class="px-2 py-1 text-xs font-medium"
                    style={{ color: "var(--text-weak)" }}
                  >
                    Other
                  </div>
                  <For each={groupedActions().other}>
                    {(action, index) => {
                      const actualIndex = () =>
                        groupedActions().quickfix.length +
                        groupedActions().refactor.length +
                        groupedActions().source.length +
                        index();
                      return (
                        <ActionItem
                          action={action}
                          isSelected={state.selectedIndex === actualIndex()}
                          onSelect={() => setState("selectedIndex", actualIndex())}
                          onExecute={() => executeAction(action)}
                          onPreview={() => showPreview(action)}
                        />
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          {/* Error message */}
          <Show when={state.error}>
            <div class="px-3 py-2 border-t" style={{ "border-color": "var(--border-weak)" }}>
              <p class="text-xs" style={{ color: "var(--cortex-error)" }}>
                {state.error}
              </p>
            </div>
          </Show>
        </div>
      </Show>

      {/* Preview Panel */}
      <Show when={state.preview}>
        <PreviewPanel
          preview={state.preview!}
          onApply={applyPreview}
          onCancel={cancelPreview}
        />
      </Show>

      {/* Context Menu - VS Code: z-index 40, 3px border-radius */}
      <Show when={contextMenuVisible() && contextMenuPosition()}>
        <div
          class="suggest-widget"
          style={{
            /* VS Code suggest widget specs */
            position: "fixed",
            "z-index": "40",
            left: `${contextMenuPosition()!.x}px`,
            top: `${contextMenuPosition()!.y}px`,
            "min-width": "200px",
            "border-radius": "var(--cortex-radius-sm)",
            "border-style": "solid",
            "border-width": "1px",
            "border-color": "var(--border-weak)",
            background: "var(--surface-raised)",
            "box-shadow": "0 0 8px 2px rgba(0, 0, 0, 0.36)",
            overflow: "hidden",
          }}
        >
          <For each={getContextMenuItems()}>
            {(item) => (
              <>
                <Show when={item.separator}>
                  <div
                    class="h-px my-1"
                    style={{ background: "var(--border-weak)" }}
                  />
                </Show>
                <button
                  class="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    color: item.disabled ? "var(--text-disabled)" : "var(--text-base)",
                    opacity: item.disabled ? 0.5 : 1,
                  }}
                  classList={{
                    "hover:bg-white/5": !item.disabled,
                    "cursor-not-allowed": item.disabled,
                  }}
                  onClick={() => {
                    if (!item.disabled) {
                      closeContextMenu();
                      item.action();
                    }
                  }}
                  disabled={item.disabled}
                >
                  <span style={{ color: "var(--text-weak)" }}>
                    <item.icon />
                  </span>
                  <span class="text-sm">{item.label}</span>
                </button>
              </>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface ActionItemProps {
  action: CodeAction;
  isSelected: boolean;
  onSelect: () => void;
  onExecute: () => void;
  onPreview: () => void;
}

function ActionItem(props: ActionItemProps) {
  const Icon = getActionIcon(props.action.kind);
  const kindLabel = getKindLabel(props.action.kind);

  return (
    <div
      class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors"
      style={{
        background: props.isSelected ? "var(--surface-active)" : "transparent",
        opacity: props.action.disabled ? 0.5 : 1,
      }}
      onMouseEnter={props.onSelect}
      onClick={props.onExecute}
      onDblClick={props.onPreview}
    >
      <span
        class="flex-shrink-0"
        style={{
          color: props.action.isPreferred ? "var(--cortex-syntax-function)" : "var(--text-weak)",
        }}
      >
        <Icon />
      </span>
      <div class="flex-1 min-w-0">
        <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
          {props.action.title}
        </div>
        <Show when={props.action.disabled}>
          <div class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
            {props.action.disabled?.reason}
          </div>
        </Show>
      </div>
      <Show when={props.action.isPreferred}>
        <span
          class="text-xs px-1.5 py-0.5 rounded"
          style={{ background: "var(--cortex-syntax-function)20", color: "var(--cortex-syntax-function)" }}
        >
          Preferred
        </span>
      </Show>
      <span class="text-xs" style={{ color: "var(--text-weak)" }}>
        {kindLabel}
      </span>
    </div>
  );
}

interface PreviewPanelProps {
  preview: PreviewState;
  onApply: () => void;
  onCancel: () => void;
}

function PreviewPanel(props: PreviewPanelProps) {
  const [showDiff, setShowDiff] = createSignal(true);

  // Generate simple diff display
  const diffLines = createMemo(() => {
    const original = props.preview.originalContent.split("\n");
    const preview = props.preview.previewContent.split("\n");
    const diff: Array<{ type: "same" | "add" | "remove"; line: string; lineNum: number }> = [];

    const maxLen = Math.max(original.length, preview.length);
    for (let i = 0; i < maxLen; i++) {
      const origLine = original[i];
      const newLine = preview[i];

      if (origLine === newLine) {
        diff.push({ type: "same", line: origLine ?? "", lineNum: i + 1 });
      } else {
        if (origLine !== undefined) {
          diff.push({ type: "remove", line: origLine, lineNum: i + 1 });
        }
        if (newLine !== undefined) {
          diff.push({ type: "add", line: newLine, lineNum: i + 1 });
        }
      }
    }

    // Filter to show only changed lines with context
    return diff.filter((d, idx) => {
      if (d.type !== "same") return true;
      // Show context lines around changes
      const hasPrevChange = diff[idx - 1]?.type !== "same";
      const hasNextChange = diff[idx + 1]?.type !== "same";
      return hasPrevChange || hasNextChange;
    });
  });

  return (
    <div
      class="rename-widget preview"
      style={{ 
        /* VS Code rename widget: z-index 100 (highest) */
        position: "fixed",
        inset: "0",
        "z-index": "100",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        class="w-[600px] max-h-[80vh] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          class="flex items-center justify-between px-4 py-3 border-b"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div>
            <h3 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Preview Changes
            </h3>
            <p class="text-xs mt-0.5" style={{ color: "var(--text-weak)" }}>
              {props.preview.action.title}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-1 text-xs rounded transition-colors"
              style={{
                background: showDiff() ? "var(--accent-primary)" : "transparent",
                color: showDiff() ? "white" : "var(--text-weak)",
              }}
              onClick={() => setShowDiff(!showDiff())}
            >
              <PreviewIcon />
            </button>
            <button
              class="p-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: "var(--text-weak)" }}
              onClick={props.onCancel}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div
          class="flex-1 overflow-auto p-4 font-mono text-xs"
          style={{ background: "var(--background-base)" }}
        >
          <Show when={showDiff()}>
            <For each={diffLines()}>
              {(line) => (
                <div
                  class="flex"
                  style={{
                    background:
                      line.type === "add"
                        ? "rgba(46, 160, 67, 0.15)"
                        : line.type === "remove"
                          ? "rgba(248, 81, 73, 0.15)"
                          : "transparent",
                    color:
                      line.type === "add"
                        ? "var(--cortex-success)"
                        : line.type === "remove"
                          ? "var(--cortex-error)"
                          : "var(--text-base)",
                  }}
                >
                  <span
                    class="w-8 shrink-0 text-right pr-2 select-none"
                    style={{ color: "var(--text-weak)" }}
                  >
                    {line.lineNum}
                  </span>
                  <span class="w-4 shrink-0 text-center select-none">
                    {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                  </span>
                  <span class="flex-1 whitespace-pre">{line.line}</span>
                </div>
              )}
            </For>
          </Show>
          <Show when={!showDiff()}>
            <pre class="whitespace-pre-wrap" style={{ color: "var(--text-base)" }}>
              {props.preview.previewContent}
            </pre>
          </Show>
        </div>

        {/* Footer */}
        <div
          class="flex items-center justify-between px-4 py-3 border-t"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <p class="text-xs" style={{ color: "var(--text-weak)" }}>
            {props.preview.edits.length} edit{props.preview.edits.length !== 1 ? "s" : ""} to be
            applied
          </p>
          <div class="flex items-center gap-2">
            <button
              class="px-3 py-1.5 text-sm rounded transition-colors hover:bg-white/10"
              style={{ color: "var(--text-weak)" }}
              onClick={props.onCancel}
            >
              Cancel
            </button>
            <button
              class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors"
              style={{ background: "var(--accent-primary)", color: "white" }}
              onClick={props.onApply}
            >
              <CheckIcon />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



