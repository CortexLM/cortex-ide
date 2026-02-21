import { describe, it, expect, vi } from "vitest";

import { SETI_FILE_NAMES, SETI_FOLDER_NAMES } from "../../iconTheme/themes-seti-data";

describe("themes-seti-data", () => {
  it("SETI_FILE_NAMES", () => {
    expect(SETI_FILE_NAMES).toBeDefined();
  });
  it("SETI_FOLDER_NAMES", () => {
    expect(SETI_FOLDER_NAMES).toBeDefined();
  });
});
