/**
 * KeyboardShortcutsEditor Tests
 * 
 * Tests for the keyboard shortcuts editor modal component.
 * Note: Component uses Portal, so queries must use document.body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { 
  render, 
  cleanup, 
  fireEvent,
  nextTick,
  screen,
} from "@/test/utils";
import { KeyboardShortcutsEditor } from "../KeyboardShortcutsEditor";
import { CommandProvider } from "@/context/CommandContext";
import { KeymapProvider } from "@/context/KeymapContext";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("KeyboardShortcutsEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("should not render when closed", () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });

  it("should render when keyboard-shortcuts:show event is dispatched", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeNull();
  });

  it("should close when Escape key is pressed", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeNull();
    
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });

  it("should display search input", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByPlaceholderText(/search commands/i)).not.toBeNull();
  });

  it("should display category sections", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByText("General")).not.toBeNull();
  });

  it("should close when clicking overlay", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByText("Keyboard Shortcuts")).not.toBeNull();
    
    const overlay = document.body.querySelector(".fixed.inset-0");
    if (overlay) {
      fireEvent.click(overlay);
      await nextTick();
    }
    
    expect(screen.queryByText("Keyboard Shortcuts")).toBeNull();
  });

  it("should filter commands based on search query", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    const searchInput = screen.queryByPlaceholderText(/search commands/i) as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    
    if (searchInput) {
      searchInput.value = "command palette";
      fireEvent.input(searchInput);
      await nextTick();
      
      expect(screen.queryByText(/Show Command Palette/)).not.toBeNull();
    }
  });

  it("should toggle category expansion when clicked", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    const generalButton = Array.from(document.body.querySelectorAll("button")).find(
      btn => btn.textContent?.includes("General")
    );
    
    expect(generalButton).toBeDefined();
    
    if (generalButton) {
      fireEvent.click(generalButton);
      await nextTick();
      
      fireEvent.click(generalButton);
      await nextTick();
    }
  });

  it("should display filter mode dropdown", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    const select = document.body.querySelector("select");
    expect(select).not.toBeNull();
    
    if (select) {
      expect(select.querySelector('option[value="all"]')).not.toBeNull();
      expect(select.querySelector('option[value="with-shortcut"]')).not.toBeNull();
      expect(select.querySelector('option[value="without-shortcut"]')).not.toBeNull();
    }
  });

  it("should display close button with title", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    const closeButton = document.body.querySelector('button[title*="Close"]');
    expect(closeButton).not.toBeNull();
  });

  it("should display keyboard shortcut hints in footer", async () => {
    render(() => (
      <KeymapProvider>
        <CommandProvider>
          <KeyboardShortcutsEditor />
        </CommandProvider>
      </KeymapProvider>
    ));
    
    window.dispatchEvent(new CustomEvent("keyboard-shortcuts:show"));
    await nextTick();
    
    expect(screen.queryByText(/Double-click a row to record/)).not.toBeNull();
  });
});
