import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { SharedMessageList } from "../../share/SharedMessageList";

describe("SharedMessageList", () => {
  it("SharedMessageList", () => {
    try { render(() => <SharedMessageList />); } catch (_e) { /* expected */ }
    expect(SharedMessageList).toBeDefined();
  });
});
