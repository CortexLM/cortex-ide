import { Component, createSignal, createMemo, For, Show, onMount } from "solid-js";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";
import { CortexToggle } from "./primitives/CortexToggle";
import { invoke } from "@tauri-apps/api/core";

interface PluginInfo {
  name: string;
  version: string;
  author: string;
  description: string;
  downloads: string;
  rating: number;
  installed: boolean;
  enabled: boolean;
}

type TabType = "marketplace" | "installed";

const iconColors = ["#4A9EFF", "#FF6B6B", "#51CF66", "#FAB005", "#CC5DE8", "#20C997", "#FF922B", "#845EF7"];
const getColor = (name: string) => iconColors[name.charCodeAt(0) % iconColors.length];

const FEATURED: PluginInfo[] = [
  { name: "GitHub Copilot", version: "1.0.0", author: "GitHub", description: "Your AI pair programmer", downloads: "38.1M", rating: 2.32, installed: false, enabled: false },
  { name: "GitHub Pull Requests", version: "0.82.0", author: "GitHub", description: "Review and manage pull requests", downloads: "21.5M", rating: 3.69, installed: false, enabled: false },
  { name: "Dart", version: "3.88.0", author: "Google", description: "Dart language support", downloads: "26.3M", rating: 3.62, installed: false, enabled: false },
  { name: "DeepSeek Developer AI", version: "0.5.0", author: "JetCode", description: "AI-driven coding assistant", downloads: "5.7k", rating: 4.17, installed: false, enabled: false },
  { name: "Prettier", version: "10.4.0", author: "Prettier", description: "Opinionated code formatter", downloads: "45.2M", rating: 3.85, installed: false, enabled: false },
  { name: "ESLint", version: "3.0.0", author: "Microsoft", description: "Integrates ESLint into the editor", downloads: "33.8M", rating: 4.01, installed: false, enabled: false },
];

export const CortexPluginsPanel: Component = () => {
  const [activeTab, setActiveTab] = createSignal<TabType>("marketplace");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [installedPlugins, setInstalledPlugins] = createSignal<PluginInfo[]>([]);
  const [marketplacePlugins, setMarketplacePlugins] = createSignal<PluginInfo[]>(FEATURED);
  const [installing, setInstalling] = createSignal<string | null>(null);

  onMount(() => { loadInstalled(); });

  const loadInstalled = async () => {
    try {
      const exts = await invoke<Array<{ manifest: { name: string; version: string; author?: string; description?: string }; enabled: boolean }>>("get_extensions");
      setInstalledPlugins(exts.map(e => ({
        name: e.manifest.name, version: e.manifest.version,
        author: e.manifest.author ?? "Unknown", description: e.manifest.description ?? "",
        downloads: "", rating: 0, installed: true, enabled: e.enabled,
      })));
    } catch { /* backend unavailable */ }
  };

  const handleInstall = async (plugin: PluginInfo) => {
    setInstalling(plugin.name);
    try {
      await invoke("install_from_marketplace", { extensionName: plugin.name });
      setInstalledPlugins(prev => [...prev, { ...plugin, installed: true, enabled: true }]);
      setMarketplacePlugins(prev => prev.filter(p => p.name !== plugin.name));
    } catch { /* install failed */ }
    setInstalling(null);
  };

  const handleToggle = async (name: string) => {
    const current = installedPlugins().find(p => p.name === name);
    if (!current) return;
    const wasEnabled = current.enabled;
    try {
      await invoke(wasEnabled ? "disable_extension" : "enable_extension", { name });
      setInstalledPlugins(prev => prev.map(p => p.name === name ? { ...p, enabled: !wasEnabled } : p));
    } catch { /* toggle failed */ }
  };

  const handleUninstall = async (name: string) => {
    try {
      await invoke("uninstall_extension", { name });
      setInstalledPlugins(prev => prev.filter(p => p.name !== name));
    } catch { /* uninstall failed */ }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setMarketplacePlugins(FEATURED); return; }
    try {
      const results = await invoke<Array<{ name: string; version: string; author: string; description: string; downloads: number; rating: number; download_url: string }>>(
        "search_marketplace", { query, category: null }
      );
      setMarketplacePlugins(results.map(r => ({
        name: r.name, version: r.version, author: r.author,
        description: r.description, downloads: formatDownloads(r.downloads),
        rating: r.rating, installed: false, enabled: false,
      })));
    } catch { /* search failed, keep current list */ }
  };

  const filteredMarketplace = createMemo(() => {
    const q = searchQuery().toLowerCase();
    const installed = new Set(installedPlugins().map(p => p.name));
    return marketplacePlugins().filter(p =>
      !installed.has(p.name) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
    );
  });

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={{ "font-weight": "600" }}>Plugins</span>
        <CortexIconButton icon="gear" size={20} title="Plugin settings" onClick={() => window.dispatchEvent(new CustomEvent("settings:open-tab"))} />
      </div>

      <div style={tabBarStyle}>
        <PluginTab icon="code-browser" label="Marketplace" active={activeTab() === "marketplace"} onClick={() => setActiveTab("marketplace")} />
        <div style={tabDividerStyle} />
        <PluginTab icon="puzzle-piece-02" label="Installed" count={installedPlugins().length} active={activeTab() === "installed"} onClick={() => setActiveTab("installed")} />
      </div>

      <Show when={activeTab() === "marketplace"}>
        <div style={searchWrapStyle}>
          <CortexIcon name="search" size={14} color="var(--cortex-text-inactive)" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" value={searchQuery()} onInput={(e) => handleSearch(e.currentTarget.value)}
            placeholder="Type / to see options" style={searchInputStyle} />
        </div>
      </Show>

      <div style={contentStyle}>
        <Show when={activeTab() === "marketplace"}>
          <Show when={!searchQuery()}>
            <CategoryHeader icon="download-03" label="Top Downloads" />
          </Show>
          <Show when={filteredMarketplace().length === 0}>
            <div style={emptyStyle}>No plugins found</div>
          </Show>
          <For each={filteredMarketplace()}>{(plugin) => (
            <MarketplaceCard plugin={plugin} installing={installing() === plugin.name} onInstall={() => handleInstall(plugin)} />
          )}</For>
        </Show>

        <Show when={activeTab() === "installed"}>
          <Show when={installedPlugins().length === 0}>
            <div style={emptyStyle}>No plugins installed yet</div>
          </Show>
          <For each={installedPlugins()}>{(plugin) => (
            <InstalledCard plugin={plugin} onToggle={() => handleToggle(plugin.name)} onUninstall={() => handleUninstall(plugin.name)} />
          )}</For>
        </Show>
      </div>
    </div>
  );
};

const PluginTab: Component<{ icon: string; label: string; count?: number; active: boolean; onClick: () => void }> = (props) => (
  <button style={pluginTabStyle(props.active)} onClick={props.onClick}>
    <CortexIcon name={props.icon} size={16} color={props.active ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)"} />
    <span>{props.label}</span>
    <Show when={props.count !== undefined && props.count! > 0}>
      <span style={badgeStyle}>{props.count}</span>
    </Show>
  </button>
);

const CategoryHeader: Component<{ icon: string; label: string }> = (props) => (
  <div style={catHeaderStyle}>
    <CortexIcon name={props.icon} size={16} color="var(--cortex-text-primary)" />
    <span style={{ "font-size": "14px", "font-weight": "500", color: "var(--cortex-text-inactive)" }}>{props.label}</span>
  </div>
);

const MarketplaceCard: Component<{ plugin: PluginInfo; installing: boolean; onInstall: () => void }> = (props) => (
  <div style={cardStyle}>
    <div style={iconCircleStyle(props.plugin.name)}>{props.plugin.name.charAt(0).toUpperCase()}</div>
    <div style={{ flex: "1", "min-width": "0" }}>
      <div style={{ "font-size": "14px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>{props.plugin.name}</div>
      <div style={statsRowStyle}>
        <Show when={props.plugin.downloads}>
          <CortexIcon name="download-04" size={12} color="var(--cortex-text-inactive)" />
          <span>{props.plugin.downloads}</span>
          <span style={dotSep} />
        </Show>
        <CortexIcon name="star-01" size={12} color="var(--cortex-text-inactive)" />
        <span>{props.plugin.rating.toFixed(2)}</span>
        <span style={dotSep} />
        <span>{props.plugin.author}</span>
      </div>
    </div>
    <button style={installBtnStyle} onClick={props.onInstall} disabled={props.installing}>
      {props.installing ? "..." : "Install"}
    </button>
  </div>
);

const InstalledCard: Component<{ plugin: PluginInfo; onToggle: () => void; onUninstall: () => void }> = (props) => (
  <div style={cardStyle}>
    <div style={iconCircleStyle(props.plugin.name)}>{props.plugin.name.charAt(0).toUpperCase()}</div>
    <div style={{ flex: "1", "min-width": "0" }}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span style={{ "font-size": "14px", "font-weight": "500", color: "var(--cortex-text-primary)" }}>{props.plugin.name}</span>
        <span style={{ "font-size": "11px", color: "var(--cortex-text-inactive)" }}>v{props.plugin.version}</span>
      </div>
      <div style={{ "font-size": "12px", color: "var(--cortex-text-inactive)" }}>{props.plugin.author}</div>
    </div>
    <CortexToggle checked={props.plugin.enabled} onChange={props.onToggle} size="sm" />
    <button style={{ ...smallBtn, color: "var(--cortex-error)" }} onClick={props.onUninstall}>Uninstall</button>
  </div>
);

const formatDownloads = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

// === Styles ===

const panelStyle = {
  display: "flex", "flex-direction": "column" as const, height: "100%",
  background: "var(--cortex-bg-secondary)", color: "var(--cortex-text-primary)",
  "font-family": "var(--cortex-font-sans)", "font-size": "13px",
};

const headerStyle = {
  padding: "12px 16px", display: "flex", "align-items": "center",
  "justify-content": "space-between",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const tabBarStyle = {
  display: "flex", "align-items": "center",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const pluginTabStyle = (active: boolean) => ({
  flex: "1", display: "flex", "align-items": "center", "justify-content": "center",
  gap: "6px", padding: "10px 16px", background: active ? "var(--cortex-bg-hover)" : "transparent",
  border: "none", color: active ? "var(--cortex-text-primary)" : "var(--cortex-text-inactive)",
  "font-size": "13px", "font-family": "var(--cortex-font-sans)", cursor: "pointer",
});

const tabDividerStyle = {
  width: "1px", height: "20px", background: "var(--cortex-border-default)",
};

const badgeStyle = {
  background: "var(--cortex-text-inactive)", color: "var(--cortex-bg-secondary)",
  padding: "1px 6px", "border-radius": "var(--cortex-radius-full)", "font-size": "10px", "font-weight": "600",
};

const searchWrapStyle = {
  position: "relative" as const, padding: "12px 16px",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const searchInputStyle = {
  width: "100%", padding: "8px 8px 8px 32px",
  background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-md)", color: "var(--cortex-text-primary)",
  "font-size": "12px", "font-family": "var(--cortex-font-sans)", outline: "none",
  "box-sizing": "border-box" as const,
};

const contentStyle = { flex: "1", overflow: "auto" as const };

const catHeaderStyle = {
  display: "flex", "align-items": "center", gap: "8px",
  padding: "12px 16px",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const cardStyle = {
  display: "flex", gap: "12px", padding: "10px 16px",
  "align-items": "center",
  "border-bottom": "1px solid var(--cortex-border-default)",
};

const iconCircleStyle = (name: string) => ({
  width: "40px", height: "40px", "border-radius": "var(--cortex-radius-full)",
  background: getColor(name), display: "flex", "align-items": "center",
  "justify-content": "center", "flex-shrink": "0",
  color: "var(--cortex-text-primary)", "font-weight": "700", "font-size": "18px",
});

const statsRowStyle = {
  display: "flex", "align-items": "center", gap: "4px",
  "font-size": "12px", color: "var(--cortex-text-inactive)", "margin-top": "2px",
};

const dotSep = { width: "3px", height: "3px", "border-radius": "var(--cortex-radius-full)", background: "var(--cortex-text-inactive)" };
const installBtnStyle = {
  padding: "6px 14px", background: "var(--cortex-bg-primary)",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-lg)", color: "var(--cortex-text-primary)",
  "font-size": "12px", "font-family": "var(--cortex-font-sans)", cursor: "pointer", "flex-shrink": "0",
};

const smallBtn = {
  padding: "4px 10px", background: "transparent",
  border: "1px solid var(--cortex-border-default)",
  "border-radius": "var(--cortex-radius-sm)", color: "var(--cortex-text-primary)",
  "font-size": "12px", "font-family": "var(--cortex-font-sans)", cursor: "pointer",
};

const emptyStyle = { padding: "32px 24px", "text-align": "center" as const, color: "var(--cortex-text-inactive)" };

export default CortexPluginsPanel;