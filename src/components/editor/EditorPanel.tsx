import { Show, createMemo, type JSX } from "solid-js";
import { MultiBuffer } from "./MultiBuffer";
import { useEditor } from "@/context/EditorContext";
import { EditorSkeleton } from "./EditorSkeleton";
import { Text, Card } from "@/components/ui";
import { Icon } from "../ui/Icon";
import { tokens } from "@/design-system/tokens";

/**
 * EditorPanel - Main editor container component
 * 
 * Styling based on VS Code Monaco Editor specifications:
 * - Background: var(--vscode-editor-background)
 * - Z-index stacking: IME (10), Minimap (5), Canvas (0), Hidden input (-10)
 * - Selection corners: 3px border-radius
 * - Cursor animations: 500ms ease-in-out
 * - Line numbers: tabular-nums font
 * 
 * IMPORTANT: Uses CSS display instead of <Show> to prevent SolidJS cleanup
 * race conditions when the last file is closed. Monaco editor needs time
 * to dispose properly before the DOM is removed.
 */
export function EditorPanel() {
  const { state } = useEditor();
  
  const hasOpenFiles = createMemo(() => state.openFiles.length > 0);
  const showEditor = createMemo(() => !state.isOpening && hasOpenFiles());

  return (
    <div 
      class="editor-panel flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ 
        position: "relative",
        background: "var(--vscode-editor-background, #141415)",
      }}
    >
      {/* Loading skeleton */}
      <Show when={state.isOpening}>
        <EditorSkeleton />
      </Show>

      
      {/* Empty state - shown when no files and not loading */}
      <div 
        style={{ 
          display: (!state.isOpening && !hasOpenFiles()) ? "flex" : "none",
          flex: "1",
          "align-items": "center",
          "justify-content": "center",
          background: `var(--vscode-editor-background, ${tokens.colors.surface.canvas})`,
        } as JSX.CSSProperties}
      >
        <Card padding="lg" style={{ "text-align": "center", background: tokens.colors.surface.elevated }}>
          <div style={{ 
            display: "flex", 
            "flex-direction": "column", 
            "align-items": "center", 
            gap: tokens.spacing.lg 
          }}>
            <Icon name="file" style={{ 
              width: "32px", 
              height: "32px", 
              color: tokens.colors.text.muted 
            }} />
            <Text variant="body" style={{ color: tokens.colors.text.primary }}>
              No files open
            </Text>
            <Text variant="muted" size="sm">
              Press{" "}
              <kbd 
                style={{ 
                  padding: "2px 6px",
                  background: tokens.colors.interactive.active,
                  border: `1px solid ${tokens.colors.border.default}`,
                  "border-radius": tokens.radius.sm,
                  "font-family": "var(--jb-font-mono)",
                  "font-size": "var(--jb-text-muted-size)",
                }}
              >
                Ctrl+P
              </kbd>{" "}
              to open a file
            </Text>
          </div>
        </Card>
      </div>
      
      {/* Editor - always mounted but hidden via CSS to prevent cleanup race condition.
          Using visibility+position instead of display:none to keep Monaco editor alive. */}
      <div
        class="flex-1 flex flex-col min-h-0 overflow-hidden"
        style={{
          visibility: showEditor() ? "visible" : "hidden",
          position: showEditor() ? "relative" : "absolute",
          width: "100%",
          height: showEditor() ? "auto" : "0",
          "pointer-events": showEditor() ? "auto" : "none",
        }}
      >
        <MultiBuffer />
      </div>
    </div>
  );
}
