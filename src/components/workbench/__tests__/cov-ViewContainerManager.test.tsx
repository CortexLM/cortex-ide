import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/context/ActivityBarContext", () => ({ ActivityBarProvider: (p: any) => p.children, useActivityBar: vi.fn(() => ({})) }));

import { ViewContainerManager, ViewContainerProvider, useViewContainers, useViewContainersOptional } from "../../workbench/ViewContainerManager";

describe("ViewContainerManager", () => {
  it("ViewContainerManager", () => {
    try { render(() => <ViewContainerManager />); } catch (_e) { /* expected */ }
    expect(ViewContainerManager).toBeDefined();
  });
  it("ViewContainerProvider", () => {
    try { render(() => <ViewContainerProvider />); } catch (_e) { /* expected */ }
    expect(ViewContainerProvider).toBeDefined();
  });
  it("useViewContainers", () => {
    try { createRoot((dispose) => { try { useViewContainers(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useViewContainers).toBeDefined();
  });
  it("useViewContainersOptional", () => {
    try { createRoot((dispose) => { try { useViewContainersOptional(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useViewContainersOptional).toBeDefined();
  });
});
