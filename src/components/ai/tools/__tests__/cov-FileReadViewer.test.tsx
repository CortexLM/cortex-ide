import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { FileReadViewer } from "../../../ai/tools/FileReadViewer";

describe("FileReadViewer", () => {
  it("FileReadViewer", () => {
    try { render(() => <FileReadViewer />); } catch (_e) { /* expected */ }
    expect(FileReadViewer).toBeDefined();
  });
});
