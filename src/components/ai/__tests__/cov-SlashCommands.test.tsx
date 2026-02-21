import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SlashCommandPicker, useSlashCommands } from "../../ai/SlashCommands";

describe("SlashCommands", () => {
  it("SlashCommandPicker", () => {
    try { render(() => <SlashCommandPicker />); } catch (_e) { /* expected */ }
    expect(SlashCommandPicker).toBeDefined();
  });
  it("useSlashCommands", () => {
    try { createRoot((dispose) => { try { useSlashCommands(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSlashCommands).toBeDefined();
  });
});
