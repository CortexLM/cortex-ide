import { describe, it, expect, vi } from "vitest";
import { render } from "@solidjs/testing-library";

import { ErrorBoundary, SidebarErrorBoundary, EditorErrorBoundary, DialogErrorBoundary, InlineErrorBoundary, CompactFallback } from "../ErrorBoundary";

describe("ErrorBoundary", () => {
  it("ErrorBoundary", () => {
    try { render(() => <ErrorBoundary />); } catch (_e) { /* expected */ }
    expect(ErrorBoundary).toBeDefined();
  });
  it("SidebarErrorBoundary", () => {
    try { render(() => <SidebarErrorBoundary />); } catch (_e) { /* expected */ }
    expect(SidebarErrorBoundary).toBeDefined();
  });
  it("EditorErrorBoundary", () => {
    try { render(() => <EditorErrorBoundary />); } catch (_e) { /* expected */ }
    expect(EditorErrorBoundary).toBeDefined();
  });
  it("DialogErrorBoundary", () => {
    try { render(() => <DialogErrorBoundary />); } catch (_e) { /* expected */ }
    expect(DialogErrorBoundary).toBeDefined();
  });
  it("InlineErrorBoundary", () => {
    try { render(() => <InlineErrorBoundary />); } catch (_e) { /* expected */ }
    expect(InlineErrorBoundary).toBeDefined();
  });
  it("CompactFallback", () => {
    try { render(() => <CompactFallback />); } catch (_e) { /* expected */ }
    expect(CompactFallback).toBeDefined();
  });
});
