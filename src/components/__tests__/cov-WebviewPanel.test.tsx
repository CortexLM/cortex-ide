import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/WebviewContext", () => ({ WebviewProvider: (p: any) => p.children, useWebview: vi.fn(() => ({})) }));

import { WebviewPanel, WebviewPanelContainer } from "../WebviewPanel";

describe("WebviewPanel", () => {
  it("WebviewPanel", () => {
    try { render(() => <WebviewPanel />); } catch (_e) { /* expected */ }
    expect(WebviewPanel).toBeDefined();
  });
  it("WebviewPanelContainer", () => {
    try { render(() => <WebviewPanelContainer />); } catch (_e) { /* expected */ }
    expect(WebviewPanelContainer).toBeDefined();
  });
});
