import { invoke } from "@tauri-apps/api/core";

export interface TrustedFolderInfo {
  path: string;
  trustedAt: number;
  description?: string;
  trustParent: boolean;
}

export interface WorkspaceTrustInfo {
  isTrusted: boolean;
  trustLevel: "trusted" | "restricted" | "unknown";
  workspacePath: string | null;
  trustedFolders: TrustedFolderInfo[];
}

export interface TrustDecisionRequest {
  workspacePath: string;
  trustLevel: "trusted" | "restricted";
  remember: boolean;
  trustParent?: boolean;
  description?: string;
}

export interface WorkspaceTrustSettings {
  enabled: boolean;
  trustAllWorkspaces: boolean;
  showBanner: boolean;
  restrictedModeEnabled: boolean;
  promptForParentFolderTrust: boolean;
}

export async function getWorkspaceTrustInfo(workspacePath?: string): Promise<WorkspaceTrustInfo> {
  try {
    const result = await invoke<WorkspaceTrustInfo>("workspace_trust_get_info", {
      workspace_path: workspacePath,
    });
    return result;
  } catch (error) {
    console.error("[workspace-trust] Failed to get trust info:", error);
    return {
      isTrusted: false,
      trustLevel: "unknown",
      workspacePath: workspacePath ?? null,
      trustedFolders: [],
    };
  }
}

export async function setWorkspaceTrust(request: TrustDecisionRequest): Promise<boolean> {
  try {
    await invoke("workspace_trust_set_decision", {
      workspace_path: request.workspacePath,
      trust_level: request.trustLevel,
      remember: request.remember,
      trust_parent: request.trustParent ?? false,
      description: request.description,
    });
    return true;
  } catch (error) {
    console.error("[workspace-trust] Failed to set trust decision:", error);
    return false;
  }
}

export async function addTrustedFolder(
  path: string,
  options?: { trustParent?: boolean; description?: string }
): Promise<boolean> {
  try {
    await invoke("workspace_trust_add_folder", {
      path,
      trust_parent: options?.trustParent ?? false,
      description: options?.description,
    });
    return true;
  } catch (error) {
    console.error("[workspace-trust] Failed to add trusted folder:", error);
    return false;
  }
}

export async function removeTrustedFolder(path: string): Promise<boolean> {
  try {
    await invoke("workspace_trust_remove_folder", { path });
    return true;
  } catch (error) {
    console.error("[workspace-trust] Failed to remove trusted folder:", error);
    return false;
  }
}

export async function getTrustedFolders(): Promise<TrustedFolderInfo[]> {
  try {
    const result = await invoke<TrustedFolderInfo[]>("workspace_trust_get_folders");
    return result;
  } catch (error) {
    console.error("[workspace-trust] Failed to get trusted folders:", error);
    return [];
  }
}

export async function clearAllTrustDecisions(): Promise<boolean> {
  try {
    await invoke("workspace_trust_clear_all");
    return true;
  } catch (error) {
    console.error("[workspace-trust] Failed to clear trust decisions:", error);
    return false;
  }
}

export async function getWorkspaceTrustSettings(): Promise<WorkspaceTrustSettings> {
  try {
    const result = await invoke<WorkspaceTrustSettings>("workspace_trust_get_settings");
    return result;
  } catch (error) {
    console.error("[workspace-trust] Failed to get settings:", error);
    return {
      enabled: true,
      trustAllWorkspaces: false,
      showBanner: true,
      restrictedModeEnabled: true,
      promptForParentFolderTrust: true,
    };
  }
}

export async function updateWorkspaceTrustSettings(
  settings: Partial<WorkspaceTrustSettings>
): Promise<boolean> {
  try {
    await invoke("workspace_trust_update_settings", { settings });
    return true;
  } catch (error) {
    console.error("[workspace-trust] Failed to update settings:", error);
    return false;
  }
}

export async function isPathTrusted(path: string): Promise<boolean> {
  try {
    const result = await invoke<boolean>("workspace_trust_is_path_trusted", { path });
    return result;
  } catch (error) {
    console.error("[workspace-trust] Failed to check path trust:", error);
    return false;
  }
}

export async function promptForTrust(workspacePath: string): Promise<"trusted" | "restricted" | "cancelled"> {
  try {
    const result = await invoke<"trusted" | "restricted" | "cancelled">(
      "workspace_trust_prompt",
      { workspace_path: workspacePath }
    );
    return result;
  } catch (error) {
    console.error("[workspace-trust] Failed to prompt for trust:", error);
    return "cancelled";
  }
}
