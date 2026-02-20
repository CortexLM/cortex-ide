/**
 * =============================================================================
 * ISSUE REPORTER PROVIDER - issue prefix
 * =============================================================================
 * 
 * Provides options to report bugs, request features, or report performance issues.
 * Collects system information and opens the appropriate report form or GitHub link.
 * Accessible via "issue " prefix in quick access.
 */

import type { QuickAccessProvider, QuickAccessItem } from "./types";
import { Icon } from "../../components/ui/Icon";
import type { Component, JSX } from "solid-js";

/**
 * Issue type enumeration
 */
export type IssueType = "bug" | "feature" | "performance";

/**
 * Issue item data
 */
export interface IssueItemData {
  type: IssueType;
  openExternal?: boolean;
}

/**
 * System information collected for issue reports
 */
export interface SystemInfo {
  /** Application version */
  appVersion: string;
  /** Operating system */
  os: string;
  /** OS version */
  osVersion: string;
  /** Architecture (x64, arm64, etc.) */
  arch: string;
  /** Memory usage in MB */
  memoryUsage?: number;
  /** Total memory in MB */
  totalMemory?: number;
  /** CPU model */
  cpuModel?: string;
  /** Number of CPU cores */
  cpuCores?: number;
  /** Electron version */
  electronVersion?: string;
  /** Chrome version */
  chromeVersion?: string;
  /** Node.js version */
  nodeVersion?: string;
  /** GPU information */
  gpuInfo?: string;
  /** List of enabled extensions */
  extensions?: string[];
  /** Current workspace path */
  workspacePath?: string;
  /** Active theme */
  theme?: string;
  /** Locale */
  locale?: string;
}

/**
 * Options for creating the Issue Reporter Provider
 */
export interface IssueReporterProviderOptions {
  /** GitHub repository URL for issues (e.g., "https://github.com/user/repo") */
  repositoryUrl?: string;
  /** Whether to include system info by default */
  includeSystemInfo?: boolean;
}

/**
 * Dependencies for the Issue Reporter Provider
 */
export interface IssueReporterProviderDependencies {
  /** Function to get system information */
  getSystemInfo: () => Promise<SystemInfo>;
  /** Function to open external URL */
  openExternal: (url: string) => void;
  /** Function to open the internal issue reporter dialog */
  openIssueReporter?: (type: IssueType, systemInfo: SystemInfo) => void;
  /** Function to hide quick access */
  hide: () => void;
}

/**
 * GitHub issue templates URLs
 */
const GITHUB_ISSUE_TEMPLATES = {
  bug: "issues/new?template=bug_report.md",
  feature: "issues/new?template=feature_request.md",
  performance: "issues/new?template=performance_issue.md",
};

/**
 * Default repository URL
 */
const DEFAULT_REPOSITORY_URL = "https://github.com/nicholasthompson/orion";

/**
 * Issue report items configuration
 */
const ISSUE_ITEMS: {
  id: string;
  label: string;
  description: string;
  detail: string;
  icon: Component<{ style?: JSX.CSSProperties }>;
  iconColor: string;
  type: IssueType;
}[] = [
  {
    id: "issue-bug",
    label: "Report Bug",
    description: "Report a bug or unexpected behavior",
    detail: "Describe what went wrong and how to reproduce it",
    icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "bug", style: props.style }),
    iconColor: "#ef4444", // Red
    type: "bug",
  },
  {
    id: "issue-feature",
    label: "Request Feature",
    description: "Suggest a new feature or improvement",
    detail: "Share your ideas for making the application better",
    icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "lightbulb", style: props.style }),
    iconColor: "#eab308", // Yellow
    type: "feature",
  },
  {
    id: "issue-performance",
    label: "Report Performance Issue",
    description: "Report slowness or high resource usage",
    detail: "Help us identify and fix performance problems",
    icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "bolt", style: props.style }),
    iconColor: "#f97316", // Orange
    type: "performance",
  },
];

/**
 * Format system info as a markdown string for GitHub issues
 */
export function formatSystemInfoForGitHub(info: SystemInfo): string {
  const lines: string[] = [
    "## System Information",
    "",
    `- **App Version:** ${info.appVersion}`,
    `- **OS:** ${info.os} ${info.osVersion}`,
    `- **Architecture:** ${info.arch}`,
  ];

  if (info.electronVersion) {
    lines.push(`- **Electron:** ${info.electronVersion}`);
  }
  if (info.chromeVersion) {
    lines.push(`- **Chrome:** ${info.chromeVersion}`);
  }
  if (info.nodeVersion) {
    lines.push(`- **Node.js:** ${info.nodeVersion}`);
  }
  if (info.cpuModel) {
    lines.push(`- **CPU:** ${info.cpuModel} (${info.cpuCores} cores)`);
  }
  if (info.totalMemory) {
    lines.push(`- **Memory:** ${info.memoryUsage?.toFixed(0) ?? "N/A"} MB / ${info.totalMemory.toFixed(0)} MB`);
  }
  if (info.gpuInfo) {
    lines.push(`- **GPU:** ${info.gpuInfo}`);
  }
  if (info.theme) {
    lines.push(`- **Theme:** ${info.theme}`);
  }
  if (info.locale) {
    lines.push(`- **Locale:** ${info.locale}`);
  }
  if (info.extensions && info.extensions.length > 0) {
    lines.push(`- **Extensions:** ${info.extensions.length} installed`);
  }

  return lines.join("\n");
}

/**
 * Build GitHub issue URL with pre-filled information
 */
export function buildGitHubIssueUrl(
  type: IssueType,
  systemInfo: SystemInfo,
  repositoryUrl: string = DEFAULT_REPOSITORY_URL
): string {
  const template = GITHUB_ISSUE_TEMPLATES[type];
  const baseUrl = `${repositoryUrl}/${template}`;
  
  // Prepare body content based on issue type
  let body = "";
  
  switch (type) {
    case "bug":
      body = [
        "## Description",
        "<!-- A clear and concise description of the bug -->",
        "",
        "## Steps to Reproduce",
        "1. ",
        "2. ",
        "3. ",
        "",
        "## Expected Behavior",
        "<!-- What did you expect to happen? -->",
        "",
        "## Actual Behavior",
        "<!-- What actually happened? -->",
        "",
        "## Screenshots",
        "<!-- If applicable, add screenshots -->",
        "",
        formatSystemInfoForGitHub(systemInfo),
      ].join("\n");
      break;
      
    case "feature":
      body = [
        "## Feature Description",
        "<!-- A clear and concise description of the feature -->",
        "",
        "## Use Case",
        "<!-- Describe the problem this feature would solve -->",
        "",
        "## Proposed Solution",
        "<!-- Describe how you'd like this feature to work -->",
        "",
        "## Alternatives Considered",
        "<!-- Any alternative solutions you've considered -->",
        "",
        formatSystemInfoForGitHub(systemInfo),
      ].join("\n");
      break;
      
    case "performance":
      body = [
        "## Performance Issue Description",
        "<!-- A clear and concise description of the performance issue -->",
        "",
        "## When does it occur?",
        "<!-- Describe when you notice the performance issue -->",
        "",
        "## Severity",
        "<!-- How severely does this impact your workflow? -->",
        "- [ ] Minor - Occasional slowness",
        "- [ ] Moderate - Frequent slowness",
        "- [ ] Severe - Application becomes unusable",
        "",
        "## Steps to Reproduce",
        "1. ",
        "2. ",
        "3. ",
        "",
        formatSystemInfoForGitHub(systemInfo),
      ].join("\n");
      break;
  }
  
  // Encode the body for URL
  const encodedBody = encodeURIComponent(body);
  
  return `${baseUrl}&body=${encodedBody}`;
}

/**
 * Create the Issue Reporter Provider
 */
export function createIssueReporterProvider(
  dependencies: IssueReporterProviderDependencies,
  options: IssueReporterProviderOptions = {}
): QuickAccessProvider<IssueItemData> {
  const {
    getSystemInfo,
    openExternal,
    openIssueReporter,
    hide,
  } = dependencies;
  
  const {
    repositoryUrl = DEFAULT_REPOSITORY_URL,
    includeSystemInfo = true,
  } = options;

  return {
    id: "quickaccess.issue",
    prefix: "issue ",
    name: "Issue Reporter",
    description: "Report bugs, request features, or report performance issues",
    placeholder: "Select issue type...",

    async provideItems(query: string): Promise<QuickAccessItem<IssueItemData>[]> {
      const items: QuickAccessItem<IssueItemData>[] = [];
      const trimmedQuery = query.trim().toLowerCase();

      // Add separator for issue types
      items.push({
        id: "separator-types",
        label: "Report an Issue",
        kind: "separator",
      });

      // Filter and add issue type items
      const filteredItems = ISSUE_ITEMS.filter(item => {
        if (!trimmedQuery) return true;
        const labelMatch = item.label.toLowerCase().includes(trimmedQuery);
        const descMatch = item.description.toLowerCase().includes(trimmedQuery);
        const typeMatch = item.type.toLowerCase().includes(trimmedQuery);
        return labelMatch || descMatch || typeMatch;
      });

      items.push(
        ...filteredItems.map(item => ({
          id: item.id,
          label: item.label,
          description: item.description,
          detail: item.detail,
          icon: item.icon,
          iconColor: item.iconColor,
          data: { type: item.type } as IssueItemData,
        }))
      );

      // Add separator for external links
      if (!trimmedQuery || "github".includes(trimmedQuery) || "external".includes(trimmedQuery)) {
        items.push({
          id: "separator-external",
          label: "External Links",
          kind: "separator",
        });

        items.push({
          id: "issue-github",
          label: "Open GitHub Issues",
          description: "View existing issues on GitHub",
          detail: repositoryUrl,
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "code-branch", style: props.style }),
          data: { type: "bug", openExternal: true } as IssueItemData,
        });
      }

      // Add system info hint
      if (!trimmedQuery || "system".includes(trimmedQuery) || "info".includes(trimmedQuery)) {
        items.push({
          id: "separator-info",
          label: "Information",
          kind: "separator",
        });

        items.push({
          id: "issue-sysinfo",
          label: "System Information",
          description: "View system info that will be included in reports",
          detail: "Click to see what data is collected",
          icon: (props: { style?: JSX.CSSProperties }) => Icon({ name: "circle-info", style: props.style }),
          disabled: false,
          data: { type: "bug" } as IssueItemData,
          alwaysShow: true,
        });
      }

      return items;
    },

    async onSelect(item: QuickAccessItem<IssueItemData>): Promise<void> {
      if (!item.data) return;
      
      hide();

      // Handle external GitHub link
      if (item.id === "issue-github") {
        openExternal(`${repositoryUrl}/issues`);
        return;
      }

      // Handle system info view
      if (item.id === "issue-sysinfo") {
        const systemInfo = await getSystemInfo();
        // Dispatch event to show system info dialog
        window.dispatchEvent(new CustomEvent("issue-reporter:show-system-info", {
          detail: { systemInfo }
        }));
        return;
      }

      // Collect system information
      let systemInfo: SystemInfo | undefined;
      if (includeSystemInfo) {
        try {
          systemInfo = await getSystemInfo();
        } catch (error) {
          console.warn("Failed to collect system information:", error);
          systemInfo = {
            appVersion: "unknown",
            os: navigator.platform,
            osVersion: "unknown",
            arch: "unknown",
          };
        }
      }

      // Use internal reporter if available, otherwise open GitHub
      if (openIssueReporter && systemInfo) {
        openIssueReporter(item.data.type, systemInfo);
      } else if (systemInfo) {
        const url = buildGitHubIssueUrl(item.data.type, systemInfo, repositoryUrl);
        openExternal(url);
      }
    },
  };
}

/**
 * Helper to collect system information from the environment
 */
export async function collectSystemInfo(): Promise<SystemInfo> {
  const info: SystemInfo = {
    appVersion: "1.0.0", // Should be injected from app
    os: getOperatingSystem(),
    osVersion: getOSVersion(),
    arch: getArchitecture(),
    locale: navigator.language,
  };

  // Try to get performance/memory info
  if (typeof performance !== "undefined" && "memory" in performance) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    info.memoryUsage = memory.usedJSHeapSize / (1024 * 1024);
    info.totalMemory = memory.jsHeapSizeLimit / (1024 * 1024);
  }

  // Try to get CPU info if available through navigator
  if ("hardwareConcurrency" in navigator) {
    info.cpuCores = navigator.hardwareConcurrency;
  }

  // Get versions if running in Electron
  if (typeof window !== "undefined" && "electronAPI" in window) {
    const electronAPI = (window as unknown as { electronAPI?: { versions?: { electron?: string; chrome?: string; node?: string } } }).electronAPI;
    if (electronAPI?.versions) {
      info.electronVersion = electronAPI.versions.electron;
      info.chromeVersion = electronAPI.versions.chrome;
      info.nodeVersion = electronAPI.versions.node;
    }
  }

  return info;
}

/**
 * Get operating system name
 */
function getOperatingSystem(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes("Win")) return "Windows";
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Linux")) return "Linux";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("iOS")) return "iOS";
  
  return navigator.platform || "Unknown";
}

/**
 * Get OS version (best effort)
 */
function getOSVersion(): string {
  const userAgent = navigator.userAgent;
  
  // Windows version
  const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
  if (winMatch) {
    const version = winMatch[1];
    const versionMap: Record<string, string> = {
      "10.0": "10/11",
      "6.3": "8.1",
      "6.2": "8",
      "6.1": "7",
    };
    return versionMap[version] || version;
  }
  
  // macOS version
  const macMatch = userAgent.match(/Mac OS X (\d+[._]\d+[._]?\d*)/);
  if (macMatch) {
    return macMatch[1].replace(/_/g, ".");
  }
  
  return "Unknown";
}

/**
 * Get architecture
 */
function getArchitecture(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes("x64") || userAgent.includes("x86_64") || userAgent.includes("Win64")) {
    return "x64";
  }
  if (userAgent.includes("arm64") || userAgent.includes("aarch64")) {
    return "arm64";
  }
  if (userAgent.includes("arm")) {
    return "arm";
  }
  if (userAgent.includes("x86") || userAgent.includes("i686")) {
    return "x86";
  }
  
  return "Unknown";
}

export default createIssueReporterProvider;
