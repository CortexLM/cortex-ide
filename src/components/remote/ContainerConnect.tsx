import { createSignal, createEffect, For, Show, createMemo, onMount, onCleanup } from "solid-js";
import { Icon } from "../ui/Icon";
import { useRemote, DevContainer, ContainerStatus, DevContainerConfig } from "@/context/RemoteContext";
import { Button, IconButton, Input, Text } from "@/components/ui";

interface ContainerConnectProps {
  onContainerSelect?: (containerId: string) => void;
  onOpenTerminal?: (containerId: string) => void;
  onOpenConfig?: (configPath: string) => void;
}

function StatusBadge(props: { status: ContainerStatus }) {
  const statusConfig = createMemo(() => {
    switch (props.status) {
      case "running":
        return { iconName: "circle-check", color: "var(--success)", text: "Running" };
      case "stopped":
        return { iconName: "stop", color: "var(--text-weaker)", text: "Stopped" };
      case "building":
        return { iconName: "spinner", color: "var(--accent)", text: "Building", animate: true };
      case "starting":
        return { iconName: "spinner", color: "var(--warning)", text: "Starting", animate: true };
      case "error":
        return { iconName: "circle-exclamation", color: "var(--error)", text: "Error" };
      default:
        return { iconName: "box", color: "var(--text-weak)", text: "Unknown" };
    }
  });

  return (
    <div class="flex items-center gap-1.5">
      <span
        class={statusConfig().animate ? "animate-spin" : ""}
        style={{ color: statusConfig().color }}
      >
        <Icon name={statusConfig().iconName} class="w-3.5 h-3.5" />
      </span>
      <span class="text-xs" style={{ color: statusConfig().color }}>
        {statusConfig().text}
      </span>
    </div>
  );
}

function ContainerCard(props: {
  container: DevContainer;
  isActive: boolean;
  onConnect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onOpenTerminal: () => void;
  onOpenConfig: () => void;
}) {
  const [showMenu, setShowMenu] = createSignal(false);

  const canConnect = () => props.container.status === "running";
  const canStart = () => props.container.status === "stopped";
  const isBusy = () => props.container.status === "building" || props.container.status === "starting";

  const formatUptime = (startedAt?: number) => {
    if (!startedAt) return "—";
    const diff = Date.now() - startedAt;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div
      class="group rounded-lg transition-all"
      classList={{
        "ring-2 ring-[var(--accent)]": props.isActive,
      }}
      style={{
        "background-color": "var(--surface-raised)",
        border: "1px solid var(--border-weak)",
      }}
    >
      <div class="p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ "background-color": "var(--surface-overlay)" }}
            >
              <Icon name="box" class="w-4 h-4" style={{ color: "var(--accent)" }} />
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-medium truncate" style={{ color: "var(--text-base)" }}>
                {props.container.name}
              </h3>
              <p class="text-xs truncate" style={{ color: "var(--text-weak)" }}>
                {props.container.image || "Custom Image"}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <StatusBadge status={props.container.status} />
            <div class="relative">
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu());
                }}
                class="opacity-0 group-hover:opacity-100"
                size="sm"
                variant="ghost"
              >
                <Icon name="ellipsis-vertical" class="w-4 h-4" />
              </IconButton>

              <Show when={showMenu()}>
                <div
                  class="absolute right-0 top-full mt-1 z-10 py-1 rounded-md shadow-lg min-w-[140px]"
                  style={{
                    "background-color": "var(--surface-overlay)",
                    border: "1px solid var(--border-base)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    onClick={() => {
                      props.onOpenConfig();
                      setShowMenu(false);
                    }}
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="gear" class="w-3.5 h-3.5" />}
                    style={{ width: "100%", "justify-content": "flex-start" }}
                  >
                    Edit Configuration
                  </Button>
                  <Button
                    onClick={() => {
                      props.onOpenTerminal();
                      setShowMenu(false);
                    }}
                    disabled={!canConnect()}
                    variant="ghost"
                    size="sm"
                    icon={<Icon name="terminal" class="w-3.5 h-3.5" />}
                    style={{ width: "100%", "justify-content": "flex-start" }}
                  >
                    Open Terminal
                  </Button>
                  <div
                    class="my-1 mx-2"
                    style={{ height: "1px", "background-color": "var(--border-weak)" }}
                  />
                  <Button
                    onClick={() => {
                      props.onRemove();
                      setShowMenu(false);
                    }}
                    disabled={isBusy()}
                    variant="danger"
                    size="sm"
                    icon={<Icon name="trash" class="w-3.5 h-3.5" />}
                    style={{ width: "100%", "justify-content": "flex-start" }}
                  >
                    Remove Container
                  </Button>
                </div>
              </Show>
            </div>
          </div>
        </div>

        <Show when={props.container.status === "running"}>
          <div class="flex items-center gap-4 mt-3 pt-2 border-t" style={{ "border-color": "var(--border-weak)" }}>
            <Show when={props.container.cpuUsage !== undefined}>
              <div class="flex items-center gap-1">
                <Icon name="microchip" class="w-3 h-3" style={{ color: "var(--text-weaker)" }} />
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {props.container.cpuUsage?.toFixed(1)}%
                </span>
              </div>
            </Show>
            <Show when={props.container.memoryUsage !== undefined}>
              <div class="flex items-center gap-1">
                <Icon name="hard-drive" class="w-3 h-3" style={{ color: "var(--text-weaker)" }} />
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {formatMemory(props.container.memoryUsage)}
                </span>
              </div>
            </Show>
            <Show when={props.container.startedAt}>
              <div class="flex items-center gap-1">
                <Icon name="clock" class="w-3 h-3" style={{ color: "var(--text-weaker)" }} />
                <span class="text-xs" style={{ color: "var(--text-weak)" }}>
                  {formatUptime(props.container.startedAt)}
                </span>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.container.error}>
          <div
            class="mt-2 px-2 py-1.5 rounded text-xs"
            style={{
              "background-color": "rgba(239, 68, 68, 0.1)",
              color: "var(--error)",
            }}
          >
            {props.container.error}
          </div>
        </Show>
      </div>

      <div
        class="flex items-center gap-2 px-3 py-2 border-t"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <Show
          when={canConnect()}
          fallback={
            <Show when={canStart()}>
              <Button
                onClick={props.onStart}
                disabled={isBusy()}
                variant="primary"
                size="sm"
                icon={<Icon name="play" class="w-3.5 h-3.5" />}
                style={{ flex: "1" }}
              >
                Start
              </Button>
            </Show>
          }
        >
          <Button
            onClick={props.onConnect}
            variant="primary"
            size="sm"
            icon={<Icon name="terminal" class="w-3.5 h-3.5" />}
            style={{ flex: "1" }}
          >
            Connect
          </Button>
          <IconButton
            onClick={props.onStop}
            size="sm"
            variant="ghost"
            tooltip="Stop container"
          >
            <Icon name="stop" class="w-3.5 h-3.5" />
          </IconButton>
        </Show>
      </div>
    </div>
  );
}

function formatMemory(bytes?: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function BuildFromDevContainerDialog(props: {
  isOpen: boolean;
  onClose: () => void;
  onBuild: (workspacePath: string, configPath?: string) => void;
  isBuilding: boolean;
  buildProgress?: string;
  error: string | null;
  availableConfigs: DevContainerConfig[];
}) {
  const [workspacePath, setWorkspacePath] = createSignal("");
  const [selectedConfig, setSelectedConfig] = createSignal<string | null>(null);
  const [customConfigPath, setCustomConfigPath] = createSignal("");
  const [useCustomPath, setUseCustomPath] = createSignal(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const configPath = useCustomPath()
      ? customConfigPath()
      : selectedConfig() || undefined;
    props.onBuild(workspacePath(), configPath);
  };

  createEffect(() => {
    if (props.isOpen) {
      setWorkspacePath("");
      setSelectedConfig(null);
      setCustomConfigPath("");
      setUseCustomPath(false);
    }
  });

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ "background-color": "rgba(0, 0, 0, 0.5)" }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !props.isBuilding) {
            props.onClose();
          }
        }}
      >
        <div
          class="w-[500px] max-h-[80vh] rounded-lg shadow-xl overflow-hidden"
          style={{
            "background-color": "var(--surface-overlay)",
            border: "1px solid var(--border-base)",
          }}
        >
          <div
            class="flex items-center justify-between px-4 py-3 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <Text size="sm" weight="semibold">
              Build Dev Container
            </Text>
            <IconButton
              onClick={props.onClose}
              disabled={props.isBuilding}
              size="sm"
              variant="ghost"
            >
              ×
            </IconButton>
          </div>

          <form onSubmit={handleSubmit} class="p-4 space-y-4 overflow-y-auto">
            <Input
              label="Workspace Path"
              type="text"
              value={workspacePath()}
              onInput={(e) => setWorkspacePath(e.currentTarget.value)}
              placeholder="/path/to/project"
              disabled={props.isBuilding}
              icon={<Icon name="folder" class="w-4 h-4" />}
              hint="Path to the project containing devcontainer.json"
              required
            />

            <Show when={props.availableConfigs.length > 0}>
              <div class="space-y-1.5">
                <Text size="xs" color="muted" weight="medium">
                  Configuration
                </Text>
                <div class="space-y-2">
                  <For each={props.availableConfigs}>
                    {(config) => (
                      <Button
                        type="button"
                        onClick={() => {
                          setSelectedConfig(config.path);
                          setUseCustomPath(false);
                        }}
                        disabled={props.isBuilding}
                        variant="secondary"
                        class="w-full text-left"
                        classList={{
                          "ring-2 ring-[var(--accent)]": selectedConfig() === config.path && !useCustomPath(),
                        }}
                        style={{
                          height: "auto",
                          padding: "12px",
                          "justify-content": "flex-start",
                          "align-items": "flex-start",
                        }}
                      >
                        <Icon name="gear" class="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
                        <div class="min-w-0">
                          <Text size="sm" weight="medium" truncate>
                            {config.name || "Default Configuration"}
                          </Text>
                          <Text size="xs" color="muted" truncate>
                            {config.path}
                          </Text>
                          <Show when={config.image}>
                            <div class="mt-1">
                              <Text size="xs" color="muted">
                                Image: {config.image}
                              </Text>
                            </div>
                          </Show>
                        </div>
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <div class="space-y-1.5">
              <Button
                type="button"
                onClick={() => setUseCustomPath(!useCustomPath())}
                disabled={props.isBuilding}
                variant="ghost"
                size="sm"
                icon={<span>{useCustomPath() ? "▼" : "▶"}</span>}
              >
                Use custom config path
              </Button>
              <Show when={useCustomPath()}>
                <Input
                  type="text"
                  value={customConfigPath()}
                  onInput={(e) => setCustomConfigPath(e.currentTarget.value)}
                  placeholder=".devcontainer/devcontainer.json"
                  disabled={props.isBuilding}
                  style={{ "margin-top": "8px" }}
                />
              </Show>
            </div>

            <Show when={props.isBuilding && props.buildProgress}>
              <div
                class="px-3 py-2 rounded text-xs font-mono"
                style={{
                  "background-color": "var(--surface-base)",
                  color: "var(--text-weak)",
                  "max-height": "120px",
                  "overflow-y": "auto",
                }}
              >
                {props.buildProgress}
              </div>
            </Show>

            <Show when={props.error}>
              <div
                class="px-3 py-2 rounded text-xs"
                style={{
                  "background-color": "rgba(239, 68, 68, 0.1)",
                  color: "var(--error)",
                }}
              >
                {props.error}
              </div>
            </Show>

            <div class="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={props.onClose}
                disabled={props.isBuilding}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!workspacePath() || props.isBuilding}
                variant="primary"
                loading={props.isBuilding}
                icon={props.isBuilding ? undefined : <Icon name="box" class="w-4 h-4" />}
              >
                {props.isBuilding ? "Building..." : "Build Container"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
}

export function ContainerConnect(props: ContainerConnectProps) {
  const remote = useRemote();
  const [showBuildDialog, setShowBuildDialog] = createSignal(false);
  const [isBuilding, setIsBuilding] = createSignal(false);
  const [buildProgress, setBuildProgress] = createSignal<string | undefined>();
  const [buildError, setBuildError] = createSignal<string | null>(null);
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  const containers = () => remote.state.containers;
  const activeContainerId = () => remote.state.activeContainerId;
  const availableConfigs = () => remote.state.availableDevContainerConfigs;

  onMount(() => {
    refreshContainers();
    const interval = setInterval(refreshContainers, 10000);
    onCleanup(() => clearInterval(interval));
  });

  const refreshContainers = async () => {
    setIsRefreshing(true);
    try {
      await remote.listContainers();
    } catch (e) {
      console.error("Failed to list containers:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConnect = async (containerId: string) => {
    try {
      await remote.connectToContainer(containerId);
      props.onContainerSelect?.(containerId);
    } catch (e) {
      console.error("Failed to connect to container:", e);
    }
  };

  const handleStart = async (containerId: string) => {
    try {
      await remote.startContainer(containerId);
    } catch (e) {
      console.error("Failed to start container:", e);
    }
  };

  const handleStop = async (containerId: string) => {
    try {
      await remote.stopContainer(containerId);
    } catch (e) {
      console.error("Failed to stop container:", e);
    }
  };

  const handleRemove = async (containerId: string) => {
    try {
      await remote.removeContainer(containerId);
    } catch (e) {
      console.error("Failed to remove container:", e);
    }
  };

  const handleBuild = async (workspacePath: string, configPath?: string) => {
    setIsBuilding(true);
    setBuildError(null);
    setBuildProgress("Initializing build...");

    try {
      await remote.buildDevContainer(workspacePath, configPath, (progress) => {
        setBuildProgress(progress);
      });
      setShowBuildDialog(false);
      await refreshContainers();
    } catch (e) {
      setBuildError(String(e));
    } finally {
      setIsBuilding(false);
    }
  };

  const handleOpenTerminal = (containerId: string) => {
    props.onOpenTerminal?.(containerId);
  };

  const handleOpenConfig = (container: DevContainer) => {
    if (container.configPath) {
      props.onOpenConfig?.(container.configPath);
    }
  };

  const runningCount = createMemo(() => containers().filter((c) => c.status === "running").length);

  return (
    <div class="flex flex-col h-full">
      <div
        class="flex items-center justify-between px-3 py-2 border-b"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-2">
          <Icon name="box" class="w-4 h-4" style={{ color: "var(--text-weak)" }} />
          <span class="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--text-weak)" }}>
            Dev Containers
          </span>
          <Show when={runningCount() > 0}>
            <span
              class="px-1.5 py-0.5 text-xs rounded"
              style={{
                "background-color": "var(--success)",
                color: "white",
              }}
            >
              {runningCount()} running
            </span>
          </Show>
        </div>
        <div class="flex items-center gap-1">
          <IconButton
            onClick={refreshContainers}
            disabled={isRefreshing()}
            size="sm"
            variant="ghost"
            tooltip="Refresh containers"
          >
            <Icon name="rotate" class={`w-4 h-4 ${isRefreshing() ? "animate-spin" : ""}`} />
          </IconButton>
          <IconButton
            onClick={() => setShowBuildDialog(true)}
            size="sm"
            variant="ghost"
            tooltip="Build from devcontainer.json"
          >
            <Icon name="plus" class="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-3 space-y-3">
        <Show
          when={containers().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-8 text-center">
              <Icon name="box" class="w-10 h-10 mb-3" style={{ color: "var(--text-weaker)" }} />
              <p class="text-sm font-medium mb-1" style={{ color: "var(--text-weak)" }}>
                No Dev Containers
              </p>
              <div class="mb-4">
                <Text size="xs" color="muted">
                  Build a container from devcontainer.json to get started
                </Text>
              </div>
              <Button
                onClick={() => setShowBuildDialog(true)}
                variant="primary"
                icon={<Icon name="plus" class="w-4 h-4" />}
              >
                Build Dev Container
              </Button>
            </div>
          }
        >
          <For each={containers()}>
            {(container) => (
              <ContainerCard
                container={container}
                isActive={activeContainerId() === container.id}
                onConnect={() => handleConnect(container.id)}
                onStart={() => handleStart(container.id)}
                onStop={() => handleStop(container.id)}
                onRemove={() => handleRemove(container.id)}
                onOpenTerminal={() => handleOpenTerminal(container.id)}
                onOpenConfig={() => handleOpenConfig(container)}
              />
            )}
          </For>
        </Show>
      </div>

      <BuildFromDevContainerDialog
        isOpen={showBuildDialog()}
        onClose={() => {
          if (!isBuilding()) {
            setShowBuildDialog(false);
            setBuildError(null);
            setBuildProgress(undefined);
          }
        }}
        onBuild={handleBuild}
        isBuilding={isBuilding()}
        buildProgress={buildProgress()}
        error={buildError()}
        availableConfigs={availableConfigs()}
      />
    </div>
  );
}
