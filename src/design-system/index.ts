/**
 * =============================================================================
 * ORION DESIGN SYSTEM - Main Export
 * =============================================================================
 * 
 * This is the main entry point for the Orion Design System.
 * Import everything you need from here:
 * 
 *   import { tokens, Box, Flex, Button } from '@/design-system';
 * 
 * =============================================================================
 */

// Tokens
export * from "./tokens";
export { tokens, default as designTokens } from "./tokens";

// Primitives
export { Box } from "./primitives/Box";
export type { BoxProps } from "./primitives/Box";

export { Flex, VStack, HStack, Center, Spacer } from "./primitives/Flex";
export type { FlexProps, StackProps } from "./primitives/Flex";

// Re-export existing UI components for convenience
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
} from "../components/ui";

// Re-export types
export type {
  ButtonProps,
  IconButtonProps,
  InputProps,
  TextareaProps,
  SelectProps,
  SelectOption,
  ToggleProps,
  RadioProps,
  RadioGroupProps,
  RadioOption,
  CheckboxProps,
  CardProps,
  ModalProps,
  TabsProps,
  TabListProps,
  TabProps,
  TabPanelProps,
  DropdownProps,
  DropdownItem,
  BreadcrumbProps,
  BreadcrumbItem,
  ListItemProps,
  ListGroupProps,
  SidebarHeaderProps,
  SidebarSectionProps,
  SidebarContentProps,
  BadgeProps,
  StatusDotProps,
  ProgressBarProps,
  TextProps,
  DividerProps,
  SpacerProps,
  EmptyStateProps,
  AlertProps,
  TooltipProps,
  SimpleTooltipProps,
  TooltipPosition,
  LoadingSpinnerProps,
  AvatarProps,
  AvatarGroupProps,
} from "../components/ui";
