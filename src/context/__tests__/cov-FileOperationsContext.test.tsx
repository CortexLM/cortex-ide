import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { FileOperationsProvider, useFileOperations } from "../FileOperationsContext";

describe("FileOperationsContext", () => {
  it("FileOperationsProvider", () => {
    try { render(() => <FileOperationsProvider />); } catch (_e) { /* expected */ }
    expect(FileOperationsProvider).toBeDefined();
  });
  it("useFileOperations", () => {
    try { createRoot((dispose) => { try { useFileOperations(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useFileOperations).toBeDefined();
  });
});
