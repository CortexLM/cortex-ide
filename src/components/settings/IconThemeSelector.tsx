import { createSignal, For, Show, createMemo } from "solid-js";
import { Icon } from '../ui/Icon';
import { useIconTheme, type IconTheme, type IconDefinition } from "@/context/IconThemeContext";
import { Card, Text, Button } from "@/components/ui";
import { SectionHeader, FormGroup } from "./FormComponents";

// ============================================================================
// Types
// ============================================================================

interface ThemeCardProps {
  theme: IconTheme;
  isActive: boolean;
  onSelect: () => void;
}

interface IconPreviewProps {
  label: string;
  icon: IconDefinition;
}

// ============================================================================
// Sample Files for Preview
// ============================================================================

const PREVIEW_FILES = [
  "index.ts",
  "App.tsx",
  "package.json",
  "README.md",
  ".gitignore",
  "styles.css",
  "config.yaml",
  "Dockerfile",
  "vite.config.ts",
  "tsconfig.json",
];

const PREVIEW_FOLDERS = [
  { name: "src", open: true },
  { name: "components", open: true },
  { name: "node_modules", open: false },
  { name: "tests", open: false },
  { name: ".github", open: false },
  { name: "dist", open: false },
  { name: "public", open: true },
  { name: "hooks", open: false },
];

// ============================================================================
// Icon Preview Component
// ============================================================================

function IconPreview(props: IconPreviewProps) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "4px 8px",
        "border-radius": "var(--jb-radius-sm)",
        background: "var(--jb-surface-active)",
        "font-size": "12px",
      }}
    >
      <span style={{ color: props.icon.color }}>{props.icon.icon}</span>
      <Text variant="muted" size="xs">{props.label}</Text>
    </div>
  );
}

// ============================================================================
// Theme Card Component
// ============================================================================

function ThemeCard(props: ThemeCardProps) {
  const previewIcons = createMemo(() => {
    const theme = props.theme;
    const fileIcons: Array<{ name: string; icon: IconDefinition }> = [];
    const folderIcons: Array<{ name: string; icon: IconDefinition; open: boolean }> = [];

    for (const filename of PREVIEW_FILES.slice(0, 6)) {
      const lowerFilename = filename.toLowerCase();
      let icon: IconDefinition = theme.icons.file;

      if (theme.icons.fileNames[filename]) {
        icon = theme.icons.fileNames[filename];
      } else if (theme.icons.fileNames[lowerFilename]) {
        icon = theme.icons.fileNames[lowerFilename];
      } else {
        const lastDotIndex = filename.lastIndexOf(".");
        if (lastDotIndex > 0) {
          const ext = filename.slice(lastDotIndex + 1).toLowerCase();
          if (theme.icons.fileExtensions[ext]) {
            icon = theme.icons.fileExtensions[ext];
          }
        }
      }

      fileIcons.push({ name: filename, icon });
    }

    for (const folder of PREVIEW_FOLDERS.slice(0, 3)) {
      const lowerName = folder.name.toLowerCase();
      let icon: IconDefinition;

      if (folder.open) {
        icon = theme.icons.folderNamesOpen[folder.name] ||
          theme.icons.folderNamesOpen[lowerName] ||
          (theme.icons.folderNames[folder.name] 
            ? { ...theme.icons.folderNames[folder.name], icon: theme.icons.folderOpen.icon }
            : theme.icons.folderOpen);
      } else {
        icon = theme.icons.folderNames[folder.name] ||
          theme.icons.folderNames[lowerName] ||
          theme.icons.folder;
      }

      folderIcons.push({ name: folder.name, icon, open: folder.open });
    }

    return { fileIcons, folderIcons };
  });

  return (
    <Card
      variant="outlined"
      padding="md"
      hoverable
      onClick={props.onSelect}
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
        cursor: "pointer",
        "text-align": "left",
        position: "relative",
        border: props.isActive ? "2px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
        background: props.isActive ? "var(--jb-surface-active)" : "var(--jb-panel)",
      }}
    >
      {/* Selection indicator */}
      <Show when={props.isActive}>
        <div
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "20px",
            height: "20px",
            "border-radius": "var(--cortex-radius-full)",
            background: "var(--jb-btn-primary-bg)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
          }}
        >
          <Icon name="check" style={{ width: "12px", height: "12px", color: "var(--cortex-text-primary)" }} />
        </div>
      </Show>

      {/* Theme info */}
      <div>
        <Text as="h3" weight="semibold" size="sm" style={{ margin: "0 0 4px 0", color: "var(--jb-text-body-color)" }}>
          {props.theme.name}
        </Text>
        <Text variant="muted" size="xs" style={{ margin: 0 }}>
          {props.theme.description}
        </Text>
      </div>

      {/* Icon preview - file tree style */}
      <div
        style={{
          background: "var(--jb-modal)",
          "border-radius": "var(--jb-radius-sm)",
          padding: "12px",
          "font-family": "var(--jb-font-mono)",
          "font-size": "12px",
        }}
      >
        {/* Folder preview */}
        <For each={previewIcons().folderIcons}>
          {(folder, index) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "padding-left": index() > 0 ? "16px" : "0",
                "margin-bottom": "4px",
              }}
            >
              <Text variant="muted" size="xs" style={{ "font-size": "10px" }}>
                {folder.open ? "▼" : "▶"}
              </Text>
              <span style={{ color: folder.icon.color }}>{folder.icon.icon}</span>
              <Text size="xs" style={{ color: "var(--jb-text-body-color)" }}>{folder.name}</Text>
            </div>
          )}
        </For>

        {/* File preview */}
        <For each={previewIcons().fileIcons}>
          {(file) => (
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "6px",
                "padding-left": "32px",
                "margin-bottom": "2px",
              }}
            >
              <span style={{ color: file.icon.color }}>{file.icon.icon}</span>
              <Text size="xs" style={{ color: "var(--jb-text-body-color)" }}>{file.name}</Text>
            </div>
          )}
        </For>
      </div>
    </Card>
  );
}

// ============================================================================
// Full Preview Component
// ============================================================================

function ThemeFullPreview() {
  const iconTheme = useIconTheme();

  const allPreviews = createMemo(() => {
    const files: Array<{ name: string; icon: IconDefinition }> = [];
    const folders: Array<{ name: string; icon: IconDefinition }> = [];

    for (const filename of PREVIEW_FILES) {
      files.push({ name: filename, icon: iconTheme.getFileIcon(filename) });
    }

    for (const folder of PREVIEW_FOLDERS) {
      folders.push({ name: folder.name, icon: iconTheme.getFolderIcon(folder.name, folder.open) });
    }

    return { files, folders };
  });

  return (
    <Card
      variant="outlined"
      padding="md"
      style={{ "margin-top": "16px" }}
    >
      <Text as="h3" weight="semibold" size="sm" style={{ margin: "0 0 12px 0", color: "var(--jb-text-body-color)" }}>
        Preview: {iconTheme.activeTheme().name}
      </Text>

      <div
        style={{
          display: "grid",
          "grid-template-columns": "1fr 1fr",
          gap: "16px",
        }}
      >
        {/* Folders */}
        <div>
          <Text variant="header" size="xs" style={{ margin: "0 0 8px 0" }}>
            Folders
          </Text>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <For each={allPreviews().folders}>
              {(folder) => <IconPreview label={folder.name} icon={folder.icon} />}
            </For>
          </div>
        </div>

        {/* Files */}
        <div>
          <Text variant="header" size="xs" style={{ margin: "0 0 8px 0" }}>
            Files
          </Text>
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <For each={allPreviews().files}>
              {(file) => <IconPreview label={file.name} icon={file.icon} />}
            </For>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function IconThemeSelector() {
  const iconTheme = useIconTheme();
  const [showFullPreview, setShowFullPreview] = createSignal(false);

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      <SectionHeader
        title="File Icon Theme"
        description="Choose how file and folder icons appear in the explorer"
      />

      <FormGroup>
        {/* Theme cards grid */}
        <div
          style={{
            display: "grid",
            "grid-template-columns": "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
            "margin-top": "12px",
          }}
        >
          <For each={iconTheme.themes()}>
            {(theme) => (
              <ThemeCard
                theme={theme}
                isActive={iconTheme.activeTheme().id === theme.id}
                onSelect={() => iconTheme.setIconTheme(theme.id)}
              />
            )}
          </For>
        </div>

        {/* Toggle full preview */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFullPreview(!showFullPreview())}
          style={{ "margin-top": "16px" }}
          icon={
            <Icon
              name="chevron-right"
              style={{
                width: "14px",
                height: "14px",
                transform: showFullPreview() ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            />
          }
        >
          {showFullPreview() ? "Hide" : "Show"} full icon preview
        </Button>

        {/* Full preview panel */}
        <Show when={showFullPreview()}>
          <ThemeFullPreview />
        </Show>
      </FormGroup>
    </div>
  );
}

