import { For, Show, createSignal } from "solid-js";
import { Icon } from "./ui/Icon";
import { useLSP } from "@/context/LSPContext";
import type { LanguageStatusItem as LanguageStatusItemType, LanguageStatusSeverity } from "@/context/LSPContext";

export interface LanguageStatusItemProps {
  item: LanguageStatusItemType;
  onCommand?: (command: string, args?: unknown[]) => void;
}

/**
 * Returns the appropriate icon name based on severity level
 */
function getSeverityIconName(severity: LanguageStatusSeverity): string {
  switch (severity) {
    case "error":
      return "circle-exclamation";
    case "warning":
      return "triangle-exclamation";
    case "info":
    default:
      return "circle-info";
  }
}

/**
 * Returns CSS color variable based on severity level
 */
function getSeverityColor(severity: LanguageStatusSeverity): string {
  switch (severity) {
    case "error":
      return "var(--error)";
    case "warning":
      return "var(--warning)";
    case "info":
    default:
      return "var(--text-weaker)";
  }
}

/**
 * Returns hover color based on severity level
 */
function getSeverityHoverColor(severity: LanguageStatusSeverity): string {
  switch (severity) {
    case "error":
      return "var(--error)";
    case "warning":
      return "var(--warning)";
    case "info":
    default:
      return "var(--text-base)";
  }
}

/**
 * Individual language status item displayed in the status bar
 */
export function LanguageStatusItemButton(props: LanguageStatusItemProps) {
  const [isHovered, setIsHovered] = createSignal(false);
  
  const handleClick = () => {
    if (props.item.command) {
      if (props.onCommand) {
        props.onCommand(props.item.command.command, props.item.command.arguments);
      } else {
        window.dispatchEvent(
          new CustomEvent("lsp:execute-command", {
            detail: {
              command: props.item.command.command,
              arguments: props.item.command.arguments,
            },
          })
        );
      }
    }
  };

  const getTooltip = () => {
    const parts: string[] = [];
    if (props.item.detail) {
      parts.push(props.item.detail);
    }
    if (props.item.command) {
      parts.push(`Click: ${props.item.command.title}`);
    }
    return parts.join("\n") || props.item.label;
  };

  const baseColor = () => getSeverityColor(props.item.severity);
  const hoverColor = () => getSeverityHoverColor(props.item.severity);
  const currentColor = () => (isHovered() ? hoverColor() : baseColor());

  return (
    <button
      class="flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors hover:bg-[rgba(255,255,255,0.06)]"
      style={{ color: currentColor() }}
      title={getTooltip()}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={!props.item.command}
    >
      <Icon name={getSeverityIconName(props.item.severity)} class="w-3 h-3" />
      <span style={{ "font-size": "11px" }}>{props.item.label}</span>
    </button>
  );
}

export interface LanguageStatusItemsProps {
  language: string;
  onCommand?: (command: string, args?: unknown[]) => void;
}

/**
 * Container component that displays all language status items for a given language
 */
export function LanguageStatusItems(props: LanguageStatusItemsProps) {
  const lsp = useLSP();
  
  const statusItems = () => lsp.getLanguageStatusItems(props.language);

  return (
    <Show when={statusItems().length > 0}>
      <For each={statusItems()}>
        {(item) => (
          <LanguageStatusItemButton item={item} onCommand={props.onCommand} />
        )}
      </For>
    </Show>
  );
}

/**
 * Compact status indicator showing aggregated status for a language
 * Shows the highest severity icon and count of items
 */
export function LanguageStatusIndicator(props: LanguageStatusItemsProps) {
  const lsp = useLSP();
  const [isHovered, setIsHovered] = createSignal(false);
  
  const statusItems = () => lsp.getLanguageStatusItems(props.language);
  
  const highestSeverity = (): LanguageStatusSeverity => {
    const items = statusItems();
    if (items.some((i) => i.severity === "error")) return "error";
    if (items.some((i) => i.severity === "warning")) return "warning";
    return "info";
  };

  const getTooltip = () => {
    const items = statusItems();
    if (items.length === 0) return "No language status";
    return items
      .map((i) => `${i.label}${i.detail ? `: ${i.detail}` : ""}`)
      .join("\n");
  };

  const baseColor = () => getSeverityColor(highestSeverity());
  const hoverColor = () => getSeverityHoverColor(highestSeverity());
  const currentColor = () => (isHovered() ? hoverColor() : baseColor());

  return (
    <Show when={statusItems().length > 0}>
      <div
        class="flex items-center gap-1 px-1.5 py-0.5 rounded-sm transition-colors hover:bg-[rgba(255,255,255,0.06)] cursor-default"
        style={{ color: currentColor() }}
        title={getTooltip()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Icon name={getSeverityIconName(highestSeverity())} class="w-3 h-3" />
        <Show when={statusItems().length > 1}>
          <span style={{ "font-size": "10px" }}>{statusItems().length}</span>
        </Show>
      </div>
    </Show>
  );
}

/**
 * Pre-configured status items for common language tools
 */
export const CommonLanguageStatusItems = {
  /**
   * Creates a TypeScript version status item
   */
  createTypeScriptVersionItem(version: string, serverRunning: boolean): LanguageStatusItemType {
    return {
      id: "typescript-version",
      label: `TS ${version}`,
      severity: serverRunning ? "info" : "warning",
      detail: serverRunning 
        ? `TypeScript ${version} - Language server running`
        : `TypeScript ${version} - Language server not running`,
      command: serverRunning 
        ? { title: "Restart TypeScript Server", command: "typescript.restartTsServer", arguments: [] }
        : { title: "Start TypeScript Server", command: "typescript.startTsServer", arguments: [] },
    };
  },

  /**
   * Creates an ESLint status item
   */
  createESLintStatusItem(
    status: "running" | "error" | "disabled" | "warning",
    message?: string
  ): LanguageStatusItemType {
    const severityMap: Record<string, LanguageStatusSeverity> = {
      running: "info",
      error: "error",
      disabled: "info",
      warning: "warning",
    };

    const labelMap: Record<string, string> = {
      running: "ESLint",
      error: "ESLint",
      disabled: "ESLint Off",
      warning: "ESLint",
    };

    return {
      id: "eslint-status",
      label: labelMap[status],
      severity: severityMap[status],
      detail: message || (status === "running" ? "ESLint is running" : status === "disabled" ? "ESLint is disabled" : "ESLint error"),
      command: status === "error" 
        ? { title: "Show ESLint Output", command: "eslint.showOutputChannel", arguments: [] }
        : status === "disabled"
          ? { title: "Enable ESLint", command: "eslint.enable", arguments: [] }
          : { title: "Restart ESLint Server", command: "eslint.restart", arguments: [] },
    };
  },

  /**
   * Creates a Prettier status item
   */
  createPrettierStatusItem(
    status: "ready" | "error" | "disabled" | "formatting",
    message?: string
  ): LanguageStatusItemType {
    const severityMap: Record<string, LanguageStatusSeverity> = {
      ready: "info",
      error: "error",
      disabled: "info",
      formatting: "info",
    };

    const labelMap: Record<string, string> = {
      ready: "Prettier",
      error: "Prettier",
      disabled: "Prettier Off",
      formatting: "Formatting...",
    };

    return {
      id: "prettier-status",
      label: labelMap[status],
      severity: severityMap[status],
      detail: message || (status === "ready" ? "Prettier is ready" : status === "disabled" ? "Prettier is disabled" : "Prettier error"),
      command: status === "error"
        ? { title: "Show Prettier Output", command: "prettier.showOutputChannel", arguments: [] }
        : status === "disabled"
          ? { title: "Enable Prettier", command: "prettier.enable", arguments: [] }
          : { title: "Format Document", command: "editor.action.formatDocument", arguments: [] },
    };
  },

  /**
   * Creates a Rust Analyzer status item
   */
  createRustAnalyzerStatusItem(
    status: "running" | "loading" | "error" | "stopped",
    message?: string
  ): LanguageStatusItemType {
    const severityMap: Record<string, LanguageStatusSeverity> = {
      running: "info",
      loading: "info",
      error: "error",
      stopped: "warning",
    };

    const labelMap: Record<string, string> = {
      running: "rust-analyzer",
      loading: "rust-analyzer loading...",
      error: "rust-analyzer",
      stopped: "rust-analyzer stopped",
    };

    return {
      id: "rust-analyzer-status",
      label: labelMap[status],
      severity: severityMap[status],
      detail: message || `rust-analyzer: ${status}`,
      command: status === "error" || status === "stopped"
        ? { title: "Restart rust-analyzer", command: "rust-analyzer.restart", arguments: [] }
        : { title: "Open rust-analyzer Status", command: "rust-analyzer.status", arguments: [] },
    };
  },

  /**
   * Creates a Python/Pylsp status item
   */
  createPythonStatusItem(
    version: string,
    interpreterPath: string,
    serverRunning: boolean
  ): LanguageStatusItemType {
    return {
      id: "python-status",
      label: `Python ${version}`,
      severity: serverRunning ? "info" : "warning",
      detail: serverRunning
        ? `Python ${version} (${interpreterPath})`
        : `Python ${version} - Language server not running`,
      command: { title: "Select Python Interpreter", command: "python.selectInterpreter", arguments: [] },
    };
  },

  /**
   * Creates a Go (gopls) status item
   */
  createGoStatusItem(
    status: "running" | "error" | "stopped",
    message?: string
  ): LanguageStatusItemType {
    const severityMap: Record<string, LanguageStatusSeverity> = {
      running: "info",
      error: "error",
      stopped: "warning",
    };

    return {
      id: "go-status",
      label: "gopls",
      severity: severityMap[status],
      detail: message || `gopls: ${status}`,
      command: status === "running"
        ? { title: "Restart gopls", command: "go.languageserver.restart", arguments: [] }
        : { title: "Start gopls", command: "go.languageserver.start", arguments: [] },
    };
  },
};

export default LanguageStatusItems;
