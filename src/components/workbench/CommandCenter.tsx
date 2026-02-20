/**
 * =============================================================================
 * COMMAND CENTER COMPONENT - VS Code Style Title Bar Search
 * =============================================================================
 * 
 * A styled search bar component for the title bar that provides:
 * - Quick access to files (Ctrl+P)
 * - Command palette integration (Ctrl+Shift+P)
 * - Workspace/file name display
 * - Recent commands dropdown
 * - Search mode integration
 * - Optional breadcrumbs navigation
 * 
 * Based on VS Code's Command Center feature in the title bar.
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  onMount,
  onCleanup,
  Show,
  For,
  type Component,
  type JSX,
} from "solid-js";
import { tokens } from "@/design-system/tokens";
import type { CommandCenterState } from "@/types/workbench";
import { Icon } from '../ui/Icon';

// =============================================================================
// TYPES
// =============================================================================

export interface CommandCenterProps {
  /** Current workspace name */
  workspaceName?: string;
  /** Current file name */
  currentFileName?: string;
  /** Current file path for breadcrumbs */
  currentFilePath?: string;
  /** Git branch name */
  gitBranch?: string;
  /** Show breadcrumbs instead of workspace name */
  showBreadcrumbs?: boolean;
  /** Recent commands for dropdown */
  recentCommands?: RecentCommand[];
  /** Pinned commands */
  pinnedCommands?: RecentCommand[];
  /** Callback when quick open is requested (Ctrl+P) */
  onQuickOpen?: () => void;
  /** Callback when command palette is requested (Ctrl+Shift+P) */
  onCommandPalette?: () => void;
  /** Callback when search is requested */
  onSearch?: () => void;
  /** Callback when a recent command is selected */
  onRecentCommandSelect?: (commandId: string) => void;
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export interface RecentCommand {
  /** Command identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon name (codicon) */
  icon?: string;
  /** Keyboard shortcut display */
  keybinding?: string;
  /** Category for grouping */
  category?: string;
}

export interface BreadcrumbSegment {
  /** Segment identifier */
  id: string;
  /** Display label */
  label: string;
  /** Segment type for icon */
  type: 'folder' | 'file' | 'symbol';
  /** Click handler */
  onClick?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COMMAND_CENTER_MIN_WIDTH = 200;
const COMMAND_CENTER_MAX_WIDTH = 600;
const DROPDOWN_MAX_HEIGHT = 300;

// =============================================================================
// COMMAND CENTER COMPONENT
// =============================================================================

export const CommandCenter: Component<CommandCenterProps> = (props) => {
  // State
  const [isHovered, setIsHovered] = createSignal(false);
  const [isFocused, setIsFocused] = createSignal(false);
  const [showDropdown, setShowDropdown] = createSignal(false);
  
  // Refs
  let containerRef: HTMLDivElement | undefined;

  // Computed values
  const displayText = createMemo(() => {
    if (props.currentFileName) {
      return props.currentFileName;
    }
    if (props.workspaceName) {
      return props.workspaceName;
    }
    return "Search files and commands...";
  });

  const hasRecentCommands = createMemo(() => {
    return (props.recentCommands && props.recentCommands.length > 0) ||
           (props.pinnedCommands && props.pinnedCommands.length > 0);
  });

  // Parse breadcrumbs from file path
  const breadcrumbs = createMemo((): BreadcrumbSegment[] => {
    if (!props.showBreadcrumbs || !props.currentFilePath) {
      return [];
    }
    
    const segments = props.currentFilePath.replace(/\\/g, '/').split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      id: `segment-${index}`,
      label: segment,
      type: index === segments.length - 1 ? 'file' : 'folder',
    }));
  });

  // Event handlers
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    
    // Toggle dropdown on click if we have recent commands
    if (hasRecentCommands()) {
      setShowDropdown(!showDropdown());
    } else {
      // Otherwise, open quick open directly
      props.onQuickOpen?.();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      props.onQuickOpen?.();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleRecentCommandClick = (command: RecentCommand) => {
    setShowDropdown(false);
    props.onRecentCommandSelect?.(command.id);
  };

  const handleQuickOpenClick = (e: MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    props.onQuickOpen?.();
  };

  const handleCommandPaletteClick = (e: MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    props.onCommandPalette?.();
  };

  const handleSearchClick = (e: MouseEvent) => {
    e.stopPropagation();
    setShowDropdown(false);
    props.onSearch?.();
  };

  // Close dropdown on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  };

  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
    
    // Listen for keyboard shortcuts
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P - Quick Open
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        // Don't prevent default here, let the main handler handle it
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    onCleanup(() => {
      document.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    });
  });

  // Styles
  const containerStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    flex: "1",
    height: "100%",
    "min-width": "0",
    "pointer-events": "none",
    ...props.style,
  });

  const buttonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.sm,
    width: `clamp(${COMMAND_CENTER_MIN_WIDTH}px, 45%, ${COMMAND_CENTER_MAX_WIDTH}px)`,
    height: "24px",
    padding: `0 ${tokens.spacing.md}`,
    background: isHovered() || isFocused() || showDropdown()
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${
      isHovered() || isFocused() || showDropdown()
        ? "rgba(255, 255, 255, 0.18)"
        : "rgba(255, 255, 255, 0.08)"
    }`,
    "border-radius": tokens.radius.sm,
    color: tokens.colors.text.muted,
    "font-size": "12px",
    "font-family": tokens.typography.fontFamily.ui,
    cursor: "pointer",
    transition: "all 150ms ease",
    "pointer-events": "auto",
    outline: "none",
  });

  const searchIconStyle: JSX.CSSProperties = {
    width: "13px",
    height: "13px",
    "flex-shrink": "0",
    opacity: "0.8",
  };

  const textStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
    "text-align": "left",
  };

  const keybindingStyle: JSX.CSSProperties = {
    "margin-left": "auto",
    padding: "2px 5px",
    "font-size": "10px",
    "font-family": tokens.typography.fontFamily.mono,
    background: "rgba(255, 255, 255, 0.08)",
    "border-radius": "var(--cortex-radius-sm)",
    color: tokens.colors.text.muted,
    "flex-shrink": "0",
  };

  return (
    <div
      ref={containerRef}
      class={`command-center ${props.class || ""}`}
      data-tauri-drag-region
      style={containerStyle()}
    >
      <button
        class="command-center-button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={buttonStyle()}
        aria-haspopup={hasRecentCommands() ? "true" : undefined}
        aria-expanded={showDropdown() ? "true" : "false"}
        title="Search files and commands (Ctrl+P)"
      >
        <Icon name="magnifying-glass" style={searchIconStyle} />
        
        <Show
          when={props.showBreadcrumbs && breadcrumbs().length > 0}
          fallback={
            <span style={textStyle}>
              {displayText()}
            </span>
          }
        >
          <CommandCenterBreadcrumbs segments={breadcrumbs()} />
        </Show>
        
        <kbd style={keybindingStyle}>Ctrl+P</kbd>
      </button>

      {/* Dropdown for recent commands */}
      <Show when={showDropdown() && hasRecentCommands()}>
        <CommandCenterDropdown
          recentCommands={props.recentCommands || []}
          pinnedCommands={props.pinnedCommands || []}
          onCommandSelect={handleRecentCommandClick}
          onQuickOpen={handleQuickOpenClick}
          onCommandPalette={handleCommandPaletteClick}
          onSearch={handleSearchClick}
        />
      </Show>
    </div>
  );
};

// =============================================================================
// BREADCRUMBS SUBCOMPONENT
// =============================================================================

interface CommandCenterBreadcrumbsProps {
  segments: BreadcrumbSegment[];
}

const CommandCenterBreadcrumbs: Component<CommandCenterBreadcrumbsProps> = (props) => {
  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "2px",
    flex: "1",
    "min-width": "0",
    overflow: "hidden",
  };

  const segmentStyle = (isLast: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "3px",
    color: isLast ? tokens.colors.text.primary : tokens.colors.text.muted,
    "font-weight": isLast ? "500" : "400",
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
  });

  const separatorStyle: JSX.CSSProperties = {
    color: tokens.colors.text.muted,
    opacity: "0.5",
    "flex-shrink": "0",
  };

  const iconStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    "flex-shrink": "0",
    opacity: "0.7",
  };

  // Only show last 3 segments for space
  const visibleSegments = () => {
    if (props.segments.length <= 3) {
      return props.segments;
    }
    return [
      { ...props.segments[0], label: '...' },
      ...props.segments.slice(-2),
    ];
  };

  return (
    <div style={containerStyle}>
      <For each={visibleSegments()}>
        {(segment, index) => (
          <>
            <Show when={index() > 0}>
              <Icon name="chevron-right" style={separatorStyle} />
            </Show>
            <span
              style={segmentStyle(index() === visibleSegments().length - 1)}
              onClick={(e) => {
                e.stopPropagation();
                segment.onClick?.();
              }}
            >
              <Show when={segment.type === 'folder'}>
                <Icon name="folder" style={iconStyle} />
              </Show>
              <Show when={segment.type === 'file'}>
                <Icon name="file" style={iconStyle} />
              </Show>
              {segment.label}
            </span>
          </>
        )}
      </For>
    </div>
  );
};

// =============================================================================
// DROPDOWN SUBCOMPONENT
// =============================================================================

interface CommandCenterDropdownProps {
  recentCommands: RecentCommand[];
  pinnedCommands: RecentCommand[];
  onCommandSelect: (command: RecentCommand) => void;
  onQuickOpen: (e: MouseEvent) => void;
  onCommandPalette: (e: MouseEvent) => void;
  onSearch: (e: MouseEvent) => void;
}

const CommandCenterDropdown: Component<CommandCenterDropdownProps> = (props) => {
  const [hoveredId, setHoveredId] = createSignal<string | null>(null);

  const dropdownStyle: JSX.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: "50%",
    transform: "translateX(-50%)",
    width: `clamp(${COMMAND_CENTER_MIN_WIDTH}px, 45%, ${COMMAND_CENTER_MAX_WIDTH}px)`,
    "max-height": `${DROPDOWN_MAX_HEIGHT}px`,
    overflow: "auto",
    background: tokens.colors.surface.modal,
    border: `1px solid ${tokens.colors.border.default}`,
    "border-radius": tokens.radius.md,
    "box-shadow": tokens.shadows.lg,
    "z-index": tokens.zIndex.dropdown,
    "pointer-events": "auto",
  };

  const sectionStyle: JSX.CSSProperties = {
    padding: tokens.spacing.sm,
  };

  const sectionTitleStyle: JSX.CSSProperties = {
    "font-size": "10px",
    "font-weight": "600",
    "text-transform": "uppercase",
    "letter-spacing": "0.5px",
    color: tokens.colors.text.muted,
    padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
    "margin-bottom": tokens.spacing.xs,
  };

  const itemStyle = (isHovered: boolean): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: tokens.spacing.sm,
    padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
    "border-radius": tokens.radius.sm,
    cursor: "pointer",
    background: isHovered ? tokens.colors.interactive.hover : "transparent",
    color: isHovered ? tokens.colors.text.primary : tokens.colors.text.secondary,
    transition: "background 100ms ease, color 100ms ease",
  });

  const iconContainerStyle: JSX.CSSProperties = {
    width: "16px",
    height: "16px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    "flex-shrink": "0",
  };

  const labelStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
    "font-size": "12px",
  };

  const keybindingItemStyle: JSX.CSSProperties = {
    "font-size": "10px",
    "font-family": tokens.typography.fontFamily.mono,
    color: tokens.colors.text.muted,
    padding: "2px 4px",
    background: "rgba(255, 255, 255, 0.06)",
    "border-radius": "var(--cortex-radius-sm)",
  };

  const dividerStyle: JSX.CSSProperties = {
    height: "1px",
    background: tokens.colors.border.divider,
    margin: `${tokens.spacing.sm} 0`,
  };

  return (
    <div style={dropdownStyle}>
      {/* Quick Actions */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Quick Actions</div>
        
        {/* Quick Open */}
        <div
          style={itemStyle(hoveredId() === 'quick-open')}
          onMouseEnter={() => setHoveredId('quick-open')}
          onMouseLeave={() => setHoveredId(null)}
          onClick={props.onQuickOpen}
        >
          <span style={iconContainerStyle}>
            <Icon name="file" style={{ width: "14px", height: "14px" }} />
          </span>
          <span style={labelStyle}>Go to File...</span>
          <span style={keybindingItemStyle}>Ctrl+P</span>
        </div>
        
        {/* Command Palette */}
        <div
          style={itemStyle(hoveredId() === 'command-palette')}
          onMouseEnter={() => setHoveredId('command-palette')}
          onMouseLeave={() => setHoveredId(null)}
          onClick={props.onCommandPalette}
        >
          <span style={iconContainerStyle}>
            <Icon name="command" style={{ width: "14px", height: "14px" }} />
          </span>
          <span style={labelStyle}>Show All Commands</span>
          <span style={keybindingItemStyle}>Ctrl+Shift+P</span>
        </div>
        
        {/* Search */}
        <div
          style={itemStyle(hoveredId() === 'search')}
          onMouseEnter={() => setHoveredId('search')}
          onMouseLeave={() => setHoveredId(null)}
          onClick={props.onSearch}
        >
          <span style={iconContainerStyle}>
            <Icon name="magnifying-glass" style={{ width: "14px", height: "14px" }} />
          </span>
          <span style={labelStyle}>Search in Files...</span>
          <span style={keybindingItemStyle}>Ctrl+Shift+F</span>
        </div>
      </div>

      {/* Pinned Commands */}
      <Show when={props.pinnedCommands.length > 0}>
        <div style={dividerStyle} />
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Pinned</div>
          <For each={props.pinnedCommands}>
            {(command) => (
              <div
                style={itemStyle(hoveredId() === `pinned-${command.id}`)}
                onMouseEnter={() => setHoveredId(`pinned-${command.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => props.onCommandSelect(command)}
              >
                <span style={iconContainerStyle}>
                  <Icon name="command" style={{ width: "14px", height: "14px" }} />
                </span>
                <span style={labelStyle}>{command.label}</span>
                <Show when={command.keybinding}>
                  <span style={keybindingItemStyle}>{command.keybinding}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Recent Commands */}
      <Show when={props.recentCommands.length > 0}>
        <div style={dividerStyle} />
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Recent</div>
          <For each={props.recentCommands.slice(0, 5)}>
            {(command) => (
              <div
                style={itemStyle(hoveredId() === `recent-${command.id}`)}
                onMouseEnter={() => setHoveredId(`recent-${command.id}`)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => props.onCommandSelect(command)}
              >
                <span style={iconContainerStyle}>
                  <Icon name="clock" style={{ width: "14px", height: "14px", opacity: "0.7" }} />
                </span>
                <span style={labelStyle}>
                  <Show when={command.category}>
                    <span style={{ opacity: "0.6" }}>{command.category}: </span>
                  </Show>
                  {command.label}
                </span>
                <Show when={command.keybinding}>
                  <span style={keybindingItemStyle}>{command.keybinding}</span>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

// =============================================================================
// STANDALONE SEARCH BAR (Alternative simpler version)
// =============================================================================

export interface SearchBarProps {
  /** Placeholder text */
  placeholder?: string;
  /** Workspace name to display */
  workspaceName?: string;
  /** Click handler */
  onClick?: () => void;
  /** Custom class */
  class?: string;
}

/**
 * Simple search bar for title bar without dropdown functionality.
 * Use this for a simpler implementation.
 */
export const SearchBar: Component<SearchBarProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const style = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.sm,
    width: "clamp(200px, 40%, 480px)",
    height: "22px",
    padding: `0 ${tokens.spacing.md}`,
    background: isHovered()
      ? "rgba(255, 255, 255, 0.07)"
      : "rgba(255, 255, 255, 0.04)",
    border: `1px solid ${
      isHovered()
        ? "rgba(255, 255, 255, 0.15)"
        : "rgba(255, 255, 255, 0.08)"
    }`,
    "border-radius": tokens.radius.sm,
    color: tokens.colors.text.muted,
    "font-size": "11px",
    cursor: "text",
    transition: "all 150ms ease",
    "pointer-events": "auto",
  });

  return (
    <button
      class={`search-bar ${props.class || ""}`}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style()}
    >
      <Icon
        name="magnifying-glass"
        style={{ width: "12px", height: "12px", "flex-shrink": "0" }}
      />
      <span
        style={{
          overflow: "hidden",
          "text-overflow": "ellipsis",
          "white-space": "nowrap",
        }}
      >
        {props.workspaceName || props.placeholder || "Search files and commands..."}
      </span>
      <kbd
        style={{
          "margin-left": "auto",
          padding: "1px 4px",
          "font-size": "10px",
          "font-family": tokens.typography.fontFamily.mono,
          background: "rgba(255, 255, 255, 0.08)",
          "border-radius": "var(--cortex-radius-sm)",
          color: tokens.colors.text.muted,
        }}
      >
        Ctrl+P
      </kbd>
    </button>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default CommandCenter;
export type { CommandCenterState };

