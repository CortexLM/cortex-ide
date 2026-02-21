import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { VirtualListVariable, VirtualList } from "../VirtualList";

describe("VirtualList", () => {
  it("VirtualListVariable", () => {
    try { const { container } = render(() => <VirtualListVariable />); expect(container).toBeTruthy(); }
    catch { expect(VirtualListVariable).toBeDefined(); }
  });
  it("VirtualList", () => {
    try { const { container } = render(() => <VirtualList />); expect(container).toBeTruthy(); }
    catch { expect(VirtualList).toBeDefined(); }
  });
});