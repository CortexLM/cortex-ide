/**
 * =============================================================================
 * ORION UI COMPONENTS - JetBrains New UI Design System
 * =============================================================================
 * 
 * @agent-instructions
 * USE THESE COMPONENTS for all UI work in this project.
 * Import from "@/components/ui" - NEVER create custom styles.
 * 
 * Available components:
 * - Button: Primary, Secondary, Ghost, Danger variants
 * - IconButton: For icon-only buttons
 * - Input, Textarea: Form inputs with focus states
 * - Card: Container with elevation variants
 * - ListItem, ListGroup: Tree/list items
 * - SidebarHeader, SidebarSection, SidebarContent: Sidebar layout
 * - Badge, StatusDot: Status indicators
 * - ProgressBar: Progress indication
 * - Text, SectionTitle: Typography
 * - Divider, Spacer: Layout helpers
 * - EmptyState: Empty content placeholder
 * - Modal: Dialog with overlay
 * - Dropdown: Menu dropdown
 * - Tabs, TabList, Tab, TabPanel: Tab navigation
 * - Tooltip, SimpleTooltip: Hover tooltips
 * - Select: Dropdown select
 * - Toggle: Switch toggle
 * - Radio, RadioGroup: Radio buttons
 * - Checkbox: Checkbox input
 * - Avatar, AvatarGroup: User avatars
 * - Breadcrumb: Navigation breadcrumbs
 * - Alert: Inline alerts/notifications
 * 
 * Design tokens are in: src/styles/design-tokens.css
 * All components use --jb-* tokens (JetBrains New UI spec)
 * =============================================================================
 */

// Buttons
export { Button } from "./Button";
export type { ButtonProps } from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";

// Form Controls
export { Input, Textarea } from "./Input";
export type { InputProps, TextareaProps } from "./Input";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { Toggle } from "./Toggle";
export type { ToggleProps } from "./Toggle";

export { Radio, RadioGroup } from "./Radio";
export type { RadioProps, RadioGroupProps, RadioOption } from "./Radio";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

// Containers
export { Card } from "./Card";
export type { CardProps } from "./Card";

export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";

// Navigation
export { Tabs, TabList, Tab, TabPanel } from "./Tabs";
export type { TabsProps, TabListProps, TabProps, TabPanelProps } from "./Tabs";

export { Dropdown } from "./Dropdown";
export type { DropdownProps, DropdownItem } from "./Dropdown";

export { Breadcrumb } from "./Breadcrumb";
export type { BreadcrumbProps, BreadcrumbItem } from "./Breadcrumb";

// Lists
export { ListItem, ListGroup } from "./ListItem";
export type { ListItemProps, ListGroupProps } from "./ListItem";

// Sidebar Layout
export { SidebarHeader, SidebarSection, SidebarContent } from "./SidebarSection";
export type { SidebarHeaderProps, SidebarSectionProps, SidebarContentProps } from "./SidebarSection";

// Status & Indicators
export { Badge, StatusDot } from "./Badge";
export type { BadgeProps, StatusDotProps } from "./Badge";

export { ProgressBar } from "./ProgressBar";
export type { ProgressBarProps } from "./ProgressBar";

// Typography
export { Text, SectionTitle } from "./Text";
export type { TextProps } from "./Text";

// Layout Helpers
export { Divider, Spacer } from "./Divider";
export type { DividerProps, SpacerProps } from "./Divider";

// Feedback
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { Alert } from "./Alert";
export type { AlertProps } from "./Alert";

export { Tooltip, SimpleTooltip } from "./Tooltip";
export type { TooltipProps, SimpleTooltipProps, TooltipPosition } from "./Tooltip";

// Loading
export { LoadingSpinner } from "./LoadingSpinner";
export type { LoadingSpinnerProps } from "./LoadingSpinner";

// Avatar
export { Avatar, AvatarGroup } from "./Avatar";
export type { AvatarProps, AvatarGroupProps } from "./Avatar";

// Quick Pick
export { QuickPick } from "./QuickPick";
export type {
  QuickPickProps,
  QuickPickItem,
  QuickPickItemButton,
  QuickPickItemSection,
  QuickPickOptions,
} from "./QuickPick";

// Quick Input (Input Box)
export { QuickInput, normalizeValidation } from "./QuickInput";
export type {
  QuickInputProps,
  QuickInputOptions,
  QuickInputButton,
  ValidationResult,
  ValidationSeverity,
  SelectionRange,
} from "./QuickInput";

// Toast Notifications
export { Toast, ToastContainer } from "./Toast";
export type {
  ToastProps,
  ToastType,
  ToastAction,
  ToastContainerProps,
} from "./Toast";

// Banner Notifications
export {
  BannerNotification,
  BannerNotificationContainer,
  BannerNotificationProvider,
  useBannerNotification,
  createWorkspaceTrustBanner,
  createExtensionRecommendationBanner,
  createUpdateAvailableBanner,
} from "./BannerNotification";
export type {
  BannerNotificationProps,
  BannerType,
  BannerAction,
  BannerNotificationContainerProps,
} from "./BannerNotification";

// Safe HTML Rendering
export { SafeHTML } from "./SafeHTML";
export type { SafeHTMLProps } from "./SafeHTML";

// Context Menu (JetBrains Style)
export { ContextMenu, useContextMenu, ContextMenuPresets } from "./ContextMenu";
export type {
  ContextMenuProps,
  ContextMenuState,
  ContextMenuItem,
  ContextMenuSection,
} from "./ContextMenu";

// Virtualization
export { VirtualList, VirtualListVariable } from "./VirtualList";
export type { VirtualListProps, VirtualListVariableProps } from "./VirtualList";
