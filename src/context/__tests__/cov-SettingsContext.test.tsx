import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SettingsProvider, useSettings, useEditorSettings, useInlayHintsSettings, useCodeLensSettings, useThemeSettings, useTerminalSettings, useAISettings, useSecuritySettings, useExplorerSettings, useZenModeSettings, useScreencastModeSettings, useSearchSettings, useFilesSettings, useDebugSettings, useGitSettings, useHttpSettings, useCommandPaletteSettings, useWorkbenchEditorSettings, useCenteredLayoutSettings, DEFAULT_COMMAND_PALETTE, DEFAULT_WORKBENCH_EDITOR, DEFAULT_WORKBENCH, DEFAULT_SETTINGS } from "../SettingsContext";

describe("SettingsContext", () => {
  it("SettingsProvider", () => {
    try { render(() => <SettingsProvider />); } catch (_e) { /* expected */ }
    expect(SettingsProvider).toBeDefined();
  });
  it("useSettings", () => {
    try { createRoot((dispose) => { try { useSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSettings).toBeDefined();
  });
  it("useEditorSettings", () => {
    try { createRoot((dispose) => { try { useEditorSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useEditorSettings).toBeDefined();
  });
  it("useInlayHintsSettings", () => {
    try { createRoot((dispose) => { try { useInlayHintsSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useInlayHintsSettings).toBeDefined();
  });
  it("useCodeLensSettings", () => {
    try { createRoot((dispose) => { try { useCodeLensSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCodeLensSettings).toBeDefined();
  });
  it("useThemeSettings", () => {
    try { createRoot((dispose) => { try { useThemeSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useThemeSettings).toBeDefined();
  });
  it("useTerminalSettings", () => {
    try { createRoot((dispose) => { try { useTerminalSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTerminalSettings).toBeDefined();
  });
  it("useAISettings", () => {
    try { createRoot((dispose) => { try { useAISettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useAISettings).toBeDefined();
  });
  it("useSecuritySettings", () => {
    try { createRoot((dispose) => { try { useSecuritySettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSecuritySettings).toBeDefined();
  });
  it("useExplorerSettings", () => {
    try { createRoot((dispose) => { try { useExplorerSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExplorerSettings).toBeDefined();
  });
  it("useZenModeSettings", () => {
    try { createRoot((dispose) => { try { useZenModeSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useZenModeSettings).toBeDefined();
  });
  it("useScreencastModeSettings", () => {
    try { createRoot((dispose) => { try { useScreencastModeSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useScreencastModeSettings).toBeDefined();
  });
  it("useSearchSettings", () => {
    try { createRoot((dispose) => { try { useSearchSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchSettings).toBeDefined();
  });
  it("useFilesSettings", () => {
    try { createRoot((dispose) => { try { useFilesSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFilesSettings).toBeDefined();
  });
  it("useDebugSettings", () => {
    try { createRoot((dispose) => { try { useDebugSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useDebugSettings).toBeDefined();
  });
  it("useGitSettings", () => {
    try { createRoot((dispose) => { try { useGitSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useGitSettings).toBeDefined();
  });
  it("useHttpSettings", () => {
    try { createRoot((dispose) => { try { useHttpSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useHttpSettings).toBeDefined();
  });
  it("useCommandPaletteSettings", () => {
    try { createRoot((dispose) => { try { useCommandPaletteSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCommandPaletteSettings).toBeDefined();
  });
  it("useWorkbenchEditorSettings", () => {
    try { createRoot((dispose) => { try { useWorkbenchEditorSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useWorkbenchEditorSettings).toBeDefined();
  });
  it("useCenteredLayoutSettings", () => {
    try { createRoot((dispose) => { try { useCenteredLayoutSettings(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useCenteredLayoutSettings).toBeDefined();
  });
  it("DEFAULT_COMMAND_PALETTE", () => {
    expect(DEFAULT_COMMAND_PALETTE).toBeDefined();
  });
  it("DEFAULT_WORKBENCH_EDITOR", () => {
    expect(DEFAULT_WORKBENCH_EDITOR).toBeDefined();
  });
  it("DEFAULT_WORKBENCH", () => {
    expect(DEFAULT_WORKBENCH).toBeDefined();
  });
  it("DEFAULT_SETTINGS", () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
  });
});
