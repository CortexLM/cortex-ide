import { describe, it, expect, vi } from "vitest";

import { useRAFThrottle, useLeadingThrottle, useThrottle, useTrailingThrottle, useThrottleState, useThrottledCallback } from "../useThrottle";

describe("useThrottle", () => {
  it("useRAFThrottle", () => { expect(typeof useRAFThrottle).toBe("function"); });
  it("useLeadingThrottle", () => { expect(typeof useLeadingThrottle).toBe("function"); });
  it("useThrottle", () => { expect(typeof useThrottle).toBe("function"); });
  it("useTrailingThrottle", () => { expect(typeof useTrailingThrottle).toBe("function"); });
  it("useThrottleState", () => { expect(typeof useThrottleState).toBe("function"); });
  it("useThrottledCallback", () => { expect(typeof useThrottledCallback).toBe("function"); });
});