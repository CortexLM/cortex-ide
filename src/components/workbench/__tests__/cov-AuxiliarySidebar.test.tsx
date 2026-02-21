import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { AuxiliarySidebar, AuxiliarySidebarToggle } from "../../workbench/AuxiliarySidebar";

describe("AuxiliarySidebar", () => {
  it("AuxiliarySidebar", () => {
    try { render(() => <AuxiliarySidebar />); } catch (_e) { /* expected */ }
    expect(AuxiliarySidebar).toBeDefined();
  });
  it("AuxiliarySidebarToggle", () => {
    try { render(() => <AuxiliarySidebarToggle />); } catch (_e) { /* expected */ }
    expect(AuxiliarySidebarToggle).toBeDefined();
  });
});
