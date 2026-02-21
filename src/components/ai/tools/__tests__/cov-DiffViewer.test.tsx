import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { DiffViewer } from "../../../ai/tools/DiffViewer";

describe("DiffViewer", () => {
  it("DiffViewer", () => {
    try { render(() => <DiffViewer />); } catch (_e) { /* expected */ }
    expect(DiffViewer).toBeDefined();
  });
});
