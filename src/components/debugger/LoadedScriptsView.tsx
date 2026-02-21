import { Show, For, createSignal, createEffect, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useDebug, Source } from "@/context/DebugContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";

// ============== Types ==============

export type ScriptSourceType = "user" | "library" | "framework" | "unknown";
export type ScriptOrigin = "local" | "remote";
export type ScriptLoadStatus = "loaded" | "pending" | "failed";

export interface LoadedScript {
  id: string;
  name: string;
  path?: string;
  sourceReference?: number;
  origin: ScriptOrigin;
  sourceType: ScriptSourceType;
  loadStatus: ScriptLoadStatus;
  presentationHint?: string;
}

interface ScriptGroup {
  type: ScriptSourceType;
  label: string;
  iconName: string;
  scripts: LoadedScript[];
  expanded: boolean;
}

interface LoadedScriptsState {
  scripts: LoadedScript[];
  groups: ScriptGroup[];
  isLoading: boolean;
  searchQuery: string;
  lastRefreshed: number | null;
}

// ============== Utilities ==============

function classifySourceType(script: LoadedScript): ScriptSourceType {
  const path = script.path?.toLowerCase() || "";
  const name = script.name.toLowerCase();

  // Framework detection patterns
  const frameworkPatterns = [
    /node_modules\/(react|vue|angular|svelte|solid-js|preact)/,
    /node_modules\/@(angular|vue|solidjs)/,
    /(react|vue|angular|svelte|solid)[\.-]/,
    /framework/i,
  ];

  // Library detection patterns
  const libraryPatterns = [
    /node_modules/,
    /vendor/,
    /packages/,
    /\.cargo/,
    /site-packages/,
    /lib\/python/,
    /gems\//,
    /\.m2\/repository/,
    /\.gradle\/caches/,
  ];

  // Check for framework
  for (const pattern of frameworkPatterns) {
    if (pattern.test(path) || pattern.test(name)) {
      return "framework";
    }
  }

  // Check for library
  for (const pattern of libraryPatterns) {
    if (pattern.test(path)) {
      return "library";
    }
  }

  // Check presentation hint
  if (script.presentationHint === "deemphasize") {
    return "library";
  }

  // Default to user code
  if (path || name) {
    return "user";
  }

  return "unknown";
}

function determineOrigin(script: LoadedScript): ScriptOrigin {
  const path = script.path?.toLowerCase() || "";

  // Remote patterns
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("webpack://") ||
    path.startsWith("vite://") ||
    path.startsWith("file://") === false && script.sourceReference && script.sourceReference > 0
  ) {
    return "remote";
  }

  return "local";
}

function getFileName(path?: string): string {
  if (!path) return "<unknown>";
  return path.split(/[/\\]/).pop() || path;
}

function createScriptGroups(scripts: LoadedScript[]): ScriptGroup[] {
  const groupMap: Record<ScriptSourceType, LoadedScript[]> = {
    user: [],
    library: [],
    framework: [],
    unknown: [],
  };

  for (const script of scripts) {
    groupMap[script.sourceType].push(script);
  }

  const groups: ScriptGroup[] = [
    {
      type: "user",
      label: "User Code",
      iconName: "code",
      scripts: groupMap.user.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      expanded: true,
    },
    {
      type: "framework",
      label: "Framework",
      iconName: "box",
      scripts: groupMap.framework.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      expanded: false,
    },
    {
      type: "library",
      label: "Libraries",
      iconName: "folder",
      scripts: groupMap.library.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      expanded: false,
    },
    {
      type: "unknown",
      label: "Other",
      iconName: "file",
      scripts: groupMap.unknown.sort((a, b) => (a.name || "").localeCompare(b.name || "")),
      expanded: false,
    },
  ];

  return groups.filter((g) => g.scripts.length > 0);
}

// ============== Components ==============

interface ScriptItemProps {
  script: LoadedScript;
  onOpen: (script: LoadedScript) => void;
}

function ScriptItem(props: ScriptItemProps) {
  const getStatusIcon = () => {
    switch (props.script.loadStatus) {
      case "loaded":
        return <Icon name="check" size="xs" style={{ color: "var(--cortex-success)" }} />;
      case "pending":
        return <Icon name="clock" size="xs" style={{ color: "var(--cortex-warning)" }} />;
      case "failed":
        return <Icon name="circle-exclamation" size="xs" style={{ color: "var(--cortex-error)" }} />;
    }
  };

  const getOriginIcon = () => {
    return props.script.origin === "remote" ? (
      <span title="Remote">
        <Icon name="globe" size="xs" style={{ color: "var(--cortex-info)" }} />
      </span>
    ) : (
      <span title="Local">
        <Icon name="hard-drive" size="xs" style={{ color: "var(--text-weak)" }} />
      </span>
    );
  };

  return (
    <div
      class="group flex items-center gap-2 px-2 py-1 ml-4 text-xs cursor-pointer transition-colors hover:bg-[var(--surface-raised)] rounded"
      onClick={() => props.onOpen(props.script)}
      title={props.script.path || props.script.name}
    >
      {/* Status indicator */}
      <div class="w-4 h-4 flex items-center justify-center shrink-0">
        {getStatusIcon()}
      </div>

      {/* File icon */}
      <Icon name="file" size="xs" class="shrink-0" style={{ color: "var(--text-weak)" }} />

      {/* Script name */}
      <span class="flex-1 truncate" style={{ color: "var(--text-base)" }}>
        {props.script.name}
      </span>

      {/* Origin indicator */}
      <div class="shrink-0 opacity-60 group-hover:opacity-100">
        {getOriginIcon()}
      </div>
    </div>
  );
}

interface ScriptGroupHeaderProps {
  group: ScriptGroup;
  expanded: boolean;
  onToggle: () => void;
  filteredCount: number;
}

function ScriptGroupHeader(props: ScriptGroupHeaderProps) {
  return (
    <div
      class="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors hover:bg-[var(--surface-raised)] rounded"
      onClick={props.onToggle}
    >
      {/* Expand/collapse icon */}
      <div class="w-4 h-4 flex items-center justify-center" style={{ color: "var(--text-weak)" }}>
        {props.expanded ? (
          <Icon name="chevron-down" size="xs" />
        ) : (
          <Icon name="chevron-right" size="xs" />
        )}
      </div>

      {/* Group icon */}
      <Icon name={props.group.iconName} size="sm" style={{ color: getGroupColor(props.group.type) }} />

      {/* Group label */}
      <span class="font-medium" style={{ color: "var(--text-base)" }}>
        {props.group.label}
      </span>

      {/* Count badge */}
      <span
        class="ml-auto px-1.5 py-0.5 rounded text-xs"
        style={{
          background: "var(--surface-sunken)",
          color: "var(--text-weak)",
        }}
      >
        {props.filteredCount}
      </span>
    </div>
  );
}

function getGroupColor(type: ScriptSourceType): string {
  switch (type) {
    case "user":
      return "var(--cortex-success)";
    case "framework":
      return "var(--cortex-info)";
    case "library":
      return "var(--cortex-info)";
    case "unknown":
      return "var(--text-weak)";
  }
}

// ============== Main Component ==============

export function LoadedScriptsView() {
  const debug = useDebug();
  const editor = useEditor();

  const [state, setState] = createStore<LoadedScriptsState>({
    scripts: [],
    groups: [],
    isLoading: false,
    searchQuery: "",
    lastRefreshed: null,
  });

  const [expandedGroups, setExpandedGroups] = createSignal<Set<ScriptSourceType>>(
    new Set(["user"])
  );

  let unlistenLoadedSource: UnlistenFn | null = null;

  // Fetch loaded scripts from debug adapter
  const fetchLoadedScripts = async (): Promise<void> => {
    if (!debug.state.activeSessionId) {
      setState("scripts", []);
      setState("groups", []);
      return;
    }

    setState("isLoading", true);

    try {
      const sources = await invoke<Source[]>("debug_get_loaded_sources", {
        sessionId: debug.state.activeSessionId,
      });

      const scripts: LoadedScript[] = sources.map((source, index) => {
        const script: LoadedScript = {
          id: source.sourceReference?.toString() || `script-${index}`,
          name: source.name || getFileName(source.path),
          path: source.path,
          sourceReference: source.sourceReference,
          origin: "local",
          sourceType: "unknown",
          loadStatus: "loaded",
        };

        script.sourceType = classifySourceType(script);
        script.origin = determineOrigin(script);

        return script;
      });

      setState("scripts", scripts);
      setState("groups", createScriptGroups(scripts));
      setState("lastRefreshed", Date.now());
    } catch (error) {
      console.error("Failed to fetch loaded scripts:", error);
      setState("scripts", []);
      setState("groups", []);
    } finally {
      setState("isLoading", false);
    }
  };

  // Handle new script loaded event
  const handleScriptLoaded = (source: Source): void => {
    const existingIndex = state.scripts.findIndex(
      (s) =>
        (source.sourceReference && s.sourceReference === source.sourceReference) ||
        (source.path && s.path === source.path)
    );

    if (existingIndex >= 0) {
      // Update existing script
      setState(
        produce((s) => {
          s.scripts[existingIndex].loadStatus = "loaded";
        })
      );
    } else {
      // Add new script
      const script: LoadedScript = {
        id: source.sourceReference?.toString() || `script-${Date.now()}`,
        name: source.name || getFileName(source.path),
        path: source.path,
        sourceReference: source.sourceReference,
        origin: "local",
        sourceType: "unknown",
        loadStatus: "loaded",
      };

      script.sourceType = classifySourceType(script);
      script.origin = determineOrigin(script);

      setState(
        produce((s) => {
          s.scripts.push(script);
          s.groups = createScriptGroups(s.scripts);
        })
      );
    }
  };

  // Open script in editor
  const handleOpenScript = async (script: LoadedScript): Promise<void> => {
    if (script.path) {
      await editor.openFile(script.path);
    } else if (script.sourceReference && debug.state.activeSessionId) {
      // For scripts without a path, try to get source content via DAP
      try {
        const content = await invoke<string>("debug_get_source", {
          sessionId: debug.state.activeSessionId,
          sourceReference: script.sourceReference,
        });

        // Open as virtual file in editor
        await editor.openVirtualFile?.(script.name, content, "javascript");
      } catch (error) {
        console.error("Failed to load script source:", error);
      }
    }
  };

  // Toggle group expansion
  const toggleGroup = (type: ScriptSourceType): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Expand all groups
  const expandAll = (): void => {
    const allTypes: ScriptSourceType[] = ["user", "library", "framework", "unknown"];
    setExpandedGroups(new Set<ScriptSourceType>(allTypes));
  };

  // Collapse all groups
  const collapseAll = (): void => {
    setExpandedGroups(new Set<ScriptSourceType>());
  };

  // Filter scripts based on search query
  const filteredGroups = (): ScriptGroup[] => {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) {
      return state.groups;
    }

    return state.groups
      .map((group) => ({
        ...group,
        scripts: group.scripts.filter(
          (script) =>
            script.name.toLowerCase().includes(query) ||
            (script.path?.toLowerCase().includes(query) ?? false)
        ),
      }))
      .filter((group) => group.scripts.length > 0);
  };

  // Get total script count
  const totalScripts = (): number => {
    return state.scripts.length;
  };

  // Get filtered script count
  const filteredScriptCount = (): number => {
    return filteredGroups().reduce((sum, g) => sum + g.scripts.length, 0);
  };

  // Refresh when debugging state changes
  createEffect(() => {
    if (debug.state.isDebugging && debug.state.activeSessionId) {
      fetchLoadedScripts();
    } else {
      setState("scripts", []);
      setState("groups", []);
    }
  });

  // Listen for loadedSource events from debug adapter
  createEffect(() => {
    if (!debug.state.isDebugging) {
      return;
    }

    const setupListener = async () => {
      unlistenLoadedSource = await listen<{ source: Source }>(
        "debug:loaded-source",
        (event) => {
          handleScriptLoaded(event.payload.source);
        }
      );
    };

    setupListener();
  });

  onCleanup(() => {
    unlistenLoadedSource?.();
  });

  return (
    <div class="flex flex-col h-full">
      {/* Header with search and actions */}
      <div class="p-2 border-b" style={{ "border-color": "var(--border-weak)" }}>
        {/* Search input */}
        <div class="relative mb-2">
<Icon
            name="magnifying-glass"
            size="sm"
            class="absolute left-2 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-weak)" }}
          />
          <input
            type="text"
            value={state.searchQuery}
            onInput={(e) => setState("searchQuery", e.currentTarget.value)}
            placeholder="Filter scripts..."
            class="w-full pl-7 pr-2 py-1.5 text-xs rounded outline-none"
            style={{
              background: "var(--surface-sunken)",
              color: "var(--text-base)",
              border: "1px solid var(--border-weak)",
            }}
          />
        </div>

        {/* Action buttons */}
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1">
            <button
              onClick={expandAll}
              class="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Expand all"
            >
              Expand
            </button>
            <button
              onClick={collapseAll}
              class="px-2 py-1 text-xs rounded transition-colors hover:bg-[var(--surface-raised)]"
              style={{ color: "var(--text-weak)" }}
              title="Collapse all"
            >
              Collapse
            </button>
          </div>

          <div class="flex items-center gap-2">
            {/* Script count */}
            <span class="text-xs" style={{ color: "var(--text-weak)" }}>
              <Show when={state.searchQuery} fallback={`${totalScripts()} scripts`}>
                {filteredScriptCount()}/{totalScripts()}
              </Show>
            </span>

            {/* Refresh button */}
            <button
              onClick={fetchLoadedScripts}
              disabled={state.isLoading || !debug.state.isDebugging}
              class="p-1 rounded transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
              style={{ color: "var(--text-weak)" }}
              title="Refresh loaded scripts"
            >
<Icon name="rotate" size="sm" class={state.isLoading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Scripts tree */}
      <div class="flex-1 overflow-y-auto py-1">
        <Show
          when={debug.state.isDebugging}
          fallback={
            <div
              class="text-xs text-center py-8 px-4"
              style={{ color: "var(--text-weak)" }}
            >
              Start debugging to see loaded scripts
            </div>
          }
        >
          <Show
            when={!state.isLoading}
            fallback={
              <div
                class="text-xs text-center py-8"
                style={{ color: "var(--text-weak)" }}
              >
                <Icon name="rotate" size="md" class="mx-auto mb-2 animate-spin" />
                Loading scripts...
              </div>
            }
          >
            <Show
              when={filteredGroups().length > 0}
              fallback={
                <div
                  class="text-xs text-center py-8 px-4"
                  style={{ color: "var(--text-weak)" }}
                >
                  <Show
                    when={state.searchQuery}
                    fallback="No scripts loaded yet"
                  >
                    No scripts match "{state.searchQuery}"
                  </Show>
                </div>
              }
            >
              <For each={filteredGroups()}>
                {(group) => {
                  const isExpanded = () => expandedGroups().has(group.type);
                  const filteredScripts = () => {
                    const query = state.searchQuery.toLowerCase().trim();
                    if (!query) return group.scripts;
                    return group.scripts.filter(
                      (s) =>
                        s.name.toLowerCase().includes(query) ||
                        (s.path?.toLowerCase().includes(query) ?? false)
                    );
                  };

                  return (
                    <div class="mb-1">
                      <ScriptGroupHeader
                        group={group}
                        expanded={isExpanded()}
                        onToggle={() => toggleGroup(group.type)}
                        filteredCount={filteredScripts().length}
                      />

                      <Show when={isExpanded()}>
                        <div class="mb-2">
                          <For each={filteredScripts()}>
                            {(script) => (
                              <ScriptItem
                                script={script}
                                onOpen={handleOpenScript}
                              />
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>
        </Show>
      </div>

      {/* Footer with last refresh time */}
      <Show when={state.lastRefreshed}>
        <div
          class="px-2 py-1 text-xs border-t"
          style={{
            color: "var(--text-weak)",
            "border-color": "var(--border-weak)",
          }}
        >
          Last updated: {new Date(state.lastRefreshed!).toLocaleTimeString()}
        </div>
      </Show>
    </div>
  );
}

