import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@solidjs/testing-library";

const mockNavigate = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("@solidjs/router", () => ({
  Navigate: (props: { href: string }) => {
    mockNavigate(props.href);
    return null;
  },
}));

vi.mock("@/utils/windowStorage", () => ({
  getWindowLabel: () => "main",
}));

import Home from "../Home";

describe("Home Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("should render without a loading spinner", () => {
      const { container } = render(() => <Home />);
      expect(container.querySelector("[data-testid='loading-spinner']")).toBeNull();
    });

    it("should render Navigate component immediately", () => {
      render(() => <Home />);
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  describe("Navigation", () => {
    it("should navigate to /session when project exists", () => {
      localStorage.setItem("cortex_current_project_main", "/home/user/my-project");

      render(() => <Home />);

      expect(mockNavigate).toHaveBeenCalledWith("/session");
    });

    it("should navigate to /welcome when no project exists", () => {
      render(() => <Home />);

      expect(mockNavigate).toHaveBeenCalledWith("/welcome");
    });

    it("should check window-specific project key first", () => {
      localStorage.setItem("cortex_current_project_main", "/home/user/project-a");

      render(() => <Home />);

      expect(mockNavigate).toHaveBeenCalledWith("/session");
    });

    it("should fall back to global project key", () => {
      localStorage.setItem("cortex_current_project", "/home/user/project-b");

      render(() => <Home />);

      expect(mockNavigate).toHaveBeenCalledWith("/session");
    });

    it("should navigate to /welcome when neither key exists", () => {
      render(() => <Home />);

      expect(mockNavigate).toHaveBeenCalledWith("/welcome");
    });

    it("should use Navigate with replace semantics", () => {
      render(() => <Home />);
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });
});
