import { JSX, Show, splitProps, mergeProps, For } from "solid-js";
import { Icon } from "./ui/Icon";
import { Button } from "./ui";

/**
 * WelcomeView - Empty state component for panels
 * 
 * Provides consistent empty state UI for:
 * - File Explorer (no folder open)
 * - Search (no search performed)
 * - Git (no repository)
 * - Debugger (no session active)
 * 
 * @example
 * <WelcomeView
 *   type="explorer"
 *   onPrimaryAction={() => openFolder()}
 * />
 */

// ============================================================================
// Types
// ============================================================================

export type WelcomeViewType = "explorer" | "search" | "git" | "debug";

export interface WelcomeViewAction {
  /** Label for the action button */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether this is the primary action */
  primary?: boolean;
  /** Icon to display in button */
  icon?: JSX.Element;
  /** Button variant override */
  variant?: "primary" | "secondary" | "ghost";
}

export interface WelcomeViewProps {
  /** The type of empty state to show */
  type: WelcomeViewType;
  /** Custom icon override */
  icon?: JSX.Element;
  /** Custom title override */
  title?: string;
  /** Custom description override */
  description?: string;
  /** Custom actions override */
  actions?: WelcomeViewAction[];
  /** Primary action handler (convenience prop for common actions) */
  onPrimaryAction?: () => void;
  /** Secondary action handler */
  onSecondaryAction?: () => void;
  /** Additional class names */
  class?: string;
  /** Inline styles */
  style?: JSX.CSSProperties;
}

// ============================================================================
// Preset Configurations
// ============================================================================

interface WelcomePreset {
  icon: () => JSX.Element;
  title: string;
  description: string;
  primaryAction: { label: string; icon: () => JSX.Element };
  secondaryAction?: { label: string; icon: () => JSX.Element };
}

const WELCOME_PRESETS: Record<WelcomeViewType, WelcomePreset> = {
  explorer: {
    icon: () => <Icon name="folder" style={{ width: "48px", height: "48px" }} />,
    title: "No Folder Open",
    description: "Open a folder to start exploring your project files and directories.",
    primaryAction: {
      label: "Open Folder",
      icon: () => <Icon name="folder-plus" style={{ width: "16px", height: "16px" }} />,
    },
    secondaryAction: {
      label: "Clone Repository",
      icon: () => <Icon name="code-branch" style={{ width: "16px", height: "16px" }} />,
    },
  },
  search: {
    icon: () => <Icon name="magnifying-glass" style={{ width: "48px", height: "48px" }} />,
    title: "Search Your Project",
    description: "Enter a search term to find files, symbols, or text across your workspace.",
    primaryAction: {
      label: "Start Search",
      icon: () => <Icon name="magnifying-glass" style={{ width: "16px", height: "16px" }} />,
    },
    secondaryAction: {
      label: "Open File Finder",
      icon: () => <Icon name="file" style={{ width: "16px", height: "16px" }} />,
    },
  },
  git: {
    icon: () => <Icon name="code-branch" style={{ width: "48px", height: "48px" }} />,
    title: "No Repository Detected",
    description: "Initialize a Git repository to track changes, create branches, and collaborate with your team.",
    primaryAction: {
      label: "Initialize Repository",
      icon: () => <Icon name="code-branch" style={{ width: "16px", height: "16px" }} />,
    },
    secondaryAction: {
      label: "Clone Repository",
      icon: () => <Icon name="code" style={{ width: "16px", height: "16px" }} />,
    },
  },
  debug: {
    icon: () => <Icon name="play" style={{ width: "48px", height: "48px" }} />,
    title: "No Debug Session",
    description: "Configure and start a debug session to inspect variables, set breakpoints, and step through code.",
    primaryAction: {
      label: "Create launch.json",
      icon: () => <Icon name="gear" style={{ width: "16px", height: "16px" }} />,
    },
    secondaryAction: {
      label: "Start Debugging",
      icon: () => <Icon name="play" style={{ width: "16px", height: "16px" }} />,
    },
  },
};

// ============================================================================
// Subcomponents
// ============================================================================

interface IconContainerProps {
  children: JSX.Element;
}

function IconContainer(props: IconContainerProps) {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        width: "80px",
        height: "80px",
        "border-radius": "var(--cortex-radius-xl)",
        "margin-bottom": "16px",
        background: "var(--jb-surface-raised, var(--surface-raised))",
        color: "var(--jb-text-muted-color, var(--text-weak))",
      }}
    >
      {props.children}
    </div>
  );
}

interface TitleProps {
  children: string;
}

function Title(props: TitleProps) {
  return (
    <h3
      style={{ 
        "font-size": "16px",
        "font-weight": "600",
        "margin-bottom": "8px",
        color: "var(--jb-text-body-color, var(--text-base))" 
      }}
    >
      {props.children}
    </h3>
  );
}

interface DescriptionProps {
  children: string;
}

function Description(props: DescriptionProps) {
  return (
    <p
      style={{ 
        "font-size": "14px",
        "text-align": "center",
        "max-width": "20rem",
        "margin-bottom": "24px",
        "line-height": "1.625",
        color: "var(--jb-text-muted-color, var(--text-weak))" 
      }}
    >
      {props.children}
    </p>
  );
}

interface ActionButtonsProps {
  actions: WelcomeViewAction[];
}

function ActionButtons(props: ActionButtonsProps) {
  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "8px", width: "100%", "max-width": "20rem" }}>
      {props.actions.map((action) => (
        <Button
          variant={action.variant ?? (action.primary ? "primary" : "secondary")}
          icon={action.icon}
          onClick={action.onClick}
          size="md"
          style={{ width: "100%" }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

// ============================================================================
// Tips Section
// ============================================================================

interface TipItem {
  icon: () => JSX.Element;
  text: string;
}

const TIPS_BY_TYPE: Record<WelcomeViewType, TipItem[]> = {
  explorer: [
    { icon: () => <Icon name="terminal" style={{ width: "14px", height: "14px" }} />, text: "Tip: Use Ctrl+P to quickly open files" },
    { icon: () => <Icon name="folder" style={{ width: "14px", height: "14px" }} />, text: "Drag a folder here to open it" },
  ],
  search: [
    { icon: () => <Icon name="code" style={{ width: "14px", height: "14px" }} />, text: "Use regex patterns for advanced search" },
    { icon: () => <Icon name="file" style={{ width: "14px", height: "14px" }} />, text: "Filter by file type using include patterns" },
  ],
  git: [
    { icon: () => <Icon name="database" style={{ width: "14px", height: "14px" }} />, text: "Track changes and collaborate easily" },
    { icon: () => <Icon name="code" style={{ width: "14px", height: "14px" }} />, text: "Create branches for feature development" },
  ],
  debug: [
    { icon: () => <Icon name="microchip" style={{ width: "14px", height: "14px" }} />, text: "Set breakpoints by clicking line numbers" },
    { icon: () => <Icon name="gear" style={{ width: "14px", height: "14px" }} />, text: "Configure launch.json for custom debugging" },
  ],
};

interface TipsProps {
  type: WelcomeViewType;
}

function Tips(props: TipsProps) {
  const tips = () => TIPS_BY_TYPE[props.type] || [];

  return (
    <Show when={tips().length > 0}>
      <div style={{ 
        "margin-top": "24px", 
        "padding-top": "16px", 
        "border-top": "1px solid var(--jb-border-default, var(--border-weak))", 
        width: "100%", 
        "max-width": "20rem" 
      }}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
          {tips().map((tip) => (
            <div
              style={{ 
                display: "flex", 
                "align-items": "center", 
                gap: "8px", 
                "font-size": "12px",
                color: "var(--jb-text-muted-color, var(--text-weaker))" 
              }}
            >
              <span style={{ "flex-shrink": "0", color: "var(--jb-text-muted-color, var(--text-weak))" }}>
                {tip.icon()}
              </span>
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>
    </Show>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WelcomeView(props: WelcomeViewProps) {
  const merged = mergeProps({ type: "explorer" as WelcomeViewType }, props);
  const [local, rest] = splitProps(merged, [
    "type",
    "icon",
    "title",
    "description",
    "actions",
    "onPrimaryAction",
    "onSecondaryAction",
    "class",
    "style",
  ]);

  const preset = () => WELCOME_PRESETS[local.type];

  const displayIcon = () => local.icon ?? preset().icon();
  const displayTitle = () => local.title ?? preset().title;
  const displayDescription = () => local.description ?? preset().description;

  const displayActions = (): WelcomeViewAction[] => {
    if (local.actions && local.actions.length > 0) {
      return local.actions;
    }

    const actions: WelcomeViewAction[] = [];
    const p = preset();

    if (local.onPrimaryAction) {
      actions.push({
        label: p.primaryAction.label,
        icon: p.primaryAction.icon(),
        onClick: local.onPrimaryAction,
        primary: true,
        variant: "primary",
      });
    }

    if (local.onSecondaryAction && p.secondaryAction) {
      actions.push({
        label: p.secondaryAction.label,
        icon: p.secondaryAction.icon(),
        onClick: local.onSecondaryAction,
        primary: false,
        variant: "secondary",
      });
    }

    return actions;
  };

  return (
    <div
      class={`flex flex-col items-center justify-center h-full px-6 py-8 ${local.class || ""}`}
      style={{
        background: "var(--background-base)",
        "min-height": "200px",
        ...local.style,
      }}
      {...rest}
    >
      <IconContainer>{displayIcon()}</IconContainer>
      <Title>{displayTitle()}</Title>
      <Description>{displayDescription()}</Description>

      <Show when={displayActions().length > 0}>
        <ActionButtons actions={displayActions()} />
      </Show>

      <Tips type={local.type} />
    </div>
  );
}

// ============================================================================
// Specialized Welcome Views
// ============================================================================

export interface RecentWorkspaceItem {
  name: string;
  path: string;
  type: "folder" | "workspace";
}

export interface ExplorerWelcomeProps {
  onOpenFolder?: () => void;
  onCloneRepo?: () => void;
  recentWorkspaces?: RecentWorkspaceItem[];
  onOpenRecent?: (path: string, type: "folder" | "workspace") => void;
}

/**
 * Pre-configured welcome view for empty file explorer
 */
export function ExplorerWelcome(props: ExplorerWelcomeProps) {
  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        padding: "8px 12px",
        background: "transparent",
      }}
    >
      {/* Trae-style: Minimal, just action links */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
        <Show when={props.onOpenFolder}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="folder-plus" style={{ width: "16px", height: "16px", opacity: "0.7" }} />}
            onClick={props.onOpenFolder}
            style={{ 
              "justify-content": "flex-start",
              color: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
            }}
          >
            Open Folder...
          </Button>
        </Show>
        <Show when={props.onCloneRepo}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="code-branch" style={{ width: "16px", height: "16px", opacity: "0.7" }} />}
            onClick={props.onCloneRepo}
            style={{ 
              "justify-content": "flex-start",
              color: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
            }}
          >
            Clone Repository...
          </Button>
        </Show>
      </div>

      {/* Recent Workspaces - compact list */}
      <Show when={props.recentWorkspaces && props.recentWorkspaces.length > 0}>
        <div style={{ "margin-top": "12px", "padding-top": "8px", "border-top": "1px solid var(--jb-border-divider, var(--cortex-bg-hover))" }}>
          <div 
            style={{ 
              "font-size": "10px",
              "text-transform": "uppercase",
              "letter-spacing": "0.05em",
              "font-weight": "500",
              padding: "0 8px",
              "margin-bottom": "4px",
              color: "var(--jb-text-muted-color, var(--cortex-text-inactive))" 
            }}
          >
            Recent
          </div>
          <div style={{ display: "flex", "flex-direction": "column" }}>
            <For each={props.recentWorkspaces!.slice(0, 5)}>
              {(recent) => (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon name="folder" style={{ width: "14px", height: "14px", "flex-shrink": "0", opacity: "0.6" }} />}
                  onClick={() => props.onOpenRecent?.(recent.path, recent.type)}
                  title={recent.path}
                  style={{ 
                    "justify-content": "flex-start",
                    color: "var(--jb-text-muted-color, var(--cortex-text-inactive))",
                  }}
                >
                  <span style={{ overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>{recent.name}</span>
                </Button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}

export interface SearchWelcomeProps {
  onStartSearch?: () => void;
  onOpenFileFinder?: () => void;
}

/**
 * Pre-configured welcome view for empty search panel
 */
export function SearchWelcome(props: SearchWelcomeProps) {
  return (
    <WelcomeView
      type="search"
      onPrimaryAction={props.onStartSearch}
      onSecondaryAction={props.onOpenFileFinder}
    />
  );
}

export interface GitWelcomeProps {
  onInitRepo?: () => void;
  onCloneRepo?: () => void;
}

/**
 * Pre-configured welcome view for repositories without git
 */
export function GitWelcome(props: GitWelcomeProps) {
  return (
    <WelcomeView
      type="git"
      onPrimaryAction={props.onInitRepo}
      onSecondaryAction={props.onCloneRepo}
    />
  );
}

export interface DebugWelcomeProps {
  onCreateLaunchConfig?: () => void;
  onStartDebugging?: () => void;
}

/**
 * Pre-configured welcome view for debugger with no active session
 */
export function DebugWelcome(props: DebugWelcomeProps) {
  return (
    <WelcomeView
      type="debug"
      onPrimaryAction={props.onCreateLaunchConfig}
      onSecondaryAction={props.onStartDebugging}
    />
  );
}

// ============================================================================
// Custom Welcome View Builder
// ============================================================================

export interface CustomWelcomeViewProps {
  icon: JSX.Element;
  title: string;
  description: string;
  actions?: WelcomeViewAction[];
  tips?: TipItem[];
  class?: string;
  style?: JSX.CSSProperties;
}

/**
 * Fully customizable welcome view for edge cases
 */
export function CustomWelcomeView(props: CustomWelcomeViewProps) {
  return (
    <div
      class={`flex flex-col items-center justify-center h-full px-6 py-8 ${props.class || ""}`}
      style={{
        background: "var(--background-base)",
        "min-height": "200px",
        ...props.style,
      }}
    >
      <IconContainer>{props.icon}</IconContainer>
      <Title>{props.title}</Title>
      <Description>{props.description}</Description>

      <Show when={props.actions && props.actions.length > 0}>
        <ActionButtons actions={props.actions!} />
      </Show>

      <Show when={props.tips && props.tips.length > 0}>
        <div style={{ 
          "margin-top": "24px", 
          "padding-top": "16px", 
          "border-top": "1px solid var(--jb-border-default, var(--border-weak))", 
          width: "100%", 
          "max-width": "20rem" 
        }}>
          <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
            {props.tips!.map((tip) => (
              <div
                style={{ 
                  display: "flex", 
                  "align-items": "center", 
                  gap: "8px", 
                  "font-size": "12px",
                  color: "var(--jb-text-muted-color, var(--text-weaker))" 
                }}
              >
                <span style={{ "flex-shrink": "0", color: "var(--jb-text-muted-color, var(--text-weak))" }}>
                  {tip.icon()}
                </span>
                <span>{tip.text}</span>
              </div>
            ))}
          </div>
        </div>
      </Show>
    </div>
  );
}

// Re-export types for consumers
export type { TipItem };

