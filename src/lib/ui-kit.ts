/**
 * =============================================================================
 * ORION UI KIT - JetBrains New UI Design System
 * =============================================================================
 * 
 * Single source of truth for UI development in Orion IDE.
 * Based on JetBrains New UI 2.0 Dark Variant specification.
 * 
 * @agent-instructions
 * ALWAYS import from this file for any UI work.
 * NEVER use hardcoded colors, fonts, or dimensions.
 * NEVER use Tailwind classes for colors/spacing in this project.
 * 
 * Usage:
 * ```tsx
 * import { ui, Button, Input, Card, Modal } from "@/lib/ui-kit";
 * 
 * <div style={ui.panel}>
 *   <Card>
 *     <Input placeholder="Search..." icon={<FiSearch />} />
 *     <Button variant="primary">Submit</Button>
 *   </Card>
 * </div>
 * ```
 * =============================================================================
 */

import type { JSX } from "solid-js";

// Re-export all UI components
export {
  // Buttons
  Button,
  IconButton,
  // Form Controls
  Input,
  Textarea,
  Select,
  Toggle,
  Radio,
  RadioGroup,
  Checkbox,
  // Containers
  Card,
  Modal,
  // Navigation
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Dropdown,
  Breadcrumb,
  // Lists
  ListItem,
  ListGroup,
  // Sidebar Layout
  SidebarHeader,
  SidebarSection,
  SidebarContent,
  // Status & Indicators
  Badge,
  StatusDot,
  ProgressBar,
  // Typography
  Text,
  SectionTitle,
  // Layout Helpers
  Divider,
  Spacer,
  // Feedback
  EmptyState,
  Alert,
  Tooltip,
  SimpleTooltip,
  // Loading
  LoadingSpinner,
  // Avatar
  Avatar,
  AvatarGroup,
} from "@/components/ui";

export type {
  // Button types
  ButtonProps,
  IconButtonProps,
  // Form Control types
  InputProps,
  TextareaProps,
  SelectProps,
  SelectOption,
  ToggleProps,
  RadioProps,
  RadioGroupProps,
  RadioOption,
  CheckboxProps,
  // Container types
  CardProps,
  ModalProps,
  // Navigation types
  TabsProps,
  TabListProps,
  TabProps,
  TabPanelProps,
  DropdownProps,
  DropdownItem,
  BreadcrumbProps,
  BreadcrumbItem,
  // List types
  ListItemProps,
  ListGroupProps,
  // Sidebar types
  SidebarHeaderProps,
  SidebarSectionProps,
  SidebarContentProps,
  // Status types
  BadgeProps,
  StatusDotProps,
  ProgressBarProps,
  // Typography types
  TextProps,
  // Layout types
  DividerProps,
  SpacerProps,
  // Feedback types
  EmptyStateProps,
  AlertProps,
  TooltipProps,
  SimpleTooltipProps,
  TooltipPosition,
  // Loading types
  LoadingSpinnerProps,
  // Avatar types
  AvatarProps,
  AvatarGroupProps,
} from "@/components/ui";

// =============================================================================
// DESIGN TOKENS - JetBrains New UI
// =============================================================================

export const tokens = {
  // Surface & Elevation
  canvas: "#1E1F22",
  panel: "#2B2D30",
  popup: "#2B2D30",
  modal: "#393B40",
  overlay: "rgba(0, 0, 0, 0.6)",
  
  // Surfaces
  surfaceHover: "#2D313A",
  surfaceActive: "#393B40",
  surfaceSelected: "#2D313A",
  
  // Borders
  borderDivider: "#393B40",
  borderDefault: "#43454A",
  borderFocus: "#3574F0",
  borderError: "#F75464",
  
  // Border Radius
  radiusSm: "4px",
  radiusMd: "6px",
  radiusLg: "8px",
  
  // Typography Colors
  textBody: "#DFE1E5",
  textMuted: "#6F737A",
  textPlaceholder: "#5F6B7C",
  
  // Typography Sizes
  fontSizeBody: "13px",
  fontSizeMuted: "12px",
  fontSizeHeader: "11px",
  
  // Icons
  iconDefault: "#6F737A",
  iconActive: "#DFE1E5",
  iconSize: "16px",
  
  // Semantic Colors
  primary: "#3574F0",
  success: "#59A869",
  warning: "#E9AA46",
  error: "#F75464",
  
  // Shadows
  shadowPopup: "0px 8px 16px rgba(0, 0, 0, 0.45)",
  shadowModal: "0px 12px 24px rgba(0, 0, 0, 0.5)",
  
  // Component Heights
  heightButton: "28px",
  heightInput: "28px",
  heightListItem: "24px",
  
  // Transitions
  transitionFast: "70ms ease",
  transitionNormal: "150ms ease",
} as const;

// =============================================================================
// STYLE PRESETS - Ready-to-use style objects
// =============================================================================

export const ui = {
  // Layout containers
  canvas: {
    background: "var(--jb-canvas)",
    "min-height": "100%",
  } as JSX.CSSProperties,

  panel: {
    background: "var(--jb-panel)",
    height: "100%",
    display: "flex",
    "flex-direction": "column",
  } as JSX.CSSProperties,

  popup: {
    background: "var(--jb-popup)",
    "border-radius": "var(--jb-radius-lg)",
    "box-shadow": "var(--jb-shadow-popup)",
    border: "1px solid var(--jb-border-divider)",
  } as JSX.CSSProperties,

  modal: {
    background: "var(--jb-modal)",
    "border-radius": "var(--jb-radius-lg)",
    "box-shadow": "var(--jb-shadow-modal)",
  } as JSX.CSSProperties,

  // Typography
  textBody: {
    "font-size": "var(--jb-text-body-size)",
    "font-weight": "var(--jb-text-body-weight)",
    color: "var(--jb-text-body-color)",
    "font-family": "var(--jb-font-ui)",
  } as JSX.CSSProperties,

  textMuted: {
    "font-size": "var(--jb-text-muted-size)",
    "font-weight": "var(--jb-text-muted-weight)",
    color: "var(--jb-text-muted-color)",
    "font-family": "var(--jb-font-ui)",
  } as JSX.CSSProperties,

  textHeader: {
    "font-size": "var(--jb-text-header-size)",
    "font-weight": "var(--jb-text-header-weight)",
    "text-transform": "uppercase",
    "letter-spacing": "var(--jb-text-header-spacing)",
    color: "var(--jb-text-header-color)",
    "font-family": "var(--jb-font-ui)",
  } as JSX.CSSProperties,

  // Common layouts
  row: {
    display: "flex",
    "align-items": "center",
    gap: "8px",
  } as JSX.CSSProperties,

  column: {
    display: "flex",
    "flex-direction": "column",
    gap: "8px",
  } as JSX.CSSProperties,

  spaceBetween: {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
  } as JSX.CSSProperties,

  center: {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
  } as JSX.CSSProperties,

  // Flex utilities
  flex1: { flex: "1" } as JSX.CSSProperties,
  flexShrink0: { "flex-shrink": "0" } as JSX.CSSProperties,
  flexGrow1: { "flex-grow": "1" } as JSX.CSSProperties,

  // Overflow
  scrollY: { 
    overflow: "auto",
    "overflow-x": "hidden",
  } as JSX.CSSProperties,

  truncate: {
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  } as JSX.CSSProperties,

  // Icons
  icon: {
    width: "var(--jb-icon-size)",
    height: "var(--jb-icon-size)",
    color: "var(--jb-icon-color-default)",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  iconActive: {
    width: "var(--jb-icon-size)",
    height: "var(--jb-icon-size)",
    color: "var(--jb-icon-color-active)",
    "flex-shrink": "0",
  } as JSX.CSSProperties,

  // Interactive states
  hoverable: {
    cursor: "pointer",
    transition: "background var(--cortex-transition-fast)",
  } as JSX.CSSProperties,

  // Padding presets
  paddingSm: { padding: "8px" } as JSX.CSSProperties,
  paddingMd: { padding: "12px" } as JSX.CSSProperties,
  paddingLg: { padding: "16px" } as JSX.CSSProperties,

  // Gap presets
  gapSm: { gap: "4px" } as JSX.CSSProperties,
  gapMd: { gap: "8px" } as JSX.CSSProperties,
  gapLg: { gap: "12px" } as JSX.CSSProperties,

} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Merge multiple style objects
 */
export function mergeStyles(...styles: (JSX.CSSProperties | undefined)[]): JSX.CSSProperties {
  return styles.reduce<JSX.CSSProperties>((acc, style) => {
    if (style) {
      return { ...acc, ...style };
    }
    return acc;
  }, {});
}

/**
 * Create hover handlers for interactive elements
 */
export function createHoverHandlers(hoverBg = "var(--jb-surface-hover)", defaultBg = "transparent") {
  return {
    onMouseEnter: (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).style.background = hoverBg;
    },
    onMouseLeave: (e: MouseEvent) => {
      (e.currentTarget as HTMLElement).style.background = defaultBg;
    },
  };
}

/**
 * Get icon style with optional active state
 */
export function getIconStyle(active = false): JSX.CSSProperties {
  return active ? ui.iconActive : ui.icon;
}
