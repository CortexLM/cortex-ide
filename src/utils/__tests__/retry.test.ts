import { describe, it, expect, vi } from "vitest";
import { withRetry, tryOperation, withRetryResult, delay, withRetryAll, withRetryAllSettled } from "../retry";
import { GitErrorCode } from "../git/errors";

describe("retry", () => {
  describe("withRetry", () => {
    it("returns result on success", async () => {
      const op = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(op);
      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable error", async () => {
      const error = Object.assign(new Error("locked"), {
        gitErrorCode: GitErrorCode.RepositoryIsLocked,
      });
      const op = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("ok");
      const result = await withRetry(op, { maxAttempts: 3, baseDelayMs: 1 });
      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("throws on non-retryable error", async () => {
      const error = Object.assign(new Error("auth failed"), {
        gitErrorCode: GitErrorCode.AuthenticationFailed,
      });
      const op = vi.fn().mockRejectedValue(error);
      await expect(withRetry(op, { maxAttempts: 3 })).rejects.toThrow("auth failed");
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("throws after max attempts", async () => {
      const error = Object.assign(new Error("locked"), {
        gitErrorCode: GitErrorCode.RepositoryIsLocked,
      });
      const op = vi.fn().mockRejectedValue(error);
      await expect(withRetry(op, { maxAttempts: 2, baseDelayMs: 1 })).rejects.toThrow("locked");
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("calls onRetry callback", async () => {
      const error = Object.assign(new Error("locked"), {
        gitErrorCode: GitErrorCode.RepositoryIsLocked,
      });
      const onRetry = vi.fn();
      const op = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce("ok");
      await withRetry(op, { maxAttempts: 3, baseDelayMs: 1, onRetry });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("tryOperation", () => {
    it("returns success result", async () => {
      const result = await tryOperation(() => Promise.resolve("ok"));
      expect(result).toEqual({ success: true, value: "ok" });
    });
    it("returns failure result", async () => {
      const result = await tryOperation(() => Promise.reject(new Error("fail")));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("fail");
      }
    });
  });

  describe("withRetryResult", () => {
    it("returns success on success", async () => {
      const result = await withRetryResult(() => Promise.resolve("ok"));
      expect(result).toEqual({ success: true, value: "ok" });
    });
    it("returns failure after retries exhausted", async () => {
      const error = Object.assign(new Error("locked"), {
        gitErrorCode: GitErrorCode.RepositoryIsLocked,
      });
      const result = await withRetryResult(() => Promise.reject(error), { maxAttempts: 1 });
      expect(result.success).toBe(false);
    });
  });

  describe("delay", () => {
    it("resolves after timeout", async () => {
      vi.useFakeTimers();
      const p = delay(100);
      vi.advanceTimersByTime(100);
      await p;
      vi.useRealTimers();
    });
  });

  describe("withRetryAll", () => {
    it("retries all operations", async () => {
      const ops = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
      ];
      const results = await withRetryAll(ops);
      expect(results).toEqual([1, 2]);
    });
  });

  describe("withRetryAllSettled", () => {
    it("settles all operations", async () => {
      const ops = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error("fail")),
      ];
      const results = await withRetryAllSettled(ops);
      expect(results[0]).toEqual({ success: true, value: 1 });
      expect(results[1].success).toBe(false);
    });
  });
});
