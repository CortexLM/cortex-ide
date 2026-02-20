import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { batchInvoke, flushBatchInvoke, _resetBatchState } from "../batchInvoke";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  _resetBatchState();
  mockInvoke.mockReset();
});

describe("batchInvoke", () => {
  it("sends a single call directly without batching", async () => {
    mockInvoke.mockResolvedValueOnce("1.0.0");

    const p = batchInvoke<string>("get_version");
    await flushBatchInvoke();
    const result = await p;

    expect(result).toBe("1.0.0");
    expect(mockInvoke).toHaveBeenCalledWith("get_version", {});
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("batches multiple calls in the same tick", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "batch_invoke") {
        return [
          { id: "1", status: "ok", data: "1.0.0" },
          { id: "2", status: "ok", data: { theme: "dark" } },
        ];
      }
      return undefined;
    });

    const p1 = batchInvoke<string>("get_version");
    const p2 = batchInvoke<{ theme: string }>("settings_load");

    await flushBatchInvoke();

    expect(await p1).toBe("1.0.0");
    expect(await p2).toEqual({ theme: "dark" });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("batch_invoke", {
      calls: [
        { id: "1", cmd: "get_version", args: {} },
        { id: "2", cmd: "settings_load", args: {} },
      ],
    });
  });

  it("passes args through to the batch call", async () => {
    mockInvoke.mockImplementation(async (cmd: string, payload?: unknown) => {
      if (cmd === "batch_invoke") {
        const { calls } = payload as { calls: Array<{ id: string }> };
        return calls.map((c) => ({ id: c.id, status: "ok", data: "value" }));
      }
      return undefined;
    });

    const p1 = batchInvoke("settings_get", { key: "theme" });
    const p2 = batchInvoke("get_version");
    await flushBatchInvoke();
    await p1;
    await p2;

    const payload = mockInvoke.mock.calls[0][1] as { calls: Array<{ args: unknown }> };
    expect(payload.calls[0].args).toEqual({ key: "theme" });
  });

  it("rejects individual promises on batch error status", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "batch_invoke") {
        return [
          { id: "1", status: "ok", data: "good" },
          { id: "2", status: "error", error: "not found" },
        ];
      }
      return undefined;
    });

    const p1 = batchInvoke<string>("get_version");
    const p2 = batchInvoke<string>("missing_cmd");
    await flushBatchInvoke();

    expect(await p1).toBe("good");
    await expect(p2).rejects.toThrow("not found");
  });

  it("rejects all promises when batch_invoke itself fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("IPC failure"));

    const p1 = batchInvoke("get_version");
    const p2 = batchInvoke("settings_load");
    await flushBatchInvoke();

    await expect(p1).rejects.toThrow("IPC failure");
    await expect(p2).rejects.toThrow("IPC failure");
  });

  it("rejects when result is missing for a call id", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "batch_invoke") {
        return [{ id: "1", status: "ok", data: "ok" }];
      }
      return undefined;
    });

    const p1 = batchInvoke("get_version");
    const p2 = batchInvoke("settings_load");
    await flushBatchInvoke();

    expect(await p1).toBe("ok");
    await expect(p2).rejects.toThrow("No result for call");
  });

  it("handles separate ticks as separate batches", async () => {
    mockInvoke.mockResolvedValue("v1");

    const p1 = batchInvoke("get_version");
    await flushBatchInvoke();
    await p1;

    _resetBatchState();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValueOnce("v2");

    const p2 = batchInvoke("get_version");
    await flushBatchInvoke();
    expect(await p2).toBe("v2");

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("flushBatchInvoke is a no-op when queue is empty", async () => {
    await flushBatchInvoke();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
