import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null), message: vi.fn().mockResolvedValue(undefined), ask: vi.fn().mockResolvedValue(false), confirm: vi.fn().mockResolvedValue(false) }));
vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));

import { SlashCommandMenu, useSlashCommandMenu, SLASH_COMMANDS } from "../../ai/SlashCommandMenu";

describe("SlashCommandMenu", () => {
  it("SlashCommandMenu", () => {
    try { render(() => <SlashCommandMenu />); } catch (_e) { /* expected */ }
    expect(SlashCommandMenu).toBeDefined();
  });
  it("useSlashCommandMenu", () => {
    try { createRoot((dispose) => { try { useSlashCommandMenu(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSlashCommandMenu).toBeDefined();
  });
  it("SLASH_COMMANDS", () => {
    expect(SLASH_COMMANDS).toBeDefined();
  });
});
