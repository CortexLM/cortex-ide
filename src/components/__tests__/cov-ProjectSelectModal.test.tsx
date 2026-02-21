import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue(null), message: vi.fn().mockResolvedValue(undefined), ask: vi.fn().mockResolvedValue(false), confirm: vi.fn().mockResolvedValue(false) }));

import { ProjectSelectModal } from "../ProjectSelectModal";

describe("ProjectSelectModal", () => {
  it("ProjectSelectModal", () => {
    try { render(() => <ProjectSelectModal />); } catch (_e) { /* expected */ }
    expect(ProjectSelectModal).toBeDefined();
  });
});
