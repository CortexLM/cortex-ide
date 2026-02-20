/**
 * =============================================================================
 * WELCOME VIEW COMPONENT - Extension-Aware Empty State Views
 * =============================================================================
 * 
 * A VS Code-compatible welcome view component that provides:
 * - Customizable welcome messages for empty views
 * - Action buttons (Open Folder, Clone Repository, etc.)
 * - Links to documentation and tutorials
 * - When clause support for conditional display
 * - Integration with the extension view system
 * - Support for multiple content items per view
 * 
 * Based on VS Code's contributes.viewsWelcome extension point.
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  Show,
  For,
  type Component,
  type JSX,
} from "solid-js";
import { tokens } from "@/design-system/tokens";
import type { WelcomeView as WelcomeViewType, WelcomeViewContent } from "@/types/workbench";
import { Icon } from '../ui/Icon';

// =============================================================================
// TYPES
// =============================================================================

export interface WelcomeViewProps {
  /** View ID this welcome content belongs to */
  viewId: string;
  /** Welcome content items to display */
  contents: WelcomeViewContent[];
  /** When clause for the entire welcome view */
  when?: string;
  /** Context values for evaluating when clauses */
  context?: WhenClauseContext;
  /** Callback when a command is executed */
  onCommand?: (command: string) => void;
  /** Callback when a link is clicked */
  onLinkClick?: (url: string) => void;
  /** Custom title override */
  title?: string;
  /** Custom icon override */
  icon?: JSX.Element;
  /** Custom class name */
  class?: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export interface WhenClauseContext {
  /** Whether a workspace/folder is open */
  workspaceFolderCount?: number;
  /** Whether the view is empty */
  viewEmpty?: boolean;
  /** Whether a git repository exists */
  gitRepository?: boolean;
  /** Active editor language */
  editorLangId?: string;
  /** Whether a file is open */
  editorIsOpen?: boolean;
  /** Custom context keys from extensions */
  [key: string]: unknown;
}

export interface ExtensionWelcomeViewConfig {
  /** View ID to contribute to */
  view: string;
  /** Contents to display */
  contents: WelcomeViewContentConfig[];
  /** When clause */
  when?: string;
}

export interface WelcomeViewContentConfig {
  /** Type of content */
  type: 'text' | 'button' | 'link';
  /** Text content (supports markdown-like links) */
  text: string;
  /** Command to execute (for buttons/links) */
  command?: string;
  /** When clause for this item */
  when?: string;
}

// =============================================================================
// WHEN CLAUSE EVALUATOR
// =============================================================================

/**
 * Simple when clause evaluator.
 * Supports basic expressions like:
 * - "workspaceFolderCount == 0"
 * - "!gitRepository"
 * - "viewEmpty && !editorIsOpen"
 * - "editorLangId == 'typescript'"
 */
export function evaluateWhenClause(
  when: string | undefined,
  context: WhenClauseContext
): boolean {
  if (!when || when.trim() === '') {
    return true;
  }

  try {
    // Handle OR expressions (||)
    if (when.includes('||')) {
      const orParts = when.split('||').map(p => p.trim());
      return orParts.some(part => evaluateWhenClause(part, context));
    }

    // Handle AND expressions (&&)
    if (when.includes('&&')) {
      const andParts = when.split('&&').map(p => p.trim());
      return andParts.every(part => evaluateWhenClause(part, context));
    }

    // Handle negation (!)
    if (when.startsWith('!')) {
      const inner = when.slice(1).trim();
      return !evaluateWhenClause(inner, context);
    }

    // Handle comparison operators
    const comparisonMatch = when.match(/^(\w+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, key, operator, valueStr] = comparisonMatch;
      const contextValue = context[key];
      
      // Parse the value (handle strings, numbers, booleans)
      let value: unknown;
      const trimmedValue = valueStr.trim();
      if (trimmedValue.startsWith("'") || trimmedValue.startsWith('"')) {
        value = trimmedValue.slice(1, -1);
      } else if (trimmedValue === 'true') {
        value = true;
      } else if (trimmedValue === 'false') {
        value = false;
      } else if (!isNaN(Number(trimmedValue))) {
        value = Number(trimmedValue);
      } else {
        value = trimmedValue;
      }

      switch (operator) {
        case '==': return contextValue === value;
        case '!=': return contextValue !== value;
        case '>=': return (contextValue as number) >= (value as number);
        case '<=': return (contextValue as number) <= (value as number);
        case '>': return (contextValue as number) > (value as number);
        case '<': return (contextValue as number) < (value as number);
        default: return false;
      }
    }

    // Handle simple boolean key
    const key = when.trim();
    return Boolean(context[key]);
  } catch (error) {
    console.warn(`Failed to evaluate when clause: ${when}`, error);
    return true; // Default to showing content on error
  }
}

// =============================================================================
// ICON MAPPING
// =============================================================================

const COMMAND_ICONS: Record<string, string> = {
  'workbench.action.files.openFolder': 'folder-plus',
  'workbench.action.files.openFile': 'file',
  'git.clone': 'code-branch',
  'git.init': 'code-branch',
  'workbench.action.openSettings': 'gear',
  'workbench.action.debug.start': 'play',
  'workbench.action.findInFiles': 'magnifying-glass',
  'workbench.action.quickOpen': 'file',
  'workbench.action.terminal.new': 'terminal',
  'extension.install': 'box',
  'workbench.action.openRecent': 'rotate',
  'markdown.showPreview': 'book',
  'help.openDocumentation': 'circle-question',
};

function getCommandIcon(command: string): string {
  // Check exact match first
  if (COMMAND_ICONS[command]) {
    return COMMAND_ICONS[command];
  }

  // Check for partial matches
  if (command.includes('folder') || command.includes('Folder')) {
    return 'folder-plus';
  }
  if (command.includes('git') || command.includes('clone') || command.includes('repository')) {
    return 'code-branch';
  }
  if (command.includes('debug') || command.includes('run') || command.includes('start')) {
    return 'play';
  }
  if (command.includes('settings') || command.includes('config')) {
    return 'gear';
  }
  if (command.includes('search') || command.includes('find')) {
    return 'magnifying-glass';
  }
  if (command.includes('terminal')) {
    return 'terminal';
  }
  if (command.includes('install') || command.includes('extension')) {
    return 'box';
  }
  if (command.includes('download')) {
    return 'download';
  }
  if (command.includes('new') || command.includes('create') || command.includes('add')) {
    return 'plus';
  }
  if (command.includes('doc') || command.includes('help')) {
    return 'book';
  }

  // Default icon
  return 'code';
}

// =============================================================================
// CONTENT RENDERER COMPONENTS
// =============================================================================

interface TextContentProps {
  text: string;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
}

/**
 * Renders text content with support for embedded links.
 * Format: "Click [here](command:my.command) to do something"
 * Or: "Visit [documentation](https://docs.example.com)"
 */
const TextContent: Component<TextContentProps> = (props) => {
  const parseText = createMemo(() => {
    const text = props.text;
    const parts: Array<{ type: 'text' | 'link'; content: string; href?: string }> = [];
    
    // Match markdown-style links: [text](url) or [text](command:id)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
      }

      // Add the link
      parts.push({
        type: 'link',
        content: match[1],
        href: match[2],
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }];
  });

  const handleLinkClick = (href: string, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (href.startsWith('command:')) {
      const command = href.slice(8); // Remove 'command:' prefix
      props.onCommand?.(command);
    } else {
      props.onLinkClick?.(href);
    }
  };

  const textStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "line-height": "1.6",
    color: tokens.colors.text.secondary,
    "text-align": "center",
    "max-width": "320px",
  };

  const linkStyle: JSX.CSSProperties = {
    color: tokens.colors.accent.primary,
    "text-decoration": "none",
    cursor: "pointer",
    transition: "color 150ms ease",
  };

  return (
    <p style={textStyle}>
      <For each={parseText()}>
        {(part) => (
          <Show
            when={part.type === 'link'}
            fallback={<span>{part.content}</span>}
          >
            <a
              href={part.href}
              style={linkStyle}
              onClick={(e) => handleLinkClick(part.href!, e)}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.textDecoration = 'none';
              }}
            >
              {part.content}
            </a>
          </Show>
        )}
      </For>
    </p>
  );
};

interface ButtonContentProps {
  text: string;
  command?: string;
  onCommand?: (command: string) => void;
}

/**
 * Renders a button that executes a command when clicked.
 */
const ButtonContent: Component<ButtonContentProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);
  const [isPressed, setIsPressed] = createSignal(false);

  const iconName = createMemo(() => {
    return props.command ? getCommandIcon(props.command) : 'code';
  });

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (props.command) {
      props.onCommand?.(props.command);
    }
  };

  const buttonStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.sm,
    width: "100%",
    "max-width": "280px",
    padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
    "font-size": "13px",
    "font-weight": "500",
    "font-family": tokens.typography.fontFamily.ui,
    color: isHovered() 
      ? tokens.colors.text.primary 
      : tokens.colors.text.secondary,
    background: isPressed()
      ? tokens.colors.interactive.active
      : isHovered()
        ? tokens.colors.interactive.hover
        : tokens.colors.surface.elevated,
    border: `1px solid ${
      isHovered()
        ? tokens.colors.border.default
        : tokens.colors.border.default
    }`,
    "border-radius": tokens.radius.md,
    cursor: "pointer",
    transition: "all 150ms ease",
    outline: "none",
  });

  const iconStyle: JSX.CSSProperties = {
    width: "16px",
    height: "16px",
    "flex-shrink": "0",
    opacity: "0.85",
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={buttonStyle()}
      title={props.command ? `Execute: ${props.command}` : undefined}
    >
      <Icon name={iconName()} style={iconStyle} />
      <span>{props.text}</span>
    </button>
  );
};

interface LinkContentProps {
  text: string;
  command?: string;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
}

/**
 * Renders a link that can execute a command or open a URL.
 */
const LinkContent: Component<LinkContentProps> = (props) => {
  const [isHovered, setIsHovered] = createSignal(false);

  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (props.command) {
      if (props.command.startsWith('http://') || props.command.startsWith('https://')) {
        props.onLinkClick?.(props.command);
      } else {
        props.onCommand?.(props.command);
      }
    }
  };

  const isExternalLink = createMemo(() => {
    return props.command?.startsWith('http://') || props.command?.startsWith('https://');
  });

  const linkStyle = (): JSX.CSSProperties => ({
    display: "inline-flex",
    "align-items": "center",
    gap: tokens.spacing.xs,
    color: isHovered() 
      ? tokens.colors.accent.hover 
      : tokens.colors.accent.primary,
    "font-size": "13px",
    "text-decoration": isHovered() ? "underline" : "none",
    cursor: "pointer",
    transition: "color 150ms ease",
  });

  const iconStyle: JSX.CSSProperties = {
    width: "12px",
    height: "12px",
    opacity: "0.7",
  };

  return (
    <a
      href={props.command || '#'}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={linkStyle()}
    >
      <span>{props.text}</span>
      <Show when={isExternalLink()}>
        <Icon name="arrow-up-right-from-square" style={iconStyle} />
      </Show>
    </a>
  );
};

// =============================================================================
// MAIN WELCOME VIEW COMPONENT
// =============================================================================

/**
 * Extension-aware welcome view component.
 * Displays customizable welcome content when a view is empty.
 */
export const WelcomeView: Component<WelcomeViewProps> = (props) => {
  const defaultContext: WhenClauseContext = {
    workspaceFolderCount: 0,
    viewEmpty: true,
    gitRepository: false,
    editorIsOpen: false,
  };

  const context = createMemo(() => ({
    ...defaultContext,
    ...props.context,
  }));

  // Filter contents based on when clauses
  const visibleContents = createMemo(() => {
    return props.contents.filter(content => 
      evaluateWhenClause(content.when, context())
    );
  });

  // Check if the entire welcome view should be shown
  const isVisible = createMemo(() => {
    return evaluateWhenClause(props.when, context());
  });

  // Styles
  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    height: "100%",
    "min-height": "200px",
    background: tokens.colors.surface.base,
    ...props.style,
  });

  const titleStyle: JSX.CSSProperties = {
    "font-size": "14px",
    "font-weight": "500",
    color: tokens.colors.text.primary,
    "margin-bottom": tokens.spacing.sm,
    "text-align": "center",
  };

  const contentGroupStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    gap: tokens.spacing.md,
    width: "100%",
  };

  const iconContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "64px",
    height: "64px",
    "border-radius": tokens.radius.lg,
    background: tokens.colors.surface.elevated,
    "margin-bottom": tokens.spacing.md,
    color: tokens.colors.text.muted,
  };



  return (
    <Show when={isVisible()}>
      <div
        class={`welcome-view ${props.class || ''}`}
        data-view-id={props.viewId}
        style={containerStyle()}
      >
        {/* Optional custom icon */}
        <Show when={props.icon}>
          <div style={iconContainerStyle}>
            {props.icon}
          </div>
        </Show>

        {/* Optional title */}
        <Show when={props.title}>
          <h3 style={titleStyle}>{props.title}</h3>
        </Show>

        {/* Content items */}
        <div style={contentGroupStyle}>
          <For each={visibleContents()}>
            {(content) => (
              <Show when={content.type === 'text'}>
                <TextContent
                  text={content.text}
                  onCommand={props.onCommand}
                  onLinkClick={props.onLinkClick}
                />
              </Show>
            )}
          </For>

          <For each={visibleContents()}>
            {(content) => (
              <Show when={content.type === 'button'}>
                <ButtonContent
                  text={content.text}
                  command={content.command}
                  onCommand={props.onCommand}
                />
              </Show>
            )}
          </For>

          <For each={visibleContents()}>
            {(content) => (
              <Show when={content.type === 'link'}>
                <LinkContent
                  text={content.text}
                  command={content.command}
                  onCommand={props.onCommand}
                  onLinkClick={props.onLinkClick}
                />
              </Show>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
};

// =============================================================================
// PRESET WELCOME VIEWS
// =============================================================================

export interface ExplorerWelcomeViewProps {
  context?: WhenClauseContext;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
  class?: string;
}

/**
 * Pre-configured welcome view for the Explorer when no folder is open.
 */
export const ExplorerWelcomeView: Component<ExplorerWelcomeViewProps> = (props) => {
  const contents: WelcomeViewContent[] = [
    {
      type: 'text',
      text: 'You have not yet opened a folder.',
    },
    {
      type: 'button',
      text: 'Open Folder',
      command: 'workbench.action.files.openFolder',
    },
    {
      type: 'button',
      text: 'Clone Repository',
      command: 'git.clone',
      when: 'git.enabled',
    },
    {
      type: 'link',
      text: 'Open Recent',
      command: 'workbench.action.openRecent',
    },
  ];

  return (
    <WelcomeView
      viewId="explorer"
      contents={contents}
      when="workspaceFolderCount == 0"
      context={props.context}
      onCommand={props.onCommand}
      onLinkClick={props.onLinkClick}
      title="No Folder Opened"
      icon={<Icon name="folder" style={{ width: "32px", height: "32px" }} />}
      class={props.class}
    />
  );
};

export interface GitWelcomeViewProps {
  context?: WhenClauseContext;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
  class?: string;
}

/**
 * Pre-configured welcome view for the SCM view when no repository is detected.
 */
export const GitWelcomeView: Component<GitWelcomeViewProps> = (props) => {
  const contents: WelcomeViewContent[] = [
    {
      type: 'text',
      text: 'The folder currently open doesn\'t have a git repository.',
    },
    {
      type: 'button',
      text: 'Initialize Repository',
      command: 'git.init',
    },
    {
      type: 'button',
      text: 'Clone Repository',
      command: 'git.clone',
    },
    {
      type: 'link',
      text: 'Learn more about git',
      command: 'https://git-scm.com/doc',
    },
  ];

  return (
    <WelcomeView
      viewId="scm"
      contents={contents}
      when="!gitRepository"
      context={props.context}
      onCommand={props.onCommand}
      onLinkClick={props.onLinkClick}
      title="No Repository"
      icon={<Icon name="code-branch" style={{ width: "32px", height: "32px" }} />}
      class={props.class}
    />
  );
};

export interface DebugWelcomeViewProps {
  context?: WhenClauseContext;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
  class?: string;
}

/**
 * Pre-configured welcome view for the Debug view.
 */
export const DebugWelcomeView: Component<DebugWelcomeViewProps> = (props) => {
  const contents: WelcomeViewContent[] = [
    {
      type: 'text',
      text: 'Run and Debug helps you debug your code. [Learn more](https://code.visualstudio.com/docs/editor/debugging).',
    },
    {
      type: 'button',
      text: 'Run and Debug',
      command: 'workbench.action.debug.start',
    },
    {
      type: 'link',
      text: 'Create a launch.json file',
      command: 'debug.addConfiguration',
    },
    {
      type: 'link',
      text: 'Show all automatic debug configurations',
      command: 'debug.showAutomaticConfigurations',
    },
  ];

  return (
    <WelcomeView
      viewId="debug"
      contents={contents}
      context={props.context}
      onCommand={props.onCommand}
      onLinkClick={props.onLinkClick}
      title="Run and Debug"
      icon={<Icon name="play" style={{ width: "32px", height: "32px" }} />}
      class={props.class}
    />
  );
};

export interface SearchWelcomeViewProps {
  context?: WhenClauseContext;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
  class?: string;
}

/**
 * Pre-configured welcome view for the Search view.
 */
export const SearchWelcomeView: Component<SearchWelcomeViewProps> = (props) => {
  const contents: WelcomeViewContent[] = [
    {
      type: 'text',
      text: 'Search across all files in your workspace.',
    },
    {
      type: 'button',
      text: 'Search Files',
      command: 'workbench.action.findInFiles',
    },
    {
      type: 'link',
      text: 'Open Search Editor',
      command: 'search.action.openNewEditor',
    },
  ];

  return (
    <WelcomeView
      viewId="search"
      contents={contents}
      when="searchInputBoxFocus == false"
      context={props.context}
      onCommand={props.onCommand}
      onLinkClick={props.onLinkClick}
      title="Search"
      icon={<Icon name="magnifying-glass" style={{ width: "32px", height: "32px" }} />}
      class={props.class}
    />
  );
};

export interface ExtensionsWelcomeViewProps {
  context?: WhenClauseContext;
  onCommand?: (command: string) => void;
  onLinkClick?: (url: string) => void;
  class?: string;
}

/**
 * Pre-configured welcome view for the Extensions view.
 */
export const ExtensionsWelcomeView: Component<ExtensionsWelcomeViewProps> = (props) => {
  const contents: WelcomeViewContent[] = [
    {
      type: 'text',
      text: 'Enhance your editor with extensions.',
    },
    {
      type: 'button',
      text: 'Browse Extensions',
      command: 'workbench.extensions.search',
    },
    {
      type: 'link',
      text: 'Install from VSIX',
      command: 'workbench.extensions.action.installVSIX',
    },
    {
      type: 'link',
      text: 'Extension Marketplace',
      command: 'https://marketplace.visualstudio.com/vscode',
    },
  ];

  return (
    <WelcomeView
      viewId="extensions"
      contents={contents}
      context={props.context}
      onCommand={props.onCommand}
      onLinkClick={props.onLinkClick}
      title="Extensions"
      icon={<Icon name="box" style={{ width: "32px", height: "32px" }} />}
      class={props.class}
    />
  );
};

// =============================================================================
// WELCOME VIEW REGISTRY (for extension contributions)
// =============================================================================

export interface WelcomeViewRegistry {
  /** Registered welcome views by view ID */
  views: Map<string, WelcomeViewType[]>;
  /** Register a welcome view contribution */
  register: (config: ExtensionWelcomeViewConfig) => void;
  /** Unregister welcome views for a view ID */
  unregister: (viewId: string) => void;
  /** Get welcome views for a specific view */
  getForView: (viewId: string) => WelcomeViewType[];
}

/**
 * Creates a welcome view registry for managing extension contributions.
 */
export function createWelcomeViewRegistry(): WelcomeViewRegistry {
  const views = new Map<string, WelcomeViewType[]>();

  return {
    views,

    register(config: ExtensionWelcomeViewConfig) {
      const existing = views.get(config.view) || [];
      const welcomeView: WelcomeViewType = {
        viewId: config.view,
        contents: config.contents.map(c => ({
          type: c.type,
          text: c.text,
          command: c.command,
          when: c.when,
        })),
        when: config.when,
      };
      views.set(config.view, [...existing, welcomeView]);
    },

    unregister(viewId: string) {
      views.delete(viewId);
    },

    getForView(viewId: string): WelcomeViewType[] {
      return views.get(viewId) || [];
    },
  };
}

// =============================================================================
// DYNAMIC WELCOME VIEW RENDERER
// =============================================================================

export interface DynamicWelcomeViewProps {
  /** View ID to render welcome content for */
  viewId: string;
  /** Registry containing welcome view contributions */
  registry: WelcomeViewRegistry;
  /** Context for when clause evaluation */
  context?: WhenClauseContext;
  /** Command handler */
  onCommand?: (command: string) => void;
  /** Link click handler */
  onLinkClick?: (url: string) => void;
  /** Custom class */
  class?: string;
}

/**
 * Renders all registered welcome views for a specific view ID.
 * Used for displaying extension-contributed welcome content.
 */
export const DynamicWelcomeView: Component<DynamicWelcomeViewProps> = (props) => {
  const welcomeViews = createMemo(() => {
    return props.registry.getForView(props.viewId);
  });

  const defaultContext: WhenClauseContext = {
    workspaceFolderCount: 0,
    viewEmpty: true,
    gitRepository: false,
    editorIsOpen: false,
  };

  const context = createMemo(() => ({
    ...defaultContext,
    ...props.context,
  }));

  // Filter to only visible welcome views
  const visibleViews = createMemo(() => {
    return welcomeViews().filter(view => 
      evaluateWhenClause(view.when, context())
    );
  });



  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
    height: "100%",
    "min-height": "200px",
    background: tokens.colors.surface.base,
  };

  return (
    <Show when={visibleViews().length > 0}>
      <div
        class={`dynamic-welcome-view ${props.class || ''}`}
        data-view-id={props.viewId}
        style={containerStyle}
      >
        <For each={visibleViews()}>
          {(view) => (
            <WelcomeView
              viewId={view.viewId}
              contents={view.contents}
              when={view.when}
              context={context()}
              onCommand={props.onCommand}
              onLinkClick={props.onLinkClick}
            />
          )}
        </For>
      </div>
    </Show>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export default WelcomeView;
export type {
  WelcomeView as WelcomeViewType,
  WelcomeViewContent as WelcomeViewContentType,
};
