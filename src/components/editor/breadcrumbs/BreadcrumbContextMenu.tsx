import { Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Icon } from "../../ui/Icon";
import type { BreadcrumbContextMenuProps } from "./breadcrumbTypes";

const menuButtonStyle = {
  width: "100%",
  height: "24px",
  padding: "0 12px",
  display: "flex",
  "align-items": "center",
  gap: "8px",
  cursor: "pointer",
  color: "var(--jb-text-body-color)",
  "font-size": "12px",
  border: "none",
  background: "transparent",
  "text-align": "left",
} as const;

const menuIconStyle = {
  width: "14px",
  height: "14px",
  "flex-shrink": "0",
  color: "var(--jb-text-muted-color)",
} as const;

const handleMouseEnter = (e: MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = "var(--jb-bg-hover)";
};

const handleMouseLeave = (e: MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = "transparent";
};

export function BreadcrumbContextMenu(props: BreadcrumbContextMenuProps) {
  return (
    <Show when={props.contextMenuPos}>
      <Portal>
        <div
          ref={(el) => props.setContextMenuRef(el)}
          class="breadcrumb-dropdown"
          style={{
            position: "fixed",
            left: `${props.contextMenuPos!.x}px`,
            top: `${props.contextMenuPos!.y}px`,
            "min-width": "180px",
            background: "var(--jb-panel)",
            border: "1px solid var(--jb-border-divider)",
            "border-radius": "var(--cortex-radius-md)",
            "box-shadow": "0 4px 16px rgba(0, 0, 0, 0.36)",
            padding: "4px 0",
            "z-index": "1000",
          }}
        >
          <button
            class="breadcrumb-dropdown-item"
            style={menuButtonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={props.onCopyPath}
          >
            <Icon name="copy" style={menuIconStyle} />
            <span>Copy Path</span>
          </button>
          <button
            class="breadcrumb-dropdown-item"
            style={menuButtonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={props.onCopyRelativePath}
          >
            <Icon name="copy" style={menuIconStyle} />
            <span>Copy Relative Path</span>
          </button>
          <div
            style={{
              height: "0",
              "border-bottom": "1px solid var(--jb-border-divider)",
              margin: "4px 0",
            }}
          />
          <button
            class="breadcrumb-dropdown-item"
            style={menuButtonStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={props.onRevealInExplorer}
          >
            <Icon name="arrow-up-right-from-square" style={menuIconStyle} />
            <span>Reveal in File Explorer</span>
          </button>
        </div>
      </Portal>
    </Show>
  );
}
