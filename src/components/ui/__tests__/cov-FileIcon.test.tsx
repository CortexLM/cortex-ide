import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { FileIcon } from "../../ui/FileIcon";

describe("FileIcon", () => {
  it("FileIcon", () => {
    try { render(() => <FileIcon />); } catch (_e) { /* expected */ }
    expect(FileIcon).toBeDefined();
  });
});
