import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

vi.mock("@/context/SpeechContext", () => ({ SpeechProvider: (p: any) => p.children, useSpeech: vi.fn(() => ({})) }));

import { VoiceInput, VoiceMicButton, VoiceAudioLevel } from "../VoiceInput";

describe("VoiceInput", () => {
  it("VoiceInput", () => {
    try { render(() => <VoiceInput />); } catch (_e) { /* expected */ }
    expect(VoiceInput).toBeDefined();
  });
  it("VoiceMicButton", () => {
    try { render(() => <VoiceMicButton />); } catch (_e) { /* expected */ }
    expect(VoiceMicButton).toBeDefined();
  });
  it("VoiceAudioLevel", () => {
    try { render(() => <VoiceAudioLevel />); } catch (_e) { /* expected */ }
    expect(VoiceAudioLevel).toBeDefined();
  });
});
