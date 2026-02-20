import { invoke } from "@tauri-apps/api/core";

export interface ServerInfo {
  port: number;
  url: string;
  running: boolean;
}

export async function startServer(): Promise<ServerInfo> {
  return invoke<ServerInfo>("start_server");
}

export async function stopServer(): Promise<void> {
  return invoke("stop_server");
}

export async function getServerInfo(): Promise<ServerInfo> {
  return invoke<ServerInfo>("get_server_info");
}

export async function getLogs(): Promise<string> {
  return invoke<string>("get_logs");
}

export async function copyLogsToClipboard(): Promise<void> {
  return invoke("copy_logs_to_clipboard");
}

export async function getVersion(): Promise<string> {
  return invoke<string>("get_version");
}

export async function openInBrowser(url: string): Promise<void> {
  return invoke("open_in_browser", { url });
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}
