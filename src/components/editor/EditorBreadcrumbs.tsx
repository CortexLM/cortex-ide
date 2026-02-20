import { createMemo, For, Show, type JSX } from "solid-js";
import { useEditor } from "@/context/EditorContext";
import { Icon } from "../ui/Icon";
import { getFileIcon } from "@/utils/fileIcons";
import { getProjectPath } from "@/utils/workspace";
import { CortexTokens } from "@/design-system/tokens/cortex-tokens";

const BREADCRUMB_HEIGHT = "22px";

interface BreadcrumbSegment {
  name: string;
  fullPath: string;
  isFile: boolean;
}

export interface EditorBreadcrumbsProps {
  filePath?: string;
  workspaceRoot?: string;
}

function parseBreadcrumbSegments(filePath: string, workspaceRoot?: string): BreadcrumbSegment[] {
  if (!filePath) return [];

  const normalized = filePath.replace(/\\/g, "/");
  let root = workspaceRoot?.replace(/\\/g, "/") || getProjectPath()?.replace(/\\/g, "/") || "";

  let relative = normalized;
  if (root && normalized.toLowerCase().startsWith(root.toLowerCase())) {
    relative = normalized.slice(root.length);
    if (relative.startsWith("/")) relative = relative.slice(1);
  }

  if (/^[A-Za-z]:/.test(relative) || relative.startsWith("/")) {
    const parts = normalized.split("/").filter(Boolean);
    relative = parts.length > 3 ? parts.slice(-3).join("/") : parts.join("/");
  }

  const parts = relative.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [];
  let currentPath = root || "";

  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    segments.push({
      name: parts[i],
      fullPath: currentPath,
      isFile: i === parts.length - 1,
    });
  }

  return segments;
}

function getSegmentIcon(segment: BreadcrumbSegment): string | null {
  if (segment.isFile) {
    return getFileIcon(segment.name, false);
  }
  return null;
}

function handleSegmentClick(segment: BreadcrumbSegment) {
  if (segment.isFile) {
    window.dispatchEvent(new CustomEvent("breadcrumb:navigate-file", {
      detail: { path: segment.fullPath },
    }));
  } else {
    window.dispatchEvent(new CustomEvent("breadcrumb:navigate-folder", {
      detail: { path: segment.fullPath },
    }));
    window.dispatchEvent(new CustomEvent("reveal-in-explorer", {
      detail: { path: segment.fullPath },
    }));
  }
}

export function EditorBreadcrumbs(props: EditorBreadcrumbsProps) {
  const editor = useEditor();

  const activeFile = createMemo(() => {
    const id = editor.state.activeFileId;
    if (!id) return undefined;
    return editor.state.openFiles.find(f => f.id === id);
  });

  const filePath = createMemo(() => props.filePath ?? activeFile()?.path ?? "");

  const segments = createMemo(() => parseBreadcrumbSegments(filePath(), props.workspaceRoot));

  const hasSegments = createMemo(() => segments().length > 0);

  const containerStyle = (): JSX.CSSProperties => ({
    display: hasSegments() ? "flex" : "none",
    "align-items": "center",
    height: BREADCRUMB_HEIGHT,
    "min-height": BREADCRUMB_HEIGHT,
    padding: "0 8px",
    overflow: "hidden",
    "flex-shrink": "0",
    background: CortexTokens.colors.bg.primary,
    "border-bottom": `1px solid ${CortexTokens.colors.border.subtle}`,
    "font-size": CortexTokens.typography.fontSize.xs,
    "font-family": CortexTokens.typography.fontFamily.sans,
  });

  const segmentButtonStyle = (isLast: boolean): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    gap: "4px",
    padding: "1px 4px",
    "border-radius": "3px",
    border: "none",
    background: "transparent",
    color: isLast ? CortexTokens.colors.text.primary : CortexTokens.colors.text.secondary,
    "font-weight": isLast ? "500" : "400",
    "font-size": "inherit",
    "font-family": "inherit",
    cursor: "pointer",
    "white-space": "nowrap",
    "max-width": "160px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "flex-shrink": "0",
    transition: "background 100ms ease-out, color 100ms ease-out",
  });

  const separatorStyle: JSX.CSSProperties = {
    color: CortexTokens.colors.text.muted,
    "font-size": "10px",
    margin: "0 2px",
    "flex-shrink": "0",
    "user-select": "none",
  };

  return (
    <nav style={containerStyle()} aria-label="File breadcrumb">
      <For each={segments()}>
        {(segment, index) => (
          <>
            <Show when={index() > 0}>
              <span style={separatorStyle} aria-hidden="true">›</span>
            </Show>
            <button
              style={segmentButtonStyle(index() === segments().length - 1)}
              onClick={() => handleSegmentClick(segment)}
              title={segment.fullPath}
              class="hover:bg-[var(--cortex-bg-hover)] hover:text-[var(--cortex-text-primary)]"
            >
              <Show when={segment.isFile && getSegmentIcon(segment)}>
                <img
                  src={getSegmentIcon(segment)!}
                  alt=""
                  width={12}
                  height={12}
                  style={{ "flex-shrink": "0" }}
                  draggable={false}
                />
              </Show>
              <Show when={!segment.isFile}>
                <Icon name="folder" size={12} style={{ "flex-shrink": "0", opacity: "0.7" }} />
              </Show>
              <span style={{ overflow: "hidden", "text-overflow": "ellipsis" }}>
                {segment.name}
              </span>
            </button>
          </>
        )}
      </For>
    </nav>
  );
}

export default EditorBreadcrumbs;
