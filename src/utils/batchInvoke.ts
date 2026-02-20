/**
 * Generic Batched IPC Invocation
 *
 * Drop-in replacement for `invoke()` that automatically batches multiple
 * calls made within the same microtask into a single `batch_invoke` IPC
 * round-trip. Each individual caller receives its own typed promise.
 *
 * Usage:
 *   const settings = await batchInvoke<Settings>("settings_load");
 *   const version = await batchInvoke<string>("get_version");
 *
 * Both calls above, if made synchronously, are sent as one IPC call.
 */

import { invoke } from "@tauri-apps/api/core";

interface BatchedCall {
  id: string;
  cmd: string;
  args: Record<string, unknown>;
}

interface BatchedResult {
  id: string;
  status: "ok" | "error";
  data?: unknown;
  error?: string;
}

interface PendingCall {
  call: BatchedCall;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

let queue: PendingCall[] = [];
let scheduled = false;
let idCounter = 0;

function nextId(): string {
  return String(++idCounter);
}

async function flush(): Promise<void> {
  const batch = queue;
  queue = [];
  scheduled = false;

  if (batch.length === 0) return;

  if (batch.length === 1) {
    const { call, resolve, reject } = batch[0];
    try {
      const result = await invoke(call.cmd, call.args);
      resolve(result);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
    return;
  }

  try {
    const calls = batch.map((p) => p.call);
    const results = await invoke<BatchedResult[]>("batch_invoke", { calls });

    const resultMap = new Map<string, BatchedResult>();
    for (const r of results) {
      resultMap.set(r.id, r);
    }

    for (const pending of batch) {
      const result = resultMap.get(pending.call.id);
      if (!result) {
        pending.reject(new Error(`No result for call ${pending.call.id}`));
      } else if (result.status === "ok") {
        pending.resolve(result.data);
      } else {
        pending.reject(new Error(result.error ?? "Unknown batch error"));
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    for (const pending of batch) {
      pending.reject(error);
    }
  }
}

/**
 * Invoke a Tauri command, automatically batching with other calls in the
 * same microtask. API-compatible with `invoke()`.
 */
export function batchInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({
      call: { id: nextId(), cmd, args: args ?? {} },
      resolve: resolve as (value: unknown) => void,
      reject,
    });

    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  });
}

/**
 * Immediately dispatch all queued calls without waiting for the microtask.
 * Useful for tests or when you need deterministic timing.
 */
export function flushBatchInvoke(): Promise<void> {
  return flush();
}

/**
 * Reset internal state. Intended for tests only.
 */
export function _resetBatchState(): void {
  queue = [];
  scheduled = false;
  idCounter = 0;
}
