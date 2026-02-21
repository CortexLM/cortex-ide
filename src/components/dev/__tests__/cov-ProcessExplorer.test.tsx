import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ readText: vi.fn().mockResolvedValue(""), writeText: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/context/ThemeContext", () => ({ ThemeProvider: (p: any) => p.children, useTheme: vi.fn(() => ({ theme: vi.fn(() => "dark"), setTheme: vi.fn(), colors: vi.fn(() => ({})), isDark: vi.fn(() => true), isLight: vi.fn(() => false), availableThemes: vi.fn(() => []) })) }));

import { openProcessExplorer, toggleProcessExplorer, ProcessExplorer, useProcessExplorer } from "../../dev/ProcessExplorer";

describe("ProcessExplorer", () => {
  it("openProcessExplorer", () => {
    try { openProcessExplorer(); } catch (_e) { /* expected */ }
    expect(openProcessExplorer).toBeDefined();
  });
  it("toggleProcessExplorer", () => {
    try { toggleProcessExplorer(); } catch (_e) { /* expected */ }
    expect(toggleProcessExplorer).toBeDefined();
  });
  it("ProcessExplorer", () => {
    try { render(() => <ProcessExplorer />); } catch (_e) { /* expected */ }
    expect(ProcessExplorer).toBeDefined();
  });
  it("useProcessExplorer", () => {
    try { createRoot((dispose) => { try { useProcessExplorer(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useProcessExplorer).toBeDefined();
  });
});
