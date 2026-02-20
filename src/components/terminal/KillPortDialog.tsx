/**
 * Kill Process on Port Dialog - Free up occupied ports
 *
 * Provides UI for finding and killing processes that are using specific network ports.
 * Useful for developers when a port is already in use.
 */

import {
  createSignal,
  createEffect,
  For,
  Show,
  createMemo,
  onMount,
  onCleanup,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../ui/Icon";
import { Button, IconButton, Input, Text, Badge } from "@/components/ui";

// ============================================================================
// Types
// ============================================================================

/**
 * Information about a process using a port
 */
export interface PortProcess {
  /** Port number */
  port: number;
  /** Process ID */
  pid: number;
  /** Process name */
  processName: string;
  /** Full command line */
  command: string;
  /** User running the process */
  user: string;
  /** Protocol (TCP or UDP) */
  protocol: "tcp" | "udp";
  /** Local address */
  localAddress?: string;
  /** State (LISTENING, ESTABLISHED, etc.) */
  state?: string;
}

/**
 * Props for the KillPortDialog component
 */
interface KillPortDialogProps {
  /** Initial port to search for */
  initialPort?: number;
  /** Callback when a port is successfully killed */
  onKilled?: (port: number, process: PortProcess) => void;
  /** Callback when dialog is closed */
  onClose: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Common development ports */
const COMMON_PORTS = [
  { port: 3000, name: "React/Next.js" },
  { port: 3001, name: "React alternate" },
  { port: 4000, name: "Phoenix/GraphQL" },
  { port: 5000, name: "Flask/ASP.NET" },
  { port: 5173, name: "Vite" },
  { port: 5174, name: "Vite alternate" },
  { port: 8000, name: "Django" },
  { port: 8080, name: "HTTP alternate" },
  { port: 8081, name: "Development" },
  { port: 9000, name: "PHP-FPM" },
  { port: 4200, name: "Angular" },
  { port: 1420, name: "Tauri dev" },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a friendly name for a process
 */
const getProcessDisplayName = (process: PortProcess): string => {
  // Try to extract a clean name from the command
  const cmd = process.command.toLowerCase();
  
  if (cmd.includes("node")) return "Node.js";
  if (cmd.includes("python")) return "Python";
  if (cmd.includes("java")) return "Java";
  if (cmd.includes("ruby")) return "Ruby";
  if (cmd.includes("php")) return "PHP";
  if (cmd.includes("nginx")) return "Nginx";
  if (cmd.includes("apache")) return "Apache";
  if (cmd.includes("postgres")) return "PostgreSQL";
  if (cmd.includes("mysql")) return "MySQL";
  if (cmd.includes("redis")) return "Redis";
  if (cmd.includes("mongo")) return "MongoDB";
  if (cmd.includes("docker")) return "Docker";
  
  return process.processName || "Unknown";
};

/**
 * Get badge variant for process state
 */
const getStateBadgeVariant = (state?: string): "success" | "warning" | "default" => {
  if (!state) return "default";
  const s = state.toUpperCase();
  if (s === "LISTENING" || s === "LISTEN") return "success";
  if (s === "ESTABLISHED" || s === "TIME_WAIT") return "warning";
  return "default";
};

// ============================================================================
// Main Component
// ============================================================================

export function KillPortDialog(props: KillPortDialogProps) {
  // State
  const [portInput, setPortInput] = createSignal(props.initialPort?.toString() || "");
  const [isSearching, setIsSearching] = createSignal(false);
  const [isScanning, setIsScanning] = createSignal(false);
  const [isKilling, setIsKilling] = createSignal<number | null>(null);
  const [processes, setProcesses] = createStore<PortProcess[]>([]);
  const [allListening, setAllListening] = createStore<PortProcess[]>([]);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal<string | null>(null);
  const [showAllPorts, setShowAllPorts] = createSignal(false);
  const [searchFilter, setSearchFilter] = createSignal("");

  // Filtered processes when viewing all
  const filteredAllProcesses = createMemo(() => {
    const filter = searchFilter().toLowerCase();
    if (!filter) return allListening;
    
    return allListening.filter((p) =>
      p.port.toString().includes(filter) ||
      p.processName.toLowerCase().includes(filter) ||
      p.command.toLowerCase().includes(filter) ||
      getProcessDisplayName(p).toLowerCase().includes(filter)
    );
  });

  /**
   * Search for process on specific port
   */
  const searchPort = async () => {
    const port = parseInt(portInput());
    if (isNaN(port) || port < 1 || port > 65535) {
      setError("Please enter a valid port number (1-65535)");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsSearching(true);
    setProcesses([]);

    try {
      const result = await invoke<PortProcess | null>("get_process_on_port", { port });
      
      if (result) {
        setProcesses([result]);
      } else {
        setError(`No process found using port ${port}`);
      }
    } catch (e) {
      setError(`Failed to search: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Scan for all listening ports
   */
  const scanAllPorts = async () => {
    setError(null);
    setSuccess(null);
    setIsScanning(true);
    setAllListening([]);

    try {
      const result = await invoke<PortProcess[]>("list_listening_ports");
      setAllListening(result);
      setShowAllPorts(true);
    } catch (e) {
      setError(`Failed to scan ports: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  /**
   * Kill a process on a specific port
   */
  const killProcess = async (process: PortProcess) => {
    const confirmed = confirm(
      `Are you sure you want to kill "${getProcessDisplayName(process)}" (PID: ${process.pid}) on port ${process.port}?\n\nThis may cause data loss if the process has unsaved work.`
    );
    
    if (!confirmed) return;

    setIsKilling(process.pid);
    setError(null);
    setSuccess(null);

    try {
      await invoke<boolean>("kill_process_on_port", { port: process.port });
      
      setSuccess(`Successfully killed process on port ${process.port}`);
      props.onKilled?.(process.port, process);
      
      // Remove from lists
      setProcesses(produce((draft) => {
        const idx = draft.findIndex((p) => p.pid === process.pid);
        if (idx >= 0) draft.splice(idx, 1);
      }));
      
      setAllListening(produce((draft) => {
        const idx = draft.findIndex((p) => p.pid === process.pid);
        if (idx >= 0) draft.splice(idx, 1);
      }));
    } catch (e) {
      setError(`Failed to kill process: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsKilling(null);
    }
  };

  /**
   * Quick kill a common port
   */
  const quickKillPort = async (port: number) => {
    setPortInput(port.toString());
    
    // Search first
    setIsSearching(true);
    try {
      const result = await invoke<PortProcess | null>("get_process_on_port", { port });
      
      if (result) {
        setProcesses([result]);
        // Auto-prompt to kill
        await killProcess(result);
      } else {
        setError(`Port ${port} is not in use`);
      }
    } catch (e) {
      setError(`Failed to check port: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key in port input
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      searchPort();
    } else if (e.key === "Escape") {
      props.onClose();
    }
  };

  // Focus port input on mount
  let inputRef: HTMLInputElement | undefined;
  onMount(() => {
    inputRef?.focus();
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  // Clear messages after a delay
  createEffect(() => {
    if (success()) {
      const timeout = setTimeout(() => setSuccess(null), 3000);
      onCleanup(() => clearTimeout(timeout));
    }
  });

  return (
    <div
      class="flex flex-col h-full"
      style={{
        background: "var(--jb-modal)",
        "border-radius": "var(--jb-radius-lg)",
        border: "1px solid var(--jb-border-default)",
        overflow: "hidden",
        "max-height": "80vh",
      }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between p-4"
        style={{
          "border-bottom": "1px solid var(--jb-border-default)",
          background: "var(--jb-panel)",
        }}
      >
        <div class="flex items-center gap-3">
          <Icon name="server" class="h-5 w-5" style={{ color: "var(--jb-text-muted-color)" }} />
          <Text as="h2" size="lg" weight="semibold">
            Kill Process on Port
          </Text>
        </div>
        <IconButton onClick={props.onClose} size="lg">
          <Icon name="xmark" class="h-5 w-5" />
        </IconButton>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Port Input */}
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Input
              ref={inputRef}
              type="number"
              value={portInput()}
              onInput={(e) => setPortInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") searchPort();
              }}
              placeholder="Enter port number (e.g., 3000)"
              min="1"
              max="65535"
              style={{ "padding-left": "12px" }}
            />
          </div>
          <Button
            variant="primary"
            onClick={searchPort}
            disabled={isSearching()}
            icon={isSearching() ? <Icon name="rotate" class="h-4 w-4 animate-spin" /> : <Icon name="magnifying-glass" class="h-4 w-4" />}
          >
            Find Process
          </Button>
        </div>

        {/* Quick Actions */}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Text size="sm" weight="medium" style={{ color: "var(--jb-text-muted-color)" }}>
              Common Ports
            </Text>
            <Button
              variant="ghost"
              size="sm"
              onClick={scanAllPorts}
              disabled={isScanning()}
              icon={isScanning() ? <Icon name="rotate" class="h-3 w-3 animate-spin" /> : <Icon name="chart-line" class="h-3 w-3" />}
            >
              Scan All Listening Ports
            </Button>
          </div>
          <div class="flex flex-wrap gap-2">
            <For each={COMMON_PORTS}>
              {(item) => (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => quickKillPort(item.port)}
                  title={item.name}
                  style={{ "font-family": "monospace" }}
                >
                  {item.port}
                </Button>
              )}
            </For>
          </div>
        </div>

        {/* Error Message */}
        <Show when={error()}>
          <div
            class="flex items-center gap-2 p-3 rounded-lg"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <Icon name="triangle-exclamation" class="h-4 w-4 flex-shrink-0" style={{ color: "var(--cortex-error)" }} />
            <Text size="sm" style={{ color: "var(--cortex-error)" }}>
              {error()}
            </Text>
          </div>
        </Show>

        {/* Success Message */}
        <Show when={success()}>
          <div
            class="flex items-center gap-2 p-3 rounded-lg"
            style={{
              background: "rgba(34, 197, 94, 0.1)",
              border: "1px solid rgba(34, 197, 94, 0.2)",
            }}
          >
            <Icon name="check" class="h-4 w-4 flex-shrink-0" style={{ color: "var(--cortex-success)" }} />
            <Text size="sm" style={{ color: "var(--cortex-success)" }}>
              {success()}
            </Text>
          </div>
        </Show>

        {/* Single Port Results */}
        <Show when={processes.length > 0 && !showAllPorts()}>
          <div class="space-y-2">
            <Text size="sm" weight="medium">Process Found</Text>
            <For each={processes}>
              {(process) => (
                <ProcessCard
                  process={process}
                  onKill={() => killProcess(process)}
                  isKilling={isKilling() === process.pid}
                />
              )}
            </For>
          </div>
        </Show>

        {/* All Listening Ports */}
        <Show when={showAllPorts()}>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <Text size="sm" weight="medium">
                Listening Ports ({allListening.length})
              </Text>
              <div class="flex items-center gap-2">
                <Input
                  type="text"
                  value={searchFilter()}
                  onInput={(e) => setSearchFilter(e.currentTarget.value)}
                  placeholder="Filter..."
                  style={{ width: "200px" }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllPorts(false)}
                >
                  Hide
                </Button>
              </div>
            </div>
            
            <div class="space-y-2 max-h-[400px] overflow-y-auto">
              <Show
                when={filteredAllProcesses().length > 0}
                fallback={
                  <div class="text-center py-4">
                    <Text style={{ color: "var(--jb-text-muted-color)" }}>
                      {searchFilter() ? "No matching processes" : "No listening ports found"}
                    </Text>
                  </div>
                }
              >
                <For each={filteredAllProcesses()}>
                  {(process) => (
                    <ProcessCard
                      process={process}
                      onKill={() => killProcess(process)}
                      isKilling={isKilling() === process.pid}
                      compact
                    />
                  )}
                </For>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      {/* Footer */}
      <div
        class="flex items-center justify-between p-4"
        style={{
          "border-top": "1px solid var(--jb-border-default)",
          background: "var(--jb-panel)",
        }}
      >
        <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
          Killing a process may cause data loss
        </Text>
        <Button variant="ghost" onClick={props.onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Process Card Component
// ============================================================================

interface ProcessCardProps {
  process: PortProcess;
  onKill: () => void;
  isKilling: boolean;
  compact?: boolean;
}

function ProcessCard(props: ProcessCardProps) {
  const displayName = () => getProcessDisplayName(props.process);

  return (
    <div
      class="flex items-start gap-3 p-3 rounded-lg"
      style={{
        background: "var(--jb-bg-secondary)",
        border: "1px solid var(--jb-border-default)",
      }}
    >
      <div class="flex-shrink-0 mt-1">
        <Icon name="terminal" class="h-5 w-5" style={{ color: "var(--jb-text-muted-color)" }} />
      </div>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <Text weight="semibold" size="sm">
            Port {props.process.port}
          </Text>
          <Badge size="sm" variant="default">
            {props.process.protocol.toUpperCase()}
          </Badge>
          <Show when={props.process.state}>
            <Badge size="sm" variant={getStateBadgeVariant(props.process.state)}>
              {props.process.state}
            </Badge>
          </Show>
        </div>
        
        <div class="mt-1 space-y-1">
          <div class="flex items-center gap-2">
            <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
              Process:
            </Text>
            <Text size="xs" weight="medium">
              {displayName()}
            </Text>
            <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
              (PID: {props.process.pid})
            </Text>
          </div>
          
          <Show when={!props.compact}>
            <Show when={props.process.command}>
              <div
                class="text-xs font-mono p-2 rounded overflow-x-auto"
                style={{
                  background: "var(--jb-panel)",
                  color: "var(--jb-text-muted-color)",
                  "max-width": "100%",
                  "white-space": "nowrap",
                }}
              >
                {props.process.command}
              </div>
            </Show>
            
            <Show when={props.process.user}>
              <Text size="xs" style={{ color: "var(--jb-text-muted-color)" }}>
                User: {props.process.user}
              </Text>
            </Show>
          </Show>
        </div>
      </div>

      <Button
        variant="danger"
        size="sm"
        onClick={props.onKill}
        disabled={props.isKilling}
        icon={
          props.isKilling ? (
            <Icon name="rotate" class="h-4 w-4 animate-spin" />
          ) : (
            <Icon name="trash" class="h-4 w-4" />
          )
        }
      >
        Kill
      </Button>
    </div>
  );
}

// ============================================================================
// Default Export
// ============================================================================

export default KillPortDialog;

