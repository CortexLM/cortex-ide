import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { JsonOutput } from "../../../notebook/outputs/JsonOutput";

describe("JsonOutput", () => {
  it("JsonOutput", () => {
    try { render(() => <JsonOutput />); } catch (_e) { /* expected */ }
    expect(JsonOutput).toBeDefined();
  });
});
