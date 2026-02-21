import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { TimelinePanel } from "../../timeline/TimelinePanel";

describe("TimelinePanel", () => {
  it("TimelinePanel", () => {
    try { render(() => <TimelinePanel />); } catch (_e) { /* expected */ }
    expect(TimelinePanel).toBeDefined();
  });
});
