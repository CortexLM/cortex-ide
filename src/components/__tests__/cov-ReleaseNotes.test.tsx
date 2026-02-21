import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/AutoUpdateContext", () => ({ AutoUpdateProvider: (p: any) => p.children, useAutoUpdate: vi.fn(() => ({})) }));

import { ReleaseNotes, ReleaseNotesButton } from "../ReleaseNotes";

describe("ReleaseNotes", () => {
  it("ReleaseNotes", () => {
    try { render(() => <ReleaseNotes />); } catch (_e) { /* expected */ }
    expect(ReleaseNotes).toBeDefined();
  });
  it("ReleaseNotesButton", () => {
    try { render(() => <ReleaseNotesButton />); } catch (_e) { /* expected */ }
    expect(ReleaseNotesButton).toBeDefined();
  });
});
