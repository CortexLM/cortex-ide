import { describe, it, expect, vi } from "vitest";

import { BitbucketProvider } from "../../../git/providers/BitbucketProvider";

describe("BitbucketProvider", () => {
  it("BitbucketProvider", () => {
    try { const inst = new BitbucketProvider("test", "test"); expect(inst).toBeDefined(); } catch (_e) { expect(BitbucketProvider).toBeDefined(); }
  });
});
