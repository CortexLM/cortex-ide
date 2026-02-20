/**
 * CortexTabs - Pixel-perfect tabs component for Cortex UI Design System
 * Supports horizontal/vertical orientation, icons, closable tabs, and keyboard navigation
 */

import {
  Component,
  JSX,
  splitProps,
  createSignal,
  createEffect,
  For,
  Show,
  onMount,
  onCleanup,
} from "solid-js";
import { CortexIcon } from "./CortexIcon";

export interface CortexTab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  closable?: boolean;
  badge?: string | number;
}

export interface CortexTabsProps {
  tabs: CortexTab[];
  activeTab?: string;
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "pills" | "underline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
  onChange?: (tabId: string) => void;
  onClose?: (tabId: string) => void;
  children?: (tabId: string) => JSX.Element;
}

export interface CortexTabPanelProps {
  id: string;
  class?: string;
  style?: JSX.CSSProperties;
  children?: JSX.Element;
}

const SIZE_STYLES: Record<"sm" | "md" | "lg", { height: string; padding: string; fontSize: string }> = {
  sm: { height: "28px", padding: "10px 20px", fontSize: "12px" },
  md: { height: "36px", padding: "10px 20px", fontSize: "12px" },
  lg: { height: "44px", padding: "10px 20px", fontSize: "12px" },
};

export const CortexTabs: Component<CortexTabsProps> = (props) => {
  const [local, others] = splitProps(props, [
    "tabs",
    "activeTab",
    "orientation",
    "variant",
    "size",
    "fullWidth",
    "class",
    "style",
    "onChange",
    "onClose",
    "children",
  ]);

  const [focusedIndex, setFocusedIndex] = createSignal(-1);
  const [indicatorStyle, setIndicatorStyle] = createSignal<JSX.CSSProperties>({});
  let tabListRef: HTMLDivElement | undefined;
  let tabRefs: HTMLButtonElement[] = [];

  const orientation = () => local.orientation ?? "horizontal";
  const variant = () => local.variant ?? "default";
  const size = () => local.size ?? "md";

  const activeIndex = () => local.tabs.findIndex((t) => t.id === local.activeTab);

  const selectTab = (tab: CortexTab) => {
    if (tab.disabled) return;
    local.onChange?.(tab.id);
  };

  const closeTab = (e: MouseEvent, tab: CortexTab) => {
    e.stopPropagation();
    local.onClose?.(tab.id);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const tabs = local.tabs.filter((t) => !t.disabled);
    const currentFocus = focusedIndex();
    let newIndex = currentFocus;

    const isHorizontal = orientation() === "horizontal";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";

    switch (e.key) {
      case prevKey:
        e.preventDefault();
        newIndex = currentFocus > 0 ? currentFocus - 1 : tabs.length - 1;
        break;

      case nextKey:
        e.preventDefault();
        newIndex = currentFocus < tabs.length - 1 ? currentFocus + 1 : 0;
        break;

      case "Home":
        e.preventDefault();
        newIndex = 0;
        break;

      case "End":
        e.preventDefault();
        newIndex = tabs.length - 1;
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        if (currentFocus >= 0 && currentFocus < local.tabs.length) {
          selectTab(local.tabs[currentFocus]);
        }
        break;

      case "Delete":
        if (currentFocus >= 0) {
          const tab = local.tabs[currentFocus];
          if (tab.closable) {
            local.onClose?.(tab.id);
          }
        }
        break;
    }

    if (newIndex !== currentFocus && newIndex >= 0) {
      setFocusedIndex(newIndex);
      tabRefs[newIndex]?.focus();
    }
  };

  const updateIndicator = () => {
    if (variant() !== "underline" || !tabListRef) return;

    const index = activeIndex();
    if (index < 0) {
      setIndicatorStyle({ opacity: "0" });
      return;
    }

    const tab = tabRefs[index];
    if (!tab) return;

    const listRect = tabListRef.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();

    if (orientation() === "horizontal") {
      setIndicatorStyle({
        position: "absolute",
        bottom: "0",
        left: `${tabRect.left - listRect.left}px`,
        width: `${tabRect.width}px`,
        height: "2px",
        background: "var(--cortex-accent-primary)",
        "border-radius": "1px 1px 0 0",
        transition: "left 200ms ease, width 200ms ease",
      });
    } else {
      setIndicatorStyle({
        position: "absolute",
        left: "0",
        top: `${tabRect.top - listRect.top}px`,
        width: "2px",
        height: `${tabRect.height}px`,
        background: "var(--cortex-accent-primary)",
        "border-radius": "0 1px 1px 0",
        transition: "top 200ms ease, height 200ms ease",
      });
    }
  };

  createEffect(() => {
    local.activeTab;
    local.tabs;
    requestAnimationFrame(updateIndicator);
  });

  onMount(() => {
    window.addEventListener("resize", updateIndicator);
    updateIndicator();
  });

  onCleanup(() => {
    window.removeEventListener("resize", updateIndicator);
  });

  const containerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": orientation() === "horizontal" ? "column" : "row",
    ...local.style,
  });

  const tabListStyle = (): JSX.CSSProperties => ({
    position: "relative",
    display: "flex",
    "flex-direction": orientation() === "horizontal" ? "row" : "column",
    gap: variant() === "pills" ? "4px" : "0px",
    padding: variant() === "pills" ? "4px" : "0",
    background: variant() === "pills" ? "var(--cortex-bg-tertiary)" : "transparent",
    "border-radius": variant() === "pills" ? "var(--cortex-radius-md, 8px)" : "0",
    "border-bottom": orientation() === "horizontal" && variant() !== "pills"
      ? "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))"
      : "none",
    "border-right": orientation() === "vertical" && variant() !== "pills"
      ? "1px solid var(--cortex-border-default, rgba(255,255,255,0.1))"
      : "none",
    "flex-shrink": "0",
  });

  const getTabStyle = (tab: CortexTab, index: number): JSX.CSSProperties => {
    const isActive = tab.id === local.activeTab;
    const isFocused = index === focusedIndex();
    const sizeConfig = SIZE_STYLES[size()];

    const baseStyle: JSX.CSSProperties = {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      gap: "4px",
      height: sizeConfig.height,
      padding: sizeConfig.padding,
      "font-family": "var(--cortex-font-sans)",
      "font-size": sizeConfig.fontSize,
      "font-weight": "400",
      "line-height": "1em",
      cursor: tab.disabled ? "not-allowed" : "pointer",
      opacity: tab.disabled ? "0.5" : "1",
      border: "none",
      outline: "none",
      "white-space": "nowrap",
      transition: "background var(--cortex-transition-fast, 100ms ease), color var(--cortex-transition-fast, 100ms ease)",
      flex: local.fullWidth ? "1" : "none",
      position: "relative",
    };

    switch (variant()) {
      case "pills":
        return {
          ...baseStyle,
          background: isActive
            ? "var(--cortex-accent-primary)"
            : "transparent",
          color: isActive
            ? "var(--cortex-bg-secondary)"
            : "var(--cortex-text-muted)",
          "border-radius": "var(--cortex-radius-sm, 4px)",
          "box-shadow": isFocused
            ? "0 0 0 2px var(--cortex-accent-primary)"
            : "none",
        };

      case "underline":
        return {
          ...baseStyle,
          background: "transparent",
          color: isActive
            ? "var(--cortex-text-primary)"
            : "var(--cortex-text-muted)",
          "margin-bottom": orientation() === "horizontal" ? "-1px" : "0",
          "margin-right": orientation() === "vertical" ? "-1px" : "0",
          "padding-bottom": orientation() === "horizontal" ? "calc(" + sizeConfig.padding.split(" ")[0] + " + 2px)" : sizeConfig.padding,
          "box-shadow": isFocused
            ? "inset 0 0 0 1px var(--cortex-accent-primary)"
            : "none",
        };

      default:
        return {
          ...baseStyle,
          background: isActive
            ? "var(--cortex-interactive-selected, rgba(255,255,255,0.08))"
            : "transparent",
          color: isActive
            ? "var(--cortex-accent-primary)"
            : "var(--cortex-text-on-surface)",
          "border-radius": orientation() === "horizontal"
            ? "var(--cortex-radius-sm, 4px) var(--cortex-radius-sm, 4px) 0 0"
            : "var(--cortex-radius-sm, 4px) 0 0 var(--cortex-radius-sm, 4px)",
          "box-shadow": isFocused
            ? "inset 0 0 0 1px var(--cortex-accent-primary)"
            : "none",
        };
    }
  };

  const panelStyle = (): JSX.CSSProperties => ({
    flex: "1",
    padding: "16px",
    overflow: "auto",
  });

  return (
    <div class={local.class} style={containerStyle()} {...others}>
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation={orientation()}
        style={tabListStyle()}
        onKeyDown={handleKeyDown}
      >
        <For each={local.tabs}>
          {(tab, index) => (
            <button
              ref={(el) => (tabRefs[index()] = el)}
              role="tab"
              aria-selected={tab.id === local.activeTab}
              aria-disabled={tab.disabled}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={tab.id === local.activeTab ? 0 : -1}
              style={getTabStyle(tab, index())}
              onClick={() => selectTab(tab)}
              onFocus={() => setFocusedIndex(index())}
              onBlur={() => setFocusedIndex(-1)}
              onMouseEnter={(e) => {
                if (!tab.disabled && tab.id !== local.activeTab) {
                  e.currentTarget.style.background = variant() === "pills"
                    ? "var(--cortex-interactive-hover, rgba(255,255,255,0.05))"
                    : "var(--cortex-interactive-hover, rgba(255,255,255,0.03))";
                  e.currentTarget.style.color = "var(--cortex-text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!tab.disabled && tab.id !== local.activeTab) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--cortex-text-on-surface)";
                }
              }}
            >
              <Show when={tab.icon}>
                <CortexIcon name={tab.icon!} size={16} color="var(--cortex-text-primary)" />
              </Show>
              <span>{tab.label}</span>
              <Show when={tab.badge !== undefined}>
                <span
                  style={{
                    display: "inline-flex",
                    "align-items": "center",
                    "justify-content": "center",
                    "min-width": "18px",
                    height: "18px",
                    padding: "0 6px",
                    "font-size": "11px",
                    "font-weight": "600",
                    "border-radius": "9px",
                    color: tab.id === local.activeTab ? "var(--cortex-accent-hover)" : "var(--cortex-text-secondary)",
                    background: "transparent",
                  }}
                >
                  {tab.badge}
                </span>
              </Show>
              <Show when={tab.closable}>
                <span
                  onClick={(e) => closeTab(e, tab)}
                  style={{
                    display: "inline-flex",
                    "align-items": "center",
                    "justify-content": "center",
                    width: "12px",
                    height: "12px",
                    "border-radius": "var(--cortex-radius-sm, 4px)",
                    "margin-left": "2px",
                    color: tab.id === local.activeTab ? "var(--cortex-accent-hover)" : "currentColor",
                    opacity: "0.6",
                    transition: "opacity var(--cortex-transition-fast, 100ms ease), background var(--cortex-transition-fast, 100ms ease)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                    e.currentTarget.style.background = "var(--cortex-interactive-hover, rgba(255,255,255,0.1))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.6";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <CortexIcon name="x" size={12} />
                </span>
              </Show>
              <Show when={tab.id === local.activeTab}>
                <div
                  style={{
                    position: "absolute",
                    bottom: "0",
                    left: "0",
                    width: "100%",
                    height: "2px",
                    background: "var(--cortex-accent-primary)",
                  }}
                />
              </Show>
            </button>
          )}
        </For>
        <Show when={variant() === "underline"}>
          <div style={indicatorStyle()} />
        </Show>
      </div>

      <Show when={local.children}>
        <div style={panelStyle()}>
          {local.children!(local.activeTab || local.tabs[0]?.id || "")}
        </div>
      </Show>
    </div>
  );
};

export const CortexTabPanel: Component<CortexTabPanelProps> = (props) => {
  const [local, others] = splitProps(props, ["id", "class", "style", "children"]);

  return (
    <div
      id={`panel-${local.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${local.id}`}
      class={local.class}
      style={local.style}
      {...others}
    >
      {local.children}
    </div>
  );
};

export default CortexTabs;
