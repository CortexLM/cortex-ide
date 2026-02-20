/**
 * @deprecated Prefer CortexTabs from "@/components/cortex/primitives" for new code.
 * This compound component API (Tabs/TabList/Tab/TabPanel) is kept for backward compatibility.
 */
import { JSX, splitProps, Show, createSignal, createContext, useContext, ParentProps } from "solid-js";

// Context for tab state
interface TabsContextValue {
  activeTab: () => string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue>();

export interface TabsProps extends ParentProps {
  /** Default active tab id */
  defaultTab?: string;
  /** Controlled active tab id */
  activeTab?: string;
  /** Callback when tab changes */
  onChange?: (tabId: string) => void;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Tabs(props: TabsProps) {
  const [local] = splitProps(props, ["defaultTab", "activeTab", "onChange", "style", "children"]);
  const [internalTab, setInternalTab] = createSignal(local.defaultTab || "");

  const activeTab = () => local.activeTab !== undefined ? local.activeTab : internalTab();
  
  const setActiveTab = (id: string) => {
    if (local.activeTab === undefined) {
      setInternalTab(id);
    }
    local.onChange?.(id);
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    height: "100%",
    ...local.style,
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div style={containerStyle}>{local.children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps extends ParentProps {
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function TabList(props: TabListProps) {
  const [local] = splitProps(props, ["style", "children"]);

  const listStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "2px",
    background: "var(--surface-card)",
    padding: "4px",
    "border-radius": "var(--cortex-radius-md)",
    "border-bottom": "1px solid var(--border-default)",
    "flex-shrink": "0",
    ...local.style,
  };

  return (
    <div style={listStyle} role="tablist">
      {local.children}
    </div>
  );
}

export interface TabProps extends ParentProps {
  /** Unique tab identifier */
  id: string;
  /** Whether tab is disabled */
  disabled?: boolean;
  /** Optional icon */
  icon?: JSX.Element;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function Tab(props: TabProps) {
  const [local] = splitProps(props, ["id", "disabled", "icon", "style", "children"]);
  const context = useContext(TabsContext);
  const [hovered, setHovered] = createSignal(false);

  if (!context) {
    throw new Error("Tab must be used within a Tabs component");
  }

  const isActive = () => context.activeTab() === local.id;

  const handleClick = () => {
    if (!local.disabled) {
      context.setActiveTab(local.id);
    }
  };

  const tabStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    gap: "6px",
    padding: "8px 16px",
    "font-size": "13px",
    "font-weight": "500",
    color: isActive() ? "var(--text-title)" : "var(--text-muted)",
    background: isActive() 
      ? "var(--surface-active)" 
      : hovered() && !local.disabled 
        ? "var(--surface-hover)" 
        : "transparent",
    border: "none",
    "border-radius": "var(--cortex-radius-md)",
    cursor: local.disabled ? "not-allowed" : "pointer",
    opacity: local.disabled ? "0.5" : "1",
    transition: "background 150ms ease, color 150ms ease",
    position: "relative",
    ...local.style,
  });

  // Active indicator no longer needed with new pill-style tabs
  const indicatorStyle: JSX.CSSProperties = {
    display: "none",
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive()}
      aria-disabled={local.disabled}
      tabIndex={isActive() ? 0 : -1}
      style={tabStyle()}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Show when={local.icon}>
        <span style={{ width: "16px", height: "16px", "flex-shrink": "0" }}>{local.icon}</span>
      </Show>
      {local.children}
      <Show when={isActive()}>
        <div style={indicatorStyle} />
      </Show>
    </button>
  );
}

export interface TabPanelProps extends ParentProps {
  /** Tab id this panel belongs to */
  id: string;
  /** Custom styles */
  style?: JSX.CSSProperties;
}

export function TabPanel(props: TabPanelProps) {
  const [local] = splitProps(props, ["id", "style", "children"]);
  const context = useContext(TabsContext);

  if (!context) {
    throw new Error("TabPanel must be used within a Tabs component");
  }

  const isActive = () => context.activeTab() === local.id;

  const panelStyle: JSX.CSSProperties = {
    flex: "1",
    overflow: "auto",
    ...local.style,
  };

  return (
    <Show when={isActive()}>
      <div role="tabpanel" aria-labelledby={local.id} style={panelStyle}>
        {local.children}
      </div>
    </Show>
  );
}

