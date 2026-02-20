import { Component, Show, For, createSignal, createMemo } from "solid-js";
import { Markdown } from "../Markdown";
import { tokens } from "@/design-system/tokens";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("extensions");

// ============================================================================
// Type Definitions
// ============================================================================

export interface ExtensionVersion {
  version: string;
  releaseDate: string;
  changelog: string;
  size: string;
  downloads: number;
}

export interface ExtensionReview {
  id: string;
  author: string;
  authorAvatar?: string;
  rating: number;
  date: string;
  content: string;
  helpful: number;
  version: string;
}

export interface ExtensionDependency {
  name: string;
  version: string;
  type: "required" | "optional" | "peer";
  description?: string;
}

export interface ExtensionScreenshot {
  url: string;
  caption: string;
}

export interface ExtensionDetailData {
  id: string;
  name: string;
  displayName: string;
  version: string;
  publisher: string;
  publisherDisplayName: string;
  publisherVerified: boolean;
  description: string;
  longDescription: string;
  icon?: string;
  banner?: string;
  repository?: string;
  license?: string;
  homepage?: string;
  categories: string[];
  tags: string[];
  rating: number;
  ratingCount: number;
  downloads: number;
  lastUpdated: string;
  published: string;
  isInstalled: boolean;
  isEnabled: boolean;
  screenshots: ExtensionScreenshot[];
  versions: ExtensionVersion[];
  reviews: ExtensionReview[];
  dependencies: ExtensionDependency[];
}

// ============================================================================
// Mock Data for Development
// ============================================================================

export const MOCK_EXTENSION_DETAIL: ExtensionDetailData = {
  id: "cortex.python-language-server",
  name: "python-language-server",
  displayName: "Python Language Server",
  version: "2.4.1",
  publisher: "cortex",
  publisherDisplayName: "Cortex",
  publisherVerified: true,
  description: "Rich Python language support with IntelliSense, linting, debugging, and more.",
  longDescription: `# Python Language Server

A comprehensive Python language extension that provides rich IntelliSense, linting, debugging, and code navigation for Python development.

## Features

### IntelliSense & Autocompletion
- Smart code completion based on Python semantics
- Signature help for functions and methods
- Quick info on hover for symbols and expressions
- Go to definition and find all references

### Linting & Code Quality
- Integration with popular linters (pylint, flake8, mypy)
- Real-time error detection and diagnostics
- Quick fixes for common issues
- Code formatting with Black and autopep8

### Debugging
- Full debugging support with breakpoints
- Variable inspection and watch expressions
- Step through code execution
- Debug configuration for various scenarios

### Additional Features
- \`\`\`python
  # Code snippets for common patterns
  def main():
      print("Hello, World!")
      
  if __name__ == "__main__":
      main()
  \`\`\`
- Virtual environment detection
- Jupyter notebook support
- Test explorer integration

## Requirements

- Python 3.8 or higher
- pip package manager

## Configuration

The extension can be configured via settings:

| Setting | Description | Default |
|---------|-------------|---------|
| \`python.linting.enabled\` | Enable/disable linting | \`true\` |
| \`python.formatting.provider\` | Formatter to use | \`black\` |
| \`python.analysis.typeCheckingMode\` | Type checking strictness | \`basic\` |

## Known Issues

- Performance may degrade in very large workspaces
- Some features require language server restart after configuration changes

## Release Notes

See the [changelog](https://github.com/cortex/python-language-server/blob/main/CHANGELOG.md) for detailed release notes.
`,
  icon: undefined,
  banner: undefined,
  repository: "https://github.com/cortex/python-language-server",
  license: "MIT",
  homepage: "https://cortex.dev/extensions/python",
  categories: ["Programming Languages", "Linters", "Debuggers", "Formatters"],
  tags: ["python", "intellisense", "linting", "debugging", "formatting"],
  rating: 4.7,
  ratingCount: 12847,
  downloads: 2543891,
  lastUpdated: "2024-12-15",
  published: "2022-03-10",
  isInstalled: false,
  isEnabled: false,
  screenshots: [
    {
      url: "/screenshots/python-intellisense.png",
      caption: "IntelliSense autocomplete suggestions",
    },
    {
      url: "/screenshots/python-linting.png",
      caption: "Real-time linting and diagnostics",
    },
    {
      url: "/screenshots/python-debugging.png",
      caption: "Integrated debugging experience",
    },
    {
      url: "/screenshots/python-formatting.png",
      caption: "Code formatting with Black",
    },
  ],
  versions: [
    {
      version: "2.4.1",
      releaseDate: "2024-12-15",
      changelog: "- Fixed issue with virtual environment detection on Windows\n- Improved performance for large files\n- Updated language server to latest version",
      size: "15.2 MB",
      downloads: 234521,
    },
    {
      version: "2.4.0",
      releaseDate: "2024-11-28",
      changelog: "- Added support for Python 3.13\n- New quick fix actions for common issues\n- Improved type inference accuracy",
      size: "15.1 MB",
      downloads: 456789,
    },
    {
      version: "2.3.2",
      releaseDate: "2024-10-15",
      changelog: "- Bug fixes and stability improvements\n- Fixed memory leak in large projects\n- Updated documentation",
      size: "14.8 MB",
      downloads: 892341,
    },
    {
      version: "2.3.1",
      releaseDate: "2024-09-20",
      changelog: "- Performance optimizations\n- Fixed issue with multiline strings\n- Improved error messages",
      size: "14.7 MB",
      downloads: 542167,
    },
    {
      version: "2.3.0",
      releaseDate: "2024-08-10",
      changelog: "- New refactoring actions\n- Added semantic highlighting\n- Improved workspace symbol search",
      size: "14.5 MB",
      downloads: 418073,
    },
  ],
  reviews: [
    {
      id: "r1",
      author: "devpro42",
      rating: 5,
      date: "2024-12-10",
      content: "Absolutely essential for Python development. The IntelliSense is incredibly accurate and the debugging support is top-notch. Highly recommended!",
      helpful: 127,
      version: "2.4.1",
    },
    {
      id: "r2",
      author: "codemaster",
      rating: 5,
      date: "2024-12-05",
      content: "Best Python extension I've used. The linting integration saves me so much time. Virtual environment detection works flawlessly.",
      helpful: 89,
      version: "2.4.0",
    },
    {
      id: "r3",
      author: "pythonista",
      rating: 4,
      date: "2024-11-22",
      content: "Great extension overall. Would love to see better Django support in future versions. The type checking is very helpful.",
      helpful: 56,
      version: "2.4.0",
    },
    {
      id: "r4",
      author: "newdev",
      rating: 4,
      date: "2024-11-15",
      content: "Easy to set up and works well. Documentation could be more comprehensive. Otherwise, excellent extension.",
      helpful: 34,
      version: "2.3.2",
    },
    {
      id: "r5",
      author: "datascience_pro",
      rating: 5,
      date: "2024-10-30",
      content: "Perfect for data science work. Jupyter notebook integration is seamless. The quick fixes are very helpful.",
      helpful: 78,
      version: "2.3.2",
    },
  ],
  dependencies: [
    {
      name: "cortex.language-server-core",
      version: "^1.5.0",
      type: "required",
      description: "Core language server functionality",
    },
    {
      name: "cortex.debug-adapter",
      version: "^2.0.0",
      type: "required",
      description: "Debug adapter protocol implementation",
    },
    {
      name: "cortex.jupyter-support",
      version: "^1.2.0",
      type: "optional",
      description: "Jupyter notebook integration",
    },
    {
      name: "cortex.test-explorer",
      version: "^1.0.0",
      type: "optional",
      description: "Test discovery and execution",
    },
  ],
};

// ============================================================================
// Sub-components
// ============================================================================

interface StarRatingProps {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}

// StarRating - VS Code specifications: 3px margin-left between stars, 0.75 opacity for empty
const StarRating: Component<StarRatingProps> = (props) => {
  const size = () => props.size || 14;
  const fullStars = () => Math.floor(props.rating);
  const hasHalfStar = () => props.rating % 1 >= 0.5;
  const emptyStars = () => 5 - fullStars() - (hasHalfStar() ? 1 : 0);

  return (
    <div class="extension-ratings" style={{ display: "flex", "align-items": "center", gap: "4px" }}>
      <div style={{ display: "flex" }}>
        <For each={Array(fullStars()).fill(0)}>
          {(_, index) => (
            <svg
              class="star star-full"
              width={size()}
              height={size()}
              viewBox="0 0 24 24"
              fill={tokens.colors.semantic.warning}
              stroke="none"
              style={{ "margin-left": index() > 0 ? "3px" : "0" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
        </For>
        <Show when={hasHalfStar()}>
          <svg
            class="star star-half"
            width={size()}
            height={size()}
            viewBox="0 0 24 24"
            style={{ position: "relative", "margin-left": fullStars() > 0 ? "3px" : "0" }}
          >
            <defs>
              <linearGradient id="half-star">
                <stop offset="50%" stop-color={tokens.colors.semantic.warning} />
                <stop offset="50%" stop-color={tokens.colors.surface.canvas} />
              </linearGradient>
            </defs>
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              fill="url(#half-star)"
            />
          </svg>
        </Show>
        <For each={Array(emptyStars()).fill(0)}>
          {() => (
            <svg
              class="star star-empty"
              width={size()}
              height={size()}
              viewBox="0 0 24 24"
              fill={tokens.colors.surface.canvas}
              stroke={tokens.colors.text.muted}
              stroke-width="1"
              style={{ "margin-left": "3px", opacity: 0.75 }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
        </For>
      </div>
      <Show when={props.showValue}>
        <span class="count" style={{ "font-size": "13px", color: tokens.colors.text.primary, "font-weight": 500, "margin-left": "6px" }}>
          {props.rating.toFixed(1)}
        </span>
      </Show>
      <Show when={props.count !== undefined}>
        <span style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
          ({props.count?.toLocaleString()} ratings)
        </span>
      </Show>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: any;
}

// TabButton - VS Code navbar specs: 11px font size, 36px line-height
const TabButton: Component<TabButtonProps> = (props) => {
  return (
    <button
      onClick={props.onClick}
      class={props.active ? "tab active" : "tab inactive"}
      style={{
        padding: "0 16px",
        "border-radius": "0",
        border: "none",
        "border-bottom": props.active
          ? "1px solid var(--vscode-panelTitle-activeBorder, var(--cortex-info))"
          : "1px solid transparent",
        "font-size": "11px",
        "line-height": "36px",
        "font-weight": props.active ? 600 : 400,
        cursor: "pointer",
        "background-color": "transparent",
        color: props.active
          ? "var(--vscode-panelTitle-activeForeground, var(--cortex-text-primary))"
          : "var(--vscode-panelTitle-inactiveForeground, var(--cortex-text-inactive))",
        transition: "all 0.2s ease",
        "white-space": "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!props.active) {
          e.currentTarget.style.color = "var(--vscode-panelTitle-activeForeground, var(--cortex-text-primary))";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.active) {
          e.currentTarget.style.color = "var(--vscode-panelTitle-inactiveForeground, var(--cortex-text-inactive))";
        }
      }}
    >
      {props.children}
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

type DetailTab = "details" | "changelog" | "reviews" | "dependencies";

/** Information about an available update */
export interface ExtensionUpdateInfo {
  currentVersion: string;
  availableVersion: string;
  changelog?: string;
  releaseDate?: string;
}

interface ExtensionDetailProps {
  extension: ExtensionDetailData;
  /** Update info if an update is available */
  updateInfo?: ExtensionUpdateInfo;
  /** Whether an update is currently in progress */
  isUpdating?: boolean;
  onClose?: () => void;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  onEnable?: (id: string) => void;
  onDisable?: (id: string) => void;
  onUpdate?: (id: string) => void;
}

export const ExtensionDetail: Component<ExtensionDetailProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<DetailTab>("details");
  const [installing, setInstalling] = createSignal(false);
  const [updating, setUpdating] = createSignal(false);
  const [selectedScreenshot, setSelectedScreenshot] = createSignal<number | null>(null);
  const [expandedVersions, setExpandedVersions] = createSignal<Set<string>>(new Set());

  const hasUpdate = () => !!props.updateInfo;
  const isUpdating = () => props.isUpdating || updating();

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await props.onInstall?.(props.extension.id);
    } finally {
      setInstalling(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await props.onUpdate?.(props.extension.id);
    } finally {
      setUpdating(false);
    }
  };

  const handleUninstall = () => {
    props.onUninstall?.(props.extension.id);
  };

  const toggleVersionExpanded = (version: string) => {
    const current = expandedVersions();
    const newSet = new Set(current);
    if (newSet.has(version)) {
      newSet.delete(version);
    } else {
      newSet.add(version);
    }
    setExpandedVersions(newSet);
  };

  const averageRatingDistribution = createMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    props.extension.reviews.forEach((review) => {
      dist[5 - review.rating]++;
    });
    const total = props.extension.reviews.length || 1;
    return dist.map((count) => (count / total) * 100);
  });

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
          padding: "20px 24px",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
        }}
      >
        <div style={{ display: "flex", gap: "16px" }}>
          {/* Extension Icon */}
          <div
            style={{
              width: "96px",
              height: "96px",
              "min-width": "96px",
              "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
              "border-radius": "var(--cortex-radius-lg)",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "font-size": "40px",
              color: "var(--primary, var(--cortex-info))",
            }}
          >
            <Show
              when={props.extension.icon}
              fallback={
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              }
            >
              <img
                src={props.extension.icon}
                alt={props.extension.displayName}
                style={{ width: "64px", height: "64px", "border-radius": "var(--cortex-radius-md)" }}
              />
            </Show>
          </div>

          {/* Extension Info */}
          <div style={{ flex: 1, "min-width": 0 }}>
            <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "16px" }}>
              <div>
                <h1
                  style={{
                    margin: 0,
                    "font-size": "20px",
                    "font-weight": 600,
                    color: tokens.colors.text.primary,
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                  }}
                >
                  {props.extension.displayName}
                </h1>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "margin-top": "4px",
                  }}
                >
                  <span style={{ "font-size": "13px", color: tokens.colors.text.muted }}>
                    {props.extension.publisherDisplayName}
                  </span>
                  <Show when={props.extension.publisherVerified}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="var(--primary, var(--cortex-info))"
                      stroke="none"
                    >
                      <title>Verified Publisher</title>
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </Show>
                  <span
                    style={{
                      "font-size": "12px",
                      color: tokens.colors.text.muted,
                      "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                      padding: "2px 6px",
                      "border-radius": "var(--cortex-radius-sm)",
                    }}
                  >
                    v{props.extension.version}
                  </span>
                  {/* Update available indicator */}
                  <Show when={hasUpdate()}>
                    <span
                      style={{
                        display: "flex",
                        "align-items": "center",
                        gap: "4px",
                        "font-size": "12px",
                        color: tokens.colors.semantic.info,
                        "background-color": "rgba(59, 130, 246, 0.15)",
                        padding: "2px 8px",
                        "border-radius": "var(--cortex-radius-sm)",
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                      v{props.updateInfo?.availableVersion} available
                    </span>
                  </Show>
                </div>
              </div>

              {/* Close button */}
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

            <p
              style={{
                margin: "8px 0 12px",
                "font-size": "13px",
                color: tokens.colors.text.primary,
                "line-height": 1.5,
              }}
            >
              {props.extension.description}
            </p>

            {/* Stats Row */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "20px",
                "flex-wrap": "wrap",
              }}
            >
              <StarRating
                rating={props.extension.rating}
                showValue={true}
                count={props.extension.ratingCount}
              />
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  "font-size": "13px",
                  color: tokens.colors.text.muted,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>{formatNumber(props.extension.downloads)} installs</span>
              </div>
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  "font-size": "13px",
                  color: tokens.colors.text.muted,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Updated {formatDate(props.extension.lastUpdated)}</span>
              </div>
            </div>

            {/* Categories */}
            <div style={{ display: "flex", gap: "6px", "margin-top": "12px", "flex-wrap": "wrap" }}>
              <For each={props.extension.categories}>
                {(category) => (
                  <span
                    style={{
                      "font-size": "11px",
                      padding: "3px 10px",
                      "border-radius": "var(--cortex-radius-full)",
                      "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                      color: tokens.colors.text.muted,
                    }}
                  >
                    {category}
                  </span>
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", "margin-top": "16px" }}>
          {/* Update button - shown when update is available */}
          <Show when={props.extension.isInstalled && hasUpdate()}>
            <button
              onClick={handleUpdate}
              disabled={isUpdating()}
              class="extension-action-button"
              style={{
                padding: "0 12px",
                "border-radius": "var(--cortex-radius-sm)",
                border: "1px solid var(--vscode-button-border, transparent)",
                "font-size": "13px",
                "font-weight": 600,
                "line-height": "22px",
                "max-width": "300px",
                cursor: isUpdating() ? "not-allowed" : "pointer",
                "background-color": "var(--info, var(--cortex-info))",
                color: "var(--cortex-text-primary)",
                opacity: isUpdating() ? 0.7 : 1,
                transition: "background-color 0.2s ease",
                display: "flex",
                "align-items": "center",
                gap: "8px",
                "white-space": "nowrap",
                overflow: "hidden",
                "text-overflow": "ellipsis",
              }}
              onMouseEnter={(e) => {
                if (!isUpdating()) {
                  e.currentTarget.style.backgroundColor = "var(--cortex-info)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isUpdating()) {
                  e.currentTarget.style.backgroundColor = "var(--info, var(--cortex-info))";
                }
              }}
            >
              <Show
                when={!isUpdating()}
                fallback={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  </svg>
                }
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </Show>
              {isUpdating() ? "Updating..." : `Update to v${props.updateInfo?.availableVersion}`}
            </button>
          </Show>
          <Show
            when={props.extension.isInstalled}
            fallback={
              <button
                onClick={handleInstall}
                disabled={installing()}
                class="extension-action-button"
                style={{
                  padding: "0 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "1px solid var(--vscode-button-border, transparent)",
                  "font-size": "13px",
                  "font-weight": 600,
                  "line-height": "22px",
                  "max-width": "300px",
                  cursor: installing() ? "not-allowed" : "pointer",
                  "background-color": "var(--vscode-extensionButton-prominentBackground, var(--cortex-info))",
                  color: "var(--vscode-extensionButton-prominentForeground, #fff)",
                  opacity: installing() ? 0.4 : 1,
                  transition: "background-color 0.2s ease",
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  "white-space": "nowrap",
                  overflow: "hidden",
                  "text-overflow": "ellipsis",
                }}
                onMouseEnter={(e) => {
                  if (!installing()) {
                    e.currentTarget.style.backgroundColor = "var(--vscode-extensionButton-prominentHoverBackground, var(--cortex-info))";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!installing()) {
                    e.currentTarget.style.backgroundColor = "var(--vscode-extensionButton-prominentBackground, var(--cortex-info))";
                  }
                }}
              >
                <Show
                  when={!installing()}
                  fallback={
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    </svg>
                  }
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </Show>
                {installing() ? "Installing..." : "Install"}
              </button>
            }
          >
            <Show
              when={props.extension.isEnabled}
              fallback={
                <button
                  onClick={() => props.onEnable?.(props.extension.id)}
                  class="extension-action-button"
                  style={{
                    padding: "0 8px",
                    "border-radius": "var(--cortex-radius-sm)",
                    border: "1px solid var(--vscode-button-border, transparent)",
                    "font-size": "13px",
                    "font-weight": 600,
                    "line-height": "22px",
                    "max-width": "300px",
                    cursor: "pointer",
                    "background-color": "var(--vscode-extensionButton-prominentBackground, var(--cortex-info))",
                    color: "var(--vscode-extensionButton-prominentForeground, #fff)",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--vscode-extensionButton-prominentHoverBackground, var(--cortex-info))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--vscode-extensionButton-prominentBackground, var(--cortex-info))";
                  }}
                >
                  Enable
                </button>
              }
            >
              <button
                onClick={() => props.onDisable?.(props.extension.id)}
                class="extension-action-button"
                style={{
                  padding: "0 8px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "1px solid var(--vscode-button-border, transparent)",
                  "font-size": "13px",
                  "font-weight": 600,
                  "line-height": "22px",
                  "max-width": "300px",
                  cursor: "pointer",
                  "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                  color: "var(--vscode-foreground, var(--cortex-text-primary))",
                  transition: "all 0.2s ease",
                }}
              >
                Disable
              </button>
            </Show>
            <button
              onClick={handleUninstall}
              class="extension-action-button"
              style={{
                padding: "0 8px",
                "border-radius": "var(--cortex-radius-sm)",
                border: "1px solid var(--vscode-editorError-foreground, var(--cortex-error))",
                "font-size": "13px",
                "font-weight": 600,
                "line-height": "22px",
                "max-width": "300px",
                cursor: "pointer",
                "background-color": "transparent",
                color: "var(--vscode-editorError-foreground, var(--cortex-error))",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(241, 76, 76, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              Uninstall
            </button>
          </Show>

          <Show when={props.extension.repository}>
            <a
              href={props.extension.repository}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "10px 16px",
                "border-radius": "var(--cortex-radius-md)",
                border: `1px solid ${tokens.colors.border.default}`,
                "font-size": "14px",
                cursor: "pointer",
                "background-color": "transparent",
                color: tokens.colors.text.muted,
                "text-decoration": "none",
                display: "flex",
                "align-items": "center",
                gap: "6px",
                transition: "all 0.2s ease",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Repository
            </a>
          </Show>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          "border-bottom": `1px solid ${tokens.colors.border.default}`,
          "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
          "padding-left": "24px",
          "overflow-x": "auto",
        }}
      >
        <TabButton active={activeTab() === "details"} onClick={() => setActiveTab("details")}>
          Details
        </TabButton>
        <TabButton active={activeTab() === "changelog"} onClick={() => setActiveTab("changelog")}>
          Changelog
        </TabButton>
        <TabButton active={activeTab() === "reviews"} onClick={() => setActiveTab("reviews")}>
          Reviews ({props.extension.reviews.length})
        </TabButton>
        <TabButton active={activeTab() === "dependencies"} onClick={() => setActiveTab("dependencies")}>
          Dependencies ({props.extension.dependencies.length})
        </TabButton>
      </div>

      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          "overflow-y": "auto",
          padding: "24px",
        }}
      >
        {/* Details Tab */}
        <Show when={activeTab() === "details"}>
          <div style={{ display: "flex", gap: "32px", "flex-wrap": "wrap" }}>
            {/* Main Content */}
            <div style={{ flex: "1 1 600px", "min-width": 0 }}>
              {/* Screenshots */}
              <Show when={props.extension.screenshots.length > 0}>
                <div style={{ "margin-bottom": "32px" }}>
                  <h3
                    style={{
                      margin: "0 0 16px",
                      "font-size": "15px",
                      "font-weight": 600,
                      color: tokens.colors.text.primary,
                    }}
                  >
                    Screenshots
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <For each={props.extension.screenshots}>
                      {(screenshot, index) => (
                        <div
                          onClick={() => setSelectedScreenshot(index())}
                          style={{
                            cursor: "pointer",
                            "border-radius": "var(--cortex-radius-md)",
                            overflow: "hidden",
                            border: `1px solid ${tokens.colors.border.default}`,
                            transition: "all 0.2s ease",
                            "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = "var(--primary, var(--cortex-info))";
                            e.currentTarget.style.transform = "scale(1.02)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = tokens.colors.border.default;
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          <div
                            style={{
                              "aspect-ratio": "16/10",
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              color: tokens.colors.text.muted,
                              "font-size": "12px",
                            }}
                          >
                            <svg
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.5"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                          <div
                            style={{
                              padding: "8px 12px",
                              "font-size": "12px",
                              color: tokens.colors.text.muted,
                              "border-top": `1px solid ${tokens.colors.border.default}`,
                              "text-align": "center",
                              "white-space": "nowrap",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                            }}
                          >
                            {screenshot.caption}
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>

              {/* Long Description (Markdown) */}
              <div>
                <h3
                  style={{
                    margin: "0 0 16px",
                    "font-size": "15px",
                    "font-weight": 600,
                    color: tokens.colors.text.primary,
                  }}
                >
                  About
                </h3>
                <div
                  style={{
                    "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                    "border-radius": "var(--cortex-radius-md)",
                    padding: "20px",
                    border: `1px solid ${tokens.colors.border.default}`,
                  }}
                >
                  <Markdown content={props.extension.longDescription} />
                </div>
              </div>
            </div>

            {/* Sidebar Info */}
            <div style={{ flex: "0 0 280px" }}>
              <div
                style={{
                  "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                  "border-radius": "var(--cortex-radius-md)",
                  padding: "20px",
                  border: `1px solid ${tokens.colors.border.default}`,
                }}
              >
                <h4
                  style={{
                    margin: "0 0 16px",
                    "font-size": "14px",
                    "font-weight": 600,
                    color: tokens.colors.text.primary,
                  }}
                >
                  More Information
                </h4>
                <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
                  <div>
                    <span
                      style={{
                        "font-size": "11px",
                        color: tokens.colors.text.muted,
                        "text-transform": "uppercase",
                        "letter-spacing": "0.5px",
                      }}
                    >
                      Identifier
                    </span>
                    <p
                      style={{
                        margin: "4px 0 0",
                        "font-size": "13px",
                        color: tokens.colors.text.primary,
                        "font-family": "monospace",
                      }}
                    >
                      {props.extension.id}
                    </p>
                  </div>
                  <div>
                    <span
                      style={{
                        "font-size": "11px",
                        color: tokens.colors.text.muted,
                        "text-transform": "uppercase",
                        "letter-spacing": "0.5px",
                      }}
                    >
                      Published
                    </span>
                    <p style={{ margin: "4px 0 0", "font-size": "13px", color: tokens.colors.text.primary }}>
                      {formatDate(props.extension.published)}
                    </p>
                  </div>
                  <div>
                    <span
                      style={{
                        "font-size": "11px",
                        color: tokens.colors.text.muted,
                        "text-transform": "uppercase",
                        "letter-spacing": "0.5px",
                      }}
                    >
                      Last Updated
                    </span>
                    <p style={{ margin: "4px 0 0", "font-size": "13px", color: tokens.colors.text.primary }}>
                      {formatDate(props.extension.lastUpdated)}
                    </p>
                  </div>
                  <Show when={props.extension.license}>
                    <div>
                      <span
                        style={{
                          "font-size": "11px",
                          color: tokens.colors.text.muted,
                          "text-transform": "uppercase",
                          "letter-spacing": "0.5px",
                        }}
                      >
                        License
                      </span>
                      <p style={{ margin: "4px 0 0", "font-size": "13px", color: tokens.colors.text.primary }}>
                        {props.extension.license}
                      </p>
                    </div>
                  </Show>
                </div>

                {/* Tags */}
                <Show when={props.extension.tags.length > 0}>
                  <div style={{ "margin-top": "20px", "padding-top": "16px", "border-top": `1px solid ${tokens.colors.border.default}` }}>
                    <span
                      style={{
                        "font-size": "11px",
                        color: tokens.colors.text.muted,
                        "text-transform": "uppercase",
                        "letter-spacing": "0.5px",
                      }}
                    >
                      Tags
                    </span>
                    <div style={{ display: "flex", gap: "6px", "margin-top": "8px", "flex-wrap": "wrap" }}>
                      <For each={props.extension.tags}>
                        {(tag) => (
                          <span
                            style={{
                              "font-size": "11px",
                              padding: "3px 8px",
                              "border-radius": "var(--cortex-radius-sm)",
                              "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                              color: tokens.colors.text.muted,
                            }}
                          >
                            {tag}
                          </span>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Changelog Tab */}
        <Show when={activeTab() === "changelog"}>
          <div style={{ "max-width": "800px" }}>
            <For each={props.extension.versions}>
              {(version) => (
                <div
                  style={{
                    "margin-bottom": "16px",
                    "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                    "border-radius": "var(--cortex-radius-md)",
                    border: `1px solid ${tokens.colors.border.default}`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    onClick={() => toggleVersionExpanded(version.version)}
                    style={{
                      padding: "16px 20px",
                      cursor: "pointer",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-tertiary, var(--cortex-bg-hover))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
                      <span
                        style={{
                          "font-size": "14px",
                          "font-weight": 600,
                          color: tokens.colors.text.primary,
                        }}
                      >
                        v{version.version}
                      </span>
                      <Show when={version.version === props.extension.version}>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "2px 6px",
                            "border-radius": "var(--cortex-radius-sm)",
                            "background-color": "rgba(34, 197, 94, 0.15)",
                            color: "var(--success, var(--cortex-success))",
                            "text-transform": "uppercase",
                            "font-weight": 600,
                          }}
                        >
                          Latest
                        </span>
                      </Show>
                    </div>
                    <div style={{ display: "flex", "align-items": "center", gap: "16px" }}>
                      <span style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        {formatDate(version.releaseDate)}
                      </span>
                      <span style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        {version.size}
                      </span>
                      <span style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        {formatNumber(version.downloads)} downloads
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={tokens.colors.text.muted}
                        stroke-width="2"
                        style={{
                          transform: expandedVersions().has(version.version)
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                  <Show when={expandedVersions().has(version.version)}>
                    <div
                      style={{
                        padding: "16px 20px",
                        "border-top": `1px solid ${tokens.colors.border.default}`,
                        "font-size": "13px",
                        color: tokens.colors.text.primary,
                        "line-height": 1.6,
                        "white-space": "pre-wrap",
                      }}
                    >
                      {version.changelog}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        {/* Reviews Tab */}
        <Show when={activeTab() === "reviews"}>
          <div style={{ display: "flex", gap: "32px", "flex-wrap": "wrap" }}>
            {/* Rating Summary */}
            <div style={{ flex: "0 0 280px" }}>
              <div
                style={{
                  "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                  "border-radius": "var(--cortex-radius-md)",
                  padding: "20px",
                  border: `1px solid ${tokens.colors.border.default}`,
                  "text-align": "center",
                }}
              >
                <div
                  style={{
                    "font-size": "48px",
                    "font-weight": 700,
                    color: tokens.colors.text.primary,
                  }}
                >
                  {props.extension.rating.toFixed(1)}
                </div>
                <StarRating rating={props.extension.rating} size={20} />
                <p
                  style={{
                    margin: "8px 0 20px",
                    "font-size": "12px",
                    color: tokens.colors.text.muted,
                  }}
                >
                  {props.extension.ratingCount.toLocaleString()} ratings
                </p>

                {/* Rating Distribution */}
                <div style={{ "text-align": "left" }}>
                  <For each={[5, 4, 3, 2, 1]}>
                    {(stars, index) => (
                      <div
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "8px",
                          "margin-bottom": "6px",
                        }}
                      >
                        <span
                          style={{
                            "font-size": "12px",
                            color: tokens.colors.text.muted,
                            width: "16px",
                          }}
                        >
                          {stars}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="var(--warning, var(--cortex-warning))"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <div
                          style={{
                            flex: 1,
                            height: "8px",
                            "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                            "border-radius": "var(--cortex-radius-sm)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${averageRatingDistribution()[index()]}%`,
                              height: "100%",
                              "background-color": "var(--primary, var(--cortex-info))",
                              "border-radius": "var(--cortex-radius-sm)",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div style={{ flex: "1 1 400px", "min-width": 0 }}>
              <For each={props.extension.reviews}>
                {(review) => (
                  <div
                    style={{
                      "margin-bottom": "16px",
                      "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                      "border-radius": "var(--cortex-radius-md)",
                      padding: "16px 20px",
                      border: `1px solid ${tokens.colors.border.default}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        "justify-content": "space-between",
                        "align-items": "flex-start",
                        "margin-bottom": "12px",
                      }}
                    >
                      <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            "border-radius": "var(--cortex-radius-full)",
                            "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "center",
                            "font-size": "14px",
                            "font-weight": 600,
                            color: tokens.colors.text.muted,
                          }}
                        >
                          {review.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div
                            style={{
                              "font-size": "13px",
                              "font-weight": 500,
                              color: tokens.colors.text.primary,
                            }}
                          >
                            {review.author}
                          </div>
                          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                            <StarRating rating={review.rating} size={12} />
                            <span
                              style={{ "font-size": "11px", color: tokens.colors.text.muted }}
                            >
                              v{review.version}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span style={{ "font-size": "12px", color: tokens.colors.text.muted }}>
                        {formatDate(review.date)}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        "font-size": "13px",
                        color: tokens.colors.text.primary,
                        "line-height": 1.6,
                      }}
                    >
                      {review.content}
                    </p>
                    <div
                      style={{
                        "margin-top": "12px",
                        display: "flex",
                        "align-items": "center",
                        gap: "8px",
                      }}
                    >
                      <button
                        style={{
                          display: "flex",
                          "align-items": "center",
                          gap: "4px",
                          padding: "4px 8px",
                          "border-radius": "var(--cortex-radius-sm)",
                          border: `1px solid ${tokens.colors.border.default}`,
                          "background-color": "transparent",
                          color: tokens.colors.text.muted,
                          "font-size": "12px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--primary, var(--cortex-info))";
                          e.currentTarget.style.color = "var(--primary, var(--cortex-info))";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = tokens.colors.border.default;
                          e.currentTarget.style.color = tokens.colors.text.muted;
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                        </svg>
                        Helpful ({review.helpful})
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Dependencies Tab */}
        <Show when={activeTab() === "dependencies"}>
          <div style={{ "max-width": "800px" }}>
            <Show
              when={props.extension.dependencies.length > 0}
              fallback={
                <div
                  style={{
                    "text-align": "center",
                    padding: "48px 24px",
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
                    style={{ margin: "0 auto 16px", opacity: 0.5 }}
                  >
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  </svg>
                  <p style={{ margin: 0 }}>This extension has no dependencies.</p>
                </div>
              }
            >
              <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
                <For each={props.extension.dependencies}>
                  {(dep) => (
                    <div
                      style={{
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "space-between",
                        padding: "16px 20px",
                        "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
                        "border-radius": "var(--cortex-radius-md)",
                        border: `1px solid ${tokens.colors.border.default}`,
                      }}
                    >
                      <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            "border-radius": "var(--cortex-radius-md)",
                            "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                            display: "flex",
                            "align-items": "center",
                            "justify-content": "center",
                            color:
                              dep.type === "required"
                                ? "var(--primary, var(--cortex-info))"
                                : tokens.colors.text.muted,
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                          </svg>
                        </div>
                        <div>
                          <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                            <span
                              style={{
                                "font-size": "13px",
                                "font-weight": 500,
                                color: tokens.colors.text.primary,
                              }}
                            >
                              {dep.name}
                            </span>
                            <span
                              style={{
                                "font-size": "11px",
                                padding: "2px 6px",
                                "border-radius": "var(--cortex-radius-sm)",
                                "background-color":
                                  dep.type === "required"
                                    ? "rgba(99, 102, 241, 0.15)"
                                    : dep.type === "optional"
                                    ? "rgba(251, 191, 36, 0.15)"
                                    : "rgba(34, 197, 94, 0.15)",
                                color:
                                  dep.type === "required"
                                    ? "var(--primary, var(--cortex-info))"
                                    : dep.type === "optional"
                                    ? "var(--warning, var(--cortex-warning))"
                                    : "var(--success, var(--cortex-success))",
                                "text-transform": "capitalize",
                              }}
                            >
                              {dep.type}
                            </span>
                          </div>
                          <Show when={dep.description}>
                            <p
                              style={{
                                margin: "4px 0 0",
                                "font-size": "12px",
                                color: tokens.colors.text.muted,
                              }}
                            >
                              {dep.description}
                            </p>
                          </Show>
                        </div>
                      </div>
                      <span
                        style={{
                          "font-size": "12px",
                          "font-family": "monospace",
                          color: tokens.colors.text.muted,
                          "background-color": "var(--bg-tertiary, var(--cortex-bg-hover))",
                          padding: "4px 8px",
                          "border-radius": "var(--cortex-radius-sm)",
                        }}
                      >
                        {dep.version}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Screenshot Modal */}
      <Show when={selectedScreenshot() !== null}>
        <div
          onClick={() => setSelectedScreenshot(null)}
          style={{
            position: "fixed",
            inset: 0,
            "background-color": "rgba(0, 0, 0, 0.85)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "z-index": 1000,
            padding: "40px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              "max-width": "90%",
              "max-height": "90%",
              "background-color": "var(--bg-secondary, var(--cortex-bg-primary))",
              "border-radius": "var(--cortex-radius-lg)",
              overflow: "hidden",
              border: `1px solid ${tokens.colors.border.default}`,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                "border-bottom": `1px solid ${tokens.colors.border.default}`,
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
              }}
            >
              <span style={{ "font-size": "13px", color: tokens.colors.text.primary }}>
                {props.extension.screenshots[selectedScreenshot()!]?.caption}
              </span>
              <button
                onClick={() => setSelectedScreenshot(null)}
                style={{
                  padding: "4px",
                  "border-radius": "var(--cortex-radius-sm)",
                  border: "none",
                  "background-color": "transparent",
                  color: tokens.colors.text.muted,
                  cursor: "pointer",
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
            </div>
            <div
              style={{
                padding: "24px",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "min-height": "300px",
                color: tokens.colors.text.muted,
              }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          </div>
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

