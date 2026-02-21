import { describe, it, expect, vi } from "vitest";

import { memoize, memoizeWithKey, withTimeout, debounce, throttle, once, sequentialize, debounceAsync } from "../decorators";

describe("decorators", () => {
  it("memoize", () => { expect(typeof memoize).toBe("function"); });
  it("memoizeWithKey", () => { expect(typeof memoizeWithKey).toBe("function"); });
  it("withTimeout", () => { expect(typeof withTimeout).toBe("function"); });
  it("debounce", () => { expect(typeof debounce).toBe("function"); });
  it("throttle", () => { expect(typeof throttle).toBe("function"); });
  it("once", () => { expect(typeof once).toBe("function"); });
  it("sequentialize", () => { expect(typeof sequentialize).toBe("function"); });
  it("debounceAsync", () => { expect(typeof debounceAsync).toBe("function"); });
});