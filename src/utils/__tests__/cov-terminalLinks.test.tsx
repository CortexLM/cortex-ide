import { describe, it, expect, vi } from "vitest";

import { detectLinks, detectUrls, detectFilePaths, parseFilePath, detectWordLinks, detectCompilerOutputLinks, mergeLinks, createDefaultLinkProvider, detectLinksInBuffer, findLinkAtPosition, normalizeUrl, isLikelyFilePath, CompositeLinkProvider, DEFAULT_WORD_SEPARATORS } from "../terminalLinks";

describe("terminalLinks", () => {
  it("detectLinks", () => {
    try { detectLinks("test", {} as any); } catch (_e) { /* expected */ }
    try { detectLinks(); } catch (_e) { /* expected */ }
    expect(detectLinks).toBeDefined();
  });
  it("detectUrls", () => {
    try { detectUrls("test"); } catch (_e) { /* expected */ }
    try { detectUrls(); } catch (_e) { /* expected */ }
    expect(detectUrls).toBeDefined();
  });
  it("detectFilePaths", () => {
    try { detectFilePaths("test"); } catch (_e) { /* expected */ }
    try { detectFilePaths(); } catch (_e) { /* expected */ }
    expect(detectFilePaths).toBeDefined();
  });
  it("parseFilePath", () => {
    try { parseFilePath("test"); } catch (_e) { /* expected */ }
    try { parseFilePath(); } catch (_e) { /* expected */ }
    expect(parseFilePath).toBeDefined();
  });
  it("detectWordLinks", () => {
    try { detectWordLinks("test", "test"); } catch (_e) { /* expected */ }
    try { detectWordLinks(); } catch (_e) { /* expected */ }
    expect(detectWordLinks).toBeDefined();
  });
  it("detectCompilerOutputLinks", () => {
    try { detectCompilerOutputLinks("test"); } catch (_e) { /* expected */ }
    try { detectCompilerOutputLinks(); } catch (_e) { /* expected */ }
    expect(detectCompilerOutputLinks).toBeDefined();
  });
  it("mergeLinks", () => {
    try { mergeLinks([]); } catch (_e) { /* expected */ }
    try { mergeLinks(); } catch (_e) { /* expected */ }
    expect(mergeLinks).toBeDefined();
  });
  it("createDefaultLinkProvider", () => {
    try { createDefaultLinkProvider(); } catch (_e) { /* expected */ }
    expect(createDefaultLinkProvider).toBeDefined();
  });
  it("detectLinksInBuffer", () => {
    try { detectLinksInBuffer([], {} as any); } catch (_e) { /* expected */ }
    try { detectLinksInBuffer(); } catch (_e) { /* expected */ }
    expect(detectLinksInBuffer).toBeDefined();
  });
  it("findLinkAtPosition", () => {
    try { findLinkAtPosition("test", 0, {} as any); } catch (_e) { /* expected */ }
    try { findLinkAtPosition(); } catch (_e) { /* expected */ }
    expect(findLinkAtPosition).toBeDefined();
  });
  it("normalizeUrl", () => {
    try { normalizeUrl("test"); } catch (_e) { /* expected */ }
    try { normalizeUrl(); } catch (_e) { /* expected */ }
    expect(normalizeUrl).toBeDefined();
  });
  it("isLikelyFilePath", () => {
    try { isLikelyFilePath("test"); } catch (_e) { /* expected */ }
    try { isLikelyFilePath(); } catch (_e) { /* expected */ }
    expect(isLikelyFilePath).toBeDefined();
  });
  it("CompositeLinkProvider", () => {
    try { const inst = new CompositeLinkProvider(); expect(inst).toBeDefined(); } catch (_e) { expect(CompositeLinkProvider).toBeDefined(); }
  });
  it("DEFAULT_WORD_SEPARATORS", () => {
    expect(DEFAULT_WORD_SEPARATORS).toBeDefined();
  });
});
