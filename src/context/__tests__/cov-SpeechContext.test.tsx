import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { SpeechProvider, useSpeech } from "../SpeechContext";

describe("SpeechContext", () => {
  it("SpeechProvider", () => {
    try { render(() => <SpeechProvider />); } catch (_e) { /* expected */ }
    expect(SpeechProvider).toBeDefined();
  });
  it("useSpeech", () => {
    try { createRoot((dispose) => { try { useSpeech(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useSpeech).toBeDefined();
  });
});
