/**
 * LFS Track Dialog - Dialog for tracking new file patterns with Git LFS
 * 
 * Features:
 * - Pattern input with examples
 * - Matching files preview
 * - Migrate existing files option
 * - Common patterns quick-select
 */

import { createSignal, createEffect, For, Show, createMemo } from "solid-js";
import { Icon } from '../ui/Icon';
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Input,
  Text,
  Modal,
  Badge,
  Checkbox,
  ListItem,
} from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

/** Props for LFSTrackDialog */
export interface LFSTrackDialogProps {
  /** Whether dialog is open */
  open: boolean;
  /** Repository path */
  repoPath: string;
  /** Suggested pattern (e.g., based on a file selection) */
  suggestedPattern?: string;
  /** Callback when pattern is tracked */
  onTrack: (pattern: string, migrate: boolean) => void;
  /** Callback when dialog is cancelled */
  onCancel: () => void;
}

/** Matching file information */
interface MatchingFile {
  path: string;
  size: number;
  alreadyTracked: boolean;
}

// ============================================================================
// Common Patterns
// ============================================================================

interface PatternCategory {
  name: string;
  patterns: Array<{
    pattern: string;
    description: string;
  }>;
}

const COMMON_PATTERNS: PatternCategory[] = [
  {
    name: "Images",
    patterns: [
      { pattern: "*.psd", description: "Photoshop files" },
      { pattern: "*.ai", description: "Illustrator files" },
      { pattern: "*.sketch", description: "Sketch files" },
      { pattern: "*.fig", description: "Figma files" },
      { pattern: "*.png", description: "PNG images" },
      { pattern: "*.jpg", description: "JPEG images" },
      { pattern: "*.gif", description: "GIF images" },
      { pattern: "*.tiff", description: "TIFF images" },
      { pattern: "*.bmp", description: "Bitmap images" },
      { pattern: "*.raw", description: "RAW images" },
    ],
  },
  {
    name: "Video",
    patterns: [
      { pattern: "*.mp4", description: "MP4 video" },
      { pattern: "*.mov", description: "QuickTime video" },
      { pattern: "*.avi", description: "AVI video" },
      { pattern: "*.mkv", description: "Matroska video" },
      { pattern: "*.webm", description: "WebM video" },
    ],
  },
  {
    name: "Audio",
    patterns: [
      { pattern: "*.mp3", description: "MP3 audio" },
      { pattern: "*.wav", description: "WAV audio" },
      { pattern: "*.flac", description: "FLAC audio" },
      { pattern: "*.aac", description: "AAC audio" },
      { pattern: "*.ogg", description: "OGG audio" },
    ],
  },
  {
    name: "Archives",
    patterns: [
      { pattern: "*.zip", description: "ZIP archive" },
      { pattern: "*.tar.gz", description: "Gzipped tarball" },
      { pattern: "*.7z", description: "7-Zip archive" },
      { pattern: "*.rar", description: "RAR archive" },
    ],
  },
  {
    name: "3D & CAD",
    patterns: [
      { pattern: "*.fbx", description: "FBX 3D model" },
      { pattern: "*.obj", description: "OBJ 3D model" },
      { pattern: "*.blend", description: "Blender files" },
      { pattern: "*.max", description: "3ds Max files" },
      { pattern: "*.dwg", description: "AutoCAD files" },
      { pattern: "*.stl", description: "STL 3D model" },
    ],
  },
  {
    name: "Documents",
    patterns: [
      { pattern: "*.pdf", description: "PDF documents" },
      { pattern: "*.docx", description: "Word documents" },
      { pattern: "*.xlsx", description: "Excel spreadsheets" },
      { pattern: "*.pptx", description: "PowerPoint presentations" },
    ],
  },
  {
    name: "Data",
    patterns: [
      { pattern: "*.sqlite", description: "SQLite database" },
      { pattern: "*.db", description: "Database files" },
      { pattern: "*.csv", description: "CSV data" },
      { pattern: "*.parquet", description: "Parquet data" },
    ],
  },
  {
    name: "Binaries",
    patterns: [
      { pattern: "*.exe", description: "Windows executable" },
      { pattern: "*.dll", description: "Windows library" },
      { pattern: "*.so", description: "Linux library" },
      { pattern: "*.dylib", description: "macOS library" },
      { pattern: "*.wasm", description: "WebAssembly" },
    ],
  },
];

// ============================================================================
// Tauri API
// ============================================================================

async function previewLFSTrack(repoPath: string, pattern: string): Promise<MatchingFile[]> {
  try {
    return await invoke<MatchingFile[]>("git_lfs_track_preview", { path: repoPath, pattern });
  } catch (err) {
    console.error("[LFS] Preview track failed:", err);
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

function isValidPattern(pattern: string): boolean {
  // Basic validation - pattern should have some content
  if (!pattern.trim()) return false;
  // Should contain at least a valid glob character or exact filename
  if (pattern.includes("/") && !pattern.includes("*")) {
    // If it has a path, it should be a valid path pattern
    return true;
  }
  // Common patterns like *.ext, foo.*, etc.
  return pattern.length > 0;
}

// ============================================================================
// Component
// ============================================================================

export function LFSTrackDialog(props: LFSTrackDialogProps) {
  const [pattern, setPattern] = createSignal(props.suggestedPattern || "");
  const [migrateExisting, setMigrateExisting] = createSignal(true);
  const [matchingFiles, setMatchingFiles] = createSignal<MatchingFile[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [showCommonPatterns, setShowCommonPatterns] = createSignal(false);
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);

  // Reset state when dialog opens
  createEffect(() => {
    if (props.open) {
      setPattern(props.suggestedPattern || "");
      setMigrateExisting(true);
      setMatchingFiles([]);
      setShowCommonPatterns(false);
      setSelectedCategory(null);
    }
  });

  // Preview matching files when pattern changes (debounced)
  let previewTimeout: ReturnType<typeof setTimeout> | null = null;
  
  createEffect(() => {
    const currentPattern = pattern();
    
    if (previewTimeout) {
      clearTimeout(previewTimeout);
    }
    
    if (!currentPattern.trim() || !props.open) {
      setMatchingFiles([]);
      return;
    }
    
    previewTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const files = await previewLFSTrack(props.repoPath, currentPattern);
        setMatchingFiles(files);
      } catch (err) {
        console.error("[LFS] Preview failed:", err);
        setMatchingFiles([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  });

  // Computed values
  const isValidPatternValue = createMemo(() => isValidPattern(pattern()));
  
  const newFilesCount = createMemo(() => 
    matchingFiles().filter(f => !f.alreadyTracked).length
  );
  
  const totalSize = createMemo(() => 
    matchingFiles().reduce((sum, f) => sum + f.size, 0)
  );

  const handleSubmit = () => {
    if (isValidPatternValue()) {
      props.onTrack(pattern(), migrateExisting());
    }
  };

  const handlePatternSelect = (selectedPattern: string) => {
    setPattern(selectedPattern);
    setShowCommonPatterns(false);
    setSelectedCategory(null);
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onCancel}
      title="Track Pattern with Git LFS"
      size="md"
      footer={
        <div style={{ display: "flex", gap: tokens.spacing.sm }}>
          <Button variant="ghost" onClick={props.onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValidPatternValue() || loading()}
          >
            Track Pattern
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
        {/* Pattern input */}
        <div>
          <label
            style={{
              display: "block",
              "font-size": "12px",
              "font-weight": "500",
              "margin-bottom": "6px",
              color: tokens.colors.text.primary,
            }}
          >
            File Pattern
          </label>
          <Input
            value={pattern()}
            onInput={(e) => setPattern(e.currentTarget.value)}
            placeholder="e.g., *.psd, assets/*.png, data/**/*.bin"
            autofocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && isValidPatternValue()) {
                handleSubmit();
              }
            }}
          />
          <Text
            style={{
              display: "block",
              "font-size": "11px",
              "margin-top": "4px",
              color: tokens.colors.text.muted,
            }}
          >
            Use glob patterns: * matches any characters, ** matches directories
          </Text>
        </div>

        {/* Common patterns toggle */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCommonPatterns(!showCommonPatterns())}
            style={{ "padding-left": "0" }}
          >
            {showCommonPatterns() ? "Hide" : "Show"} common patterns
          </Button>

          <Show when={showCommonPatterns()}>
            <div
              style={{
                "margin-top": "8px",
                padding: "8px",
                background: tokens.colors.surface.panel,
                "border-radius": tokens.radius.md,
                border: `1px solid ${tokens.colors.border.divider}`,
              }}
            >
              {/* Category selector */}
              <div
                style={{
                  display: "flex",
                  "flex-wrap": "wrap",
                  gap: "4px",
                  "margin-bottom": "8px",
                }}
              >
                <For each={COMMON_PATTERNS}>
                  {(category) => (
                    <Button
                      variant={selectedCategory() === category.name ? "primary" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedCategory(
                        selectedCategory() === category.name ? null : category.name
                      )}
                      style={{ "font-size": "11px" }}
                    >
                      {category.name}
                    </Button>
                  )}
                </For>
              </div>

              {/* Pattern list for selected category */}
              <Show when={selectedCategory()}>
                <div
                  style={{
                    display: "grid",
                    "grid-template-columns": "repeat(2, 1fr)",
                    gap: "4px",
                    "max-height": "150px",
                    "overflow-y": "auto",
                  }}
                >
                  <For each={COMMON_PATTERNS.find(c => c.name === selectedCategory())?.patterns || []}>
                    {(p) => (
                      <button
                        type="button"
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "6px",
                          padding: "6px 8px",
                          background: "transparent",
                          border: `1px solid ${tokens.colors.border.divider}`,
                          "border-radius": tokens.radius.sm,
                          cursor: "pointer",
                          "text-align": "left",
                          transition: "background var(--cortex-transition-fast)",
                        }}
                        onClick={() => handlePatternSelect(p.pattern)}
                        onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.interactive.hover}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <code
                          style={{
                            "font-size": "11px",
                            "font-family": "monospace",
                            color: tokens.colors.semantic.primary,
                          }}
                        >
                          {p.pattern}
                        </code>
                        <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                          {p.description}
                        </Text>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Migrate option */}
        <div
          style={{
            padding: "12px",
            background: tokens.colors.surface.panel,
            "border-radius": tokens.radius.md,
            border: `1px solid ${tokens.colors.border.divider}`,
          }}
        >
          <Checkbox
            checked={migrateExisting()}
            onChange={setMigrateExisting}
            label="Migrate existing files"
          />
          <Text
            style={{
              display: "block",
              "font-size": "11px",
              "margin-top": "4px",
              "margin-left": "24px",
              color: tokens.colors.text.muted,
            }}
          >
            Convert existing matching files to LFS. This rewrites history and
            requires force-pushing if the branch has been pushed.
          </Text>
        </div>

        {/* Preview section */}
        <div>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              "margin-bottom": "8px",
            }}
          >
            <Text style={{ "font-size": "12px", "font-weight": "500", color: tokens.colors.text.primary }}>
              Matching Files
            </Text>
            <Show when={loading()}>
              <Icon
                name="spinner"
                style={{
                  width: "14px",
                  height: "14px",
                  animation: "spin 1s linear infinite",
                  color: tokens.colors.icon.default,
                }}
              />
            </Show>
            <Show when={!loading() && matchingFiles().length > 0}>
              <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                <Badge variant="default" size="sm">
                  {matchingFiles().length} files
                </Badge>
                <Badge variant="default" size="sm">
                  {formatBytes(totalSize())}
                </Badge>
              </div>
            </Show>
          </div>

          <div
            style={{
              "max-height": "200px",
              "overflow-y": "auto",
              border: `1px solid ${tokens.colors.border.divider}`,
              "border-radius": tokens.radius.md,
              background: tokens.colors.surface.panel,
            }}
          >
            <Show
              when={matchingFiles().length > 0}
              fallback={
                <div style={{ padding: "24px", "text-align": "center" }}>
                  <Show
                    when={pattern().trim()}
                    fallback={
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        Enter a pattern to see matching files
                      </Text>
                    }
                  >
                    <Show
                      when={!loading()}
                      fallback={
                        <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                          Searching...
                        </Text>
                      }
                    >
                      <Text style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        No matching files found
                      </Text>
                    </Show>
                  </Show>
                </div>
              }
            >
              <For each={matchingFiles()}>
                {(file) => (
                  <ListItem
                    icon={
                      file.alreadyTracked ? (
                        <Icon name="check" style={{ width: "14px", height: "14px", color: tokens.colors.semantic.success }} />
                      ) : (
                        <Icon name="file" style={{ width: "14px", height: "14px", color: tokens.colors.icon.default }} />
                      )
                    }
                    label={getFileName(file.path)}
                    description={file.path}
                    iconRight={
                      <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.sm }}>
                        <Text style={{ "font-size": "10px", color: tokens.colors.text.muted }}>
                          {formatBytes(file.size)}
                        </Text>
                        <Show when={file.alreadyTracked}>
                          <Badge variant="success" size="sm">Tracked</Badge>
                        </Show>
                      </div>
                    }
                  />
                )}
              </For>
            </Show>
          </div>

          {/* Info message if files will be migrated */}
          <Show when={migrateExisting() && newFilesCount() > 0}>
            <div
              style={{
                display: "flex",
                "align-items": "flex-start",
                gap: tokens.spacing.sm,
                "margin-top": "8px",
                padding: "8px 12px",
                background: `color-mix(in srgb, ${tokens.colors.semantic.warning} 10%, transparent)`,
                "border-radius": tokens.radius.md,
              }}
            >
              <Icon
                name="triangle-exclamation"
                style={{
                  width: "14px",
                  height: "14px",
                  "flex-shrink": "0",
                  "margin-top": "2px",
                  color: tokens.colors.semantic.warning,
                }}
              />
              <Text style={{ "font-size": "11px", color: tokens.colors.semantic.warning }}>
                {newFilesCount()} file{newFilesCount() !== 1 ? "s" : ""} will be converted to LFS.
                This modifies git history.
              </Text>
            </div>
          </Show>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  );
}

export default LFSTrackDialog;
