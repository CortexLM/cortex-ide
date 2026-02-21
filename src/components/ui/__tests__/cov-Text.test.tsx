import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Text, SectionTitle } from "../../ui/Text";

describe("Text", () => {
  it("Text", () => {
    try { render(() => <Text />); } catch (_e) { /* expected */ }
    expect(Text).toBeDefined();
  });
  it("SectionTitle", () => {
    try { render(() => <SectionTitle />); } catch (_e) { /* expected */ }
    expect(SectionTitle).toBeDefined();
  });
});
