/**
 * EditorSkeleton - Placeholder shown while Monaco editor is loading
 * 
 * Displays a visually consistent skeleton that mimics the appearance
 * of a code editor with line numbers, content area, and subtle animation.
 */

import { For, Show, type JSX } from "solid-js";
import { Text, LoadingSpinner } from "@/components/ui";

interface EditorSkeletonProps {
  /** Number of skeleton lines to show (default: 20) */
  lineCount?: number;
  /** Whether to show the loading message (default: true) */
  showMessage?: boolean;
}

export function EditorSkeleton(props: EditorSkeletonProps) {
  const lineCount = () => props.lineCount ?? 20;
  const showMessage = () => props.showMessage ?? true;

  // Generate varying line widths for realistic appearance
  const getLineWidth = (index: number) => {
    const patterns = [60, 80, 45, 90, 70, 55, 85, 40, 75, 65];
    return patterns[index % patterns.length];
  };

  const containerStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--jb-panel)",
  };

  const headerStyle: JSX.CSSProperties = {
    height: "32px",
    display: "flex",
    "align-items": "center",
    padding: "0 12px",
    "border-bottom": "1px solid var(--jb-border-divider)",
    "flex-shrink": "0",
    background: "var(--jb-app-root)",
  };

  const skeletonBarStyle: JSX.CSSProperties = {
    height: "12px",
    width: "150px",
    "border-radius": "var(--jb-radius-sm)",
    background: "var(--jb-surface-active)",
    animation: "skeleton-pulse 1.5s ease-in-out infinite",
  };

  const editorContentStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    overflow: "hidden",
  };

  const gutterStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "padding-top": "8px",
    "padding-right": "12px",
    "padding-left": "16px",
    "user-select": "none",
    "flex-shrink": "0",
    background: "var(--jb-panel)",
    "border-right": "1px solid var(--jb-border-divider)",
    "min-width": "50px",
  };

  const lineNumberStyle: JSX.CSSProperties = {
    "text-align": "right",
    height: "20px",
    display: "flex",
    "align-items": "center",
    "justify-content": "flex-end",
    color: "var(--jb-text-placeholder)",
    "font-size": "13px",
    "font-family": "var(--jb-font-mono)",
  };

  const codeContentStyle: JSX.CSSProperties = {
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    "padding-top": "8px",
    "padding-left": "16px",
    "padding-right": "16px",
    overflow: "hidden",
  };

  const skeletonLineContainerStyle: JSX.CSSProperties = {
    height: "20px",
    display: "flex",
    "align-items": "center",
  };

  const overlayStyle: JSX.CSSProperties = {
    position: "absolute",
    inset: "0",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "pointer-events": "none",
    background: "rgba(30, 30, 30, 0.5)",
    "backdrop-filter": "blur(2px)",
  };

  const loadingContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    gap: "12px",
  };

  const loadingRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  return (
    <div style={containerStyle}>
      {/* Header area */}
      <div style={headerStyle}>
        <div style={skeletonBarStyle} />
      </div>
      
      {/* Editor content area */}
      <div style={editorContentStyle}>
        {/* Line numbers gutter */}
        <div style={gutterStyle}>
          <For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
            {(lineNum) => (
              <div style={lineNumberStyle}>
                {lineNum}
              </div>
            )}
          </For>
        </div>
        
        {/* Code content skeleton */}
        <div style={codeContentStyle}>
          <For each={Array.from({ length: lineCount() }, (_, i) => i)}>
            {(index) => (
              <div style={skeletonLineContainerStyle}>
                <div 
                  style={{ 
                    height: "12px",
                    width: `${getLineWidth(index)}%`,
                    "border-radius": "var(--jb-radius-sm)",
                    background: "var(--jb-surface-active)",
                    opacity: "0.4",
                    animation: `skeleton-pulse 1.5s ease-in-out ${index * 0.05}s infinite`,
                  }}
                />
              </div>
            )}
          </For>
        </div>
      </div>
      
      {/* Loading message overlay */}
      <Show when={showMessage()}>
        <div style={overlayStyle}>
          <div style={loadingContainerStyle}>
            <div style={loadingRowStyle}>
              <LoadingSpinner size="md" />
              <Text variant="body" color="muted" weight="medium">
                Loading editor...
              </Text>
            </div>
          </div>
        </div>
      </Show>
      
      {/* Skeleton animation styles */}
      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}

export default EditorSkeleton;
