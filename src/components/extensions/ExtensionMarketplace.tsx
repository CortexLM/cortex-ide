import { Component, Show, For, createSignal, createMemo, onMount } from "solid-js";
import { useExtensions, Extension, MarketplaceExtension } from "../../context/ExtensionsContext";
import { ExtensionCard, ViewMode } from "./ExtensionCard";
import { ExtensionDetail, ExtensionDetailData, MOCK_EXTENSION_DETAIL } from "./ExtensionDetail";
import { tokens } from "@/design-system/tokens";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("extensions");

interface ExtensionMarketplaceProps {
  onClose?: () => void;
}

type TabType = "marketplace" | "installed";
type CategoryFilter = "all" | "themes" | "languages" | "snippets" | "panels" | "ai" | "formatters" | "debuggers";

/** Convert extension data to detail format */
function extensionToDetailData(
  ext: Extension | MarketplaceExtension,
  isInstalled: boolean,
  isEnabled: boolean
): ExtensionDetailData {
  const isLocal = "manifest" in ext;
  
  return {
    id: isLocal ? `local.${ext.manifest.name}` : `marketplace.${ext.name}`,
    name: isLocal ? ext.manifest.name : ext.name,
    displayName: isLocal ? ext.manifest.name : ext.name,
    version: isLocal ? ext.manifest.version : ext.version,
    publisher: isLocal ? ext.manifest.author : ext.author,
    publisherDisplayName: isLocal ? ext.manifest.author : ext.author,
    publisherVerified: !isLocal,
    description: isLocal ? ext.manifest.description : ext.description,
    longDescription: isLocal 
      ? `# ${ext.manifest.name}\n\n${ext.manifest.description}\n\n## Installation\n\nThis extension is installed locally.`
      : MOCK_EXTENSION_DETAIL.longDescription,
    icon: isLocal ? ext.manifest.icon : (ext as MarketplaceExtension).icon_url,
    repository: isLocal ? ext.manifest.repository : (ext as MarketplaceExtension).repository_url,
    license: isLocal ? ext.manifest.license : "MIT",
    categories: isLocal 
      ? ext.manifest.keywords || []
      : (ext as MarketplaceExtension).categories,
    tags: isLocal ? ext.manifest.keywords || [] : [],
    rating: isLocal ? 4.5 : (ext as MarketplaceExtension).rating,
    ratingCount: isLocal ? 100 : Math.floor((ext as MarketplaceExtension).downloads / 100),
    downloads: isLocal ? 0 : (ext as MarketplaceExtension).downloads,
    lastUpdated: isLocal ? new Date().toISOString().split("T")[0] : (ext as MarketplaceExtension).updated_at,
    published: isLocal ? new Date().toISOString().split("T")[0] : (ext as MarketplaceExtension).updated_at,
    isInstalled,
    isEnabled,
    screenshots: MOCK_EXTENSION_DETAIL.screenshots,
    versions: [
      {
        version: isLocal ? ext.manifest.version : ext.version,
        releaseDate: new Date().toISOString().split("T")[0],
        changelog: "Initial release",
        size: "2.5 MB",
        downloads: isLocal ? 0 : (ext as MarketplaceExtension).downloads,
      },
    ],
    reviews: MOCK_EXTENSION_DETAIL.reviews.slice(0, 3),
    dependencies: [],
  };
}

export const ExtensionMarketplace: Component<ExtensionMarketplaceProps> = (props) => {
  const {
    extensions,
    marketplaceExtensions,
    loading,
    error,
    searchMarketplace,
    getFeaturedExtensions,
    installFromMarketplace,
    enableExtension,
    disableExtension,
    uninstallExtension,
  } = useExtensions();

  const [activeTab, setActiveTab] = createSignal<TabType>("marketplace");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [category, setCategory] = createSignal<CategoryFilter>("all");
  const [viewMode, setViewMode] = createSignal<ViewMode>("grid");
  const [selectedExtension, setSelectedExtension] = createSignal<ExtensionDetailData | null>(null);

  // Get list of installed extension names for comparison
  const installedNames = createMemo(() =>
    new Set(extensions().map((ext) => ext.manifest.name))
  );

  // Filter marketplace extensions based on search and category
  const filteredMarketplace = createMemo(() => {
    let exts = marketplaceExtensions();
    const query = searchQuery().toLowerCase();

    // Apply text search
    if (query) {
      exts = exts.filter(
        (ext) =>
          ext.name.toLowerCase().includes(query) ||
          ext.description.toLowerCase().includes(query) ||
          ext.author.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (category() !== "all") {
      exts = exts.filter((ext) =>
        ext.categories.some((c) => c.toLowerCase() === category())
      );
    }

    return exts;
  });

  // Filter installed extensions based on search and category
  const filteredInstalled = createMemo(() => {
    let exts = extensions();
    const query = searchQuery().toLowerCase();

    // Apply text search
    if (query) {
      exts = exts.filter(
        (ext) =>
          ext.manifest.name.toLowerCase().includes(query) ||
          ext.manifest.description.toLowerCase().includes(query) ||
          ext.manifest.author.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (category() !== "all") {
      exts = exts.filter((ext) =>
        ext.manifest.keywords?.some((k) => k.toLowerCase() === category()) ||
        ext.manifest.contributes.themes.length > 0 && category() === "themes" ||
        ext.manifest.contributes.languages.length > 0 && category() === "languages" ||
        ext.manifest.contributes.snippets.length > 0 && category() === "snippets" ||
        ext.manifest.contributes.panels.length > 0 && category() === "panels"
      );
    }

    return exts;
  });

  // Load featured extensions on mount
  onMount(async () => {
    await getFeaturedExtensions();
  });

  const handleExtensionClick = (ext: Extension | MarketplaceExtension) => {
    const isLocal = "manifest" in ext;
    const isInstalled = isLocal || installedNames().has((ext as MarketplaceExtension).name);
    const isEnabled = isLocal ? (ext as Extension).enabled : false;
    const detailData = extensionToDetailData(ext, isInstalled, isEnabled);
    setSelectedExtension(detailData);
  };

  const handleDetailClose = () => {
    setSelectedExtension(null);
  };

  const handleDetailInstall = async (id: string) => {
    const name = id.replace(/^(local\.|marketplace\.)/, "");
    await installFromMarketplace(name);
    // Update detail view to show installed state
    const current = selectedExtension();
    if (current) {
      setSelectedExtension({ ...current, isInstalled: true, isEnabled: true });
    }
  };

  const handleDetailUninstall = async (id: string) => {
    const name = id.replace(/^(local\.|marketplace\.)/, "");
    await uninstallExtension(name);
    setSelectedExtension(null);
  };

  const handleDetailEnable = async (id: string) => {
    const name = id.replace(/^(local\.|marketplace\.)/, "");
    await enableExtension(name);
    const current = selectedExtension();
    if (current) {
      setSelectedExtension({ ...current, isEnabled: true });
    }
  };

  const handleDetailDisable = async (id: string) => {
    const name = id.replace(/^(local\.|marketplace\.)/, "");
    await disableExtension(name);
    const current = selectedExtension();
    if (current) {
      setSelectedExtension({ ...current, isEnabled: false });
    }
  };

  const handleSearch = async () => {
    await searchMarketplace(searchQuery(), category() !== "all" ? category() : undefined);
  };

  const handleInstall = async (name: string) => {
    await installFromMarketplace(name);
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Show detail view when an extension is selected
  if (selectedExtension()) {
    return (
      <ExtensionDetail
        extension={selectedExtension()!}
        onClose={handleDetailClose}
        onInstall={handleDetailInstall}
        onUninstall={handleDetailUninstall}
        onEnable={handleDetailEnable}
        onDisable={handleDetailDisable}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "background-color": tokens.colors.surface.panel,
        color: tokens.colors.text.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "16px 20px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <h2 style={{ margin: 0, "font-size": "16px", "font-weight": 600 }}>
            Extensions
          </h2>
        </div>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          {/* View Mode Toggle */}
          <div
            style={{
              display: "flex",
              "border-radius": "var(--cortex-radius-md)",
              border: `1px solid ${tokens.colors.border.default}`,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              style={{
                padding: "6px 8px",
                border: "none",
                "background-color": viewMode() === "grid" ? tokens.colors.surface.canvas : "transparent",
                color: viewMode() === "grid" ? tokens.colors.text.primary : tokens.colors.text.muted,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              style={{
                padding: "6px 8px",
                border: "none",
                "border-left": `1px solid ${tokens.colors.border.default}`,
                "background-color": viewMode() === "list" ? tokens.colors.surface.canvas : "transparent",
                color: viewMode() === "list" ? tokens.colors.text.primary : tokens.colors.text.muted,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
          <Show when={props.onClose}>
            <button
              onClick={props.onClose}
              title="Close"
              style={{
                padding: "6px",
                "border-radius": "var(--cortex-radius-md)",
                border: `1px solid ${tokens.colors.border.default}`,
                "background-color": "transparent",
                color: tokens.colors.text.muted,
                cursor: "pointer",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Show>
        </div>
      </div>

      {/* Tab Navigation - VS Code specs: 11px font, 36px line-height */}
      <div
        class="extension-editor"
        style={{
          display: "flex",
          "border-bottom": `1px solid ${tokens.colors.border.divider}`,
          "background-color": tokens.colors.surface.canvas,
          "padding-left": "20px",
        }}
      >
        <button
          onClick={() => setActiveTab("marketplace")}
          class={activeTab() === "marketplace" ? "tab active" : "tab inactive"}
          style={{
            padding: "0 16px",
            border: "none",
            "border-bottom": activeTab() === "marketplace"
              ? `1px solid ${tokens.colors.semantic.primary}`
              : "1px solid transparent",
            "background-color": "transparent",
            color: activeTab() === "marketplace"
              ? tokens.colors.text.primary
              : tokens.colors.text.muted,
            "font-size": "11px",
            "line-height": "36px",
            "font-weight": activeTab() === "marketplace" ? 600 : 400,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          Marketplace
        </button>
        <button
          onClick={() => setActiveTab("installed")}
          class={activeTab() === "installed" ? "tab active" : "tab inactive"}
          style={{
            padding: "0 16px",
            border: "none",
            "border-bottom": activeTab() === "installed"
              ? `1px solid ${tokens.colors.semantic.primary}`
              : "1px solid transparent",
            "background-color": "transparent",
            color: activeTab() === "installed"
              ? tokens.colors.text.primary
              : tokens.colors.text.muted,
            "font-size": "11px",
            "line-height": "36px",
            "font-weight": activeTab() === "installed" ? 600 : 400,
            cursor: "pointer",
            display: "flex",
            "align-items": "center",
            gap: "8px",
            transition: "all 0.2s ease",
          }}
        >
          Installed
          <span
            style={{
              "font-size": "10px",
              "background-color": activeTab() === "installed"
                ? tokens.colors.semantic.primary
                : tokens.colors.surface.canvas,
              color: activeTab() === "installed" ? "#fff" : tokens.colors.text.muted,
              padding: "2px 6px",
              "border-radius": "var(--cortex-radius-full)",
            }}
          >
            {extensions().length}
          </span>
        </button>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          padding: "12px 20px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            "align-items": "center",
            gap: "8px",
            padding: "8px 12px",
            "background-color": tokens.colors.surface.canvas,
            "border-radius": "var(--cortex-radius-md)",
            border: `1px solid ${tokens.colors.border.default}`,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.colors.text.muted}
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={activeTab() === "marketplace" ? "Search marketplace..." : "Search installed extensions..."}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            style={{
              flex: 1,
              border: "none",
              background: "none",
              outline: "none",
              color: tokens.colors.text.primary,
              "font-size": "13px",
            }}
          />
        </div>
        <Show when={activeTab() === "marketplace"}>
          <button
            onClick={handleSearch}
            disabled={loading()}
            style={{
              padding: "8px 16px",
              "border-radius": "var(--cortex-radius-md)",
              border: "none",
              "background-color": tokens.colors.semantic.primary,
              color: "var(--cortex-text-primary)",
              "font-size": "13px",
              "font-weight": 500,
              cursor: loading() ? "not-allowed" : "pointer",
              opacity: loading() ? 0.5 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            Search
          </button>
        </Show>
      </div>

      {/* Category Filters */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "12px 20px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "overflow-x": "auto",
        }}
      >
        {(
          [
            { value: "all", label: "All" },
            { value: "themes", label: "Themes" },
            { value: "languages", label: "Languages" },
            { value: "snippets", label: "Snippets" },
            { value: "panels", label: "Panels" },
            { value: "ai", label: "AI" },
            { value: "formatters", label: "Formatters" },
            { value: "debuggers", label: "Debuggers" },
          ] as const
        ).map((cat) => (
          <button
            onClick={() => setCategory(cat.value)}
            style={{
              padding: "6px 14px",
              "border-radius": "var(--cortex-radius-full)",
              border: "none",
              "font-size": "13px",
              "font-weight": 500,
              cursor: "pointer",
              "white-space": "nowrap",
              "background-color":
                category() === cat.value
                  ? tokens.colors.semantic.primary
                  : tokens.colors.surface.canvas,
              color:
                category() === cat.value ? "#fff" : tokens.colors.text.muted,
              transition: "all 0.2s ease",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error Message */}
      <Show when={error()}>
        <div
          style={{
            margin: "12px 20px",
            padding: "12px",
            "background-color": "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${tokens.colors.semantic.error}`,
            "border-radius": "var(--cortex-radius-md)",
            color: tokens.colors.semantic.error,
            "font-size": "13px",
            display: "flex",
            "align-items": "center",
            gap: "8px",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error()}
        </div>
      </Show>

      {/* Content */}
      <div
        style={{
          flex: 1,
          "overflow-y": "auto",
          padding: "16px 20px",
        }}
      >
        {/* Marketplace Tab Content */}
        <Show when={activeTab() === "marketplace"}>
          <Show
            when={!loading()}
            fallback={
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  height: "200px",
                  gap: "12px",
                  color: tokens.colors.text.muted,
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <span>Searching marketplace...</span>
              </div>
            }
          >
            <Show
              when={filteredMarketplace().length > 0}
              fallback={
                <div
                  style={{
                    display: "flex",
                    "flex-direction": "column",
                    "align-items": "center",
                    "justify-content": "center",
                    height: "200px",
                    gap: "16px",
                    color: tokens.colors.text.muted,
                  }}
                >
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    style={{ opacity: 0.5 }}
                  >
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  <div style={{ "text-align": "center" }}>
                    <p style={{ margin: "0 0 8px" }}>No extensions found</p>
                    <p
                      style={{
                        margin: 0,
                        "font-size": "12px",
                        "max-width": "300px",
                      }}
                    >
                      Try adjusting your search or browse different categories.
                    </p>
                  </div>
                </div>
              }
            >
              {/* Featured Section */}
              <Show when={!searchQuery() && category() === "all" && viewMode() === "grid"}>
                <div style={{ "margin-bottom": "24px" }}>
                  <h3
                    style={{
                      margin: "0 0 16px",
                      "font-size": "14px",
                      "font-weight": 600,
                      color: tokens.colors.text.primary,
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="none"
                      style={{ color: tokens.colors.semantic.warning }}
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Featured Extensions
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": "repeat(auto-fill, minmax(320px, 1fr))",
                      gap: "16px",
                    }}
                  >
                    <For each={filteredMarketplace().slice(0, 3)}>
                      {(ext) => (
                        <ExtensionCard
                          extension={ext}
                          isInstalled={installedNames().has(ext.name)}
                          viewMode={viewMode()}
                          onInstall={handleInstall}
                          onClick={handleExtensionClick}
                        />
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* All Extensions */}
              <div>
                <Show when={!searchQuery() && category() === "all" && viewMode() === "grid"}>
                  <h3
                    style={{
                      margin: "0 0 16px",
                      "font-size": "14px",
                      "font-weight": 600,
                      color: tokens.colors.text.primary,
                    }}
                  >
                    All Extensions
                  </h3>
                </Show>
                <div
                  style={{
                    display: viewMode() === "grid" ? "grid" : "flex",
                    "grid-template-columns": viewMode() === "grid" ? "repeat(auto-fill, minmax(320px, 1fr))" : undefined,
                    "flex-direction": viewMode() === "list" ? "column" : undefined,
                    gap: "16px",
                  }}
                >
                  <For
                    each={
                      !searchQuery() && category() === "all" && viewMode() === "grid"
                        ? filteredMarketplace().slice(3)
                        : filteredMarketplace()
                    }
                  >
                    {(ext) => (
                      <ExtensionCard
                        extension={ext}
                        isInstalled={installedNames().has(ext.name)}
                        viewMode={viewMode()}
                        onInstall={handleInstall}
                        onClick={handleExtensionClick}
                      />
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </Show>
        </Show>

        {/* Installed Tab Content */}
        <Show when={activeTab() === "installed"}>
          <Show
            when={filteredInstalled().length > 0}
            fallback={
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  height: "200px",
                  gap: "16px",
                  color: tokens.colors.text.muted,
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  style={{ opacity: 0.5 }}
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                <div style={{ "text-align": "center" }}>
                  <p style={{ margin: "0 0 8px" }}>No installed extensions</p>
                  <p
                    style={{
                      margin: 0,
                      "font-size": "12px",
                      "max-width": "300px",
                    }}
                  >
                    Browse the marketplace to find and install extensions.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("marketplace")}
                  style={{
                    padding: "8px 16px",
                    "border-radius": "var(--cortex-radius-md)",
                    border: "none",
                    "background-color": tokens.colors.semantic.primary,
                    color: "var(--cortex-text-primary)",
                    "font-size": "13px",
                    "font-weight": 500,
                    cursor: "pointer",
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Browse Marketplace
                </button>
              </div>
            }
          >
            <div
              style={{
                display: viewMode() === "grid" ? "grid" : "flex",
                "grid-template-columns": viewMode() === "grid" ? "repeat(auto-fill, minmax(320px, 1fr))" : undefined,
                "flex-direction": viewMode() === "list" ? "column" : undefined,
                gap: "16px",
              }}
            >
              <For each={filteredInstalled()}>
                {(ext) => (
                  <ExtensionCard
                    extension={ext}
                    viewMode={viewMode()}
                    onEnable={(name) => enableExtension(name)}
                    onDisable={(name) => disableExtension(name)}
                    onUninstall={(name) => uninstallExtension(name)}
                    onClick={handleExtensionClick}
                  />
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>

      {/* Info Footer */}
      <Show when={activeTab() === "marketplace"}>
        <div
          style={{
            padding: "12px 20px",
            "border-top": `1px solid ${tokens.colors.border.default}`,
            "font-size": "12px",
            color: tokens.colors.text.muted,
            "text-align": "center",
          }}
        >
          Click on any extension to view details, screenshots, reviews, and more.
        </div>
      </Show>

      {/* CSS for spin animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

