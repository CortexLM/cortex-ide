import { Show, For, createSignal, onMount, onCleanup } from "solid-js";
import { useDebug, StackFrame, Thread } from "@/context/DebugContext";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";
import { IconButton, Text } from "@/components/ui";

/**
 * Call Stack View - VS Code Specification Compliant
 * 
 * Specs:
 * - Thread/Session row: display flex, padding-right 12px, align-items center
 * - Stack frame: overflow hidden, text-overflow ellipsis
 * - State label: font-size 0.8em, text-transform uppercase, margin 0 10px
 * - State message badge: border-radius 3px, padding 1px 2px, font-size 9px
 * - Session icon: line-height 22px, margin-right 2px
 * - File name: margin-right 0.8em
 * - File path (non-first): margin-left 0.8em
 */

/**
 * Formats stack frames into a human-readable stack trace string.
 * Each line shows: function_name (file_path:line:column)
 */
export function formatStackTrace(frames: StackFrame[]): string {
  return frames.map(f => {
    const location = f.source?.path 
      ? `${f.source.path}:${f.line}${f.column > 0 ? `:${f.column}` : ''}`
      : 'unknown';
    return `${f.name} (${location})`;
  }).join('\n');
}

/**
 * Copies the given text to the system clipboard.
 * Returns true on success, false on failure.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("Failed to copy to clipboard:", e);
    return false;
  }
}

export function CallStackView() {
  const debug = useDebug();
  const editor = useEditor();
  
  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<{
    x: number;
    y: number;
    frameId?: number;
  } | null>(null);
  
  // Copy success feedback
  const [copySuccess, setCopySuccess] = createSignal(false);
  
  // Close context menu on outside click
  onMount(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener("click", handleClickOutside);
    onCleanup(() => document.removeEventListener("click", handleClickOutside));
  });
  
  // Handle keyboard shortcut (Ctrl+C when focused)
  const handleKeyDown = async (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "c") {
      const frames = debug.state.stackFrames;
      if (frames.length > 0) {
        e.preventDefault();
        await handleCopyStackTrace();
      }
    }
  };
  
  // Copy entire call stack
  const handleCopyStackTrace = async () => {
    const frames = debug.state.stackFrames;
    if (frames.length === 0) return;
    
    const stackTrace = formatStackTrace(frames);
    const success = await copyToClipboard(stackTrace);
    
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
    
    setContextMenu(null);
  };
  
  // Copy single frame
  const handleCopyFrame = async (frame: StackFrame) => {
    const frameText = formatStackTrace([frame]);
    await copyToClipboard(frameText);
    setContextMenu(null);
  };

  // Restart frame - restart execution from a specific stack frame
  const handleRestartFrame = async (frameId: number) => {
    try {
      await debug.restartFrame(frameId);
    } catch (e) {
      console.error("Failed to restart frame:", e);
    }
    setContextMenu(null);
  };
  
  // Handle context menu on stack frame
  const handleContextMenu = (e: MouseEvent, frameId?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      frameId,
    });
  };

  const handleSelectFrame = async (frame: StackFrame) => {
    await debug.selectFrame(frame.id);

    // Open the file and navigate to the specific line
    if (frame.source?.path) {
      await editor.openFile(frame.source.path);
      // Dispatch goto-line event to navigate to the frame's line and column
      window.dispatchEvent(
        new CustomEvent("editor:goto-line", {
          detail: {
            line: frame.line,
            column: frame.column > 0 ? frame.column : 1,
          },
        })
      );
    }
  };

  const handleSelectThread = async (thread: Thread) => {
    await debug.selectThread(thread.id);
  };

  const getFileName = (path?: string) => {
    if (!path) return "<unknown>";
    return path.split(/[/\\]/).pop() || path;
  };

  // Detect platform for font size
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const fontSize = isMac ? "11px" : "13px";

  return (
    <div 
      class="debug-call-stack py-1" 
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar */}
      <Show when={debug.state.stackFrames.length > 0}>
        <div 
          class="call-stack-toolbar flex items-center justify-between px-2 py-1 border-b"
          style={{ 
            "border-color": "var(--border-weak)",
            "min-height": "24px",
          }}
        >
          <Text variant="muted" size="xs">
            {debug.state.stackFrames.length} frame{debug.state.stackFrames.length !== 1 ? 's' : ''}
          </Text>
          <div class="flex items-center gap-1">
            <IconButton
              size="sm"
              variant="ghost"
              onClick={handleCopyStackTrace}
              tooltip="Copy Call Stack (Ctrl+C)"
              style={{ 
                width: "20px", 
                height: "20px",
                color: copySuccess() ? tokens.colors.semantic.success : "var(--text-weak)",
              }}
            >
              <Show when={copySuccess()} fallback={<Icon name="copy" size="sm" />}>
                <Icon name="clipboard" size="sm" />
              </Show>
            </IconButton>
          </div>
        </div>
      </Show>

      <Show
        when={debug.state.threads.length > 0}
        fallback={
          <div 
            class="text-center py-4" 
            style={{ 
              color: "var(--text-weak)",
              "font-size": fontSize,
            }}
          >
            <Show when={debug.state.isDebugging} fallback="Start debugging to see call stack">
              No threads available
            </Show>
          </div>
        }
      >
        <For each={debug.state.threads}>
          {(thread) => (
            <div class="mb-2">
              {/* Thread header - VS Code spec: flex, padding-right 12px, align-items center */}
              <div
                class="thread flex items-center cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                style={{
                  height: "22px",
                  "line-height": "22px",
                  "padding-right": tokens.spacing.lg,
                  "padding-left": tokens.spacing.sm,
                  "font-size": fontSize,
                  color: debug.state.activeThreadId === thread.id
                    ? "var(--text-base)"
                    : "var(--text-weak)",
                  background: debug.state.activeThreadId === thread.id
                    ? "var(--surface-raised)"
                    : "transparent",
                }}
                onClick={() => handleSelectThread(thread)}
              >
                {/* Twistie icon */}
                <Show
                  when={debug.state.activeThreadId === thread.id}
                  fallback={<Icon name="chevron-right" size="sm" style={{ "margin-right": "2px" }} />}
                >
                  <Icon name="chevron-down" size="sm" style={{ "margin-right": "2px" }} />
                </Show>
                
                {/* Thread name - flex: 1, overflow hidden, text-overflow ellipsis */}
                <span 
                  class="name flex-1 font-medium"
                  style={{
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                  }}
                >
                  Thread {thread.id}: {thread.name}
                </span>
                
                {/* State label - VS Code spec: uppercase, 0.8em, margin 0 10px */}
                <span 
                  class="state label"
                  style={{
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                    margin: "0 10px",
                    "text-transform": "uppercase",
                    "align-self": "center",
                    "font-size": "0.8em",
                    background: "var(--debug-view-state-label-background)",
                    "border-radius": "var(--cortex-radius-sm)",
                    padding: "1px 4px",
                  }}
                >
                  {thread.stopped ? "paused" : "running"}
                </span>
              </div>

              {/* Stack frames for active thread */}
              <Show when={debug.state.activeThreadId === thread.id}>
                <div class="ml-3">
                  <For each={debug.state.stackFrames}>
                    {(frame, index) => (
                      <div
                        class="stack-frame flex items-center cursor-pointer transition-colors hover:bg-[var(--surface-raised)]"
                        style={{
                          height: "22px",
                          "line-height": "22px",
                          "padding-right": tokens.spacing.lg,
                          "padding-left": tokens.spacing.sm,
                          "font-size": fontSize,
                          overflow: "hidden",
                          "text-overflow": "ellipsis",
                          color: debug.state.activeFrameId === frame.id
                            ? "var(--text-base)"
                            : "var(--text-weak)",
                          background: debug.state.activeFrameId === frame.id
                            ? "var(--surface-raised)"
                            : "transparent",
                          opacity: frame.presentationHint === "subtle" ? 0.6 : 1,
                        }}
                        onClick={() => handleSelectFrame(frame)}
                        onContextMenu={(e) => handleContextMenu(e, frame.id)}
                      >
                        {/* Frame indicator - VS Code stackframe icons */}
                        <div
                          class="shrink-0 flex items-center justify-center"
                          style={{ 
                            width: "16px",
                            height: "16px",
                            "margin-right": tokens.spacing.sm,
                            color: index() === 0 
                              ? "var(--debug-icon-breakpoint-current-stackframe-foreground)" 
                              : "var(--debug-icon-breakpoint-stackframe-foreground)",
                          }}
                        >
                          {/* Yellow arrow for top frame, green for others */}
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <Show 
                              when={index() === 0}
                              fallback={
                                <path d="M8 1L15 8L8 15L8 10L1 10L1 6L8 6L8 1Z" fill-opacity="0.6" />
                              }
                            >
                              <path d="M8 1L15 8L8 15L8 10L1 10L1 6L8 6L8 1Z" />
                            </Show>
                          </svg>
                        </div>

                        {/* Function name - VS Code label style */}
                        <span 
                          class="label shrink-0" 
                          style={{ 
                            color: "var(--cortex-syntax-function)",
                            flex: "1",
                            "flex-shrink": "0",
                            "min-width": "fit-content",
                          }}
                        >
                          {frame.name}
                        </span>

                        {/* Source location - VS Code file style: flex end, margin-right 0.8em */}
                        <Show when={frame.source}>
                          <div
                            class="file flex overflow-hidden justify-end"
                            style={{ "margin-left": "0.8em" }}
                          >
                            <span
                              class="file-name"
                              style={{ 
                                overflow: "hidden",
                                "text-overflow": "ellipsis",
                                "margin-right": "0.8em",
                                color: "var(--text-weak)",
                              }}
                            >
                              {getFileName(frame.source?.path)}
                            </span>
                            {/* Line number badge - VS Code spec: padding 4px horizontal */}
                            <span 
                              class="line-number"
                              style={{
                                "padding-left": tokens.spacing.sm,
                                "padding-right": tokens.spacing.sm,
                                color: "var(--text-weak)",
                              }}
                            >
                              :{frame.line}
                              <Show when={frame.column > 0}>:{frame.column}</Show>
                            </span>
                          </div>
                        </Show>
                      </div>
                    )}
                  </For>
                  
                  {/* Show more link - VS Code spec: opacity 0.5, text-align center */}
                  <Show when={debug.state.stackFrames.length >= 20}>
                    <div 
                      class="show-more cursor-pointer hover:underline"
                      style={{
                        opacity: "0.5",
                        "text-align": "center",
                        "font-size": fontSize,
                        "padding": tokens.spacing.sm,
                      }}
                    >
                      Load more frames...
                    </div>
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </For>
      </Show>
      
      {/* Context Menu */}
      <Show when={contextMenu()}>
        {(menu) => (
          <CallStackContextMenu
            x={menu().x}
            y={menu().y}
            frameId={menu().frameId}
            frames={debug.state.stackFrames}
            supportsRestartFrame={debug.state.capabilities?.supportsRestartFrame ?? false}
            onCopyStackTrace={handleCopyStackTrace}
            onCopyFrame={handleCopyFrame}
            onRestartFrame={handleRestartFrame}
            onClose={() => setContextMenu(null)}
          />
        )}
      </Show>
    </div>
  );
}

/**
 * Context menu for call stack operations
 */
interface CallStackContextMenuProps {
  x: number;
  y: number;
  frameId?: number;
  frames: StackFrame[];
  supportsRestartFrame: boolean;
  onCopyStackTrace: () => void;
  onCopyFrame: (frame: StackFrame) => void;
  onRestartFrame: (frameId: number) => void;
  onClose: () => void;
}

function CallStackContextMenu(props: CallStackContextMenuProps) {
  let menuRef: HTMLDivElement | undefined;
  
  // Find the specific frame if frameId is provided
  const targetFrame = () => props.frameId 
    ? props.frames.find(f => f.id === props.frameId) 
    : undefined;

  // Check if the frame supports restart (canRestart property from DAP)
  const canRestartFrame = () => {
    const frame = targetFrame();
    if (!frame || !props.supportsRestartFrame) return false;
    // canRestart property indicates if the adapter supports restarting this specific frame
    // If not specified, default to true if the adapter supports restartFrame capability
    return frame.canRestart !== false;
  };
  
  // Adjust position to stay within viewport
  const getPosition = () => {
    const menuWidth = 200;
    const menuHeight = canRestartFrame() ? 120 : 80;
    const padding = 8;
    
    let x = props.x;
    let y = props.y;
    
    // Adjust if menu would overflow right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    
    // Adjust if menu would overflow bottom edge
    if (y + menuHeight > window.innerHeight - padding) {
      y = window.innerHeight - menuHeight - padding;
    }
    
    return { x, y };
  };
  
  const pos = getPosition();
  
  return (
    <div
      ref={menuRef}
      class="call-stack-context-menu fixed z-50 rounded shadow-lg"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        background: "var(--background-base)",
        border: `1px solid ${tokens.colors.border.default}`,
        "min-width": "180px",
        "box-shadow": tokens.shadows.popup,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Restart Frame - only shown when the frame supports restart */}
      <Show when={canRestartFrame()}>
        <button
          class="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-[var(--surface-raised)] transition-colors"
          style={{ color: "var(--text-base)" }}
          onClick={() => {
            const frame = targetFrame();
            if (frame) props.onRestartFrame(frame.id);
          }}
        >
          <Icon name="rotate" size="sm" style={{ color: "var(--debug-icon-restart-foreground)" }} />
          Restart Frame
        </button>
        <div 
          style={{ 
            height: "1px", 
            background: "var(--border-weak)", 
            margin: "4px 0" 
          }} 
        />
      </Show>

      {/* Copy This Frame - only shown when right-clicking a specific frame */}
      <Show when={targetFrame()}>
        {(frame) => (
          <button
            class="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-[var(--surface-raised)] transition-colors"
            style={{ color: "var(--text-base)" }}
            onClick={() => props.onCopyFrame(frame())}
          >
            <Icon name="copy" size="sm" style={{ color: "var(--text-weak)" }} />
            Copy Frame
          </button>
        )}
      </Show>
      
      {/* Copy All Call Stack */}
      <button
        class="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-[var(--surface-raised)] transition-colors"
        style={{ color: "var(--text-base)" }}
        onClick={props.onCopyStackTrace}
      >
        <Icon name="clipboard" size="sm" style={{ color: "var(--text-weak)" }} />
        Copy Call Stack
        <span 
          class="ml-auto text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Ctrl+C
        </span>
      </button>
    </div>
  );
}

