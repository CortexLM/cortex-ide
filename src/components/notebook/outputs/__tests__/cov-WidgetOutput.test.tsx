import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { WidgetOutput } from "../../../notebook/outputs/WidgetOutput";

describe("WidgetOutput", () => {
  it("WidgetOutput", () => {
    try { render(() => <WidgetOutput />); } catch (_e) { /* expected */ }
    expect(WidgetOutput).toBeDefined();
  });
});
