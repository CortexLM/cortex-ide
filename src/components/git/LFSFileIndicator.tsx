/**
 * LFS File Indicator - Shows LFS status icon in file explorer
 * 
 * Icons:
 * - Cloud icon: LFS tracked file (content available locally)
 * - Download icon: LFS pointer (content not fetched)
 * - Upload icon: Modified LFS file pending push
 * - Lock icon: File is locked
 */

import { createSignal, createEffect, createMemo } from "solid-js";
import { Icon } from '../ui/Icon';
import { invoke } from "@tauri-apps/api/core";
import { SimpleTooltip } from "@/components/ui";
import { tokens } from "@/design-system/tokens";

// ============================================================================
// Types
// ============================================================================

/** LFS file status types */
export type LFSFileStatus = 
  | "tracked"      // File is tracked and content is available locally
  | "pointer"      // File is a pointer (content not fetched)
  | "modified"     // LFS file has been modified
  | "locked"       // File is locked
  | "locked-other" // File is locked by another user
  | "not-tracked"  // File is not tracked by LFS
  | "unknown";     // Status could not be determined

/** LFS file info returned from backend */
export interface LFSFileInfo {
  /** Whether file is tracked by LFS */
  isTracked: boolean;
  /** Whether file is currently a pointer (not fetched) */
  isPointer: boolean;
  /** Whether file has local modifications */
  isModified: boolean;
  /** Lock information if file is locked */
  lock: {
    id: string;
    owner: string;
    isOurs: boolean;
  } | null;
}

/** Props for LFSFileIndicator */
export interface LFSFileIndicatorProps {
  /** Repository path */
  repoPath: string;
  /** File path relative to repo root */
  filePath: string;
  /** Size variant */
  size?: "sm" | "md";
  /** Whether to show tooltip */
  showTooltip?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional class for styling */
  class?: string;
}

// ============================================================================
// Tauri API
// ============================================================================

/** Cache for LFS file status to avoid repeated API calls */
const statusCache = new Map<string, { info: LFSFileInfo; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

async function getLFSFileInfo(repoPath: string, filePath: string): Promise<LFSFileInfo | null> {
  const cacheKey = `${repoPath}:${filePath}`;
  const cached = statusCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.info;
  }
  
  try {
    const info = await invoke<LFSFileInfo>("git_lfs_file_info", { 
      path: repoPath, 
      filePath 
    });
    statusCache.set(cacheKey, { info, timestamp: Date.now() });
    return info;
  } catch (err) {
    // File might not be in an LFS-enabled repo
    return null;
  }
}

/** Invalidate cache for a specific file or all files in a repo */
export function invalidateLFSCache(repoPath: string, filePath?: string): void {
  if (filePath) {
    statusCache.delete(`${repoPath}:${filePath}`);
  } else {
    // Invalidate all entries for this repo
    for (const key of statusCache.keys()) {
      if (key.startsWith(`${repoPath}:`)) {
        statusCache.delete(key);
      }
    }
  }
}

/** Clear entire LFS cache */
export function clearLFSCache(): void {
  statusCache.clear();
}

// ============================================================================
// Component
// ============================================================================

export function LFSFileIndicator(props: LFSFileIndicatorProps) {
  const [info, setInfo] = createSignal<LFSFileInfo | null>(null);
  const [loading, setLoading] = createSignal(true);

  // Load file info
  createEffect(() => {
    setLoading(true);
    getLFSFileInfo(props.repoPath, props.filePath)
      .then(setInfo)
      .finally(() => setLoading(false));
  });

  // Determine status
  const status = createMemo((): LFSFileStatus => {
    const i = info();
    if (!i || !i.isTracked) return "not-tracked";
    if (i.lock) {
      return i.lock.isOurs ? "locked" : "locked-other";
    }
    if (i.isModified) return "modified";
    if (i.isPointer) return "pointer";
    return "tracked";
  });

  // Get icon based on status
  const getIcon = () => {
    const size = props.size === "sm" ? "12px" : "14px";
    
    if (loading()) {
      return (
        <Icon
          name="spinner"
          style={{
            width: size,
            height: size,
            animation: "spin 1s linear infinite",
            color: tokens.colors.icon.default,
          }}
        />
      );
    }

    switch (status()) {
      case "tracked":
        return (
          <Icon
            name="cloud"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.success,
            }}
          />
        );
      case "pointer":
        return (
          <Icon
            name="download"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.warning,
            }}
          />
        );
      case "modified":
        return (
          <Icon
            name="upload"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.primary,
            }}
          />
        );
      case "locked":
        return (
          <Icon
            name="lock"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.success,
            }}
          />
        );
      case "locked-other":
        return (
          <Icon
            name="lock"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.error,
            }}
          />
        );
      default:
        return null;
    }
  };

  // Get tooltip text
  const getTooltipText = (): string => {
    const i = info();
    switch (status()) {
      case "tracked":
        return "LFS tracked (local)";
      case "pointer":
        return "LFS pointer (not fetched)";
      case "modified":
        return "LFS file modified";
      case "locked":
        return "Locked by you";
      case "locked-other":
        return `Locked by ${i?.lock?.owner || "another user"}`;
      default:
        return "";
    }
  };

  // Don't render if not tracked
  if (status() === "not-tracked" && !loading()) {
    return null;
  }

  const icon = getIcon();
  
  // Return nothing if no icon to show
  if (!icon) return null;

  const indicator = (
    <span
      class={props.class}
      style={{
        display: "inline-flex",
        "align-items": "center",
        "justify-content": "center",
        cursor: props.onClick ? "pointer" : "default",
      }}
      onClick={(e) => {
        if (props.onClick) {
          e.stopPropagation();
          props.onClick();
        }
      }}
    >
      {icon}
    </span>
  );

  // Wrap with tooltip if enabled
  if (props.showTooltip !== false && status() !== "not-tracked") {
    return (
      <SimpleTooltip text={getTooltipText()}>
        {indicator}
      </SimpleTooltip>
    );
  }

  return indicator;
}

// ============================================================================
// Batch Status Component
// ============================================================================

/** Props for batch LFS indicator that shows overall status for a directory */
export interface LFSDirectoryIndicatorProps {
  /** Repository path */
  repoPath: string;
  /** Directory path relative to repo root */
  dirPath: string;
  /** Size variant */
  size?: "sm" | "md";
}

/** Directory LFS summary */
interface LFSDirSummary {
  totalFiles: number;
  pointerFiles: number;
  lockedFiles: number;
}

export function LFSDirectoryIndicator(props: LFSDirectoryIndicatorProps) {
  const [summary, setSummary] = createSignal<LFSDirSummary | null>(null);
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    setLoading(true);
    invoke<LFSDirSummary>("git_lfs_dir_summary", {
      path: props.repoPath,
      dirPath: props.dirPath,
    })
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  });

  // Don't show anything if no LFS files
  if (!loading() && (!summary() || summary()!.totalFiles === 0)) {
    return null;
  }

  const size = props.size === "sm" ? "12px" : "14px";

  if (loading()) {
    return (
      <Icon
        name="spinner"
        style={{
          width: size,
          height: size,
          animation: "spin 1s linear infinite",
          color: tokens.colors.icon.default,
        }}
      />
    );
  }

  const s = summary()!;

  // Show warning if there are pointer files
  if (s.pointerFiles > 0) {
    return (
      <SimpleTooltip text={`${s.pointerFiles} LFS files not fetched`}>
        <span style={{ display: "inline-flex", "align-items": "center" }}>
          <Icon
            name="download"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.warning,
            }}
          />
        </span>
      </SimpleTooltip>
    );
  }

  // Show lock icon if there are locked files
  if (s.lockedFiles > 0) {
    return (
      <SimpleTooltip text={`${s.lockedFiles} locked files`}>
        <span style={{ display: "inline-flex", "align-items": "center" }}>
          <Icon
            name="lock"
            style={{
              width: size,
              height: size,
              color: tokens.colors.semantic.warning,
            }}
          />
        </span>
      </SimpleTooltip>
    );
  }

  // Show cloud icon for fully synced LFS directory
  return (
    <SimpleTooltip text={`${s.totalFiles} LFS files`}>
      <span style={{ display: "inline-flex", "align-items": "center" }}>
        <Icon
          name="cloud"
          style={{
            width: size,
            height: size,
            color: tokens.colors.semantic.success,
            opacity: 0.7,
          }}
        />
      </span>
    </SimpleTooltip>
  );
}

export default LFSFileIndicator;
