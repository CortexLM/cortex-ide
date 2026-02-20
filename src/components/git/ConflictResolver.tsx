import { createSignal, createEffect, For, Show, createMemo } from "solid-js";
import { Icon } from "../ui/Icon";

interface ConflictHunk {
  id: string;
  startLine: number;
  endLine: number;
  oursContent: string[];
  theirsContent: string[];
  oursLabel: string;
  theirsLabel: string;
  resolved: boolean;
  resolution?: "ours" | "theirs" | "both" | "custom";
  customContent?: string[];
}

interface ConflictFile {
  path: string;
  hunks: ConflictHunk[];
  oursLabel: string;
  theirsLabel: string;
}

interface ConflictResolverProps {
  file: ConflictFile;
  onResolve?: (file: string, resolution: ResolvedConflict) => void;
  onCancel?: () => void;
}

export interface ResolvedConflict {
  path: string;
  hunks: {
    id: string;
    resolution: "ours" | "theirs" | "both" | "custom";
    content: string[];
  }[];
}

export function ConflictResolver(props: ConflictResolverProps) {
  const [hunks, setHunks] = createSignal<ConflictHunk[]>(props.file.hunks);
  const [selectedHunk, setSelectedHunk] = createSignal<string | null>(
    props.file.hunks.length > 0 ? props.file.hunks[0].id : null
  );
  const [viewMode, setViewMode] = createSignal<"side-by-side" | "inline">("side-by-side");
  const [customEditing, setCustomEditing] = createSignal<string | null>(null);
  const [customContent, setCustomContent] = createSignal("");

  createEffect(() => {
    setHunks(props.file.hunks);
  });

  const allResolved = createMemo(() => {
    return hunks().every(h => h.resolved);
  });

  const resolvedCount = createMemo(() => {
    return hunks().filter(h => h.resolved).length;
  });

  const resolveHunk = (hunkId: string, resolution: "ours" | "theirs" | "both") => {
    setHunks(prev => prev.map(h => {
      if (h.id !== hunkId) return h;

      let content: string[] = [];
      switch (resolution) {
        case "ours":
          content = h.oursContent;
          break;
        case "theirs":
          content = h.theirsContent;
          break;
        case "both":
          content = [...h.oursContent, ...h.theirsContent];
          break;
      }

      return {
        ...h,
        resolved: true,
        resolution,
        customContent: content
      };
    }));

    moveToNextUnresolved(hunkId);
  };

  const resolveWithCustom = (hunkId: string) => {
    setHunks(prev => prev.map(h => {
      if (h.id !== hunkId) return h;
      return {
        ...h,
        resolved: true,
        resolution: "custom",
        customContent: customContent().split("\n")
      };
    }));
    setCustomEditing(null);
    setCustomContent("");
    moveToNextUnresolved(hunkId);
  };

  const unresolveHunk = (hunkId: string) => {
    setHunks(prev => prev.map(h => {
      if (h.id !== hunkId) return h;
      return {
        ...h,
        resolved: false,
        resolution: undefined,
        customContent: undefined
      };
    }));
  };

  const moveToNextUnresolved = (currentId: string) => {
    const currentIndex = hunks().findIndex(h => h.id === currentId);
    const nextUnresolved = hunks().find((h, i) => i > currentIndex && !h.resolved);
    if (nextUnresolved) {
      setSelectedHunk(nextUnresolved.id);
    }
  };

  const startCustomEdit = (hunk: ConflictHunk) => {
    const initialContent = hunk.customContent?.join("\n") || 
      [...hunk.oursContent, "// --- divider ---", ...hunk.theirsContent].join("\n");
    setCustomContent(initialContent);
    setCustomEditing(hunk.id);
  };

  const applyResolution = () => {
    if (!allResolved()) return;

    const resolution: ResolvedConflict = {
      path: props.file.path,
      hunks: hunks().map(h => ({
        id: h.id,
        resolution: h.resolution!,
        content: h.customContent || []
      }))
    };

    props.onResolve?.(props.file.path, resolution);
  };

  const currentHunk = createMemo(() => {
    return hunks().find(h => h.id === selectedHunk());
  });

  const getLineClass = (type: "ours" | "theirs" | "resolved") => {
    switch (type) {
      case "ours":
        return "bg-green-500/10 border-l-2 border-green-500";
      case "theirs":
        return "bg-blue-500/10 border-l-2 border-blue-500";
      case "resolved":
        return "bg-purple-500/10 border-l-2 border-purple-500";
    }
  };

  return (
    <div
      class="h-full flex flex-col overflow-hidden"
      style={{ background: "var(--background-base)" }}
    >
      {/* Header */}
      <div
        class="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <div class="flex items-center gap-3">
          <Icon name="code-merge" class="w-5 h-5 text-orange-400" />
          <div>
            <h2 class="text-sm font-medium" style={{ color: "var(--text-base)" }}>
              Resolve Conflicts
            </h2>
            <p class="text-xs" style={{ color: "var(--text-weak)" }}>
              {props.file.path}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs px-2 py-1 rounded" style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}>
            {resolvedCount()}/{hunks().length} resolved
          </span>
          <div class="flex rounded overflow-hidden" style={{ background: "var(--surface-active)" }}>
            <button
              class="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewMode() === "side-by-side" ? "var(--accent-primary)" : "transparent",
                color: viewMode() === "side-by-side" ? "white" : "var(--text-weak)"
              }}
              onClick={() => setViewMode("side-by-side")}
            >
              Side by Side
            </button>
            <button
              class="px-2 py-1 text-xs transition-colors"
              style={{
                background: viewMode() === "inline" ? "var(--accent-primary)" : "transparent",
                color: viewMode() === "inline" ? "white" : "var(--text-weak)"
              }}
              onClick={() => setViewMode("inline")}
            >
              Inline
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
        {/* Hunks list sidebar */}
        <div
          class="w-64 border-r overflow-y-auto shrink-0"
          style={{ "border-color": "var(--border-weak)" }}
        >
          <div class="p-2">
            <For each={hunks()}>
              {(hunk, index) => (
                <button
                  class={`w-full flex items-center gap-2 px-3 py-2 rounded mb-1 text-left transition-colors ${
                    selectedHunk() === hunk.id ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => setSelectedHunk(hunk.id)}
                >
                  <Show when={hunk.resolved}>
                    <Icon name="check" class="w-4 h-4 text-green-400 shrink-0" />
                  </Show>
                  <Show when={!hunk.resolved}>
                    <Icon name="triangle-exclamation" class="w-4 h-4 text-orange-400 shrink-0" />
                  </Show>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate" style={{ color: "var(--text-base)" }}>
                      Conflict {index() + 1}
                    </div>
                    <div class="text-xs" style={{ color: "var(--text-weak)" }}>
                      Lines {hunk.startLine}-{hunk.endLine}
                    </div>
                  </div>
                  <Show when={hunk.resolved}>
                    <span
                      class="text-xs px-1.5 py-0.5 rounded capitalize"
                      style={{
                        background: hunk.resolution === "ours" ? "rgba(46, 160, 67, 0.2)" :
                                   hunk.resolution === "theirs" ? "rgba(56, 139, 253, 0.2)" :
                                   "rgba(136, 87, 219, 0.2)",
                        color: hunk.resolution === "ours" ? "var(--cortex-success)" :
                               hunk.resolution === "theirs" ? "var(--cortex-info)" :
                               "var(--cortex-info)"
                      }}
                    >
                      {hunk.resolution}
                    </span>
                  </Show>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Main content */}
        <div class="flex-1 flex flex-col overflow-hidden">
          <Show when={currentHunk()}>
            {(hunk) => (
              <>
                {/* Action bar */}
                <div
                  class="flex items-center justify-between px-4 py-2 border-b shrink-0"
                  style={{ "border-color": "var(--border-weak)" }}
                >
                  <div class="flex items-center gap-2">
                    <button
                      class={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                        hunk().resolved && hunk().resolution === "ours" ? "ring-2 ring-green-500" : ""
                      }`}
                      style={{ background: "rgba(46, 160, 67, 0.2)", color: "var(--cortex-success)" }}
                      onClick={() => resolveHunk(hunk().id, "ours")}
                    >
                      <Icon name="arrow-left" class="w-4 h-4" />
                      Accept {hunk().oursLabel}
                    </button>
                    <button
                      class={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                        hunk().resolved && hunk().resolution === "theirs" ? "ring-2 ring-blue-500" : ""
                      }`}
                      style={{ background: "rgba(56, 139, 253, 0.2)", color: "var(--cortex-info)" }}
                      onClick={() => resolveHunk(hunk().id, "theirs")}
                    >
                      Accept {hunk().theirsLabel}
                      <Icon name="arrow-right" class="w-4 h-4" />
                    </button>
                    <button
                      class={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                        hunk().resolved && hunk().resolution === "both" ? "ring-2 ring-purple-500" : ""
                      }`}
                      style={{ background: "rgba(136, 87, 219, 0.2)", color: "var(--cortex-info)" }}
                      onClick={() => resolveHunk(hunk().id, "both")}
                    >
                      <Icon name="code-merge" class="w-4 h-4" />
                      Accept Both
                    </button>
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors border"
                      style={{ "border-color": "var(--border-weak)", color: "var(--text-base)" }}
                      onClick={() => startCustomEdit(hunk())}
                    >
                      Edit Manually
                    </button>
                  </div>
                  <Show when={hunk().resolved}>
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
                      style={{ color: "var(--text-weak)" }}
                      onClick={() => unresolveHunk(hunk().id)}
                    >
                      <Icon name="rotate" class="w-4 h-4" />
                      Reset
                    </button>
                  </Show>
                </div>

                {/* Diff view */}
                <div class="flex-1 overflow-auto font-mono text-sm">
                  <Show when={viewMode() === "side-by-side"}>
                    <div class="flex h-full">
                      {/* Ours side */}
                      <div class="flex-1 border-r" style={{ "border-color": "var(--border-weak)" }}>
                        <div
                          class="sticky top-0 px-4 py-2 font-sans text-xs font-medium border-b"
                          style={{
                            background: "rgba(46, 160, 67, 0.1)",
                            color: "var(--cortex-success)",
                            "border-color": "var(--border-weak)"
                          }}
                        >
                          {hunk().oursLabel} (Current)
                        </div>
                        <div class="p-2">
                          <For each={hunk().oursContent}>
                            {(line, i) => (
                              <div class={`px-3 py-0.5 ${getLineClass("ours")}`}>
                                <span class="inline-block w-8 text-right mr-3 select-none" style={{ color: "var(--text-weaker)" }}>
                                  {hunk().startLine + i()}
                                </span>
                                <span style={{ color: "var(--text-base)" }}>{line}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>

                      {/* Theirs side */}
                      <div class="flex-1">
                        <div
                          class="sticky top-0 px-4 py-2 font-sans text-xs font-medium border-b"
                          style={{
                            background: "rgba(56, 139, 253, 0.1)",
                            color: "var(--cortex-info)",
                            "border-color": "var(--border-weak)"
                          }}
                        >
                          {hunk().theirsLabel} (Incoming)
                        </div>
                        <div class="p-2">
                          <For each={hunk().theirsContent}>
                            {(line, i) => (
                              <div class={`px-3 py-0.5 ${getLineClass("theirs")}`}>
                                <span class="inline-block w-8 text-right mr-3 select-none" style={{ color: "var(--text-weaker)" }}>
                                  {hunk().startLine + i()}
                                </span>
                                <span style={{ color: "var(--text-base)" }}>{line}</span>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </Show>

                  <Show when={viewMode() === "inline"}>
                    <div class="p-2">
                      {/* Ours section */}
                      <div
                        class="px-4 py-2 font-sans text-xs font-medium rounded-t"
                        style={{ background: "rgba(46, 160, 67, 0.1)", color: "var(--cortex-success)" }}
                      >
                        {hunk().oursLabel} (Current)
                      </div>
                      <For each={hunk().oursContent}>
                        {(line, i) => (
                          <div class={`px-3 py-0.5 ${getLineClass("ours")}`}>
                            <span class="inline-block w-8 text-right mr-3 select-none" style={{ color: "var(--text-weaker)" }}>
                              {hunk().startLine + i()}
                            </span>
                            <span class="text-green-400">+ </span>
                            <span style={{ color: "var(--text-base)" }}>{line}</span>
                          </div>
                        )}
                      </For>

                      {/* Divider */}
                      <div
                        class="my-2 px-4 py-1 text-xs font-sans"
                        style={{ background: "var(--surface-active)", color: "var(--text-weak)" }}
                      >
                        ════════════════════════════════════════
                      </div>

                      {/* Theirs section */}
                      <div
                        class="px-4 py-2 font-sans text-xs font-medium rounded-t"
                        style={{ background: "rgba(56, 139, 253, 0.1)", color: "var(--cortex-info)" }}
                      >
                        {hunk().theirsLabel} (Incoming)
                      </div>
                      <For each={hunk().theirsContent}>
                        {(line, i) => (
                          <div class={`px-3 py-0.5 ${getLineClass("theirs")}`}>
                            <span class="inline-block w-8 text-right mr-3 select-none" style={{ color: "var(--text-weaker)" }}>
                              {hunk().startLine + i()}
                            </span>
                            <span class="text-blue-400">+ </span>
                            <span style={{ color: "var(--text-base)" }}>{line}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>

                  {/* Show resolved content */}
                  <Show when={hunk().resolved && hunk().customContent}>
                    <div class="border-t mt-4" style={{ "border-color": "var(--border-weak)" }}>
                      <div
                        class="px-4 py-2 font-sans text-xs font-medium"
                        style={{ background: "rgba(136, 87, 219, 0.1)", color: "var(--cortex-info)" }}
                      >
                        Resolution Preview
                      </div>
                      <div class="p-2">
                        <For each={hunk().customContent}>
                          {(line, i) => (
                            <div class={`px-3 py-0.5 ${getLineClass("resolved")}`}>
                              <span class="inline-block w-8 text-right mr-3 select-none" style={{ color: "var(--text-weaker)" }}>
                                {hunk().startLine + i()}
                              </span>
                              <span style={{ color: "var(--text-base)" }}>{line}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </div>
              </>
            )}
          </Show>

          <Show when={!currentHunk()}>
            <div class="flex-1 flex items-center justify-center">
              <span style={{ color: "var(--text-weak)" }}>Select a conflict to resolve</span>
            </div>
          </Show>
        </div>
      </div>

      {/* Footer */}
      <div
        class="flex items-center justify-between px-4 py-3 border-t shrink-0"
        style={{ "border-color": "var(--border-weak)" }}
      >
        <button
          class="px-4 py-2 rounded text-sm transition-colors"
          style={{ color: "var(--text-weak)" }}
          onClick={() => props.onCancel?.()}
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: "var(--accent-primary)", color: "white" }}
          disabled={!allResolved()}
          onClick={applyResolution}
        >
          {allResolved() ? "Apply Resolution" : `${hunks().length - resolvedCount()} conflicts remaining`}
        </button>
      </div>

      {/* Custom edit modal */}
      <Show when={customEditing()}>
        <div
          class="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setCustomEditing(null)}
        >
          <div
            class="w-[800px] max-h-[80vh] flex flex-col rounded-lg shadow-xl overflow-hidden"
            style={{ background: "var(--surface-raised)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between px-4 py-3 border-b" style={{ "border-color": "var(--border-weak)" }}>
              <h3 class="text-lg font-medium" style={{ color: "var(--text-base)" }}>
                Edit Resolution
              </h3>
              <button
                class="p-1 rounded hover:bg-white/10"
                onClick={() => setCustomEditing(null)}
              >
                <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-weak)" }} />
              </button>
            </div>
            <div class="flex-1 overflow-hidden p-4">
              <textarea
                class="w-full h-full min-h-[300px] px-4 py-3 rounded font-mono text-sm resize-none outline-none"
                style={{
                  background: "var(--background-stronger)",
                  color: "var(--text-base)",
                  border: "1px solid var(--border-weak)"
                }}
                value={customContent()}
                onInput={(e) => setCustomContent(e.currentTarget.value)}
              />
            </div>
            <div class="flex justify-end gap-2 px-4 py-3 border-t" style={{ "border-color": "var(--border-weak)" }}>
              <button
                class="px-4 py-2 rounded text-sm transition-colors"
                style={{ color: "var(--text-weak)" }}
                onClick={() => setCustomEditing(null)}
              >
                Cancel
              </button>
              <button
                class="px-4 py-2 rounded text-sm transition-colors"
                style={{ background: "var(--accent-primary)", color: "white" }}
                onClick={() => resolveWithCustom(customEditing()!)}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default ConflictResolver;

