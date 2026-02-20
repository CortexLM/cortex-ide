import { Show, createSignal, createMemo, type JSX } from "solid-js";
import { useEditor, type OpenFile } from "@/context/EditorContext";
import { TabBar } from "./TabBar";
import { Icon } from "../ui/Icon";
import { ContextMenu, type ContextMenuSection } from "@/components/ui";
import { CortexTokens } from "@/design-system/tokens/cortex-tokens";

const TAB_BAR_HEIGHT = "35px";

export interface EditorTabBarProps {
  files?: OpenFile[];
  activeFileId?: string | null;
  onFileSelect?: (fileId: string) => void;
  onFileClose?: (fileId: string) => void;
  onNewFile?: () => void;
  groupId?: string;
  showCloseGroupButton?: boolean;
  onCloseGroup?: () => void;
}

export function EditorTabBar(props: EditorTabBarProps) {
  const editor = useEditor();

  const files = () => props.files ?? editor.state.openFiles;
  const hasFiles = createMemo(() => files().length > 0);

  const [splitMenuPos, setSplitMenuPos] = createSignal<{ x: number; y: number } | null>(null);

  const handleSplitRight = () => {
    window.dispatchEvent(new CustomEvent("editor:split-right"));
  };

  const handleSplitDown = () => {
    window.dispatchEvent(new CustomEvent("editor:split-down"));
  };

  const handleSplitContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSplitMenuPos({ x: e.clientX, y: e.clientY });
  };

  const handleCloseSaved = () => {
    const allFiles = files();
    for (const file of allFiles) {
      if (!file.modified) {
        if (props.onFileClose) {
          props.onFileClose(file.id);
        } else {
          editor.closeFile(file.id);
        }
      }
    }
  };

  const splitMenuSections = createMemo((): ContextMenuSection[] => [
    {
      items: [
        {
          id: "split-right",
          label: "Split Right",
          icon: "columns",
          shortcut: "Ctrl+\\",
          action: () => {
            handleSplitRight();
            setSplitMenuPos(null);
          },
        },
        {
          id: "split-down",
          label: "Split Down",
          icon: "grip-lines",
          shortcut: "Ctrl+K Ctrl+\\",
          action: () => {
            handleSplitDown();
            setSplitMenuPos(null);
          },
        },
      ],
    },
    {
      items: [
        {
          id: "close-saved",
          label: "Close Saved",
          icon: "floppy-disk",
          action: () => {
            handleCloseSaved();
            setSplitMenuPos(null);
          },
        },
      ],
    },
  ]);

  const containerStyle = (): JSX.CSSProperties => ({
    display: hasFiles() ? "flex" : "none",
    "align-items": "stretch",
    height: TAB_BAR_HEIGHT,
    "min-height": TAB_BAR_HEIGHT,
    background: CortexTokens.colors.bg.primary,
    "border-bottom": `1px solid ${CortexTokens.colors.border.subtle}`,
    "flex-shrink": "0",
  });

  const splitButtonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "28px",
    height: "100%",
    color: CortexTokens.colors.text.secondary,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    "flex-shrink": "0",
    transition: "color 150ms ease-out, background 150ms ease-out",
  });

  return (
    <div style={containerStyle()}>
      <div style={{ flex: "1", "min-width": "0", overflow: "hidden" }}>
        <TabBar
          files={props.files}
          activeFileId={props.activeFileId}
          onFileSelect={props.onFileSelect}
          onFileClose={props.onFileClose}
          onNewFile={props.onNewFile}
          groupId={props.groupId}
          showCloseGroupButton={props.showCloseGroupButton}
          onCloseGroup={props.onCloseGroup}
          showNewTabButton={true}
        />
      </div>

      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "2px",
          padding: "0 4px",
          "border-left": `1px solid ${CortexTokens.colors.border.subtle}`,
          "flex-shrink": "0",
        }}
      >
        <button
          onClick={handleSplitRight}
          style={splitButtonStyle()}
          title="Split Editor Right (Ctrl+\)"
        >
          <Icon name="columns" size={14} />
        </button>

        <button
          onClick={handleSplitDown}
          style={splitButtonStyle()}
          title="Split Editor Down (Ctrl+K Ctrl+\)"
        >
          <Icon name="grip-lines" size={14} />
        </button>

        <button
          onClick={handleSplitContextMenu}
          onContextMenu={handleSplitContextMenu}
          style={splitButtonStyle()}
          title="More Split Options..."
        >
          <Icon name="ellipsis" size={14} />
        </button>
      </div>

      <Show when={splitMenuPos()}>
        <ContextMenu
          state={{
            visible: true,
            x: splitMenuPos()!.x,
            y: splitMenuPos()!.y,
            sections: splitMenuSections(),
          }}
          onClose={() => setSplitMenuPos(null)}
        />
      </Show>
    </div>
  );
}

export default EditorTabBar;
