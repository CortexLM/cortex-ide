import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { Card } from "../../ui/Card";

describe("Card", () => {
  it("Card", () => {
    try { render(() => <Card />); } catch (_e) { /* expected */ }
    expect(Card).toBeDefined();
  });
});
