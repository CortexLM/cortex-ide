import { describe, it, expect, vi } from "vitest";

import { useTauriListeners, useTauriListen, useTauriListenWhen } from "../useTauriListen";

describe("useTauriListen", () => {
  it("useTauriListeners", () => { expect(typeof useTauriListeners).toBe("function"); });
  it("useTauriListen", () => { expect(typeof useTauriListen).toBe("function"); });
  it("useTauriListenWhen", () => { expect(typeof useTauriListenWhen).toBe("function"); });
});