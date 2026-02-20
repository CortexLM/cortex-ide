import { invoke } from "@tauri-apps/api/core";

export interface DiagnosticPosition {
  line: number;
  character: number;
}

export interface DiagnosticRange {
  start: DiagnosticPosition;
  end: DiagnosticPosition;
}

export type DiagnosticSeverity = "error" | "warning" | "information" | "hint";

export interface Diagnostic {
  uri: string;
  range: DiagnosticRange;
  severity: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: DiagnosticRelatedInfo[];
}

export interface DiagnosticRelatedInfo {
  location: {
    uri: string;
    range: DiagnosticRange;
  };
  message: string;
}

export interface DiagnosticCollection {
  uri: string;
  diagnostics: Diagnostic[];
}

export interface CodeAction {
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

export interface DiagnosticsRefreshOptions {
  uri?: string;
  force?: boolean;
}

export interface DiagnosticsExportOptions {
  format: "json" | "csv" | "markdown";
  uri?: string;
  includeHints?: boolean;
}

export async function refreshDiagnostics(options?: DiagnosticsRefreshOptions): Promise<void> {
  try {
    await invoke("diagnostics_refresh", {
      uri: options?.uri,
      force: options?.force ?? false,
    });
  } catch (error) {
    console.error("[diagnostics] Failed to refresh:", error);
  }
}

export async function getDiagnostics(uri?: string): Promise<DiagnosticCollection[]> {
  try {
    const result = await invoke<DiagnosticCollection[]>("diagnostics_get", { uri });
    return result;
  } catch (error) {
    console.error("[diagnostics] Failed to get diagnostics:", error);
    return [];
  }
}

export async function getDiagnosticsForFile(uri: string): Promise<Diagnostic[]> {
  try {
    const result = await invoke<Diagnostic[]>("diagnostics_get_for_file", { uri });
    return result;
  } catch (error) {
    console.error("[diagnostics] Failed to get diagnostics for file:", error);
    return [];
  }
}

export async function clearDiagnostics(uri?: string): Promise<void> {
  try {
    await invoke("diagnostics_clear", { uri });
  } catch (error) {
    console.error("[diagnostics] Failed to clear:", error);
  }
}

export async function getCodeActions(uri: string, range: DiagnosticRange): Promise<CodeAction[]> {
  try {
    const result = await invoke<CodeAction[]>("diagnostics_get_code_actions", {
      uri,
      range,
    });
    return result;
  } catch (error) {
    console.error("[diagnostics] Failed to get code actions:", error);
    return [];
  }
}

export async function applyCodeAction(action: CodeAction): Promise<boolean> {
  try {
    await invoke("diagnostics_apply_code_action", { action });
    return true;
  } catch (error) {
    console.error("[diagnostics] Failed to apply code action:", error);
    return false;
  }
}

export async function exportDiagnostics(options: DiagnosticsExportOptions): Promise<string> {
  try {
    const result = await invoke<string>("diagnostics_export", {
      format: options.format,
      uri: options.uri,
      include_hints: options.includeHints ?? false,
    });
    return result;
  } catch (error) {
    console.error("[diagnostics] Failed to export:", error);
    return "";
  }
}

export async function getDiagnosticCounts(uri?: string): Promise<{
  error: number;
  warning: number;
  information: number;
  hint: number;
  total: number;
}> {
  try {
    const result = await invoke<{
      error: number;
      warning: number;
      information: number;
      hint: number;
      total: number;
    }>("diagnostics_get_counts", { uri });
    return result;
  } catch (error) {
    console.error("[diagnostics] Failed to get counts:", error);
    return { error: 0, warning: 0, information: 0, hint: 0, total: 0 };
  }
}

export async function navigateToDiagnostic(
  uri: string,
  range: DiagnosticRange
): Promise<void> {
  try {
    await invoke("diagnostics_navigate_to", {
      uri,
      line: range.start.line,
      column: range.start.character,
    });
  } catch (error) {
    console.error("[diagnostics] Failed to navigate:", error);
  }
}

export async function setDiagnosticsFilter(filter: {
  showErrors?: boolean;
  showWarnings?: boolean;
  showInformation?: boolean;
  showHints?: boolean;
  sources?: string[];
}): Promise<void> {
  try {
    await invoke("diagnostics_set_filter", { filter });
  } catch (error) {
    console.error("[diagnostics] Failed to set filter:", error);
  }
}
