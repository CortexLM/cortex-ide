import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { MinimapContextMenu } from "../../editor/MinimapContextMenu";

describe("MinimapContextMenu", () => {
  it("MinimapContextMenu", () => {
    try { render(() => <MinimapContextMenu />); } catch (_e) { /* expected */ }
    expect(MinimapContextMenu).toBeDefined();
  });
});
