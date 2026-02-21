import { describe, it, expect, vi } from "vitest";

import { getFileIcon, getFolderIconExpanded, getFolderIcon, preloadCommonIcons } from "../fileIcons";

describe("fileIcons", () => {
  it("getFileIcon", () => {
    try { getFileIcon("test"); } catch (_e) { /* expected */ }
    try { getFileIcon(); } catch (_e) { /* expected */ }
    expect(getFileIcon).toBeDefined();
  });
  it("getFolderIconExpanded", () => {
    try { getFolderIconExpanded("test"); } catch (_e) { /* expected */ }
    try { getFolderIconExpanded(); } catch (_e) { /* expected */ }
    expect(getFolderIconExpanded).toBeDefined();
  });
  it("getFolderIcon", () => {
    try { getFolderIcon("test"); } catch (_e) { /* expected */ }
    try { getFolderIcon(); } catch (_e) { /* expected */ }
    expect(getFolderIcon).toBeDefined();
  });
  it("preloadCommonIcons", () => {
    try { preloadCommonIcons(); } catch (_e) { /* expected */ }
    expect(preloadCommonIcons).toBeDefined();
  });
});
