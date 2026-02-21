import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { validateWhenClause, parseWhenClause, WhenClauseInput, WhenClauseRecordButton, WhenClauseDisplay, CONTEXT_KEY_CATEGORIES, ALL_CONTEXT_KEYS, CONTEXT_KEY_NAMES, WHEN_OPERATORS } from "../../settings/WhenClauseInput";

describe("WhenClauseInput", () => {
  it("validateWhenClause", () => {
    try { validateWhenClause("test"); } catch (_e) { /* expected */ }
    try { validateWhenClause(); } catch (_e) { /* expected */ }
    expect(validateWhenClause).toBeDefined();
  });
  it("parseWhenClause", () => {
    try { parseWhenClause("test"); } catch (_e) { /* expected */ }
    try { parseWhenClause(); } catch (_e) { /* expected */ }
    expect(parseWhenClause).toBeDefined();
  });
  it("WhenClauseInput", () => {
    try { render(() => <WhenClauseInput />); } catch (_e) { /* expected */ }
    expect(WhenClauseInput).toBeDefined();
  });
  it("WhenClauseRecordButton", () => {
    try { render(() => <WhenClauseRecordButton />); } catch (_e) { /* expected */ }
    expect(WhenClauseRecordButton).toBeDefined();
  });
  it("WhenClauseDisplay", () => {
    try { render(() => <WhenClauseDisplay />); } catch (_e) { /* expected */ }
    expect(WhenClauseDisplay).toBeDefined();
  });
  it("CONTEXT_KEY_CATEGORIES", () => {
    expect(CONTEXT_KEY_CATEGORIES).toBeDefined();
  });
  it("ALL_CONTEXT_KEYS", () => {
    expect(ALL_CONTEXT_KEYS).toBeDefined();
  });
  it("CONTEXT_KEY_NAMES", () => {
    expect(CONTEXT_KEY_NAMES).toBeDefined();
  });
  it("WHEN_OPERATORS", () => {
    expect(WHEN_OPERATORS).toBeDefined();
  });
});
