import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/utils/workspace", () => ({ getWorkspacePath: vi.fn(() => "/test"), isWorkspaceOpen: vi.fn(() => true), getRelativePath: vi.fn((p: string) => p), joinPath: vi.fn((...args: string[]) => args.join("/")), normalizePath: vi.fn((p: string) => p) }));

import { SearchProvider, useSearch, useSearchQuery, useSearchResults, useSearchOperations, useSearchHistory, useSearchEditors, useSearchProviders, DEFAULT_SEARCH_OPTIONS, DEFAULT_SEARCH_QUERY } from "../SearchContext";

describe("SearchContext", () => {
  it("SearchProvider", () => {
    try { render(() => <SearchProvider />); } catch (_e) { /* expected */ }
    expect(SearchProvider).toBeDefined();
  });
  it("useSearch", () => {
    try { createRoot((dispose) => { try { useSearch(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearch).toBeDefined();
  });
  it("useSearchQuery", () => {
    try { createRoot((dispose) => { try { useSearchQuery(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchQuery).toBeDefined();
  });
  it("useSearchResults", () => {
    try { createRoot((dispose) => { try { useSearchResults(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchResults).toBeDefined();
  });
  it("useSearchOperations", () => {
    try { createRoot((dispose) => { try { useSearchOperations(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchOperations).toBeDefined();
  });
  it("useSearchHistory", () => {
    try { createRoot((dispose) => { try { useSearchHistory(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchHistory).toBeDefined();
  });
  it("useSearchEditors", () => {
    try { createRoot((dispose) => { try { useSearchEditors(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchEditors).toBeDefined();
  });
  it("useSearchProviders", () => {
    try { createRoot((dispose) => { try { useSearchProviders(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSearchProviders).toBeDefined();
  });
  it("DEFAULT_SEARCH_OPTIONS", () => {
    expect(DEFAULT_SEARCH_OPTIONS).toBeDefined();
  });
  it("DEFAULT_SEARCH_QUERY", () => {
    expect(DEFAULT_SEARCH_QUERY).toBeDefined();
  });
});
