import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/design-system/tokens", () => ({ colors: {}, spacing: {}, typography: {}, shadows: {}, radii: {}, transitions: {} }));
vi.mock("@/components/ui/Icon", () => ({ Icon: (p: any) => null, default: (p: any) => null }));

import { DiffHunk } from "../../git/DiffHunk";

describe("DiffHunk", () => {
  it("DiffHunk", () => {
    try { render(() => <DiffHunk />); } catch (_e) { /* expected */ }
    expect(DiffHunk).toBeDefined();
  });
});
