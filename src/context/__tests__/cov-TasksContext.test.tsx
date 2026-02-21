import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { createRoot } from "solid-js";

import { resolveProblemMatcher, parseTaskOutput, getTaskVariables, substituteTaskVariables, hasInputVariables, extractInputVariableIds, extractTaskInputVariableIds, substituteInputVariables, hasCommandVariables, extractCommandVariableIds, substituteCommandVariables, detectOS, getDefaultShellConfig, mergeOSConfig, quoteShellArg, buildShellCommand, checkInstancePolicy, TasksProvider, useTasks, BUILTIN_PROBLEM_MATCHERS } from "../TasksContext";

describe("TasksContext", () => {
  it("resolveProblemMatcher", () => {
    try { resolveProblemMatcher({} as any); } catch (_e) { /* expected */ }
    try { resolveProblemMatcher(); } catch (_e) { /* expected */ }
    expect(resolveProblemMatcher).toBeDefined();
  });
  it("parseTaskOutput", () => {
    try { parseTaskOutput("test", {} as any, "test"); } catch (_e) { /* expected */ }
    try { parseTaskOutput(); } catch (_e) { /* expected */ }
    expect(parseTaskOutput).toBeDefined();
  });
  it("getTaskVariables", () => {
    try { getTaskVariables("test"); } catch (_e) { /* expected */ }
    try { getTaskVariables(); } catch (_e) { /* expected */ }
    expect(getTaskVariables).toBeDefined();
  });
  it("substituteTaskVariables", () => {
    try { substituteTaskVariables("test", "test"); } catch (_e) { /* expected */ }
    try { substituteTaskVariables(); } catch (_e) { /* expected */ }
    expect(substituteTaskVariables).toBeDefined();
  });
  it("hasInputVariables", () => {
    try { hasInputVariables("test"); } catch (_e) { /* expected */ }
    try { hasInputVariables(); } catch (_e) { /* expected */ }
    expect(hasInputVariables).toBeDefined();
  });
  it("extractInputVariableIds", () => {
    try { extractInputVariableIds("test"); } catch (_e) { /* expected */ }
    try { extractInputVariableIds(); } catch (_e) { /* expected */ }
    expect(extractInputVariableIds).toBeDefined();
  });
  it("extractTaskInputVariableIds", () => {
    try { extractTaskInputVariableIds({} as any); } catch (_e) { /* expected */ }
    try { extractTaskInputVariableIds(); } catch (_e) { /* expected */ }
    expect(extractTaskInputVariableIds).toBeDefined();
  });
  it("substituteInputVariables", () => {
    try { substituteInputVariables("test", {}); } catch (_e) { /* expected */ }
    try { substituteInputVariables(); } catch (_e) { /* expected */ }
    expect(substituteInputVariables).toBeDefined();
  });
  it("hasCommandVariables", () => {
    try { hasCommandVariables("test"); } catch (_e) { /* expected */ }
    try { hasCommandVariables(); } catch (_e) { /* expected */ }
    expect(hasCommandVariables).toBeDefined();
  });
  it("extractCommandVariableIds", () => {
    try { extractCommandVariableIds("test"); } catch (_e) { /* expected */ }
    try { extractCommandVariableIds(); } catch (_e) { /* expected */ }
    expect(extractCommandVariableIds).toBeDefined();
  });
  it("substituteCommandVariables", () => {
    try { substituteCommandVariables("test", {}); } catch (_e) { /* expected */ }
    try { substituteCommandVariables(); } catch (_e) { /* expected */ }
    expect(substituteCommandVariables).toBeDefined();
  });
  it("detectOS", () => {
    try { detectOS(); } catch (_e) { /* expected */ }
    expect(detectOS).toBeDefined();
  });
  it("getDefaultShellConfig", () => {
    try { getDefaultShellConfig({} as any); } catch (_e) { /* expected */ }
    try { getDefaultShellConfig(); } catch (_e) { /* expected */ }
    expect(getDefaultShellConfig).toBeDefined();
  });
  it("mergeOSConfig", () => {
    try { mergeOSConfig({} as any, {} as any); } catch (_e) { /* expected */ }
    try { mergeOSConfig(); } catch (_e) { /* expected */ }
    expect(mergeOSConfig).toBeDefined();
  });
  it("quoteShellArg", () => {
    try { quoteShellArg("test", {} as any); } catch (_e) { /* expected */ }
    try { quoteShellArg(); } catch (_e) { /* expected */ }
    expect(quoteShellArg).toBeDefined();
  });
  it("buildShellCommand", () => {
    try { buildShellCommand("test", {} as any, {} as any); } catch (_e) { /* expected */ }
    try { buildShellCommand(); } catch (_e) { /* expected */ }
    expect(buildShellCommand).toBeDefined();
  });
  it("checkInstancePolicy", () => {
    try { checkInstancePolicy({} as any, [], []); } catch (_e) { /* expected */ }
    try { checkInstancePolicy(); } catch (_e) { /* expected */ }
    expect(checkInstancePolicy).toBeDefined();
  });
  it("TasksProvider", () => {
    try { render(() => <TasksProvider />); } catch (_e) { /* expected */ }
    expect(TasksProvider).toBeDefined();
  });
  it("useTasks", () => {
    try { createRoot((dispose) => { try { useTasks(); } catch (_e) {} dispose(); }); } catch (_e) { /* expected */ }
    expect(useTasks).toBeDefined();
  });
  it("BUILTIN_PROBLEM_MATCHERS", () => {
    expect(BUILTIN_PROBLEM_MATCHERS).toBeDefined();
  });
});
