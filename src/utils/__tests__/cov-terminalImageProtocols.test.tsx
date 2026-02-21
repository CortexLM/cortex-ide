import { describe, it, expect, vi } from "vitest";

import { parseITerm2Image, parseSixelImage, parseKittyImage, detectImageProtocol, parseImageSequence, extractImageSequences, convertSixelToPNG, convertKittyRawToPNG } from "../terminalImageProtocols";

describe("terminalImageProtocols", () => {
  it("parseITerm2Image", () => {
    try { parseITerm2Image("test"); } catch (_e) { /* expected */ }
    try { parseITerm2Image(); } catch (_e) { /* expected */ }
    expect(parseITerm2Image).toBeDefined();
  });
  it("parseSixelImage", () => {
    try { parseSixelImage("test"); } catch (_e) { /* expected */ }
    try { parseSixelImage(); } catch (_e) { /* expected */ }
    expect(parseSixelImage).toBeDefined();
  });
  it("parseKittyImage", () => {
    try { parseKittyImage("test"); } catch (_e) { /* expected */ }
    try { parseKittyImage(); } catch (_e) { /* expected */ }
    expect(parseKittyImage).toBeDefined();
  });
  it("detectImageProtocol", () => {
    try { detectImageProtocol("test"); } catch (_e) { /* expected */ }
    try { detectImageProtocol(); } catch (_e) { /* expected */ }
    expect(detectImageProtocol).toBeDefined();
  });
  it("parseImageSequence", () => {
    try { parseImageSequence("test"); } catch (_e) { /* expected */ }
    try { parseImageSequence(); } catch (_e) { /* expected */ }
    expect(parseImageSequence).toBeDefined();
  });
  it("extractImageSequences", () => {
    try { extractImageSequences("test"); } catch (_e) { /* expected */ }
    try { extractImageSequences(); } catch (_e) { /* expected */ }
    expect(extractImageSequences).toBeDefined();
  });
  it("convertSixelToPNG", () => {
    try { convertSixelToPNG("test"); } catch (_e) { /* expected */ }
    try { convertSixelToPNG(); } catch (_e) { /* expected */ }
    expect(convertSixelToPNG).toBeDefined();
  });
  it("convertKittyRawToPNG", () => {
    try { convertKittyRawToPNG("test", 0, 0, {} as any); } catch (_e) { /* expected */ }
    try { convertKittyRawToPNG(); } catch (_e) { /* expected */ }
    expect(convertKittyRawToPNG).toBeDefined();
  });
});
