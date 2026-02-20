import { platform, version as osVersion, arch, type } from "@tauri-apps/plugin-os";
import { getVersion } from "./tauri";

export interface SystemInfo {
  os: string;
  osVersion: string;
  arch: string;
  appVersion: string;
  platform: string;
  timestamp: string;
  userAgent: string;
}

/**
 * Collect system information for feedback/bug reports
 */
export async function collectSystemInfo(): Promise<SystemInfo> {
  let osName = "Unknown";
  let osVersionStr = "Unknown";
  let archStr = "Unknown";
  let platformStr = "Unknown";
  let appVersion = "Unknown";

  try {
    osName = type();
    osVersionStr = osVersion();
    archStr = arch();
    platformStr = platform();
  } catch (err) {
    console.warn("Failed to get OS info:", err);
  }

  try {
    appVersion = await getVersion();
  } catch (err) {
    console.warn("Failed to get app version:", err);
  }

  return {
    os: osName,
    osVersion: osVersionStr,
    arch: archStr,
    appVersion,
    platform: platformStr,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };
}

/**
 * Format system info as a readable string for bug reports
 */
export function formatSystemInfo(info: SystemInfo): string {
  return `
System Information:
- OS: ${info.os} ${info.osVersion}
- Architecture: ${info.arch}
- Platform: ${info.platform}
- App Version: ${info.appVersion}
- Timestamp: ${info.timestamp}
- User Agent: ${info.userAgent}
`.trim();
}

/**
 * Encode system info for URL parameters (e.g., GitHub issue templates)
 */
export function encodeSystemInfoForUrl(info: SystemInfo): string {
  const formatted = formatSystemInfo(info);
  return encodeURIComponent(formatted);
}
