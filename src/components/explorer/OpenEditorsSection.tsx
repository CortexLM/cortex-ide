import { Component, For, Show, createMemo } from 'solid-js';
import { Icon } from '../ui/Icon';
import { useEditor, type OpenFile } from '../../context/EditorContext';
import { getFileIcon } from '../../utils/fileIcons';
import { Card, SidebarSection, ListItem, Badge, Text } from '../ui';

const OpenEditorItem: Component<{
  file: OpenFile;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: MouseEvent) => void;
}> = (props) => {
  return (
    <ListItem
      icon={
        <img 
          src={getFileIcon(props.file.name, false)} 
          alt=""
          width={16}
          height={16}
          draggable={false}
          style={{ "flex-shrink": "0" }}
        />
      }
      label={props.file.name}
      selected={props.isActive}
      onClick={props.onSelect}
      iconRight={
        <div 
          class="open-editor-item-actions"
          style={{ display: "flex", "align-items": "center", gap: "4px" }}
        >
          <Show when={props.file.modified}>
            <span 
              title="Unsaved changes"
              style={{
                width: "8px",
                height: "8px",
                "border-radius": "var(--cortex-radius-full)",
                background: "var(--cortex-primary)",
                "flex-shrink": "0",
              }}
            />
          </Show>
          <button
            class="open-editor-close-btn"
            onClick={props.onClose}
            title="Close"
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "18px",
              height: "18px",
              padding: "0",
              border: "none",
              background: "transparent",
              color: "var(--jb-icon-color-default)",
              "border-radius": "var(--jb-radius-sm)",
              cursor: "pointer",
              opacity: "0",
              transition: "opacity 0.15s ease, background 0.15s ease",
            }}
          >
            <Icon name="xmark" style={{ width: "12px", height: "12px" }} />
          </button>
        </div>
      }
      style={{
        margin: "0 4px",
        "border-radius": "var(--jb-radius-sm)",
      }}
    />
  );
};

export const OpenEditorsSection: Component = () => {
  const editor = useEditor();
  
  const openFiles = createMemo(() => editor.state.openFiles ?? []);
  const activeFileId = createMemo(() => editor.state.activeFileId);
  const fileCount = createMemo(() => openFiles().length);
  
  const handleFileClick = (fileId: string) => {
    editor.setActiveFile(fileId);
  };
  
  const handleCloseFile = (e: MouseEvent, fileId: string) => {
    e.stopPropagation();
    editor.closeFile(fileId);
  };
  
  const handleCloseAll = (e: MouseEvent) => {
    e.stopPropagation();
    editor.closeAllFiles();
  };
  
  return (
    <Card 
      variant="default" 
      padding="sm"
      style={{ 
        margin: "8px",
        "margin-bottom": "4px",
      }}
    >
      <SidebarSection
        title="Open Editors"
        collapsible
        defaultCollapsed={false}
        actions={
          <Show when={fileCount() > 0}>
            <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
              <Badge variant="default">{fileCount()}</Badge>
              <button
                onClick={handleCloseAll}
                title="Close All Editors"
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "20px",
                  height: "20px",
                  padding: "0",
                  border: "none",
                  background: "transparent",
                  color: "var(--jb-icon-color-default)",
                  "border-radius": "var(--jb-radius-sm)",
                  cursor: "pointer",
                }}
              >
                <Icon name="xmark" style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          </Show>
        }
        style={{ padding: "0" }}
      >
        <div style={{ 
          display: "flex", 
          "flex-direction": "column", 
          gap: "2px",
          padding: "4px 0",
        }}>
          <For each={openFiles()}>
            {(file) => (
              <OpenEditorItem
                file={file}
                isActive={file.id === activeFileId()}
                onSelect={() => handleFileClick(file.id)}
                onClose={(e) => handleCloseFile(e, file.id)}
              />
            )}
          </For>
          <Show when={fileCount() === 0}>
            <Text 
              variant="muted" 
              size="sm"
              style={{ padding: "8px 12px", "text-align": "center" }}
            >
              No open editors
            </Text>
          </Show>
        </div>
      </SidebarSection>
      
      <style>{`
        .open-editor-close-btn:hover {
          background: var(--jb-surface-hover) !important;
          opacity: 1 !important;
        }
        [style*="display: flex"]:hover .open-editor-close-btn,
        .open-editor-item-actions:hover .open-editor-close-btn {
          opacity: 1 !important;
        }
      `}</style>
    </Card>
  );
};

