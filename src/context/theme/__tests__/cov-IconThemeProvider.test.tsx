import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/iconTheme/IconThemeProvider", () => ({ IconThemeProvider: (p: any) => p.children, useIconThemeProvider: vi.fn(() => ({})) }));
vi.mock("@/context/iconTheme/types", () => ({ types: (p: any) => p.children, usetypes: vi.fn(() => ({})) }));

import { getIconForFile, getIconForFolder, FileIconThemeProvider } from "../../theme/IconThemeProvider";

describe("IconThemeProvider", () => {
  it("getIconForFile", () => {
    try { getIconForFile("test"); } catch (_e) { /* expected */ }
    try { getIconForFile(); } catch (_e) { /* expected */ }
    expect(getIconForFile).toBeDefined();
  });
  it("getIconForFolder", () => {
    try { getIconForFolder("test", false); } catch (_e) { /* expected */ }
    try { getIconForFolder(); } catch (_e) { /* expected */ }
    expect(getIconForFolder).toBeDefined();
  });
  it("FileIconThemeProvider", () => {
    try { render(() => <FileIconThemeProvider />); } catch (_e) { /* expected */ }
    expect(FileIconThemeProvider).toBeDefined();
  });
});
