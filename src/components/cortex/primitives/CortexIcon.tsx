/**
 * CortexIcon - Pixel-perfect icon wrapper for Cortex UI Design System
 * Uses the existing Icon component with Font Awesome Pro icons
 */

import { Component, JSX, splitProps } from "solid-js";
import { Icon } from "../../ui/Icon";

// Icon size tokens from Cortex UI specs
export const CORTEX_ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
} as const;

export type CortexIconSize = keyof typeof CORTEX_ICON_SIZES | number;

export interface CortexIconProps {
  name: string;
  size?: CortexIconSize;
  color?: string;
  class?: string;
  style?: JSX.CSSProperties;
  onClick?: (e: MouseEvent) => void;
}

// Map Figma design icon names to Font Awesome icon names
const ICON_NAME_MAP: Record<string, string> = {
  // Navigation
  home: "house",
  house: "house",
  plus: "plus",
  "circle-plus": "circle-plus",
  folder: "folder",
  "folder-open": "folder-open",
  "code-branch": "code-branch",
  git: "code-branch",
  play: "play",
  "play-circle": "circle-play",
  box: "box",
  cube: "cube",
  users: "users",
  "grid-2": "grid-2",
  grid: "grid-2",
  book: "book",
  "book-open": "book-open",
  map: "map",
  paintbrush: "paintbrush",
  brush: "paintbrush",
  settings: "gear",
  gear: "gear",
  
  // Actions
  menu: "bars", // Hamburger menu icon
  bars: "bars",
  search: "magnifying-glass",
  "search-sm": "magnifying-glass",
  refresh: "arrows-rotate",
  "refresh-cw": "arrows-rotate",
  "refresh-cw-02": "arrows-rotate",
  "rotate-cw": "arrows-rotate",
  "chevron-down": "chevron-down",
  "chevron-up": "chevron-up",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",
  "chevron-up-double": "chevrons-up",
  "x-close": "xmark",
  x: "xmark",
  close: "xmark",
  minus: "minus",
  copy: "copy",
  "copy-06": "copy",
  maximize: "expand",
  minimize: "compress",
  
  // Theme
  sun: "sun",
  moon: "moon",
  
  // Files
  file: "file",
  "file-text": "file-lines",
  "file-code": "file-code",
  
  // Communication
  send: "paper-plane",
  "paper-plane": "paper-plane",
  upload: "upload",
  "corner-up-left": "arrow-turn-up",
  undo: "arrow-turn-up",
  
  // Status
  check: "check",
  "check-circle": "circle-check",
  star: "star",
  "star-05": "star",
  stop: "stop",
  square: "square",
  "info-circle": "circle-info",
  info: "circle-info",
  alert: "circle-exclamation",
  warning: "triangle-exclamation",
  
  // Layout
  layout: "table-columns",
  terminal: "terminal",
  "terminal-square": "terminal",
  panel: "sidebar",
  
  // User
  user: "user",
  "user-circle": "circle-user",
  
  // Misc
  lock: "lock",
  road: "file-lines",
  docker: "docker",
  container: "docker",
  "caret-left": "caret-left",
  "caret-right": "caret-right",
  "help-circle": "circle-question",
  speedometer: "gauge",
  gauge: "gauge",

  "file-plus": "file-circle-plus",
  "file-plus-01": "file-circle-plus",
  attach: "paperclip",
  paperclip: "paperclip",
  "hide-panel": "sidebar",
  expand: "expand",
  "message-square-01": "comment",
  "message-text-square-01": "comment-dots",
  "bell-02": "bell",
  command: "keyboard",
  debug: "bug",
  more: "ellipsis",
  "trash-03": "trash",
  "switch-horizontal-01": "arrows-left-right",
  "target-02": "bullseye",
  "tag-02": "tag",
  "flag-05": "flag",
  "lightbulb-03": "lightbulb",
  "green-tick": "circle-check",
  "reverse-left": "rotate-left",
  clock: "clock",
  "layout-alt-04": "table-cells-large",
  "filter-lines": "filter",
  list: "list",
  "arrow-narrow-down": "arrow-down",
  "arrow-narrow-up": "arrow-up",
  "arrow-narrow-down-left": "arrow-down-left",
  "star-01": "star",
  "edit-02": "pen",
  "lock-01": "lock",
  "save-01": "floppy-disk",
  "upload-01": "upload",
  "flip-backward": "backward-step",
  "flip-forward": "forward-step",
  "move-up": "arrow-up",
  "move-down": "arrow-down",
  back: "arrow-left",
  "brackets-square": "brackets-square",
  palette: "palette",
  eye: "eye",
  "refresh-cw-05": "arrows-rotate",
  code: "code",
  "git-branch-01": "code-branch",
  "git-branch-02": "code-branch",
  "git-logo": "code-branch",
  "settings-02": "gear",
  "menu-left-off": "bars",
  "menu-left-on": "bars-staggered",
  plugins: "puzzle-piece",
  plug: "plug",

  // Plugins & Account panel icons
  puzzle: "puzzle-piece",
  "puzzle-piece": "puzzle-piece",
  "puzzle-piece-02": "puzzle-piece",
  "download-03": "download",
  "download-04": "download",
  "award-05": "award",
  "clock-fast-forward": "clock-rotate-left",
  "arrow-narrow-up-right": "arrow-up-right-from-square",
  "code-browser": "globe",
  "shield-02": "shield-halved",
  "pie-chart-01": "chart-pie",
  data: "database",
  database: "database",
  "user-01": "user",
  "eye-slash": "eye-slash",
  "sign-out": "right-from-bracket",
  "right-from-bracket": "right-from-bracket",
  key: "key",
  "key-01": "key",
};

export const CortexIcon: Component<CortexIconProps> = (props) => {
  const [local] = splitProps(props, [
    "name",
    "size",
    "color",
    "class",
    "style",
    "onClick",
  ]);

  const getSize = (): number => {
    if (typeof local.size === "number") return local.size;
    return CORTEX_ICON_SIZES[local.size || "md"];
  };

  const getIconName = (): string => {
    const lowercaseName = local.name.toLowerCase();
    return ICON_NAME_MAP[lowercaseName] || lowercaseName;
  };

  const iconStyle = (): JSX.CSSProperties => ({
    width: `${getSize()}px`,
    height: `${getSize()}px`,
    color: local.color || "currentColor",
    "flex-shrink": "0",
    transition: "color var(--cortex-transition-normal, 150ms ease)",
    ...local.style,
  });

  return (
    <Icon
      name={getIconName()}
      size={getSize()}
      color={local.color}
      class={local.class}
      style={iconStyle()}
      onClick={local.onClick}
    />
  );
};

export default CortexIcon;


