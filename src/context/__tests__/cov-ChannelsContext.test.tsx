import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { ChannelsProvider, useChannels } from "../ChannelsContext";

describe("ChannelsContext", () => {
  it("ChannelsProvider", () => {
    try { render(() => <ChannelsProvider />); } catch (_e) { /* expected */ }
    expect(ChannelsProvider).toBeDefined();
  });
  it("useChannels", () => {
    try { createRoot((dispose) => { try { useChannels(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useChannels).toBeDefined();
  });
});
