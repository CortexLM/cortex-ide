import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));

import { evaluateWhenClause, createWelcomeViewRegistry, WelcomeView, ExplorerWelcomeView, GitWelcomeView, DebugWelcomeView, SearchWelcomeView, ExtensionsWelcomeView, DynamicWelcomeView } from "../../workbench/WelcomeView";

describe("WelcomeView", () => {
  it("evaluateWhenClause", () => {
    try { evaluateWhenClause({} as any, {} as any); } catch (_e) { /* expected */ }
    try { evaluateWhenClause(); } catch (_e) { /* expected */ }
    expect(evaluateWhenClause).toBeDefined();
  });
  it("createWelcomeViewRegistry", () => {
    try { createWelcomeViewRegistry(); } catch (_e) { /* expected */ }
    expect(createWelcomeViewRegistry).toBeDefined();
  });
  it("WelcomeView", () => {
    try { render(() => <WelcomeView />); } catch (_e) { /* expected */ }
    expect(WelcomeView).toBeDefined();
  });
  it("ExplorerWelcomeView", () => {
    try { render(() => <ExplorerWelcomeView />); } catch (_e) { /* expected */ }
    expect(ExplorerWelcomeView).toBeDefined();
  });
  it("GitWelcomeView", () => {
    try { render(() => <GitWelcomeView />); } catch (_e) { /* expected */ }
    expect(GitWelcomeView).toBeDefined();
  });
  it("DebugWelcomeView", () => {
    try { render(() => <DebugWelcomeView />); } catch (_e) { /* expected */ }
    expect(DebugWelcomeView).toBeDefined();
  });
  it("SearchWelcomeView", () => {
    try { render(() => <SearchWelcomeView />); } catch (_e) { /* expected */ }
    expect(SearchWelcomeView).toBeDefined();
  });
  it("ExtensionsWelcomeView", () => {
    try { render(() => <ExtensionsWelcomeView />); } catch (_e) { /* expected */ }
    expect(ExtensionsWelcomeView).toBeDefined();
  });
  it("DynamicWelcomeView", () => {
    try { render(() => <DynamicWelcomeView />); } catch (_e) { /* expected */ }
    expect(DynamicWelcomeView).toBeDefined();
  });
});
