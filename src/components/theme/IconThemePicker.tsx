import { createSignal, createMemo, For, Show } from "solid-js";
import { useIconTheme } from "@/context/iconTheme/IconThemeProvider";
import type { IconTheme, IconDefinition } from "@/context/iconTheme/types";
import { tokens } from "@/design-system/tokens";

const PREVIEW_FILES = ["index.ts", "App.tsx", "package.json", "README.md", "styles.css", "config.yaml", ".gitignore", "Dockerfile"];
const PREVIEW_FOLDERS: Array<{ name: string; open: boolean }> = [
  { name: "src", open: true },
  { name: "components", open: true },
  { name: "node_modules", open: false },
  { name: "tests", open: false },
];

function resolveFileIcon(theme: IconTheme, filename: string): IconDefinition {
  const lower = filename.toLowerCase();
  if (theme.icons.fileNames[filename]) return theme.icons.fileNames[filename];
  if (theme.icons.fileNames[lower]) return theme.icons.fileNames[lower];
  const dot = filename.lastIndexOf(".");
  if (dot > 0 && dot < filename.length - 1) {
    const ext = filename.slice(dot + 1).toLowerCase();
    if (theme.icons.fileExtensions[ext]) return theme.icons.fileExtensions[ext];
  }
  return theme.icons.file;
}

function resolveFolderIcon(theme: IconTheme, name: string, open: boolean): IconDefinition {
  const lower = name.toLowerCase();
  if (open) {
    return theme.icons.folderNamesOpen[name]
      ?? theme.icons.folderNamesOpen[lower]
      ?? (theme.icons.folderNames[name] ? { ...theme.icons.folderNames[name], icon: theme.icons.folderOpen.icon } : null)
      ?? (theme.icons.folderNames[lower] ? { ...theme.icons.folderNames[lower], icon: theme.icons.folderOpen.icon } : null)
      ?? theme.icons.folderOpen;
  }
  return theme.icons.folderNames[name] ?? theme.icons.folderNames[lower] ?? theme.icons.folder;
}

function IconPreviewItem(props: { label: string; icon: IconDefinition; indent: number; chevron?: string }) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "6px", "padding-left": `${props.indent}px`, "margin-bottom": "2px", "font-size": tokens.typography.fontSize.xs, "font-family": tokens.typography.fontFamily.mono }}>
      <Show when={props.chevron}>
        <span style={{ color: tokens.colors.text.muted, "font-size": "10px", width: "10px", "text-align": "center" }}>{props.chevron}</span>
      </Show>
      <span style={{ color: props.icon.color }}>{props.icon.icon}</span>
      <span style={{ color: tokens.colors.text.secondary }}>{props.label}</span>
    </div>
  );
}

function ThemeCard(props: { theme: IconTheme; isActive: boolean; onSelect: () => void }) {
  const previews = createMemo(() => ({
    files: PREVIEW_FILES.slice(0, 4).map((name) => ({ name, icon: resolveFileIcon(props.theme, name) })),
    folders: PREVIEW_FOLDERS.slice(0, 2).map((f) => ({ ...f, icon: resolveFolderIcon(props.theme, f.name, f.open) })),
  }));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); props.onSelect(); } }}
      style={{
        display: "flex", "flex-direction": "column", gap: "12px", cursor: "pointer",
        padding: tokens.spacing.md, "border-radius": tokens.radius.md, position: "relative",
        border: props.isActive ? `2px solid ${tokens.colors.accent.primary}` : `1px solid ${tokens.colors.border.default}`,
        background: props.isActive ? tokens.colors.surface.active : tokens.colors.surface.card,
        transition: tokens.transitions.fast,
      }}
    >
      <Show when={props.isActive}>
        <div style={{
          position: "absolute", top: "8px", right: "8px", width: "20px", height: "20px",
          "border-radius": tokens.radius.full, background: tokens.colors.accent.primary,
          display: "flex", "align-items": "center", "justify-content": "center",
          "font-size": "12px", color: tokens.colors.text.inverse,
        }}>✓</div>
      </Show>
      <div>
        <div style={{ "font-weight": tokens.typography.fontWeight.semibold, "font-size": tokens.typography.fontSize.sm, color: tokens.colors.text.primary, "margin-bottom": "4px" }}>
          {props.theme.name}
        </div>
        <div style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.text.muted }}>
          {props.theme.description}
        </div>
      </div>
      <div style={{ background: tokens.colors.surface.panel, "border-radius": tokens.radius.sm, padding: tokens.spacing.md }}>
        <For each={previews().folders}>
          {(folder, i) => <IconPreviewItem label={folder.name} icon={folder.icon} indent={i() > 0 ? 16 : 0} chevron={folder.open ? "▼" : "▶"} />}
        </For>
        <For each={previews().files}>
          {(file) => <IconPreviewItem label={file.name} icon={file.icon} indent={32} />}
        </For>
      </div>
    </div>
  );
}

export function IconThemePicker() {
  const iconTheme = useIconTheme();
  const [showFullPreview, setShowFullPreview] = createSignal(false);

  const fullPreview = createMemo(() => ({
    files: PREVIEW_FILES.map((name) => ({ name, icon: iconTheme.getFileIcon(name) })),
    folders: PREVIEW_FOLDERS.map((f) => ({ name: f.name, icon: iconTheme.getFolderIcon(f.name, f.open) })),
  }));

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.lg }}>
      <div>
        <div style={{ "font-weight": tokens.typography.fontWeight.semibold, "font-size": tokens.typography.fontSize.lg, color: tokens.colors.text.title, "margin-bottom": "4px" }}>
          File Icon Theme
        </div>
        <div style={{ "font-size": tokens.typography.fontSize.sm, color: tokens.colors.text.muted }}>
          Choose how file and folder icons appear in the explorer
        </div>
      </div>

      <div style={{ display: "grid", "grid-template-columns": "repeat(auto-fill, minmax(280px, 1fr))", gap: tokens.spacing.md }}>
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

      <button
        type="button"
        onClick={() => setShowFullPreview((prev) => !prev)}
        style={{
          display: "flex", "align-items": "center", gap: "6px", background: "transparent",
          border: "none", color: tokens.colors.text.secondary, cursor: "pointer",
          padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`, "border-radius": tokens.radius.sm,
          "font-size": tokens.typography.fontSize.sm, "font-family": tokens.typography.fontFamily.ui,
        }}
      >
        <span style={{ display: "inline-block", transform: showFullPreview() ? "rotate(90deg)" : "rotate(0deg)", transition: tokens.transitions.fast, "font-size": "12px" }}>▶</span>
        {showFullPreview() ? "Hide" : "Show"} full icon preview
      </button>

      <Show when={showFullPreview()}>
        <div style={{ border: `1px solid ${tokens.colors.border.default}`, "border-radius": tokens.radius.md, padding: tokens.spacing.lg, background: tokens.colors.surface.card }}>
          <div style={{ "font-weight": tokens.typography.fontWeight.semibold, "font-size": tokens.typography.fontSize.sm, color: tokens.colors.text.primary, "margin-bottom": tokens.spacing.md }}>
            Preview: {iconTheme.activeTheme().name}
          </div>
          <div style={{ display: "grid", "grid-template-columns": "1fr 1fr", gap: tokens.spacing.lg }}>
            <div>
              <div style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm, "text-transform": "uppercase", "letter-spacing": "0.05em" }}>Folders</div>
              <For each={fullPreview().folders}>
                {(folder) => <IconPreviewItem label={folder.name} icon={folder.icon} indent={0} />}
              </For>
            </div>
            <div>
              <div style={{ "font-size": tokens.typography.fontSize.xs, color: tokens.colors.text.muted, "margin-bottom": tokens.spacing.sm, "text-transform": "uppercase", "letter-spacing": "0.05em" }}>Files</div>
              <For each={fullPreview().files}>
                {(file) => <IconPreviewItem label={file.name} icon={file.icon} indent={0} />}
              </For>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
