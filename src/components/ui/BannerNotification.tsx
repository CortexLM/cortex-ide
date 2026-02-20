/**
 * BannerNotification Component - VSCode-style banner notifications
 *
 * Features:
 * - Position: fixed at top of viewport (below menu bar)
 * - Full-width banners for workspace trust, extension recommendations, updates
 * - Multiple banner types: info, warning, error, success
 * - Dismissable with X button
 * - Action buttons (primary and secondary)
 * - Slide-in animation from top
 * - Auto-dismiss with countdown
 * - Stack multiple banners
 * - Context provider for global banner management
 */

import {
  Show,
  For,
  createSignal,
  createContext,
  useContext,
  onMount,
  onCleanup,
  JSX,
  ParentProps,
  Accessor,
} from "solid-js";
import { Icon } from './Icon';
import { tokens } from "@/design-system/tokens";

// =============================================================================
// TYPES
// =============================================================================

export type BannerType = "info" | "warning" | "error" | "success";

export interface BannerAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface BannerNotificationProps {
  id: string;
  type: BannerType;
  message: string;
  description?: string;
  actions?: BannerAction[];
  dismissable?: boolean;
  autoDismiss?: number; // ms
  onDismiss?: () => void;
  icon?: JSX.Element;
}

interface BannerNotificationContextValue {
  banners: Accessor<BannerNotificationProps[]>;
  addBanner: (banner: Omit<BannerNotificationProps, "id"> & { id?: string }) => string;
  removeBanner: (id: string) => void;
  clearAllBanners: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ANIMATION_DURATION = 200;
const MENU_BAR_HEIGHT = 40; // Height of the title/menu bar

const TYPE_CONFIG: Record<
  BannerType,
  {
    bgTint: string;
    borderColor: string;
    iconColor: string;
  }
> = {
  info: {
    bgTint: "var(--state-info-bg)",
    borderColor: "var(--state-info)",
    iconColor: "var(--state-info)",
  },
  warning: {
    bgTint: "var(--state-warning-bg)",
    borderColor: "var(--state-warning)",
    iconColor: "var(--state-warning)",
  },
  error: {
    bgTint: "var(--state-error-bg)",
    borderColor: "var(--state-error)",
    iconColor: "var(--state-error)",
  },
  success: {
    bgTint: "var(--state-success-bg)",
    borderColor: "var(--state-success)",
    iconColor: "var(--state-success)",
  },
};

// =============================================================================
// CONTEXT
// =============================================================================

const BannerNotificationContext = createContext<BannerNotificationContextValue>();

export function useBannerNotification(): BannerNotificationContextValue {
  const context = useContext(BannerNotificationContext);
  if (!context) {
    throw new Error(
      "useBannerNotification must be used within a BannerNotificationProvider"
    );
  }
  return context;
}

// =============================================================================
// BANNER NOTIFICATION COMPONENT
// =============================================================================

export function BannerNotification(props: BannerNotificationProps) {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isExiting, setIsExiting] = createSignal(false);
  const [countdown, setCountdown] = createSignal<number | null>(null);

  let countdownInterval: ReturnType<typeof setInterval> | undefined;
  let dismissTimeout: ReturnType<typeof setTimeout> | undefined;

  const config = () => TYPE_CONFIG[props.type];
  const dismissable = () => props.dismissable !== false;

  const startAutoDismiss = () => {
    if (!props.autoDismiss || props.autoDismiss <= 0) return;

    const startTime = Date.now();
    const duration = props.autoDismiss;
    setCountdown(Math.ceil(duration / 1000));

    countdownInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setCountdown(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        handleDismiss();
      }
    }, 100);
  };

  const stopAutoDismiss = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
  };

  const handleDismiss = () => {
    if (isExiting()) return;
    setIsExiting(true);
    stopAutoDismiss();

    dismissTimeout = setTimeout(() => {
      props.onDismiss?.();
    }, ANIMATION_DURATION);
  };

  const handleActionClick = (action: BannerAction) => {
    action.onClick();
  };

  onMount(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
    startAutoDismiss();
  });

  onCleanup(() => {
    stopAutoDismiss();
    if (dismissTimeout) clearTimeout(dismissTimeout);
  });

  const getIconName = (): string => {
    switch (props.type) {
      case "success":
        return "check";
      case "error":
        return "circle-exclamation";
      case "warning":
        return "triangle-exclamation";
      case "info":
      default:
        return "circle-info";
    }
  };

  const getAnimationStyle = (): JSX.CSSProperties => {
    if (isExiting()) {
      return {
        opacity: "0",
        transform: "translateY(-100%)",
        "max-height": "0",
        "margin-bottom": "0",
        padding: "0",
        transition: `all ${ANIMATION_DURATION}ms ease-out`,
      };
    }
    if (isVisible()) {
      return {
        opacity: "1",
        transform: "translateY(0)",
        "max-height": "200px",
        transition: `all ${ANIMATION_DURATION}ms ease-out`,
      };
    }
    return {
      opacity: "0",
      transform: "translateY(-100%)",
      "max-height": "0",
    };
  };

  const getPrimaryButtonStyle = (): JSX.CSSProperties => ({
    background: "var(--state-info)",
    color: "var(--text-title)",
    border: "none",
    padding: "6px 12px",
    "border-radius": "var(--radius-sm)",
    "font-size": tokens.typography.fontSize.sm,
    "font-weight": tokens.typography.fontWeight.medium,
    "font-family": tokens.typography.fontFamily.ui,
    cursor: "pointer",
    transition: `background ${tokens.motion.duration.fast} ease`,
    "white-space": "nowrap",
  });

  const getSecondaryButtonStyle = (): JSX.CSSProperties => ({
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
    padding: "6px 12px",
    "border-radius": "var(--radius-sm)",
    "font-size": tokens.typography.fontSize.sm,
    "font-weight": tokens.typography.fontWeight.medium,
    "font-family": tokens.typography.fontFamily.ui,
    cursor: "pointer",
    transition: `background ${tokens.motion.duration.fast} ease`,
    "white-space": "nowrap",
  });

  return (
    <div
      style={{
        width: "100%",
        overflow: "hidden",
        ...getAnimationStyle(),
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: tokens.spacing.lg,
          "min-height": "40px",
          padding: tokens.spacing.md,
          background: config().bgTint,
          "border-bottom": `1px solid ${config().borderColor}`,
          "border-radius": tokens.radius.md,
          "font-family": tokens.typography.fontFamily.ui,
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "flex-shrink": 0,
            color: config().iconColor,
          }}
        >
          {props.icon || <Icon name={getIconName()} size={18} />}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            "min-width": 0,
            display: "flex",
            "flex-direction": "column",
            gap: tokens.spacing.xs,
          }}
        >
          <div
            style={{
              "font-size": "13px",
              "font-weight": tokens.typography.fontWeight.medium,
              color: "var(--text-primary)",
              "line-height": "1.4",
            }}
          >
            {props.message}
          </div>
          <Show when={props.description}>
            <div
              style={{
                "font-size": "13px",
                color: "var(--text-muted)",
                "line-height": "1.4",
              }}
            >
              {props.description}
            </div>
          </Show>
        </div>

        {/* Actions */}
        <Show when={props.actions && props.actions.length > 0}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: tokens.spacing.sm,
              "flex-shrink": 0,
            }}
          >
            <For each={props.actions}>
              {(action) => (
                <button
                  style={
                    action.primary
                      ? getPrimaryButtonStyle()
                      : getSecondaryButtonStyle()
                  }
                  onClick={() => handleActionClick(action)}
                  onMouseEnter={(e) => {
                    if (action.primary) {
                      e.currentTarget.style.background = "var(--surface-active)";
                    } else {
                      e.currentTarget.style.background = "var(--surface-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (action.primary) {
                      e.currentTarget.style.background = "var(--state-info)";
                    } else {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {action.label}
                </button>
              )}
            </For>
          </div>
        </Show>

        {/* Countdown indicator */}
        <Show when={countdown() !== null && countdown()! > 0}>
          <div
            style={{
              "font-size": tokens.typography.fontSize.xs,
              color: tokens.colors.text.muted,
              "flex-shrink": 0,
              "min-width": "24px",
              "text-align": "center",
            }}
          >
            {countdown()}s
          </div>
        </Show>

        {/* Dismiss button */}
        <Show when={dismissable()}>
          <button
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "24px",
              height: "24px",
              padding: "0",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: tokens.colors.text.muted,
              "border-radius": tokens.radius.sm,
              "flex-shrink": 0,
              transition: `background ${tokens.motion.duration.fast} ease, color ${tokens.motion.duration.fast} ease`,
            }}
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.interactive.hover;
              e.currentTarget.style.color = tokens.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = tokens.colors.text.muted;
            }}
          >
            <Icon name="xmark" size={14} />
          </button>
        </Show>
      </div>
    </div>
  );
}

// =============================================================================
// BANNER NOTIFICATION CONTAINER
// =============================================================================

export interface BannerNotificationContainerProps {
  banners: BannerNotificationProps[];
  onDismiss: (id: string) => void;
}

export function BannerNotificationContainer(
  props: BannerNotificationContainerProps
) {
  return (
    <div
      class="banner-notifications"
      style={{
        position: "fixed",
        top: `${MENU_BAR_HEIGHT}px`,
        left: "0",
        right: "0",
        "z-index": tokens.zIndex.notifications,
        display: "flex",
        "flex-direction": "column",
        gap: tokens.spacing.xs,
        padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
        "pointer-events": "none",
      }}
    >
      <For each={props.banners}>
        {(banner) => (
          <div style={{ "pointer-events": "auto" }}>
            <BannerNotification
              {...banner}
              onDismiss={() => {
                banner.onDismiss?.();
                props.onDismiss(banner.id);
              }}
            />
          </div>
        )}
      </For>
    </div>
  );
}

// =============================================================================
// BANNER NOTIFICATION PROVIDER
// =============================================================================

let bannerIdCounter = 0;

function generateBannerId(): string {
  return `banner-${++bannerIdCounter}-${Date.now()}`;
}

export function BannerNotificationProvider(props: ParentProps) {
  const [banners, setBanners] = createSignal<BannerNotificationProps[]>([]);

  const addBanner = (
    banner: Omit<BannerNotificationProps, "id"> & { id?: string }
  ): string => {
    const id = banner.id || generateBannerId();
    const newBanner: BannerNotificationProps = {
      ...banner,
      id,
    };
    setBanners((prev) => [...prev, newBanner]);
    return id;
  };

  const removeBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  };

  const clearAllBanners = () => {
    setBanners([]);
  };

  const contextValue: BannerNotificationContextValue = {
    banners,
    addBanner,
    removeBanner,
    clearAllBanners,
  };

  return (
    <BannerNotificationContext.Provider value={contextValue}>
      {props.children}
      <BannerNotificationContainer banners={banners()} onDismiss={removeBanner} />
    </BannerNotificationContext.Provider>
  );
}

// =============================================================================
// CONVENIENCE FUNCTIONS FOR COMMON BANNER TYPES
// =============================================================================

export function createWorkspaceTrustBanner(
  onTrust: () => void,
  onDontTrust: () => void,
  onDismiss?: () => void
): Omit<BannerNotificationProps, "id"> {
  return {
    type: "warning",
    message: "Do you trust the authors of the files in this folder?",
    description:
      "Code execution is restricted in this workspace until you trust its contents.",
    actions: [
      { label: "Trust", onClick: onTrust, primary: true },
      { label: "Don't Trust", onClick: onDontTrust },
    ],
    dismissable: true,
    onDismiss,
  };
}

export function createExtensionRecommendationBanner(
  extensionName: string,
  onInstall: () => void,
  onDismiss?: () => void
): Omit<BannerNotificationProps, "id"> {
  return {
    type: "info",
    message: `Install recommended extension: ${extensionName}`,
    description:
      "This extension is recommended based on the files in your workspace.",
    actions: [
      { label: "Install", onClick: onInstall, primary: true },
      { label: "Later", onClick: onDismiss || (() => {}) },
    ],
    dismissable: true,
    onDismiss,
  };
}

export function createUpdateAvailableBanner(
  version: string,
  onUpdate: () => void,
  onDismiss?: () => void
): Omit<BannerNotificationProps, "id"> {
  return {
    type: "info",
    message: `A new version (${version}) is available`,
    description: "Restart to update to the latest version with new features and fixes.",
    actions: [
      { label: "Restart to Update", onClick: onUpdate, primary: true },
      { label: "Later", onClick: onDismiss || (() => {}) },
    ],
    dismissable: true,
    onDismiss,
  };
}

export default BannerNotification;
