/**
 * Workbench Types
 *
 * Centralized type definitions for workbench-related functionality including
 * auxiliary sidebar, command center, view containers, panels, and notifications.
 * 
 * These types mirror VS Code's workbench API for extension compatibility.
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Markdown string for rich text rendering.
 */
export interface MarkdownString {
  /** Raw markdown content */
  value: string;
  /** Whether the markdown is trusted (allows command URIs) */
  isTrusted?: boolean;
  /** Whether to support theme icons like $(icon-name) */
  supportThemeIcons?: boolean;
  /** Whether to support HTML tags */
  supportHtml?: boolean;
}

/**
 * Command definition with arguments.
 */
export interface Command {
  /** Command identifier */
  command: string;
  /** Display title */
  title: string;
  /** Optional tooltip */
  tooltip?: string;
  /** Optional arguments to pass to the command */
  arguments?: unknown[];
}

// ============================================================================
// Auxiliary Sidebar (Secondary Side Bar)
// ============================================================================

/**
 * State for the auxiliary sidebar (secondary side bar).
 * The auxiliary sidebar is positioned opposite to the primary sidebar.
 */
export interface AuxiliarySidebarState {
  /** Whether the auxiliary sidebar is visible */
  visible: boolean;
  /** Position of the auxiliary sidebar */
  position: 'left' | 'right';
  /** Current width in pixels */
  width: number;
  /** ID of the currently active view */
  activeViewId?: string;
  /** View containers registered in the auxiliary sidebar */
  viewContainers: ViewContainer[];
}

// ============================================================================
// Command Center (in Title Bar)
// ============================================================================

/**
 * State for the command center displayed in the title bar.
 * Provides quick access to commands, files, and search.
 */
export interface CommandCenterState {
  /** Whether the command center is visible */
  visible: boolean;
  /** Current mode of the command center */
  mode: 'quick-open' | 'command-palette' | 'search';
  /** Recently executed commands */
  recentCommands: string[];
  /** User-pinned commands for quick access */
  pinnedCommands: string[];
}

// ============================================================================
// View Container Contribution (from extensions)
// ============================================================================

/**
 * View container that groups related views.
 * Can be contributed by extensions via package.json.
 */
export interface ViewContainer {
  /** Unique identifier for the view container */
  id: string;
  /** Display title shown in the sidebar */
  title: string;
  /** Icon for the view container (codicon name or themed icon) */
  icon?: string | { light: string; dark: string };
  /** Sort order within the sidebar */
  order?: number;
  /** Views contained in this container */
  views: View[];
}

/**
 * Individual view within a view container.
 * Views display content like trees, webviews, or custom UI.
 */
export interface View {
  /** Unique identifier for the view */
  id: string;
  /** Display name shown in the view header */
  name: string;
  /** When clause controlling view visibility */
  when?: string;
  /** Icon for the view (codicon name) */
  icon?: string;
  /** Contextual title shown when view is focused */
  contextualTitle?: string;
  /** Initial visibility state */
  visibility?: 'visible' | 'hidden' | 'collapsed';
  /** Initial size in pixels or percentage */
  initialSize?: number;
  /** Type of view content */
  type?: 'tree' | 'webview';
  /** Whether the user can toggle visibility */
  canToggleVisibility?: boolean;
  /** Whether the user can move this view to another container */
  canMoveView?: boolean;
}

// ============================================================================
// Welcome View
// ============================================================================

/**
 * Welcome view content shown when a view is empty.
 * Provides guidance and quick actions to get started.
 */
export interface WelcomeView {
  /** ID of the view this welcome content belongs to */
  viewId: string;
  /** Content items to display */
  contents: WelcomeViewContent[];
  /** When clause controlling welcome view visibility */
  when?: string;
}

/**
 * Individual content item in a welcome view.
 */
export interface WelcomeViewContent {
  /** Type of content */
  type: 'text' | 'button' | 'link';
  /** Text content to display */
  text: string;
  /** Command to execute when clicked (for button/link) */
  command?: string;
  /** When clause controlling item visibility */
  when?: string;
}

// ============================================================================
// Panel Position and Alignment
// ============================================================================

/**
 * Position of the bottom panel.
 */
export type PanelPosition = 'bottom' | 'left' | 'right';

/**
 * Alignment of content within the panel area.
 */
export type PanelAlignment = 'left' | 'center' | 'right' | 'justify';

// ============================================================================
// Editor Title Actions
// ============================================================================

/**
 * Action displayed in the editor title area.
 * Shows icons/buttons in the editor tab bar.
 */
export interface EditorTitleAction {
  /** Command to execute when clicked */
  command: string;
  /** Display title/tooltip */
  title: string;
  /** Icon to display (codicon name) */
  icon?: string;
  /** When clause controlling action visibility */
  when?: string;
  /** Group for ordering ('navigation' = left, 'inline' = right) */
  group?: 'navigation' | 'inline' | string;
}

// ============================================================================
// View Title Actions
// ============================================================================

/**
 * Action displayed in a view's title bar.
 * Provides quick actions for view content.
 */
export interface ViewTitleAction {
  /** ID of the view this action belongs to */
  viewId: string;
  /** Command to execute when clicked */
  command: string;
  /** Display title/tooltip */
  title: string;
  /** Icon to display (codicon name) */
  icon?: string;
  /** When clause controlling action visibility */
  when?: string;
  /** Group for ordering ('navigation' = inline, others in overflow) */
  group?: 'navigation' | 'inline' | string;
}

// ============================================================================
// Status Bar Item
// ============================================================================

/**
 * Options for creating a status bar item.
 * Status bar items display information and actions at the bottom of the window.
 */
export interface StatusBarItemOptions {
  /** Unique identifier for the item */
  id: string;
  /** Human-readable name (shown in context menu) */
  name: string;
  /** Text to display in the status bar */
  text: string;
  /** Tooltip shown on hover (can be markdown) */
  tooltip?: string | MarkdownString;
  /** Text color */
  color?: string;
  /** Background color (typically 'warning' or 'error') */
  backgroundColor?: string;
  /** Command to execute when clicked */
  command?: string | Command;
  /** Alignment in the status bar */
  alignment: 'left' | 'right';
  /** Sort priority (higher = more to the left/right) */
  priority?: number;
  /** Accessibility information */
  accessibilityInformation?: { label: string; role?: string };
}

// ============================================================================
// Notification
// ============================================================================

/**
 * Options for displaying a notification.
 */
export interface NotificationOptions {
  /** Severity level affecting icon and styling */
  severity: 'info' | 'warning' | 'error';
  /** Message text to display */
  message: string;
  /** Source of the notification (e.g., extension name) */
  source?: string;
  /** Progress indicator configuration */
  progress?: { infinite: boolean } | { total: number; worked: number };
  /** Action buttons for the notification */
  actions?: NotificationAction[];
  /** Whether the notification persists until dismissed */
  sticky?: boolean;
}

/**
 * Action button for a notification.
 */
export interface NotificationAction {
  /** Button label */
  label: string;
  /** Command to execute when clicked */
  command?: string;
  /** Whether this is a secondary (less prominent) action */
  isSecondary?: boolean;
}

// ============================================================================
// Workbench State
// ============================================================================

/**
 * Complete workbench layout state.
 * Tracks visibility and configuration of all major UI components.
 */
export interface WorkbenchState {
  /** Layout configuration for major UI areas */
  layout: {
    /** Primary sidebar configuration */
    sideBar: { 
      visible: boolean; 
      position: 'left' | 'right'; 
      width: number;
    };
    /** Auxiliary (secondary) sidebar configuration */
    auxiliarySideBar: AuxiliarySidebarState;
    /** Bottom panel configuration */
    panel: { 
      visible: boolean; 
      position: PanelPosition; 
      alignment: PanelAlignment; 
      height: number;
    };
    /** Activity bar configuration */
    activityBar: { 
      visible: boolean; 
      position: 'side' | 'top' | 'bottom';
    };
    /** Status bar configuration */
    statusBar: { 
      visible: boolean;
    };
    /** Menu bar configuration */
    menuBar: { 
      visible: boolean; 
      mode: 'classic' | 'compact' | 'hidden';
    };
  };
  /** Whether zen mode is active (hides UI chrome) */
  zenMode: boolean;
  /** Whether fullscreen mode is active */
  fullscreen: boolean;
  /** Whether centered layout is active (centers editor) */
  centeredLayout: boolean;
}


