import { createSignal, Show, For, createEffect } from "solid-js";
import { Icon } from "../ui/Icon";
import { RemoteFileNode, useRemote } from "@/context/RemoteContext";
import { SSHConnectionDialog } from "./SSHConnectionDialog";
import { RemoteHostsList } from "./RemoteHostsList";
import type { ConnectionProfile } from "@/context/RemoteContext";

interface RemoteExplorerProps {
  onFileSelect?: (connectionId: string, path: string) => void;
  onRunCommand?: (connectionId: string) => void;
}

// File type icons based on extension
const getFileIcon = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase();
  const iconMap: Record<string, string> = {
    ts: "text-blue-400",
    tsx: "text-blue-400",
    js: "text-yellow-400",
    jsx: "text-yellow-400",
    json: "text-yellow-300",
    md: "text-gray-400",
    css: "text-pink-400",
    scss: "text-pink-400",
    html: "text-orange-400",
    py: "text-green-400",
    rs: "text-orange-500",
    go: "text-cyan-400",
    yaml: "text-red-400",
    yml: "text-red-400",
    toml: "text-gray-400",
    lock: "text-gray-500",
    sh: "text-green-500",
    bash: "text-green-500",
  };
  return iconMap[ext || ""] || "text-gray-400";
};

function RemoteFileTreeNode(props: {
  node: RemoteFileNode;
  depth: number;
  connectionId: string;
  onFileSelect?: (path: string) => void;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
}) {
  const isExpanded = () => props.expandedPaths.has(props.node.path);

  const handleClick = () => {
    if (props.node.isDir) {
      props.toggleExpand(props.node.path);
    } else {
      props.onFileSelect?.(props.node.path);
    }
  };

  // Filter out hidden files and common ignored directories
  const visibleChildren = () => {
    if (!props.node.children) return [];
    return props.node.children
      .filter(
        (child) =>
          !child.name.startsWith(".") &&
          !["node_modules", "target", "dist", "build", "__pycache__", ".git", "venv", ".venv"].includes(
            child.name
          )
      )
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });
  };

  return (
    <div>
      <button
        onClick={handleClick}
        class="w-full flex items-center gap-1 py-0.5 px-1 rounded text-left transition-colors hover:bg-[var(--surface-raised)]"
        style={{
          "padding-left": `${props.depth * 12 + 4}px`,
          color: "var(--text-base)",
        }}
      >
        {/* Expand/collapse icon for directories */}
        <Show when={props.node.isDir}>
          <span class="w-4 h-4 flex items-center justify-center" style={{ color: "var(--text-weak)" }}>
            {isExpanded() ? <Icon name="chevron-down" class="w-3 h-3" /> : <Icon name="chevron-right" class="w-3 h-3" />}
          </span>
        </Show>
        <Show when={!props.node.isDir}>
          <span class="w-4 h-4" />
        </Show>

        {/* File/folder icon */}
        <span class="w-4 h-4 flex items-center justify-center">
          <Show
            when={props.node.isDir}
            fallback={<Icon name="file" class={`w-3.5 h-3.5 ${getFileIcon(props.node.name)}`} />}
          >
            <Icon
              name="folder"
              class="w-3.5 h-3.5"
              style={{ color: isExpanded() ? "var(--cortex-warning)" : "var(--cortex-warning)" }}
            />
          </Show>
        </span>

        {/* Name */}
        <span class="text-xs truncate flex-1">{props.node.name}</span>
      </button>

      {/* Children */}
      <Show when={props.node.isDir && isExpanded() && props.node.children}>
        <For each={visibleChildren()}>
          {(child) => (
            <RemoteFileTreeNode
              node={child}
              depth={props.depth + 1}
              connectionId={props.connectionId}
              onFileSelect={props.onFileSelect}
              expandedPaths={props.expandedPaths}
              toggleExpand={props.toggleExpand}
            />
          )}
        </For>
      </Show>
    </div>
  );
}

export function RemoteExplorer(props: RemoteExplorerProps) {
  const remote = useRemote();
  
  const [showConnectionDialog, setShowConnectionDialog] = createSignal(false);
  const [editingProfile, setEditingProfile] = createSignal<ConnectionProfile | undefined>();
  const [currentPath, setCurrentPath] = createSignal("~");
  const [tree, setTree] = createSignal<RemoteFileNode | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedPaths, setExpandedPaths] = createSignal<Set<string>>(new Set());
  const [showHostsList, setShowHostsList] = createSignal(true);

  const activeConnection = () => remote.getActiveConnection();

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const loadTree = async () => {
    const conn = activeConnection();
    if (!conn || conn.status !== "connected") return;

    setLoading(true);
    setError(null);

    try {
      const data = await remote.getFileTree(conn.id, currentPath(), 3);
      setTree(data);

      // Auto-expand root
      if (data?.path) {
        setExpandedPaths(new Set([data.path]));
      }
    } catch (e) {
      console.error("Failed to load remote file tree:", e);
      setError(e instanceof Error ? e.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  // Reload when connection or path changes
  createEffect(() => {
    const conn = activeConnection();
    if (conn && conn.status === "connected") {
      setShowHostsList(false);
      loadTree();
    } else {
      setTree(null);
      setShowHostsList(true);
    }
  });

  const handleFileSelect = (path: string) => {
    const conn = activeConnection();
    if (conn) {
      props.onFileSelect?.(conn.id, path);
    }
  };

  const navigateUp = () => {
    const path = currentPath();
    if (path === "~" || path === "/" || path === activeConnection()?.home_directory) {
      return;
    }
    const parentPath = path.substring(0, path.lastIndexOf("/")) || "/";
    setCurrentPath(parentPath);
  };

  const navigateHome = () => {
    setCurrentPath("~");
  };

  const handleNewConnection = () => {
    setEditingProfile(undefined);
    setShowConnectionDialog(true);
  };

  const handleEditProfile = (profile: ConnectionProfile) => {
    setEditingProfile(profile);
    setShowConnectionDialog(true);
  };

  const handleSelectConnection = (connectionId: string) => {
    remote.setActiveConnection(connectionId);
    setCurrentPath("~");
  };

  const handleRunCommand = () => {
    const conn = activeConnection();
    if (conn) {
      props.onRunCommand?.(conn.id);
    }
  };

  return (
    <div class="flex flex-col h-full">
      {/* Connection dialog */}
      <SSHConnectionDialog
        isOpen={showConnectionDialog()}
        onClose={() => {
          setShowConnectionDialog(false);
          setEditingProfile(undefined);
        }}
        editProfile={editingProfile()}
        onConnect={(profile) => {
          handleSelectConnection(profile.id);
        }}
      />

      {/* Show hosts list or file browser */}
      <Show
        when={!showHostsList() && activeConnection()}
        fallback={
          <RemoteHostsList
            onNewConnection={handleNewConnection}
            onEditProfile={handleEditProfile}
            onSelectConnection={handleSelectConnection}
          />
        }
      >
        {/* Connected state - show file browser */}
        <div class="flex flex-col h-full">
          {/* Header with connection info */}
          <div
            class="flex items-center justify-between px-2 py-1.5 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <button
              onClick={() => setShowHostsList(true)}
              class="flex items-center gap-1 text-xs font-medium hover:underline"
              style={{ color: "var(--accent)" }}
              title="Back to hosts list"
            >
              <Icon name="chevron-up" class="w-3 h-3" />
              {activeConnection()?.profile.name}
            </button>
            <div class="flex items-center gap-1">
              <button
                onClick={handleRunCommand}
                class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Run command"
              >
                <Icon name="terminal" class="w-3.5 h-3.5" />
              </button>
              <button
                onClick={loadTree}
                class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
                style={{ color: "var(--text-weak)" }}
                title="Refresh"
              >
                <Icon name="rotate" class={`w-3 h-3 ${loading() ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Breadcrumb / path bar */}
          <div
            class="flex items-center gap-1 px-2 py-1 border-b"
            style={{ "border-color": "var(--border-weak)" }}
          >
            <button
              onClick={navigateHome}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Home"
            >
              <Icon name="house" class="w-3.5 h-3.5" />
            </button>
            <button
              onClick={navigateUp}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Go up"
            >
              <Icon name="chevron-up" class="w-3.5 h-3.5" />
            </button>
            <span class="text-xs truncate flex-1" style={{ color: "var(--text-weak)" }}>
              {currentPath()}
            </span>
          </div>

          {/* File tree */}
          <div class="flex-1 overflow-y-auto overflow-x-hidden py-1">
            <Show when={loading()}>
              <div class="px-3 py-4 text-center">
                <p class="text-xs" style={{ color: "var(--text-weak)" }}>
                  Loading...
                </p>
              </div>
            </Show>

            <Show when={error()}>
              <div class="px-3 py-4 text-center">
                <p class="text-xs" style={{ color: "var(--error)" }}>
                  {error()}
                </p>
                <button
                  onClick={loadTree}
                  class="mt-2 text-xs font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Retry
                </button>
              </div>
            </Show>

            <Show when={tree() && !loading()}>
              <RemoteFileTreeNode
                node={tree()!}
                depth={0}
                connectionId={activeConnection()!.id}
                onFileSelect={handleFileSelect}
                expandedPaths={expandedPaths()}
                toggleExpand={toggleExpand}
              />
            </Show>
          </div>

          {/* Platform info */}
          <div
            class="px-2 py-1 text-xs border-t"
            style={{
              "border-color": "var(--border-weak)",
              color: "var(--text-weaker)",
            }}
          >
            {activeConnection()?.platform || "Unknown"} •{" "}
            {activeConnection()?.profile.username}@{activeConnection()?.profile.host}
          </div>
        </div>
      </Show>
    </div>
  );
}

