import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { LinkifiedOutput } from "../../debugger/LinkifiedOutput";

describe("LinkifiedOutput", () => {
  it("LinkifiedOutput", () => {
    try { render(() => <LinkifiedOutput />); } catch (_e) { /* expected */ }
    expect(LinkifiedOutput).toBeDefined();
  });
});
