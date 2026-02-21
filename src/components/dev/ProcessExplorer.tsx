import {
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  For,
  Show,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Icon } from "../ui/Icon";
import { useTheme } from "@/context/ThemeContext";

// ============== Types ==============

/** Process type enumeration */
export type ProcessType =
  | "main"
  | "renderer"
  | "extension_host"
  | "lsp_server"
  | "terminal"
  | "debug_adapter"
  | "plugin"
  | "unknown";

/** Single process information */
export interface ProcessInfo {
  pid: number;
  name: string;
  type: ProcessType;
  cpuPercent: number;
  memoryBytes: number;
  memoryPercent: number;
  status: "running" | "sleeping" | "stopped" | "zombie";
  startTime: number;
  parentPid?: number;
  command?: string;
  details?: ProcessDetails;
}

/** Extended process details */
export interface ProcessDetails {
  workingDirectory?: string;
  arguments?: string[];
  environment?: Record<string, string>;
  threads?: number;
  openFiles?: number;
  networkConnections?: number;
}

/** Sort configuration */
interface SortConfig {
  column: keyof ProcessInfo;
  direction: "asc" | "desc";
}

/** Refresh interval options in milliseconds */
const REFRESH_INTERVALS = [
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "Off", value: 0 },
];

// ============== Utility Functions ==============

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Format percentage with fixed decimals */
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format timestamp to relative time */
function formatUptime(startTime: number): string {
  const now = Date.now();
  const diffMs = now - startTime;
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Get icon name for process type */
function getProcessIconName(type: ProcessType): string {
  switch (type) {
    case "main":
      return "server";
    case "renderer":
      return "layer-group";
    case "extension_host":
      return "box";
    case "lsp_server":
      return "code";
    case "terminal":
      return "terminal";
    case "debug_adapter":
      return "play";
    case "plugin":
      return "bolt";
    default:
      return "microchip";
  }
}

/** Get color for process type */
function getProcessTypeColor(type: ProcessType): string {
  switch (type) {
    case "main":
      return "var(--cortex-info)"; // Indigo
    case "renderer":
      return "var(--cortex-info)"; // Violet
    case "extension_host":
      return "var(--cortex-success)"; // Green
    case "lsp_server":
      return "var(--cortex-info)"; // Blue
    case "terminal":
      return "var(--cortex-warning)"; // Amber
    case "debug_adapter":
      return "var(--cortex-error)"; // Red
    case "plugin":
      return "var(--cortex-info)"; // Teal
    default:
      return "var(--cortex-text-inactive)"; // Gray
  }
}

/** Get display label for process type */
function getProcessTypeLabel(type: ProcessType): string {
  switch (type) {
    case "main":
      return "Main Process";
    case "renderer":
      return "Renderer";
    case "extension_host":
      return "Extension Host";
    case "lsp_server":
      return "LSP Server";
    case "terminal":
      return "Terminal";
    case "debug_adapter":
      return "Debug Adapter";
    case "plugin":
      return "Plugin";
    default:
      return "Unknown";
  }
}

// ============== Process Row Component ==============

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: () => void;
  onTerminate: () => void;
  onForceKill: () => void;
  onCopyInfo: () => void;
  isDark: boolean;
}

function ProcessRow(props: ProcessRowProps) {
  const iconName = getProcessIconName(props.process.type);
  const typeColor = getProcessTypeColor(props.process.type);

  const cpuWarning = () => props.process.cpuPercent > 80;
  const memWarning = () => props.process.memoryPercent > 80;

  return (
    <tr
      class="transition-colors cursor-pointer"
      style={{
        background: props.isSelected
          ? props.isDark
            ? "rgba(99, 102, 241, 0.15)"
            : "rgba(99, 102, 241, 0.1)"
          : "transparent",
      }}
      onClick={props.onSelect}
      onMouseEnter={(e) => {
        if (!props.isSelected) {
          e.currentTarget.style.background = props.isDark
            ? "rgba(255, 255, 255, 0.03)"
            : "rgba(0, 0, 0, 0.02)";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.isSelected) {
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {/* Process Name */}
      <td class="py-2 px-3">
        <div class="flex items-center gap-2">
          <div
            class="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: `${typeColor}20` }}
          >
            <Icon name={iconName} size={14} style={{ color: typeColor }} />
          </div>
          <div>
            <div
              class="text-sm font-medium"
              style={{ color: props.isDark ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
            >
              {props.process.name}
            </div>
            <div class="text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
              {getProcessTypeLabel(props.process.type)}
            </div>
          </div>
        </div>
      </td>

      {/* PID */}
      <td class="py-2 px-3">
        <span
          class="font-mono text-sm"
          style={{ color: props.isDark ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)" }}
        >
          {props.process.pid}
        </span>
      </td>

      {/* CPU % */}
      <td class="py-2 px-3">
        <div class="flex items-center gap-2">
          <div
            class="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
          >
            <div
              class="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(props.process.cpuPercent, 100)}%`,
                background: cpuWarning() ? "var(--cortex-error)" : "var(--cortex-success)",
              }}
            />
          </div>
          <span
            class="text-sm font-mono w-12"
            style={{
              color: cpuWarning()
                ? "var(--cortex-error)"
                : props.isDark
                ? "var(--cortex-text-inactive)"
                : "var(--cortex-text-inactive)",
            }}
          >
            {formatPercent(props.process.cpuPercent)}
          </span>
        </div>
      </td>

      {/* Memory */}
      <td class="py-2 px-3">
        <div class="flex items-center gap-2">
          <div
            class="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
          >
            <div
              class="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(props.process.memoryPercent, 100)}%`,
                background: memWarning() ? "var(--cortex-error)" : "var(--cortex-info)",
              }}
            />
          </div>
          <span
            class="text-sm font-mono w-20"
            style={{
              color: memWarning()
                ? "var(--cortex-error)"
                : props.isDark
                ? "var(--cortex-text-inactive)"
                : "var(--cortex-text-inactive)",
            }}
          >
            {formatBytes(props.process.memoryBytes)}
          </span>
        </div>
      </td>

      {/* Status */}
      <td class="py-2 px-3">
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{
            background:
              props.process.status === "running"
                ? "rgba(34, 197, 94, 0.15)"
                : props.process.status === "sleeping"
                ? "rgba(59, 130, 246, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            color:
              props.process.status === "running"
                ? "var(--cortex-success)"
                : props.process.status === "sleeping"
                ? "var(--cortex-info)"
                : "var(--cortex-error)",
          }}
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            style={{
              background:
                props.process.status === "running"
                  ? "var(--cortex-success)"
                  : props.process.status === "sleeping"
                  ? "var(--cortex-info)"
                  : "var(--cortex-error)",
            }}
          />
          {props.process.status}
        </span>
      </td>

      {/* Actions */}
      <td class="py-2 px-3">
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded transition-colors"
            style={{ color: "var(--cortex-text-inactive)" }}
            onClick={(e) => {
              e.stopPropagation();
              props.onCopyInfo();
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = props.isDark
                ? "var(--ui-panel-bg-lighter)"
                : "var(--cortex-text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            title="Copy process info"
          >
            <Icon name="copy" size={14} />
          </button>
          <Show when={props.process.type !== "main"}>
            <button
              class="p-1.5 rounded transition-colors"
              style={{ color: "var(--cortex-warning)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onTerminate();
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(245, 158, 11, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              title="Terminate process"
            >
              <Icon name="triangle-exclamation" size={14} />
            </button>
            <button
              class="p-1.5 rounded transition-colors"
              style={{ color: "var(--cortex-error)" }}
              onClick={(e) => {
                e.stopPropagation();
                props.onForceKill();
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
              title="Force kill process"
            >
              <Icon name="trash" size={14} />
            </button>
          </Show>
        </div>
      </td>
    </tr>
  );
}

// ============== Process Details Panel ==============

interface ProcessDetailsPanelProps {
  process: ProcessInfo;
  onClose: () => void;
  onTerminate: () => void;
  onForceKill: () => void;
  onCopyDiagnostics: () => void;
  isDark: boolean;
}

function ProcessDetailsPanel(props: ProcessDetailsPanelProps) {
  const iconName = getProcessIconName(props.process.type);
  const typeColor = getProcessTypeColor(props.process.type);

  const DetailRow = (rowProps: { label: string; value: string | number }) => (
    <div class="flex items-center justify-between py-1.5">
      <span class="text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
        {rowProps.label}
      </span>
      <span
        class="text-sm font-mono"
        style={{ color: props.isDark ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
      >
        {rowProps.value}
      </span>
    </div>
  );

  return (
    <div
      class="h-full flex flex-col"
      style={{
        background: props.isDark ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
        "border-left": `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ "border-bottom": `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}` }}
      >
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${typeColor}20` }}
          >
            <Icon name={iconName} size={18} style={{ color: typeColor }} />
          </div>
          <div>
            <h3
              class="text-sm font-semibold"
              style={{ color: props.isDark ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
            >
              {props.process.name}
            </h3>
            <p class="text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
              PID {props.process.pid}
            </p>
          </div>
        </div>
        <button
          class="p-1.5 rounded transition-colors"
          style={{ color: "var(--cortex-text-inactive)" }}
          onClick={props.onClose}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = props.isDark
              ? "var(--ui-panel-bg-lighter)"
              : "var(--cortex-text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Icon name="xmark" size={16} />
        </button>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Basic Info */}
        <div>
          <h4
            class="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--cortex-text-inactive)" }}
          >
            Process Information
          </h4>
          <div
            class="rounded-lg p-3"
            style={{
              background: props.isDark ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
              border: `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
            }}
          >
            <DetailRow label="Type" value={getProcessTypeLabel(props.process.type)} />
            <DetailRow label="Status" value={props.process.status} />
            <DetailRow label="Uptime" value={formatUptime(props.process.startTime)} />
            <Show when={props.process.parentPid}>
              <DetailRow label="Parent PID" value={props.process.parentPid!} />
            </Show>
          </div>
        </div>

        {/* Resource Usage */}
        <div>
          <h4
            class="text-xs font-medium uppercase tracking-wider mb-2"
            style={{ color: "var(--cortex-text-inactive)" }}
          >
            Resource Usage
          </h4>
          <div
            class="rounded-lg p-3 space-y-3"
            style={{
              background: props.isDark ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
              border: `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
            }}
          >
            {/* CPU */}
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span style={{ color: "var(--cortex-text-inactive)" }}>CPU</span>
                <span
                  style={{
                    color:
                      props.process.cpuPercent > 80
                        ? "var(--cortex-error)"
                        : props.isDark
                        ? "var(--cortex-text-primary)"
                        : "var(--cortex-bg-secondary)",
                  }}
                >
                  {formatPercent(props.process.cpuPercent)}
                </span>
              </div>
              <div
                class="h-2 rounded-full overflow-hidden"
                style={{ background: props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
              >
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(props.process.cpuPercent, 100)}%`,
                    background:
                      props.process.cpuPercent > 80
                        ? "var(--cortex-error)"
                        : props.process.cpuPercent > 50
                        ? "var(--cortex-warning)"
                        : "var(--cortex-success)",
                  }}
                />
              </div>
            </div>

            {/* Memory */}
            <div>
              <div class="flex items-center justify-between text-xs mb-1">
                <span style={{ color: "var(--cortex-text-inactive)" }}>Memory</span>
                <span
                  style={{
                    color:
                      props.process.memoryPercent > 80
                        ? "var(--cortex-error)"
                        : props.isDark
                        ? "var(--cortex-text-primary)"
                        : "var(--cortex-bg-secondary)",
                  }}
                >
                  {formatBytes(props.process.memoryBytes)} ({formatPercent(props.process.memoryPercent)})
                </span>
              </div>
              <div
                class="h-2 rounded-full overflow-hidden"
                style={{ background: props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)" }}
              >
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(props.process.memoryPercent, 100)}%`,
                    background:
                      props.process.memoryPercent > 80
                        ? "var(--cortex-error)"
                        : props.process.memoryPercent > 50
                        ? "var(--cortex-warning)"
                        : "var(--cortex-info)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Command Line */}
        <Show when={props.process.command}>
          <div>
            <h4
              class="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: "var(--cortex-text-inactive)" }}
            >
              Command Line
            </h4>
            <div
              class="rounded-lg p-3 font-mono text-xs overflow-x-auto"
              style={{
                background: props.isDark ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
                border: `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                color: props.isDark ? "var(--cortex-text-inactive)" : "var(--cortex-text-inactive)",
              }}
            >
              {props.process.command}
            </div>
          </div>
        </Show>

        {/* Extended Details */}
        <Show when={props.process.details}>
          <div>
            <h4
              class="text-xs font-medium uppercase tracking-wider mb-2"
              style={{ color: "var(--cortex-text-inactive)" }}
            >
              Extended Details
            </h4>
            <div
              class="rounded-lg p-3"
              style={{
                background: props.isDark ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
                border: `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
              }}
            >
              <Show when={props.process.details?.threads}>
                <DetailRow label="Threads" value={props.process.details!.threads!} />
              </Show>
              <Show when={props.process.details?.openFiles}>
                <DetailRow label="Open Files" value={props.process.details!.openFiles!} />
              </Show>
              <Show when={props.process.details?.networkConnections}>
                <DetailRow
                  label="Network Connections"
                  value={props.process.details!.networkConnections!}
                />
              </Show>
              <Show when={props.process.details?.workingDirectory}>
                <div class="py-1.5">
                  <div class="text-xs mb-1" style={{ color: "var(--cortex-text-inactive)" }}>
                    Working Directory
                  </div>
                  <div
                    class="text-xs font-mono truncate"
                    style={{ color: props.isDark ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                    title={props.process.details!.workingDirectory}
                  >
                    {props.process.details!.workingDirectory}
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Actions */}
      <div
        class="px-4 py-3 space-y-2 shrink-0"
        style={{ "border-top": `1px solid ${props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}` }}
      >
        <button
          class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: props.isDark ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
            color: props.isDark ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
          }}
          onClick={props.onCopyDiagnostics}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = props.isDark
              ? "var(--cortex-bg-hover)"
              : "var(--cortex-text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = props.isDark
              ? "var(--ui-panel-bg-lighter)"
              : "var(--cortex-text-primary)")
          }
        >
          <Icon name="copy" size={14} />
          Copy Diagnostics
        </button>

        <Show when={props.process.type !== "main"}>
          <div class="flex gap-2">
            <button
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "var(--cortex-warning)",
              }}
              onClick={props.onTerminate}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(245, 158, 11, 0.25)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(245, 158, 11, 0.15)")
              }
            >
              <Icon name="triangle-exclamation" size={14} />
              Terminate
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "var(--cortex-error)",
              }}
              onClick={props.onForceKill}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)")
              }
            >
              <Icon name="trash" size={14} />
              Force Kill
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ============== Main Process Explorer Component ==============

interface ProcessExplorerProps {
  open: boolean;
  onClose: () => void;
}

export function ProcessExplorer(props: ProcessExplorerProps) {
  const { isDark } = useTheme();

  // State
  const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedPid, setSelectedPid] = createSignal<number | null>(null);
  const [sortConfig, setSortConfig] = createSignal<SortConfig>({
    column: "cpuPercent",
    direction: "desc",
  });
  const [refreshInterval, setRefreshInterval] = createSignal(2000);
  const [filterType, setFilterType] = createSignal<ProcessType | "all">("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [confirmKill, setConfirmKill] = createSignal<{
    pid: number;
    force: boolean;
  } | null>(null);

  let refreshTimerRef: ReturnType<typeof setInterval> | null = null;
  let unlistenFn: UnlistenFn | null = null;

  // Fetch processes from backend
  const fetchProcesses = async () => {
    if (!props.open) return;

    try {
      setLoading(processes().length === 0);
      setError(null);

      const result = await invoke<ProcessInfo[]>("get_cortex_processes");
      setProcesses(result);
    } catch (e) {
      // If the Tauri command doesn't exist, use simulated data for development
      console.warn("Failed to fetch processes, using simulated data:", e);
      setProcesses(getSimulatedProcesses());
    } finally {
      setLoading(false);
    }
  };

  // Generate simulated process data for development/demo
  const getSimulatedProcesses = (): ProcessInfo[] => {
    const now = Date.now();
    const baseProcesses: Omit<ProcessInfo, "cpuPercent" | "memoryBytes" | "memoryPercent">[] = [
      {
        pid: 1000,
        name: "cortex-desktop",
        type: "main",
        status: "running",
        startTime: now - 3600000,
        command: "cortex-desktop --no-sandbox",
        details: {
          workingDirectory: "/Applications/Cortex.app/Contents/MacOS",
          threads: 12,
          openFiles: 156,
          networkConnections: 3,
        },
      },
      {
        pid: 1001,
        name: "cortex-renderer",
        type: "renderer",
        status: "running",
        startTime: now - 3600000,
        parentPid: 1000,
        command: "--type=renderer",
        details: { threads: 8, openFiles: 42 },
      },
      {
        pid: 1002,
        name: "extension-host",
        type: "extension_host",
        status: "running",
        startTime: now - 3500000,
        parentPid: 1000,
        command: "--extension-host",
        details: { threads: 4, openFiles: 28 },
      },
      {
        pid: 1003,
        name: "rust-analyzer",
        type: "lsp_server",
        status: "running",
        startTime: now - 1800000,
        parentPid: 1002,
        command: "rust-analyzer",
        details: { threads: 6, openFiles: 512, networkConnections: 0 },
      },
      {
        pid: 1004,
        name: "typescript-language-server",
        type: "lsp_server",
        status: "running",
        startTime: now - 1700000,
        parentPid: 1002,
        command: "typescript-language-server --stdio",
        details: { threads: 2, openFiles: 89 },
      },
      {
        pid: 1005,
        name: "python-lsp-server",
        type: "lsp_server",
        status: "sleeping",
        startTime: now - 1600000,
        parentPid: 1002,
        command: "pylsp",
        details: { threads: 1, openFiles: 34 },
      },
      {
        pid: 1006,
        name: "bash",
        type: "terminal",
        status: "running",
        startTime: now - 900000,
        parentPid: 1000,
        command: "/bin/bash --login",
        details: { workingDirectory: "/Users/dev/projects", threads: 1, openFiles: 8 },
      },
      {
        pid: 1007,
        name: "zsh",
        type: "terminal",
        status: "running",
        startTime: now - 600000,
        parentPid: 1000,
        command: "/bin/zsh",
        details: { workingDirectory: "/Users/dev/projects/cortex", threads: 1, openFiles: 12 },
      },
      {
        pid: 1008,
        name: "lldb-server",
        type: "debug_adapter",
        status: "running",
        startTime: now - 300000,
        parentPid: 1002,
        command: "lldb-vscode",
        details: { threads: 3, openFiles: 24, networkConnections: 1 },
      },
      {
        pid: 1009,
        name: "copilot-agent",
        type: "plugin",
        status: "running",
        startTime: now - 3400000,
        parentPid: 1002,
        command: "node copilot-agent.js",
        details: { threads: 2, openFiles: 16, networkConnections: 2 },
      },
    ];

    // Add some variation to resource usage
    return baseProcesses.map((proc) => ({
      ...proc,
      cpuPercent: Math.random() * (proc.type === "lsp_server" ? 40 : proc.type === "main" ? 15 : 20),
      memoryBytes:
        Math.random() *
        (proc.type === "main"
          ? 500 * 1024 * 1024
          : proc.type === "lsp_server"
          ? 300 * 1024 * 1024
          : 100 * 1024 * 1024),
      memoryPercent:
        Math.random() * (proc.type === "main" ? 8 : proc.type === "lsp_server" ? 5 : 2),
    }));
  };

  // Terminate process
  const terminateProcess = async (pid: number, force: boolean) => {
    try {
      await invoke("terminate_cortex_process", { pid, force });
      // Remove from list optimistically
      setProcesses((prev) => prev.filter((p) => p.pid !== pid));
      if (selectedPid() === pid) {
        setSelectedPid(null);
      }
    } catch (e) {
      console.error("Failed to terminate process:", e);
      setError(`Failed to terminate process ${pid}: ${e}`);
    }
    setConfirmKill(null);
  };

  // Copy process info to clipboard
  const copyProcessInfo = async (process: ProcessInfo) => {
    const info = `Process: ${process.name}
PID: ${process.pid}
Type: ${getProcessTypeLabel(process.type)}
Status: ${process.status}
CPU: ${formatPercent(process.cpuPercent)}
Memory: ${formatBytes(process.memoryBytes)} (${formatPercent(process.memoryPercent)})
Uptime: ${formatUptime(process.startTime)}
${process.command ? `Command: ${process.command}` : ""}`;

    try {
      await writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
    }
  };

  // Copy full diagnostics
  const copyDiagnostics = async () => {
    const allProcesses = processes();
    const totalCpu = allProcesses.reduce((sum, p) => sum + p.cpuPercent, 0);
    const totalMemory = allProcesses.reduce((sum, p) => sum + p.memoryBytes, 0);

    let report = `Cortex Desktop Process Report
Generated: ${new Date().toISOString()}
=====================================

Summary:
- Total Processes: ${allProcesses.length}
- Total CPU Usage: ${formatPercent(totalCpu)}
- Total Memory Usage: ${formatBytes(totalMemory)}

Process List:
`;

    for (const proc of allProcesses) {
      report += `
[${proc.pid}] ${proc.name} (${getProcessTypeLabel(proc.type)})
  Status: ${proc.status}
  CPU: ${formatPercent(proc.cpuPercent)}
  Memory: ${formatBytes(proc.memoryBytes)}
  Uptime: ${formatUptime(proc.startTime)}
  ${proc.command ? `Command: ${proc.command}` : ""}
`;
    }

    try {
      await writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy diagnostics:", e);
    }
  };

  // Sorted and filtered processes
  const sortedProcesses = createMemo(() => {
    let filtered = processes();

    // Apply type filter
    const typeFilter = filterType();
    if (typeFilter !== "all") {
      filtered = filtered.filter((p) => p.type === typeFilter);
    }

    // Apply search filter
    const query = searchQuery().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.pid.toString().includes(query) ||
          getProcessTypeLabel(p.type).toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const config = sortConfig();
    return [...filtered].sort((a, b) => {
      const aVal = a[config.column];
      const bVal = b[config.column];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return config.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return config.direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  });

  // Selected process details
  const selectedProcess = createMemo(() => {
    const pid = selectedPid();
    if (pid === null) return null;
    return processes().find((p) => p.pid === pid) || null;
  });

  // Toggle sort column
  const toggleSort = (column: keyof ProcessInfo) => {
    setSortConfig((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  // Summary stats - single pass over the array for efficiency
  const stats = createMemo(() => {
    const procs = processes();
    const byType: Record<ProcessType, number> = {
      main: 0,
      renderer: 0,
      extension_host: 0,
      lsp_server: 0,
      terminal: 0,
      debug_adapter: 0,
      plugin: 0,
      unknown: 0,
    };
    let totalCpu = 0;
    let totalMemory = 0;

    for (const p of procs) {
      byType[p.type] = (byType[p.type] || 0) + 1;
      totalCpu += p.cpuPercent;
      totalMemory += p.memoryBytes;
    }

    return {
      total: procs.length,
      totalCpu,
      totalMemory,
      byType,
    };
  });

  // Setup refresh interval
  createEffect(() => {
    if (!props.open) {
      if (refreshTimerRef) {
        clearInterval(refreshTimerRef);
        refreshTimerRef = null;
      }
      return;
    }

    // Initial fetch
    fetchProcesses();

    // Setup interval
    const interval = refreshInterval();
    if (interval > 0) {
      refreshTimerRef = setInterval(fetchProcesses, interval);
    }
  });

  // Listen for process events
  createEffect(() => {
    if (!props.open) {
      if (unlistenFn) {
        unlistenFn();
        unlistenFn = null;
      }
      return;
    }

    listen<ProcessInfo[]>("process-explorer:update", (event) => {
      setProcesses(event.payload);
    }).then((fn) => {
      unlistenFn = fn;
    }).catch((err) => {
      console.warn("Failed to listen for process-explorer:update events:", err);
    });
  });

  // Cleanup
  onCleanup(() => {
    if (refreshTimerRef) {
      clearInterval(refreshTimerRef);
    }
    if (unlistenFn) {
      unlistenFn();
    }
  });

  // Sort header component
  const SortHeader = (headerProps: { column: keyof ProcessInfo; label: string }) => {
    const config = sortConfig();
    const isActive = config.column === headerProps.column;

    return (
      <th
        class="py-2 px-3 text-left cursor-pointer select-none transition-colors"
        style={{ color: "var(--cortex-text-inactive)" }}
        onClick={() => toggleSort(headerProps.column)}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = isDark()
            ? "rgba(255, 255, 255, 0.03)"
            : "rgba(0, 0, 0, 0.02)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div class="flex items-center gap-1 text-xs font-medium uppercase tracking-wider">
          {headerProps.label}
          <Show when={isActive}>
            {config.direction === "asc" ? (
              <Icon name="chevron-up" size={12} />
            ) : (
              <Icon name="chevron-down" size={12} />
            )}
          </Show>
        </div>
      </th>
    );
  };

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 z-50"
        style={{ background: "rgba(0, 0, 0, 0.6)" }}
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
      >
        {/* Modal */}
        <div
          class="absolute inset-4 flex flex-col rounded-xl overflow-hidden"
          style={{
            background: isDark() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)",
            border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
            "box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div
            class="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ "border-bottom": `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}` }}
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--cortex-info), var(--cortex-info))" }}
              >
                <Icon name="wave-pulse" size={20} color="white" />
              </div>
              <div>
                <h2
                  class="text-lg font-semibold"
                  style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                >
                  Process Explorer
                </h2>
                <p class="text-xs" style={{ color: "var(--cortex-text-inactive)" }}>
                  {stats().total} processes · CPU: {formatPercent(stats().totalCpu)} · Memory:{" "}
                  {formatBytes(stats().totalMemory)}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              {/* Refresh indicator */}
              <Show when={loading()}>
                <Icon name="rotate" class="animate-spin" size={16} style={{ color: "var(--cortex-text-inactive)" }} />
              </Show>

              {/* Refresh interval selector */}
              <select
                class="px-2 py-1 rounded-lg text-xs"
                style={{
                  background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                  border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                  color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                }}
                value={refreshInterval()}
                onChange={(e) => setRefreshInterval(parseInt(e.currentTarget.value))}
              >
                <For each={REFRESH_INTERVALS}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>

              {/* Manual refresh */}
              <button
                class="p-2 rounded-lg transition-colors"
                style={{
                  background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                  border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                  color: "var(--cortex-text-inactive)",
                }}
                onClick={() => fetchProcesses()}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)")
                }
                title="Refresh now"
              >
                <Icon name="rotate" size={16} />
              </button>

              {/* Copy diagnostics */}
              <button
                class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: copied() ? "rgba(34, 197, 94, 0.15)" : isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                  border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
                  color: copied() ? "var(--cortex-success)" : isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                }}
                onClick={copyDiagnostics}
              >
                {copied() ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
                {copied() ? "Copied!" : "Report"}
              </button>

              {/* Close */}
              <button
                class="p-2 rounded-lg transition-colors"
                style={{ color: "var(--cortex-text-inactive)" }}
                onClick={props.onClose}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="xmark" size={18} />
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div
            class="flex items-center gap-4 px-5 py-3 shrink-0"
            style={{ "border-bottom": `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}` }}
          >
            {/* Search */}
            <div
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 max-w-xs"
              style={{
                background: isDark() ? "var(--ui-panel-bg)" : "var(--cortex-text-primary)",
                border: `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}`,
              }}
            >
              <Icon name="circle-info" size={14} style={{ color: "var(--cortex-text-inactive)" }} />
              <input
                type="text"
                placeholder="Search processes..."
                class="flex-1 bg-transparent text-sm outline-none"
                style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </div>

            {/* Type filter */}
            <div class="flex items-center gap-1">
              <button
                class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  background:
                    filterType() === "all"
                      ? "rgba(99, 102, 241, 0.15)"
                      : "transparent",
                  color: filterType() === "all" ? "var(--cortex-info)" : "var(--cortex-text-inactive)",
                }}
                onClick={() => setFilterType("all")}
              >
                All ({stats().total})
              </button>
              <For
                each={[
                  { type: "lsp_server" as ProcessType, label: "LSP" },
                  { type: "terminal" as ProcessType, label: "Terminal" },
                  { type: "extension_host" as ProcessType, label: "Extensions" },
                  { type: "debug_adapter" as ProcessType, label: "Debug" },
                ]}
              >
                {(item) => (
                  <button
                    class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background:
                        filterType() === item.type
                          ? `${getProcessTypeColor(item.type)}20`
                          : "transparent",
                      color:
                        filterType() === item.type
                          ? getProcessTypeColor(item.type)
                          : "var(--cortex-text-inactive)",
                    }}
                    onClick={() => setFilterType(item.type)}
                  >
                    {item.label} ({stats().byType[item.type]})
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Content */}
          <div class="flex-1 flex overflow-hidden">
            {/* Process List */}
            <div class="flex-1 overflow-auto">
              <Show
                when={!error()}
                fallback={
                  <div class="flex flex-col items-center justify-center h-full p-8">
                    <Icon name="triangle-exclamation" size={48} style={{ color: "var(--cortex-error)", opacity: 0.5 }} />
                    <p class="mt-4 text-sm" style={{ color: "var(--cortex-error)" }}>
                      {error()}
                    </p>
                    <button
                      class="mt-4 px-4 py-2 rounded-lg text-sm"
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "var(--cortex-error)",
                      }}
                      onClick={() => fetchProcesses()}
                    >
                      Retry
                    </button>
                  </div>
                }
              >
                <table class="w-full">
                  <thead
                    class="sticky top-0 z-10"
                    style={{ background: isDark() ? "var(--cortex-bg-secondary)" : "var(--cortex-text-primary)" }}
                  >
                    <tr style={{ "border-bottom": `1px solid ${isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)"}` }}>
                      <SortHeader column="name" label="Process" />
                      <SortHeader column="pid" label="PID" />
                      <SortHeader column="cpuPercent" label="CPU" />
                      <SortHeader column="memoryBytes" label="Memory" />
                      <SortHeader column="status" label="Status" />
                      <th class="py-2 px-3 text-left">
                        <span
                          class="text-xs font-medium uppercase tracking-wider"
                          style={{ color: "var(--cortex-text-inactive)" }}
                        >
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedProcesses()}>
                      {(process) => (
                        <ProcessRow
                          process={process}
                          isSelected={selectedPid() === process.pid}
                          onSelect={() =>
                            setSelectedPid((prev) =>
                              prev === process.pid ? null : process.pid
                            )
                          }
                          onTerminate={() =>
                            setConfirmKill({ pid: process.pid, force: false })
                          }
                          onForceKill={() =>
                            setConfirmKill({ pid: process.pid, force: true })
                          }
                          onCopyInfo={() => copyProcessInfo(process)}
                          isDark={isDark()}
                        />
                      )}
                    </For>
                  </tbody>
                </table>

                <Show when={sortedProcesses().length === 0 && !loading()}>
                  <div class="flex flex-col items-center justify-center py-16">
                    <Icon name="microchip" size={48} style={{ color: "var(--cortex-text-inactive)", opacity: 0.3 }} />
                    <p class="mt-4 text-sm" style={{ color: "var(--cortex-text-inactive)" }}>
                      No processes found
                    </p>
                  </div>
                </Show>
              </Show>
            </div>

            {/* Details Panel */}
            <Show when={selectedProcess()}>
              {(process) => (
                <div class="w-80 shrink-0">
                  <ProcessDetailsPanel
                    process={process()}
                    onClose={() => setSelectedPid(null)}
                    onTerminate={() =>
                      setConfirmKill({ pid: process().pid, force: false })
                    }
                    onForceKill={() =>
                      setConfirmKill({ pid: process().pid, force: true })
                    }
                    onCopyDiagnostics={() => copyProcessInfo(process())}
                    isDark={isDark()}
                  />
                </div>
              )}
            </Show>
          </div>
        </div>

        {/* Kill Confirmation Dialog */}
        <Show when={confirmKill()}>
          {(kill) => {
            const process = processes().find((p) => p.pid === kill().pid);
            return (
              <div
                class="fixed inset-0 z-[60] flex items-center justify-center"
                style={{ background: "rgba(0, 0, 0, 0.5)" }}
                onClick={(e) => e.target === e.currentTarget && setConfirmKill(null)}
              >
                <div
                  class="w-full max-w-sm mx-4 rounded-xl overflow-hidden"
                  style={{
                    background: isDark() ? "var(--cortex-bg-primary)" : "var(--cortex-text-primary)",
                    border: `1px solid ${isDark() ? "var(--cortex-bg-hover)" : "var(--cortex-text-primary)"}`,
                  }}
                >
                  <div class="p-5">
                    <div class="flex items-center gap-3 mb-4">
                      <div
                        class="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{
                          background: kill().force
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(245, 158, 11, 0.15)",
                        }}
                      >
                        {kill().force ? (
                          <Icon name="trash" size={20} style={{ color: "var(--cortex-error)" }} />
                        ) : (
                          <Icon name="triangle-exclamation" size={20} style={{ color: "var(--cortex-warning)" }} />
                        )}
                      </div>
                      <div>
                        <h3
                          class="font-semibold"
                          style={{ color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)" }}
                        >
                          {kill().force ? "Force Kill Process?" : "Terminate Process?"}
                        </h3>
                        <p class="text-sm" style={{ color: "var(--cortex-text-inactive)" }}>
                          {process?.name} (PID {kill().pid})
                        </p>
                      </div>
                    </div>

                    <p class="text-sm mb-5" style={{ color: "var(--cortex-text-inactive)" }}>
                      {kill().force
                        ? "Force killing will immediately terminate the process without allowing it to clean up. This may cause data loss."
                        : "Terminating will send a signal to gracefully stop the process. Some processes may not respond."}
                    </p>

                    <div class="flex gap-3">
                      <button
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          background: isDark() ? "var(--ui-panel-bg-lighter)" : "var(--cortex-text-primary)",
                          color: isDark() ? "var(--cortex-text-primary)" : "var(--cortex-bg-secondary)",
                        }}
                        onClick={() => setConfirmKill(null)}
                      >
                        Cancel
                      </button>
                      <button
                        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          background: kill().force
                            ? "rgba(239, 68, 68, 0.9)"
                            : "rgba(245, 158, 11, 0.9)",
                          color: "var(--cortex-text-primary)",
                        }}
                        onClick={() => terminateProcess(kill().pid, kill().force)}
                      >
                        {kill().force ? "Force Kill" : "Terminate"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          }}
        </Show>
      </div>
    </Show>
  );
}

// ============== Hook for Process Explorer ==============

export function useProcessExplorer() {
  const [open, setOpen] = createSignal(false);

  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
    toggle: () => setOpen((prev) => !prev),
    Dialog: () => <ProcessExplorer open={open()} onClose={() => setOpen(false)} />,
  };
}

// ============== Command Registration ==============

/** Open Process Explorer via command palette */
export function openProcessExplorer(): void {
  window.dispatchEvent(new CustomEvent("process-explorer:open"));
}

/** Toggle Process Explorer */
export function toggleProcessExplorer(): void {
  window.dispatchEvent(new CustomEvent("process-explorer:toggle"));
}

// ============== Default Export ==============

export default ProcessExplorer;

