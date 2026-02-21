import { describe, it, expect, vi } from "vitest";

import { useLspFeature } from "../useLspFeature";

describe("useLspFeature", () => {
  it("useLspFeature", () => { expect(typeof useLspFeature).toBe("function"); });
});