import { Component, createSignal, createMemo, For, Show } from "solid-js";
import {
  useExtensions,
  type ExtensionUpdateInfo,
  type ExtensionsContextValue,
} from "@/context/ExtensionsContext";
import { CortexButton } from "./primitives/CortexButton";
import { CortexIcon } from "./primitives/CortexIcon";
import { CortexIconButton } from "./primitives/CortexIconButton";

type TabType = "installed" | "marketplace" | "outdated";
const iconColors = ["#4A9EFF", "#FF6B6B", "#51CF66", "#FAB005", "#CC5DE8", "#20C997", "#FF922B", "#845EF7"];
const getIconColor = (name: string) => iconColors[name.charCodeAt(0) % iconColors.length];

const RatingStars: Component<{ rating: number }> = (props) => {
  const stars = createMemo(() => {
    const full = Math.round(props.rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  });
  return <span style={{ color: "var(--cortex-warning)", "font-size": "12px", "letter-spacing": "1px" }}>{stars()}</span>;
};

const Tab: Component<{ label: string; count?: number; active: boolean; onClick: () => void; highlight?: boolean }> = (props) => (
  <button onClick={props.onClick} style={{
    flex: 1, background: "transparent", border: "none",
    "border-bottom": props.active ? "2px solid var(--cortex-accent-primary)" : "2px solid transparent",
    color: props.active ? "var(--cortex-text-on-surface)" : "var(--cortex-text-secondary)",
    padding: "10px 8px", cursor: "pointer", "font-size": "14px",
    display: "flex", "align-items": "center", "justify-content": "center", gap: "6px",
    "font-family": "inherit",
  }}>
    {props.label}
    <Show when={props.count !== undefined && props.count! > 0}>
      <span style={{
        background: props.highlight ? "var(--cortex-accent-primary)" : "rgba(252,252,252,0.08)",
        color: props.highlight ? "var(--cortex-accent-text)" : "var(--cortex-text-secondary)",
        padding: "2px 8px", "border-radius": "4px", "font-size": "12px", "font-weight": "600",
      }}>{props.count}</span>
    </Show>
  </button>
);

const ExtensionCard: Component<{
  name: string; version: string; author: string; description: string;
  isInstalled: boolean; enabled?: boolean; updateInfo?: ExtensionUpdateInfo;
  rating?: number; onToggle?: () => void; onUninstall?: () => void;
  onUpdate?: () => void; onInstall?: () => void;
}> = (props) => (
  <div class="ext-card" style={{
    padding: "12px", "border-bottom": "1px solid var(--cortex-border-default)",
    display: "flex", gap: "12px", "align-items": "flex-start",
  }}>
    <div style={{
      width: "42px", height: "42px", "border-radius": "50%", background: getIconColor(props.name),
      display: "flex", "align-items": "center", "justify-content": "center", "flex-shrink": 0,
      color: "var(--cortex-text-primary)", "font-weight": "700", "font-size": "18px",
    }}>{props.name.charAt(0).toUpperCase()}</div>
    <div style={{ flex: 1, "min-width": 0 }}>
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "2px" }}>
        <span style={{ "font-weight": "600", "font-size": "16px", color: "var(--cortex-text-on-surface)" }}>{props.name}</span>
        <span style={{ color: "var(--cortex-text-inactive)", "font-size": "12px" }}>v{props.version}</span>
        <Show when={props.updateInfo}>
          <span style={{
            background: "var(--cortex-accent-primary)", color: "var(--cortex-accent-text)",
            padding: "1px 6px", "border-radius": "4px", "font-size": "11px", "font-weight": "600",
          }}>{props.updateInfo!.availableVersion}</span>
        </Show>
      </div>
      <div style={{ color: "var(--cortex-text-secondary)", "font-size": "14px", "margin-bottom": "2px" }}>{props.author}</div>
      <div style={{
        color: "var(--cortex-text-inactive)", "font-size": "14px",
        overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap",
      }}>{props.description}</div>
      <Show when={!props.isInstalled && props.rating !== undefined}>
        <div style={{ "margin-top": "4px" }}><RatingStars rating={props.rating!} /></div>
      </Show>
    </div>
    <div style={{ display: "flex", "flex-direction": "column", gap: "4px", "align-items": "flex-end" }}>
      <Show when={props.isInstalled}>
        <Show when={props.updateInfo}>
          <CortexButton variant="primary" size="xs" onClick={props.onUpdate}>Update</CortexButton>
        </Show>
        <CortexButton variant={props.enabled ? "secondary" : "ghost"} size="xs" onClick={props.onToggle}>
          {props.enabled ? "Disable" : "Enable"}
        </CortexButton>
        <CortexButton variant="ghost" size="xs" onClick={props.onUninstall} style={{ color: "var(--cortex-pause-color)" }}>
          Uninstall
        </CortexButton>
      </Show>
      <Show when={!props.isInstalled}>
        <CortexButton variant="primary" size="xs" onClick={props.onInstall}>Install</CortexButton>
      </Show>
    </div>
  </div>
);

export const CortexExtensionsPanel: Component = () => {
  let ctx: ExtensionsContextValue | null = null;
  try { ctx = useExtensions(); } catch { /* Context not available */ }

  const [activeTab, setActiveTab] = createSignal<TabType>("installed");
  const [searchQuery, setSearchQuery] = createSignal("");

  const installedList = createMemo(() => ctx?.extensions() ?? []);
  const outdatedMap = createMemo(() => ctx?.outdatedExtensions() ?? new Map<string, ExtensionUpdateInfo>());
  const outdatedList = createMemo(() => installedList().filter((e) => outdatedMap().has(e.manifest.name)));
  const marketplaceList = createMemo(() => ctx?.marketplaceExtensions() ?? []);

  const filteredInstalled = createMemo(() => {
    const q = searchQuery().toLowerCase();
    if (!q) return installedList();
    return installedList().filter((e) => e.manifest.name.toLowerCase().includes(q) || (e.manifest.description ?? "").toLowerCase().includes(q));
  });

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === "marketplace") ctx?.searchMarketplace(searchQuery());
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (activeTab() === "marketplace") ctx?.searchMarketplace(value);
  };

  const emptyMessages: Record<TabType, string> = {
    installed: "No extensions installed",
    marketplace: "No extensions found",
    outdated: "All extensions up to date",
  };

  const renderInstalledCard = (ext: ReturnType<typeof installedList>[0]) => (
    <ExtensionCard
      name={ext.manifest.name} version={ext.manifest.version}
      author={ext.manifest.author ?? "Unknown"} description={ext.manifest.description ?? ""}
      isInstalled={true} enabled={ext.enabled} updateInfo={outdatedMap().get(ext.manifest.name)}
      onToggle={() => {
        const current = installedList().find(e => e.manifest.name === ext.manifest.name);
        if (!current) return;
        current.enabled ? ctx?.disableExtension(ext.manifest.name) : ctx?.enableExtension(ext.manifest.name);
      }}
      onUninstall={() => ctx?.uninstallExtension(ext.manifest.name)}
      onUpdate={() => ctx?.updateExtension(ext.manifest.name)}
    />
  );

  return (
    <div style={{
      display: "flex", "flex-direction": "column", height: "100%",
      background: "var(--cortex-bg-primary)", color: "var(--cortex-text-on-surface)",
      "font-family": "var(--cortex-font-sans)", "font-size": "14px",
    }}>
      <div style={{
        padding: "12px", "border-bottom": "1px solid var(--cortex-border-default)",
        display: "flex", "align-items": "center", "justify-content": "space-between",
      }}>
        <span style={{ "font-size": "16px", "font-weight": "500" }}>Extensions</span>
        <CortexIconButton icon="refresh" size={20} onClick={() => ctx?.loadExtensions()} />
      </div>

      <div style={{ padding: "12px", "border-bottom": "1px solid var(--cortex-border-default)" }}>
        <div style={{ position: "relative" }}>
          <CortexIcon name="search" size="sm" color="var(--cortex-text-inactive)"
            style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
          <input type="text" value={searchQuery()} onInput={(e) => handleSearch(e.currentTarget.value)}
            placeholder="Search extensions..." style={{
              width: "100%", background: "var(--cortex-bg-secondary)",
              border: "1px solid var(--cortex-border-default)", "border-radius": "12px",
              color: "var(--cortex-text-on-surface)", padding: "10px 12px 10px 34px",
              "font-size": "14px", outline: "none", "box-sizing": "border-box",
              "font-family": "inherit",
            }} />
        </div>
      </div>

      <div style={{ display: "flex", "border-bottom": "1px solid var(--cortex-border-default)" }}>
        <Tab label="Installed" count={installedList().length} active={activeTab() === "installed"} onClick={() => handleTabSwitch("installed")} />
        <Tab label="Marketplace" active={activeTab() === "marketplace"} onClick={() => handleTabSwitch("marketplace")} />
        <Tab label="Outdated" count={outdatedList().length} active={activeTab() === "outdated"} onClick={() => handleTabSwitch("outdated")} highlight={outdatedList().length > 0} />
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Show when={ctx?.loading()}>
          <div style={{ padding: "24px", color: "var(--cortex-text-inactive)", "text-align": "center", "font-size": "14px" }}>Loading...</div>
        </Show>
        <Show when={!ctx?.loading()}>
          <Show when={activeTab() === "installed"}>
            <Show when={filteredInstalled().length === 0}>
              <div style={{ padding: "24px", color: "var(--cortex-text-inactive)", "text-align": "center", "font-size": "14px" }}>{emptyMessages.installed}</div>
            </Show>
            <For each={filteredInstalled()}>{renderInstalledCard}</For>
          </Show>
          <Show when={activeTab() === "marketplace"}>
            <Show when={marketplaceList().length === 0}>
              <div style={{ padding: "24px", color: "var(--cortex-text-inactive)", "text-align": "center", "font-size": "14px" }}>{emptyMessages.marketplace}</div>
            </Show>
            <For each={marketplaceList()}>
              {(ext) => (
                <ExtensionCard name={ext.name} version={ext.version} author={ext.author}
                  description={ext.description} isInstalled={false} rating={ext.rating}
                  onInstall={() => ctx?.installFromMarketplace(ext.name)} />
              )}
            </For>
          </Show>
          <Show when={activeTab() === "outdated"}>
            <Show when={outdatedList().length === 0}>
              <div style={{ padding: "24px", color: "var(--cortex-text-inactive)", "text-align": "center", "font-size": "14px" }}>{emptyMessages.outdated}</div>
            </Show>
            <For each={outdatedList()}>{renderInstalledCard}</For>
          </Show>
        </Show>
      </div>

      <div style={{
        padding: "8px 12px", "border-top": "1px solid var(--cortex-border-default)",
        display: "flex", "justify-content": "space-between", "align-items": "center",
      }}>
        <CortexButton variant="ghost" size="xs" icon="refresh" onClick={() => ctx?.checkForUpdates()}>Check for updates</CortexButton>
        <CortexButton variant="ghost" size="xs" icon="folder" onClick={() => ctx?.openExtensionsDirectory()}>Open folder</CortexButton>
      </div>

      <style>{`
        .ext-card:hover { background: rgba(255,255,255,0.05); }
      `}</style>
    </div>
  );
};

export default CortexExtensionsPanel;
