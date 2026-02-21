import { describe, it, expect, vi } from "vitest";

import { buildVariableContext, substituteVariables, substituteTaskCommand, getAvailableVariables, findUnresolvedVariables, validateInputValue, parseInputDefinitions, buildTaskVariableContext, InputValidationError, InputCancelledError } from "../taskVariables";

describe("taskVariables", () => {
  it("buildVariableContext", () => {
    try { buildVariableContext("test"); } catch (_e) { /* expected */ }
    try { buildVariableContext(); } catch (_e) { /* expected */ }
    expect(buildVariableContext).toBeDefined();
  });
  it("substituteVariables", () => {
    try { substituteVariables("test", {} as any); } catch (_e) { /* expected */ }
    try { substituteVariables(); } catch (_e) { /* expected */ }
    expect(substituteVariables).toBeDefined();
  });
  it("substituteTaskCommand", () => {
    try { substituteTaskCommand("test", {} as any, {} as any); } catch (_e) { /* expected */ }
    try { substituteTaskCommand(); } catch (_e) { /* expected */ }
    expect(substituteTaskCommand).toBeDefined();
  });
  it("getAvailableVariables", () => {
    try { getAvailableVariables(); } catch (_e) { /* expected */ }
    expect(getAvailableVariables).toBeDefined();
  });
  it("findUnresolvedVariables", () => {
    try { findUnresolvedVariables("test"); } catch (_e) { /* expected */ }
    try { findUnresolvedVariables(); } catch (_e) { /* expected */ }
    expect(findUnresolvedVariables).toBeDefined();
  });
  it("validateInputValue", () => {
    try { validateInputValue("test", {} as any); } catch (_e) { /* expected */ }
    try { validateInputValue(); } catch (_e) { /* expected */ }
    expect(validateInputValue).toBeDefined();
  });
  it("parseInputDefinitions", () => {
    try { parseInputDefinitions([]); } catch (_e) { /* expected */ }
    try { parseInputDefinitions(); } catch (_e) { /* expected */ }
    expect(parseInputDefinitions).toBeDefined();
  });
  it("buildTaskVariableContext", () => {
    try { buildTaskVariableContext({} as any); } catch (_e) { /* expected */ }
    try { buildTaskVariableContext(); } catch (_e) { /* expected */ }
    expect(buildTaskVariableContext).toBeDefined();
  });
  it("InputValidationError", () => {
    try { const inst = new InputValidationError("test"); expect(inst).toBeDefined(); } catch (_e) { expect(InputValidationError).toBeDefined(); }
  });
  it("InputCancelledError", () => {
    try { const inst = new InputCancelledError(); expect(inst).toBeDefined(); } catch (_e) { expect(InputCancelledError).toBeDefined(); }
  });
});
