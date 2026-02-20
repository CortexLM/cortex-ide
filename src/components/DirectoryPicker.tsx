import { createSignal, createEffect, Show, For } from "solid-js";
import { useSDK } from "@/context/SDKContext";
import { Icon } from "./ui/Icon";

interface FileEntry {
  name: string;
  path: string;
  type: string;
  size: number;
  modified: string | null;
}

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
  onClose?: () => void;
  initialPath?: string;
}

export function DirectoryPicker(props: DirectoryPickerProps) {
  const { state } = useSDK();
  const [currentPath, setCurrentPath] = createSignal(props.initialPath || "/");
  const [entries, setEntries] = createSignal<FileEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newFolderName, setNewFolderName] = createSignal("");
  const [showNewFolder, setShowNewFolder] = createSignal(false);

  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${state.serverUrl}/api/v1/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to list directory: ${res.status}`);
      }
      
      const data = await res.json() as { path: string; entries: FileEntry[] };
      const dirs = data.entries.filter(e => e.type === "directory");
      setEntries(dirs);
      setCurrentPath(data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load directory");
    } finally {
      setLoading(false);
    }
  };

  const createFolder = async () => {
    const name = newFolderName().trim();
    if (!name) return;
    
    const newPath = currentPath().endsWith("/") 
      ? `${currentPath()}${name}` 
      : `${currentPath()}/${name}`;
    
    try {
      const res = await fetch(`${state.serverUrl}/api/v1/files/mkdir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath }),
      });
      
      if (!res.ok) {
        throw new Error(`Failed to create folder: ${res.status}`);
      }
      
      setNewFolderName("");
      setShowNewFolder(false);
      await fetchDirectory(currentPath());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create folder");
    }
  };

  const navigateUp = () => {
    const parts = currentPath().split("/").filter(Boolean);
    if (parts.length > 0) {
      parts.pop();
      const newPath = "/" + parts.join("/");
      fetchDirectory(newPath || "/");
    }
  };

  const navigateTo = (path: string) => {
    fetchDirectory(path);
  };

  const goHome = () => {
    fetchDirectory("/root");
  };

  const selectCurrent = () => {
    props.onSelect(currentPath());
  };

  createEffect(() => {
    fetchDirectory(currentPath());
  });

  const pathParts = () => {
    const parts = currentPath().split("/").filter(Boolean);
    return parts.map((part, i) => ({
      name: part,
      path: "/" + parts.slice(0, i + 1).join("/"),
    }));
  };

  return (
    <div 
      class="rounded-lg border overflow-hidden"
      style={{ 
        background: "var(--surface-base)",
        "border-color": "var(--border-base)"
      }}
    >
      {/* Header with breadcrumb */}
      <div 
        class="px-3 py-2 border-b flex items-center gap-2"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <button
          onClick={goHome}
          class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
          style={{ color: "var(--text-weak)" }}
          title="Go to home"
        >
          <Icon name="house" size={14} />
        </button>
        
        <button
          onClick={navigateUp}
          class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
          style={{ color: "var(--text-weak)" }}
          title="Go up"
        >
          <Icon name="chevron-up" size={14} />
        </button>
        
        <div class="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => navigateTo("/")}
            class="text-xs shrink-0 hover:underline"
            style={{ color: "var(--text-weak)" }}
          >
            /
          </button>
          <For each={pathParts()}>
            {(part) => (
              <>
                <Icon name="chevron-right" size={12} class="shrink-0" style={{ color: "var(--text-weaker)" }} />
                <button
                  onClick={() => navigateTo(part.path)}
                  class="text-xs shrink-0 hover:underline truncate max-w-[100px]"
                  style={{ color: "var(--text-weak)" }}
                  title={part.name}
                >
                  {part.name}
                </button>
              </>
            )}
          </For>
        </div>

        <button
          onClick={() => setShowNewFolder(!showNewFolder())}
          class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
          style={{ color: "var(--text-weak)" }}
          title="New folder"
        >
          <Icon name="folder-plus" size={14} />
        </button>
      </div>

      {/* New folder input */}
      <Show when={showNewFolder()}>
        <div 
          class="px-3 py-2 border-b flex items-center gap-2"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <Icon name="folder" class="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-weak)" }} />
          <input
            type="text"
            value={newFolderName()}
            onInput={(e) => setNewFolderName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
              if (e.key === "Escape") {
                setShowNewFolder(false);
                setNewFolderName("");
              }
            }}
            placeholder="New folder name..."
            class="flex-1 text-xs bg-transparent outline-none"
            style={{ color: "var(--text-base)" }}
            autofocus
          />
          <button
            onClick={createFolder}
            disabled={!newFolderName().trim()}
            class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
            style={{ color: newFolderName().trim() ? "var(--text-base)" : "var(--text-weaker)" }}
          >
            <Icon name="check" size={14} />
          </button>
          <button
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName("");
            }}
            class="p-1 rounded hover:bg-[var(--surface-raised)] transition-colors"
            style={{ color: "var(--text-weak)" }}
          >
            <Icon name="xmark" size={14} />
          </button>
        </div>
      </Show>

      {/* Error message */}
      <Show when={error()}>
        <div 
          class="px-3 py-2 text-xs"
          style={{ color: "var(--text-weak)", background: "var(--surface-raised)" }}
        >
          {error()}
        </div>
      </Show>

      {/* Directory listing */}
      <div 
        class="max-h-48 overflow-y-auto"
        style={{ background: "var(--background-base)" }}
      >
        <Show when={loading()}>
          <div class="px-3 py-4 text-xs text-center" style={{ color: "var(--text-weaker)" }}>
            Loading...
          </div>
        </Show>
        
        <Show when={!loading() && entries().length === 0}>
          <div class="px-3 py-4 text-xs text-center" style={{ color: "var(--text-weaker)" }}>
            No subdirectories
          </div>
        </Show>
        
        <Show when={!loading() && entries().length > 0}>
          <For each={entries()}>
            {(entry) => (
              <button
                onClick={() => navigateTo(entry.path)}
                class="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--surface-raised)] transition-colors text-left"
              >
<Icon name="folder" size={14} class="shrink-0" style={{ color: "var(--text-weak)" }} />
                <span class="text-xs truncate" style={{ color: "var(--text-base)" }}>
                  {entry.name}
                </span>
              </button>
            )}
          </For>
        </Show>
      </div>

      {/* Footer with current selection */}
      <div 
        class="px-3 py-2 border-t flex items-center justify-between gap-2"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex-1 min-w-0">
          <div class="text-xs truncate" style={{ color: "var(--text-weaker)" }}>
            Selected:
          </div>
          <div 
            class="text-xs font-mono truncate"
            style={{ color: "var(--text-base)" }}
            title={currentPath()}
          >
            {currentPath()}
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              class="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
            >
              cancel
            </button>
          </Show>
          <button
            onClick={selectCurrent}
            class="px-2 py-1 text-xs rounded transition-colors"
            style={{ 
              background: "var(--surface-raised)",
              color: "var(--text-base)"
            }}
          >
            select
          </button>
        </div>
      </div>
    </div>
  );
}
