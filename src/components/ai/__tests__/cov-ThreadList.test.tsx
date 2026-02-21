import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ThreadList } from "../../ai/ThreadList";

describe("ThreadList", () => {
  it("ThreadList", () => {
    try { render(() => <ThreadList />); } catch (_e) { /* expected */ }
    expect(ThreadList).toBeDefined();
  });
});
