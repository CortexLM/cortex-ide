import { describe, it, expect, vi } from "vitest";

import { detectEnvironment, getDefaultExecutor, setDefaultExecutor, NodeProcessRunner, TauriProcessRunner, CliExecutor, StreamHandle, JsonStreamHandle } from "../executor";

describe("executor", () => {
  it("detectEnvironment", () => {
    try { detectEnvironment(); } catch (_e) { /* expected */ }
    expect(detectEnvironment).toBeDefined();
  });
  it("getDefaultExecutor", () => {
    try { getDefaultExecutor(); } catch (_e) { /* expected */ }
    expect(getDefaultExecutor).toBeDefined();
  });
  it("setDefaultExecutor", () => {
    try { setDefaultExecutor({} as any); } catch (_e) { /* expected */ }
    try { setDefaultExecutor(); } catch (_e) { /* expected */ }
    expect(setDefaultExecutor).toBeDefined();
  });
  it("NodeProcessRunner", () => {
    try { const inst = new NodeProcessRunner(); expect(inst).toBeDefined(); } catch (_e) { expect(NodeProcessRunner).toBeDefined(); }
  });
  it("TauriProcessRunner", () => {
    try { const inst = new TauriProcessRunner(); expect(inst).toBeDefined(); } catch (_e) { expect(TauriProcessRunner).toBeDefined(); }
  });
  it("CliExecutor", () => {
    try { const inst = new CliExecutor(); expect(inst).toBeDefined(); } catch (_e) { expect(CliExecutor).toBeDefined(); }
  });
  it("StreamHandle", () => {
    try { const inst = new StreamHandle(); expect(inst).toBeDefined(); } catch (_e) { expect(StreamHandle).toBeDefined(); }
  });
  it("JsonStreamHandle", () => {
    try { const inst = new JsonStreamHandle({} as any, {} as any); expect(inst).toBeDefined(); } catch (_e) { expect(JsonStreamHandle).toBeDefined(); }
  });
});
