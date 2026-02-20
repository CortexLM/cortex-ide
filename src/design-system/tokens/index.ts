/**
 * =============================================================================
 * DESIGN SYSTEM TOKENS - Legacy Orion Semantic Tokens
 * =============================================================================
 *
 * @deprecated — This module maps to the LEGACY Orion/blue-accent design-tokens.css.
 * The canonical design system is cortex-tokens.ts (Lime accent, from Figma).
 *
 * New components should import from '@/design-system/tokens/cortex-tokens' instead:
 *   import { CortexTokens } from '@/design-system/tokens/cortex-tokens';
 *
 * Existing imports will continue to work — CSS variables are aliased to
 * their --cortex-* equivalents in design-tokens.css.
 * =============================================================================
 */

// =============================================================================
// COLOR TOKENS
// @deprecated — Use CortexTokens.colors from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.colors from '@/design-system/tokens/cortex-tokens' */
export const colors = {
  // Surface hierarchy
  surface: {
    base: 'var(--surface-base)',           // Graphite #26292C
    card: 'var(--surface-card)',           // Carbon #191A1C
    panel: 'var(--surface-panel)',
    input: 'var(--surface-input)',
    hover: 'var(--surface-hover)',
    active: 'var(--surface-active)',
    elevated: 'var(--surface-elevated)',
    overlay: 'var(--surface-overlay)',
    canvas: 'var(--surface-base)',         // Alias for compatibility
    popup: 'var(--surface-elevated)',      // Alias for compatibility
    modal: 'var(--surface-elevated)',      // Alias for compatibility
  },
  
  // Interactive surface states (for backwards compatibility)
  interactive: {
    hover: 'var(--surface-hover)',
    active: 'var(--surface-active)',
    selected: 'var(--surface-active)',
  },
  
  // Text hierarchy
  text: {
    title: 'var(--text-title)',
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
    placeholder: 'var(--text-placeholder)',
    disabled: 'var(--text-disabled)',
    inverse: 'var(--text-inverse)',
  },
  
  // Icon colors (for backwards compatibility)
  icon: {
    default: 'var(--text-muted)',
    inactive: 'var(--text-disabled)',
    active: 'var(--text-title)',
  },
  
  // Accent colors (Blue)
  accent: {
    primary: 'var(--accent-primary)',
    hover: 'var(--accent-hover)',
    active: 'var(--accent-active)',
    muted: 'var(--accent-muted)',
    glow: 'var(--accent-glow)',
    light: 'var(--accent-light)',
  },
  
  // Border colors
  border: {
    default: 'var(--border-default)',
    hover: 'var(--border-hover)',
    focus: 'var(--border-focus)',
    error: 'var(--border-error)',
    success: 'var(--border-success)',
    divider: 'var(--border-default)',      // Alias for compatibility
    panel: 'var(--border-default)',        // Alias for compatibility
  },
  
  // Semantic colors (for backwards compatibility)
  semantic: {
    primary: 'var(--accent-primary)',
    success: 'var(--state-success)',
    warning: 'var(--state-warning)',
    error: 'var(--state-error)',
    info: 'var(--state-info)',
  },
  
  // Semantic state colors
  state: {
    success: 'var(--state-success)',
    successBg: 'var(--state-success-bg)',
    warning: 'var(--state-warning)',
    warningBg: 'var(--state-warning-bg)',
    error: 'var(--state-error)',
    errorBg: 'var(--state-error-bg)',
    info: 'var(--state-info)',
    infoBg: 'var(--state-info-bg)',
  },
  
  // Neon loader colors
  neon: {
    color: 'var(--neon-color)',
    glow: 'var(--neon-glow)',
  },
  
  // Factory node category colors
  node: {
    trigger: 'var(--node-trigger)',
    agent: 'var(--node-agent)',
    supervisor: 'var(--node-supervisor)',
    action: 'var(--node-action)',
    logic: 'var(--node-logic)',
    communication: 'var(--node-communication)',
    utility: 'var(--node-utility)',
  },
  
  // Factory port data type colors
  port: {
    any: 'var(--port-any)',
    string: 'var(--port-string)',
    number: 'var(--port-number)',
    boolean: 'var(--port-boolean)',
    object: 'var(--port-object)',
    array: 'var(--port-array)',
    agent: 'var(--port-agent)',
    message: 'var(--port-message)',
    event: 'var(--port-event)',
    error: 'var(--port-error)',
  },
} as const;

// =============================================================================
// SPACING TOKENS
// @deprecated — Use CortexTokens.spacing from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.spacing from '@/design-system/tokens/cortex-tokens' */
export const spacing = {
  0: 'var(--space-0)',
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  
  // Aliases
  xs: 'var(--space-1)',
  sm: 'var(--space-2)',
  md: 'var(--space-3)',
  lg: 'var(--space-4)',
  xl: 'var(--space-6)',
  '2xl': 'var(--space-8)',
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// @deprecated — Use CortexTokens.typography from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.typography from '@/design-system/tokens/cortex-tokens' */
export const typography = {
  fontFamily: {
    ui: 'var(--font-ui)',
    mono: 'var(--font-mono)',
  },
  
  fontSize: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
    '3xl': 'var(--text-3xl)',
  },
  
  fontWeight: {
    normal: 'var(--font-normal)',
    medium: 'var(--font-medium)',
    semibold: 'var(--font-semibold)',
    bold: 'var(--font-bold)',
  },
} as const;

// =============================================================================
// RADIUS TOKENS
// @deprecated — Use CortexTokens.radius from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.radius from '@/design-system/tokens/cortex-tokens' */
export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  full: 'var(--radius-full)',
} as const;

// =============================================================================
// SHADOW TOKENS
// @deprecated — Use CortexTokens.shadows from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.shadows from '@/design-system/tokens/cortex-tokens' */
export const shadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  popup: 'var(--shadow-popup)',
  modal: 'var(--shadow-modal)',
} as const;

// =============================================================================
// Z-INDEX TOKENS
// @deprecated — Use CortexTokens.zIndex from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.zIndex from '@/design-system/tokens/cortex-tokens' */
export const zIndex = {
  base: 'var(--z-base)',
  dropdown: 'var(--z-dropdown)',
  sticky: 'var(--z-sticky)',
  overlay: 'var(--z-overlay)',
  modal: 'var(--z-modal)',
  popover: 'var(--z-popover)',
  tooltip: 'var(--z-tooltip)',
  notification: 'var(--z-notification)',
  notifications: 'var(--z-notification)',  // Alias for compatibility
  max: 'var(--z-max)',
} as const;

// =============================================================================
// TRANSITION TOKENS
// @deprecated — Use CortexTokens.transitions from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.transitions from '@/design-system/tokens/cortex-tokens' */
export const transitions = {
  fast: 'var(--transition-fast)',
  normal: 'var(--transition-normal)',
  slow: 'var(--transition-slow)',
} as const;

// =============================================================================
// MOTION TOKENS (for animation timing)
// @deprecated — Use CortexTokens.duration / CortexTokens.easing from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.duration / CortexTokens.easing from '@/design-system/tokens/cortex-tokens' */
export const motion = {
  duration: {
    instant: '50ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0.0, 1, 1)',
    easeOut: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
} as const;

// =============================================================================
// SIZE TOKENS
// @deprecated — Use CortexTokens.dimensions from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.dimensions from '@/design-system/tokens/cortex-tokens' */
export const sizes = {
  button: {
    sm: 'var(--height-button-sm)',
    md: 'var(--height-button-md)',
    lg: 'var(--height-button-lg)',
  },
  input: {
    default: 'var(--height-input)',
  },
  layout: {
    tab: 'var(--height-tab)',
    titlebar: 'var(--height-titlebar)',
    statusbar: 'var(--height-statusbar)',
    panelHeader: 'var(--height-panel-header, 35px)',
    sidebar: 'var(--width-sidebar)',
    sidebarMin: 'var(--width-sidebar-min)',
    activityBar: 'var(--width-activitybar)',
  },
} as const;

// =============================================================================
// COMPONENT TOKENS
// @deprecated — Use CortexTokens.components from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.components from '@/design-system/tokens/cortex-tokens' */
export const components = {
  button: {
    primary: {
      bg: 'var(--button-primary-bg)',
      bgHover: 'var(--button-primary-bg-hover)',
      bgActive: 'var(--button-primary-bg-active)',
      text: 'var(--button-primary-text)',
    },
    secondary: {
      bg: 'var(--button-secondary-bg)',
      bgHover: 'var(--button-secondary-bg-hover)',
      bgActive: 'var(--button-secondary-bg-active)',
      text: 'var(--button-secondary-text)',
      border: 'var(--button-secondary-border)',
    },
    ghost: {
      bg: 'var(--button-ghost-bg)',
      bgHover: 'var(--button-ghost-bg-hover)',
      bgActive: 'var(--button-ghost-bg-active)',
      text: 'var(--button-ghost-text)',
    },
    danger: {
      bg: 'var(--button-danger-bg)',
      bgHover: 'var(--button-danger-bg-hover)',
      bgActive: 'var(--button-danger-bg-active)',
      text: 'var(--button-danger-text)',
    },
  },
  
  input: {
    bg: 'var(--input-bg)',
    border: 'var(--input-border)',
    borderHover: 'var(--input-border-hover)',
    borderFocus: 'var(--input-border-focus)',
    text: 'var(--input-text)',
    placeholder: 'var(--input-placeholder)',
    radius: 'var(--input-radius)',
    height: 'var(--input-height)',
  },
  
  card: {
    bg: 'var(--card-bg)',
    bgHover: 'var(--card-bg-hover)',
    border: 'var(--card-border)',
    borderHover: 'var(--card-border-hover)',
    radius: 'var(--card-radius)',
    shadow: 'var(--card-shadow)',
  },
  
  modal: {
    bg: 'var(--modal-bg)',
    border: 'var(--modal-border)',
    radius: 'var(--modal-radius)',
    shadow: 'var(--modal-shadow)',
    overlay: 'var(--modal-overlay)',
  },
  
  toast: {
    bg: 'var(--toast-bg)',
    border: 'var(--toast-border)',
    radius: 'var(--toast-radius)',
    shadow: 'var(--toast-shadow)',
  },
  
  tooltip: {
    bg: 'var(--tooltip-bg)',
    border: 'var(--tooltip-border)',
    text: 'var(--tooltip-text)',
    radius: 'var(--tooltip-radius)',
    shadow: 'var(--tooltip-shadow)',
  },
  
  tab: {
    bg: 'var(--tab-bg)',
    bgHover: 'var(--tab-bg-hover)',
    bgActive: 'var(--tab-bg-active)',
    text: 'var(--tab-text)',
    textActive: 'var(--tab-text-active)',
    border: 'var(--tab-border)',
  },
  
  scrollbar: {
    thumb: 'var(--scrollbar-thumb)',
    thumbHover: 'var(--scrollbar-thumb-hover)',
    track: 'var(--scrollbar-track)',
    width: 'var(--scrollbar-width)',
  },
  
  skeleton: {
    base: 'var(--skeleton-base)',
    highlight: 'var(--skeleton-highlight)',
  },
} as const;

// =============================================================================
// VIBE MODE TOKENS (aliases to main tokens for compatibility)
// @deprecated — Use CortexTokens.colors.accent from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexTokens.colors.accent from '@/design-system/tokens/cortex-tokens' */
export const vibeColors = {
  accent: 'var(--vibe-accent)',
  accentHover: 'var(--vibe-accent-hover)',
  accentMuted: 'var(--vibe-accent-muted)',
  bg: 'var(--vibe-bg)',
  surface: 'var(--vibe-surface)',
  surfaceElevated: 'var(--vibe-surface-elevated)',
  border: 'var(--vibe-border)',
  textPrimary: 'var(--vibe-text-primary)',
  textSecondary: 'var(--vibe-text-secondary)',
  textMuted: 'var(--vibe-text-muted)',
} as const;

// =============================================================================
// RAW VALUES (for use in JS calculations where CSS vars don't work)
// @deprecated — Use CortexRawValues from cortex-tokens.ts
// =============================================================================

/** @deprecated Use CortexRawValues from '@/design-system/tokens/cortex-tokens' */
export const rawValues = {
  colors: {
    graphite: '#26292C',
    carbon: '#191A1C',
    blue500: '#3b82f6',
    blue600: '#2563eb',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    white: '#f8f9fa',
    neonCyan: '#00D9FF',
    // Factory node colors (raw values for JS calculations)
    nodeTrigger: '#E9AA46',
    nodeAgent: '#3574F0',
    nodeSupervisor: '#9D5BD2',
    nodeAction: '#59A869',
    nodeLogic: '#CC7832',
    nodeCommunication: '#C75450',
    nodeUtility: '#8B8B8B',
    // Factory port colors (raw values for JS calculations)
    portObject: '#9B59B6',
    portArray: '#1ABC9C',
    portAgent: '#3498DB',
    portMessage: '#00BCD4',
    portEvent: '#E91E63',
  },
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 12,
  },
} as const;

// =============================================================================
// UNIFIED TOKENS EXPORT
// @deprecated — Use CortexTokens from '@/design-system/tokens/cortex-tokens'
// =============================================================================

/** @deprecated Use CortexTokens from '@/design-system/tokens/cortex-tokens' */
export const tokens = {
  colors,
  spacing,
  typography,
  radius,
  shadows,
  zIndex,
  transitions,
  motion,
  sizes,
  components,
  vibeColors,
  rawValues,
} as const;

/** @deprecated */
export type Tokens = typeof tokens;
/** @deprecated */
export type Colors = typeof colors;
/** @deprecated */
export type Components = typeof components;

/** @deprecated Use CortexTokens from '@/design-system/tokens/cortex-tokens' */
export default tokens;
