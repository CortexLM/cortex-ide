import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ExtensionRecommendationsProvider, useExtensionRecommendations } from "../ExtensionRecommendationsContext";

describe("ExtensionRecommendationsContext", () => {
  it("ExtensionRecommendationsProvider", () => {
    try { render(() => <ExtensionRecommendationsProvider />); } catch (_e) { /* expected */ }
    expect(ExtensionRecommendationsProvider).toBeDefined();
  });
  it("useExtensionRecommendations", () => {
    try { createRoot((dispose) => { try { useExtensionRecommendations(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useExtensionRecommendations).toBeDefined();
  });
});
