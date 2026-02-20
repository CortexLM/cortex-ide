/**
 * =============================================================================
 * cortex design tokens - Complete Design System (TypeScript)
 * =============================================================================
 *
 * Extracted from Figma designs - 4 screens analysis
 * THEME: Dark mode with Lime accent
 *
 * Usage:
 *   import { CortexTokens } from '@/design-system/tokens/cortex-tokens';
 *   const style = { background: CortexTokens.colors.bg.primary };
 *
 * Or use raw values for JS calculations:
 *   import { CortexRawValues } from '@/design-system/tokens/cortex-tokens';
 *   const darkerColor = adjustBrightness(CortexRawValues.colors.lime[500], -0.1);
 * =============================================================================
 */

// =============================================================================
// RAW COLOR VALUES (for JS calculations)
// =============================================================================

export const CortexRawValues = {
  colors: {
    // Neutral/Gray scale
    neutral: {
      black: '#000000',
      950: '#0A0A0A',
      900: '#0D0D0D',
      850: '#111111',
      800: '#121212',
      750: '#171717',
      700: '#1A1A1A',
      650: '#1E1E1E',
      600: '#222222',
      550: '#262626',
      500: '#2A2A2A',
      450: '#333333',
      400: '#404040',
      350: '#4D4D4D',
      300: '#666666',
      250: '#737373',
      200: '#808080',
      150: '#999999',
      100: '#A0A0A0',
      50: '#B3B3B3',
      white: '#FFFFFF',
    },

    // Lime accent palette
    lime: {
      50: '#F7FFE5',
      100: '#EEFFCC',
      200: '#DDFF99',
      300: '#CCFF66',
      400: '#BBFF33',
      500: '#B2FF22', // Primary accent (Figma exact)
      600: '#A6E600', // Hover
      700: '#8FCC00', // Pressed
      800: '#739900',
      900: '#5C7A00',
    },

    // Purple accent (Figma component stroke)
    purple: {
      500: '#8A38F5',
    },

    // Figma exact neutral colors
    figma: {
      bg: '#141415',
      surface: '#1C1C1D',
      elevated: '#252628',
      border: '#333337',
      borderHover: '#3C3D40',
      borderStrong: '#4C4C4D',
      borderAlt: '#4E4F54',
      textSecondary: '#8C8D8F',
      textSurface: '#FCFCFC',
      openBg: '#E9E9EA',
    },

    // Success (Green)
    success: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
    },

    // Error (Red)
    error: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
    },

    // Warning (Orange/Yellow)
    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
    },

    // Info (Blue)
    info: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
    },
  },

  spacing: {
    0: 0,
    px: 1,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    20: 80,
    24: 96,
    28: 112,
    32: 128,
  },

  radius: {
    none: 0,
    px: 1,
    '2xs': 2,
    '3xs': 3,
    xs: 4,
    component: 5,
    sm: 6,
    md: 8,
    input: 10,
    lg: 12,
    xl: 16,
    '2xl': 24,
    '3xl': 24,
    full: 9999,
  },

  fontSize: {
    '2xs': 10,
    xs: 12,
    sm: 14,
    base: 16,
    lg: 17,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },

  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    none: 1,
    compact: 1.1428,
    dense: 1.1667,
    tight: 1.2,
    firm: 1.25,
    cozy: 1.32,
    snug: 1.375,
    mid: 1.4286,
    normal: 1.5,
    relaxed: 1.625,
    loose: 1.75,
  },

  iconSize: {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 40,
    '3xl': 48,
  },

  zIndex: {
    base: 0,
    docked: 10,
    dropdown: 100,
    sticky: 200,
    banner: 300,
    overlay: 400,
    modal: 500,
    popover: 600,
    tooltip: 700,
    toast: 800,
    max: 9999,
  },

  duration: {
    instant: 50,
    fast: 100,
    normal: 200,
    slow: 300,
    slower: 500,
  },

  dimensions: {
    input: {
      sm: 32,
      md: 40,
      lg: 48,
    },
    button: {
      sm: 32,
      md: 40,
      lg: 48,
    },
    tab: 44,
    titlebar: 40,
    statusbar: 24,
    navbar: 56,
    sidebar: {
      sm: 220,
      md: 280,
      lg: 320,
    },
    activitybar: 40,
    modal: {
      sm: 400,
      md: 560,
      lg: 720,
      xl: 900,
    },
    scrollbar: 8,
  },
} as const;

// =============================================================================
// CSS VARIABLE REFERENCES (for use in styles)
// =============================================================================

export const CortexTokens = {
  colors: {
    // Background colors
    bg: {
      primary: 'var(--cortex-bg-primary)',
      secondary: 'var(--cortex-bg-secondary)',
      tertiary: 'var(--cortex-bg-tertiary)',
      elevated: 'var(--cortex-bg-elevated)',
      hover: 'var(--cortex-bg-hover)',
      active: 'var(--cortex-bg-active)',
      overlay: 'var(--cortex-bg-overlay)',
      backdrop: 'var(--cortex-bg-backdrop)',
    },

    // Text colors
    text: {
      primary: 'var(--cortex-text-primary)',
      secondary: 'var(--cortex-text-secondary)',
      tertiary: 'var(--cortex-text-tertiary)',
      muted: 'var(--cortex-text-muted)',
      disabled: 'var(--cortex-text-disabled)',
      placeholder: 'var(--cortex-text-placeholder)',
      inverse: 'var(--cortex-text-inverse)',
      link: 'var(--cortex-text-link)',
      linkHover: 'var(--cortex-text-link-hover)',
    },

    // Accent colors (Lime)
    accent: {
      primary: 'var(--cortex-accent-primary)',
      hover: 'var(--cortex-accent-hover)',
      pressed: 'var(--cortex-accent-pressed)',
      muted: 'var(--cortex-accent-muted)',
      glow: 'var(--cortex-accent-glow)',
      text: 'var(--cortex-accent-text)',
      disabled: 'var(--cortex-accent-disabled)',
      blue: 'var(--cortex-accent-blue)',
      darkBg: 'var(--cortex-accent-dark-bg)',
      purple: 'var(--cortex-accent-purple)',
    },

    // Semantic state colors
    state: {
      success: 'var(--cortex-success)',
      successHover: 'var(--cortex-success-hover)',
      successBg: 'var(--cortex-success-bg)',
      error: 'var(--cortex-error)',
      errorHover: 'var(--cortex-error-hover)',
      errorBg: 'var(--cortex-error-bg)',
      warning: 'var(--cortex-warning)',
      warningHover: 'var(--cortex-warning-hover)',
      warningBg: 'var(--cortex-warning-bg)',
      info: 'var(--cortex-info)',
      infoHover: 'var(--cortex-info-hover)',
      infoBg: 'var(--cortex-info-bg)',
    },

    // Border colors
    border: {
      default: 'var(--cortex-border-default)',
      hover: 'var(--cortex-border-hover)',
      focus: 'var(--cortex-border-focus)',
      error: 'var(--cortex-border-error)',
      success: 'var(--cortex-border-success)',
      subtle: 'var(--cortex-border-subtle)',
      strong: 'var(--cortex-border-strong)',
      accent: 'var(--cortex-border-accent)',
      card: 'var(--cortex-border-card)',
      internal: 'var(--cortex-border-internal)',
    },

    // Syntax highlighting
    syntax: {
      keyword: 'var(--cortex-syntax-keyword)',
      string: 'var(--cortex-syntax-string)',
      number: 'var(--cortex-syntax-number)',
      comment: 'var(--cortex-syntax-comment)',
      function: 'var(--cortex-syntax-function)',
      variable: 'var(--cortex-syntax-variable)',
      type: 'var(--cortex-syntax-type)',
      constant: 'var(--cortex-syntax-constant)',
      operator: 'var(--cortex-syntax-operator)',
      bracket: 'var(--cortex-syntax-bracket)',
      property: 'var(--cortex-syntax-property)',
      parameter: 'var(--cortex-syntax-parameter)',
      lineNumber: 'var(--cortex-syntax-line-number)',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: 'var(--cortex-font-sans)',
      display: 'var(--cortex-font-display)',
      mono: 'var(--cortex-font-mono)',
      serif: 'var(--cortex-font-serif)',
    },
    fontSize: {
      '2xs': 'var(--cortex-text-2xs)',
      xs: 'var(--cortex-text-xs)',
      sm: 'var(--cortex-text-sm)',
      base: 'var(--cortex-text-base)',
      lg: 'var(--cortex-text-lg)',
      xl: 'var(--cortex-text-xl)',
      '2xl': 'var(--cortex-text-2xl)',
      '3xl': 'var(--cortex-text-3xl)',
      '4xl': 'var(--cortex-text-4xl)',
      '5xl': 'var(--cortex-text-5xl)',
    },
    fontWeight: {
      regular: 'var(--cortex-font-regular)',
      medium: 'var(--cortex-font-medium)',
      semibold: 'var(--cortex-font-semibold)',
      bold: 'var(--cortex-font-bold)',
    },
    lineHeight: {
      none: 'var(--cortex-leading-none)',
      compact: 'var(--cortex-leading-compact)',
      dense: 'var(--cortex-leading-dense)',
      tight: 'var(--cortex-leading-tight)',
      firm: 'var(--cortex-leading-firm)',
      cozy: 'var(--cortex-leading-cozy)',
      snug: 'var(--cortex-leading-snug)',
      mid: 'var(--cortex-leading-mid)',
      normal: 'var(--cortex-leading-normal)',
      relaxed: 'var(--cortex-leading-relaxed)',
      loose: 'var(--cortex-leading-loose)',
    },
    letterSpacing: {
      tighter: 'var(--cortex-tracking-tighter)',
      tight: 'var(--cortex-tracking-tight)',
      figma: 'var(--cortex-tracking-figma)',
      normal: 'var(--cortex-tracking-normal)',
      wide: 'var(--cortex-tracking-wide)',
      wider: 'var(--cortex-tracking-wider)',
    },
  },

  // Spacing
  spacing: {
    0: 'var(--cortex-space-0)',
    px: 'var(--cortex-space-px)',
    0.5: 'var(--cortex-space-0-5)',
    1: 'var(--cortex-space-1)',
    1.5: 'var(--cortex-space-1-5)',
    2: 'var(--cortex-space-2)',
    2.5: 'var(--cortex-space-2-5)',
    3: 'var(--cortex-space-3)',
    3.5: 'var(--cortex-space-3-5)',
    4: 'var(--cortex-space-4)',
    5: 'var(--cortex-space-5)',
    6: 'var(--cortex-space-6)',
    7: 'var(--cortex-space-7)',
    8: 'var(--cortex-space-8)',
    9: 'var(--cortex-space-9)',
    10: 'var(--cortex-space-10)',
    11: 'var(--cortex-space-11)',
    12: 'var(--cortex-space-12)',
    14: 'var(--cortex-space-14)',
    16: 'var(--cortex-space-16)',
    20: 'var(--cortex-space-20)',
    24: 'var(--cortex-space-24)',
    28: 'var(--cortex-space-28)',
    32: 'var(--cortex-space-32)',
  },

  // Border radius
  radius: {
    none: 'var(--cortex-radius-none)',
    px: 'var(--cortex-radius-px)',
    '2xs': 'var(--cortex-radius-2xs)',
    '3xs': 'var(--cortex-radius-3xs)',
    xs: 'var(--cortex-radius-xs)',
    component: 'var(--cortex-radius-component)',
    sm: 'var(--cortex-radius-sm)',
    md: 'var(--cortex-radius-md)',
    input: 'var(--cortex-radius-input)',
    lg: 'var(--cortex-radius-lg)',
    xl: 'var(--cortex-radius-xl)',
    '2xl': 'var(--cortex-radius-2xl)',
    '3xl': 'var(--cortex-radius-3xl)',
    full: 'var(--cortex-radius-full)',
  },

  // Shadows
  shadows: {
    sm: 'var(--cortex-shadow-sm)',
    md: 'var(--cortex-shadow-md)',
    lg: 'var(--cortex-shadow-lg)',
    xl: 'var(--cortex-shadow-xl)',
    '2xl': 'var(--cortex-shadow-2xl)',
    inner: 'var(--cortex-shadow-inner)',
    elevation: {
      1: 'var(--cortex-elevation-1)',
      2: 'var(--cortex-elevation-2)',
      3: 'var(--cortex-elevation-3)',
      4: 'var(--cortex-elevation-4)',
    },
    glow: {
      accent: 'var(--cortex-glow-accent)',
      success: 'var(--cortex-glow-success)',
      error: 'var(--cortex-glow-error)',
    },
  },

  // Icon sizes
  iconSize: {
    xs: 'var(--cortex-icon-xs)',
    sm: 'var(--cortex-icon-sm)',
    md: 'var(--cortex-icon-md)',
    lg: 'var(--cortex-icon-lg)',
    xl: 'var(--cortex-icon-xl)',
    '2xl': 'var(--cortex-icon-2xl)',
    '3xl': 'var(--cortex-icon-3xl)',
  },

  // Z-index
  zIndex: {
    base: 'var(--cortex-z-base)',
    docked: 'var(--cortex-z-docked)',
    dropdown: 'var(--cortex-z-dropdown)',
    sticky: 'var(--cortex-z-sticky)',
    banner: 'var(--cortex-z-banner)',
    overlay: 'var(--cortex-z-overlay)',
    modal: 'var(--cortex-z-modal)',
    popover: 'var(--cortex-z-popover)',
    tooltip: 'var(--cortex-z-tooltip)',
    toast: 'var(--cortex-z-toast)',
    max: 'var(--cortex-z-max)',
  },

  // Transitions
  transitions: {
    fast: 'var(--cortex-transition-fast)',
    normal: 'var(--cortex-transition-normal)',
    slow: 'var(--cortex-transition-slow)',
    slower: 'var(--cortex-transition-slower)',
  },

  // Easing
  easing: {
    in: 'var(--cortex-ease-in)',
    out: 'var(--cortex-ease-out)',
    inOut: 'var(--cortex-ease-in-out)',
    bounce: 'var(--cortex-ease-bounce)',
  },

  // Durations
  duration: {
    instant: 'var(--cortex-duration-instant)',
    fast: 'var(--cortex-duration-fast)',
    normal: 'var(--cortex-duration-normal)',
    slow: 'var(--cortex-duration-slow)',
    slower: 'var(--cortex-duration-slower)',
  },

  // Layout dimensions
  dimensions: {
    input: {
      sm: 'var(--cortex-height-input-sm)',
      md: 'var(--cortex-height-input)',
      lg: 'var(--cortex-height-input-lg)',
    },
    button: {
      sm: 'var(--cortex-height-button-sm)',
      md: 'var(--cortex-height-button)',
      lg: 'var(--cortex-height-button-lg)',
    },
    tab: 'var(--cortex-height-tab)',
    titlebar: 'var(--cortex-height-titlebar)',
    statusbar: 'var(--cortex-height-statusbar)',
    navbar: 'var(--cortex-height-navbar)',
    sidebar: {
      sm: 'var(--cortex-width-sidebar-sm)',
      md: 'var(--cortex-width-sidebar)',
      lg: 'var(--cortex-width-sidebar-lg)',
    },
    activitybar: 'var(--cortex-width-activitybar)',
    modal: {
      sm: 'var(--cortex-width-modal-sm)',
      md: 'var(--cortex-width-modal-md)',
      lg: 'var(--cortex-width-modal-lg)',
      xl: 'var(--cortex-width-modal-xl)',
    },
    scrollbar: 'var(--cortex-scrollbar-width)',
  },

  // Component-specific tokens
  components: {
    // Input tokens
    input: {
      bg: 'var(--cortex-input-bg)',
      bgHover: 'var(--cortex-input-bg-hover)',
      bgFocus: 'var(--cortex-input-bg-focus)',
      bgDisabled: 'var(--cortex-input-bg-disabled)',
      border: 'var(--cortex-input-border)',
      borderHover: 'var(--cortex-input-border-hover)',
      borderFocus: 'var(--cortex-input-border-focus)',
      borderError: 'var(--cortex-input-border-error)',
      text: 'var(--cortex-input-text)',
      placeholder: 'var(--cortex-input-placeholder)',
      radius: 'var(--cortex-input-radius)',
    },

    // Button tokens
    button: {
      primary: {
        bg: 'var(--cortex-btn-primary-bg)',
        bgHover: 'var(--cortex-btn-primary-bg-hover)',
        bgActive: 'var(--cortex-btn-primary-bg-active)',
        text: 'var(--cortex-btn-primary-text)',
        border: 'var(--cortex-btn-primary-border)',
      },
      secondary: {
        bg: 'var(--cortex-btn-secondary-bg)',
        bgHover: 'var(--cortex-btn-secondary-bg-hover)',
        bgActive: 'var(--cortex-btn-secondary-bg-active)',
        text: 'var(--cortex-btn-secondary-text)',
        border: 'var(--cortex-btn-secondary-border)',
      },
      ghost: {
        bg: 'var(--cortex-btn-ghost-bg)',
        bgHover: 'var(--cortex-btn-ghost-bg-hover)',
        bgActive: 'var(--cortex-btn-ghost-bg-active)',
        text: 'var(--cortex-btn-ghost-text)',
        border: 'var(--cortex-btn-ghost-border)',
      },
      danger: {
        bg: 'var(--cortex-btn-danger-bg)',
        bgHover: 'var(--cortex-btn-danger-bg-hover)',
        bgActive: 'var(--cortex-btn-danger-bg-active)',
        text: 'var(--cortex-btn-danger-text)',
        border: 'var(--cortex-btn-danger-border)',
      },
    },

    // Card tokens
    card: {
      bg: 'var(--cortex-card-bg)',
      bgHover: 'var(--cortex-card-bg-hover)',
      border: 'var(--cortex-card-border)',
      borderHover: 'var(--cortex-card-border-hover)',
      radius: 'var(--cortex-card-radius)',
      shadow: 'var(--cortex-card-shadow)',
    },

    // Modal tokens
    modal: {
      bg: 'var(--cortex-modal-bg)',
      border: 'var(--cortex-modal-border)',
      radius: 'var(--cortex-modal-radius)',
      shadow: 'var(--cortex-modal-shadow)',
      overlay: 'var(--cortex-modal-overlay)',
    },

    // Dropdown tokens
    dropdown: {
      bg: 'var(--cortex-dropdown-bg)',
      border: 'var(--cortex-dropdown-border)',
      radius: 'var(--cortex-dropdown-radius)',
      shadow: 'var(--cortex-dropdown-shadow)',
      itemHover: 'var(--cortex-dropdown-item-hover)',
      itemActive: 'var(--cortex-dropdown-item-active)',
    },

    // Tooltip tokens
    tooltip: {
      bg: 'var(--cortex-tooltip-bg)',
      border: 'var(--cortex-tooltip-border)',
      text: 'var(--cortex-tooltip-text)',
      radius: 'var(--cortex-tooltip-radius)',
      shadow: 'var(--cortex-tooltip-shadow)',
    },

    // Toast tokens
    toast: {
      bg: 'var(--cortex-toast-bg)',
      border: 'var(--cortex-toast-border)',
      radius: 'var(--cortex-toast-radius)',
      shadow: 'var(--cortex-toast-shadow)',
    },

    // Tab tokens
    tab: {
      bg: 'var(--cortex-tab-bg)',
      bgHover: 'var(--cortex-tab-bg-hover)',
      bgActive: 'var(--cortex-tab-bg-active)',
      text: 'var(--cortex-tab-text)',
      textHover: 'var(--cortex-tab-text-hover)',
      textActive: 'var(--cortex-tab-text-active)',
      indicator: 'var(--cortex-tab-indicator)',
    },

    // Scrollbar tokens
    scrollbar: {
      track: 'var(--cortex-scrollbar-track)',
      thumb: 'var(--cortex-scrollbar-thumb)',
      thumbHover: 'var(--cortex-scrollbar-thumb-hover)',
      width: 'var(--cortex-scrollbar-width)',
      radius: 'var(--cortex-scrollbar-radius)',
    },

    // Badge tokens
    badge: {
      bg: 'var(--cortex-badge-bg)',
      text: 'var(--cortex-badge-text)',
      radius: 'var(--cortex-badge-radius)',
    },

    // Avatar tokens
    avatar: {
      bg: 'var(--cortex-avatar-bg)',
      border: 'var(--cortex-avatar-border)',
      radius: 'var(--cortex-avatar-radius)',
    },

    // Divider tokens
    divider: {
      color: 'var(--cortex-divider-color)',
      strong: 'var(--cortex-divider-strong)',
    },

    // Switch/Toggle tokens
    switch: {
      bgOff: 'var(--cortex-switch-bg-off)',
      bgOn: 'var(--cortex-switch-bg-on)',
      thumb: 'var(--cortex-switch-thumb)',
      border: 'var(--cortex-switch-border)',
    },

    // Checkbox/Radio tokens
    checkbox: {
      bg: 'var(--cortex-checkbox-bg)',
      bgChecked: 'var(--cortex-checkbox-bg-checked)',
      bgCheckedBlue: 'var(--cortex-checkbox-bg-checked-blue)',
      bgUnchecked: 'var(--cortex-checkbox-bg-unchecked)',
      border: 'var(--cortex-checkbox-border)',
      borderChecked: 'var(--cortex-checkbox-border-checked)',
      check: 'var(--cortex-checkbox-check)',
    },

    // Progress tokens
    progress: {
      bg: 'var(--cortex-progress-bg)',
      fill: 'var(--cortex-progress-fill)',
      radius: 'var(--cortex-progress-radius)',
    },

    // Skeleton tokens
    skeleton: {
      base: 'var(--cortex-skeleton-base)',
      highlight: 'var(--cortex-skeleton-highlight)',
    },

    // Focus ring tokens
    focus: {
      ring: 'var(--cortex-focus-ring)',
      ringOffset: 'var(--cortex-focus-ring-offset)',
      ringError: 'var(--cortex-focus-ring-error)',
    },

    // Icon button tokens (Figma)
    iconButton: {
      hoverBg: 'var(--cortex-icon-button-hover-bg)',
    },
  },
} as const;

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CortexTokens = typeof CortexTokens;
export type CortexRawValues = typeof CortexRawValues;
export type CortexColors = typeof CortexTokens.colors;
export type CortexTypography = typeof CortexTokens.typography;
export type CortexSpacing = typeof CortexTokens.spacing;
export type CortexComponents = typeof CortexTokens.components;

// Specific color types
export type CortexBackgroundColor = keyof typeof CortexTokens.colors.bg;
export type CortexTextColor = keyof typeof CortexTokens.colors.text;
export type CortexAccentColor = keyof typeof CortexTokens.colors.accent;
export type CortexStateColor = keyof typeof CortexTokens.colors.state;
export type CortexBorderColor = keyof typeof CortexTokens.colors.border;

// Spacing types
export type CortexSpacingKey = keyof typeof CortexTokens.spacing;

// Typography types
export type CortexFontSize = keyof typeof CortexTokens.typography.fontSize;
export type CortexFontWeight = keyof typeof CortexTokens.typography.fontWeight;
export type CortexLineHeight = keyof typeof CortexTokens.typography.lineHeight;

// Radius types
export type CortexRadius = keyof typeof CortexTokens.radius;

// Z-index types
export type CortexZIndex = keyof typeof CortexTokens.zIndex;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a CSS variable reference by path
 * @example getToken('colors.bg.primary') => 'var(--cortex-bg-primary)'
 */
export function getToken<T extends keyof CortexTokens>(
  category: T,
  ...path: string[]
): string {
  let value: unknown = CortexTokens[category];
  for (const key of path) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      console.warn(`Token not found: ${category}.${path.join('.')}`);
      return '';
    }
  }
  return typeof value === 'string' ? value : '';
}

/**
 * Get a raw value by path (for JS calculations)
 * @example getRawValue('colors.lime.500') => '#B2FF22'
 */
export function getRawValue<T extends keyof CortexRawValues>(
  category: T,
  ...path: string[]
): string | number {
  let value: unknown = CortexRawValues[category];
  for (const key of path) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      console.warn(`Raw value not found: ${category}.${path.join('.')}`);
      return '';
    }
  }
  return value as string | number;
}

/**
 * Convert spacing number to pixel string
 * @example spacingToPx(4) => '16px'
 */
export function spacingToPx(
  key: keyof typeof CortexRawValues.spacing
): string {
  return `${CortexRawValues.spacing[key]}px`;
}

/**
 * Convert radius key to pixel string
 * @example radiusToPx('md') => '8px'
 */
export function radiusToPx(
  key: keyof typeof CortexRawValues.radius
): string {
  const value = CortexRawValues.radius[key];
  return value === 9999 ? '9999px' : `${value}px`;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default CortexTokens;



