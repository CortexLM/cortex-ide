import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexDropdownMenu } from "../CortexDropdownMenu";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

describe("CortexDropdownMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with role='menu'", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu");
      expect(menu).toBeTruthy();
      expect(menu.tagName.toLowerCase()).toBe("div");
    });

    it("renders children", () => {
      const { getByText } = render(() => (
        <CortexDropdownMenu>
          <span>First Item</span>
          <span>Second Item</span>
        </CortexDropdownMenu>
      ));
      expect(getByText("First Item")).toBeTruthy();
      expect(getByText("Second Item")).toBeTruthy();
    });
  });

  describe("width", () => {
    it("applies default width of 243px", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.width).toBe("243px");
    });

    it("applies custom width prop", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu width={180}>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.width).toBe("180px");
    });

    it("applies a different custom width", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu width={320}>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.width).toBe("320px");
    });
  });

  describe("custom style and class", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu class="my-custom-menu">
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.classList.contains("my-custom-menu")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu style={{ "margin-top": "10px" }}>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.marginTop).toBe("10px");
      expect(menu.style.position).toBe("absolute");
    });

    it("custom style overrides base styles", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu style={{ position: "fixed" as const }}>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.position).toBe("fixed");
    });
  });

  describe("click-outside handler", () => {
    it("calls onClickOutside when clicking outside the menu", async () => {
      const handleClickOutside = vi.fn();
      render(() => (
        <div>
          <button data-testid="outside-btn">Outside</button>
          <CortexDropdownMenu onClickOutside={handleClickOutside}>
            <span>Menu Content</span>
          </CortexDropdownMenu>
        </div>
      ));

      const outsideBtn = document.querySelector("[data-testid='outside-btn']") as HTMLElement;
      await fireEvent.mouseDown(outsideBtn);
      expect(handleClickOutside).toHaveBeenCalledTimes(1);
    });

    it("does not call onClickOutside when clicking inside the menu", async () => {
      const handleClickOutside = vi.fn();
      const { getByText } = render(() => (
        <CortexDropdownMenu onClickOutside={handleClickOutside}>
          <span>Menu Content</span>
        </CortexDropdownMenu>
      ));

      const menuContent = getByText("Menu Content");
      await fireEvent.mouseDown(menuContent);
      expect(handleClickOutside).not.toHaveBeenCalled();
    });

    it("does not throw when onClickOutside is not provided", async () => {
      render(() => (
        <div>
          <button data-testid="outside-btn">Outside</button>
          <CortexDropdownMenu>
            <span>Menu Content</span>
          </CortexDropdownMenu>
        </div>
      ));

      const outsideBtn = document.querySelector("[data-testid='outside-btn']") as HTMLElement;
      expect(() => fireEvent.mouseDown(outsideBtn)).not.toThrow();
    });
  });

  describe("positioning and z-index", () => {
    it("is positioned absolutely", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.position).toBe("absolute");
    });

    it("has correct z-index from CSS variable", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.zIndex).toBe("var(--cortex-z-dropdown, 600)");
    });
  });

  describe("background and border from CSS variables", () => {
    it("has background from CSS variable", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.background).toBe("var(--cortex-dropdown-bg)");
    });

    it("has border from CSS variable", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.border).toBe("1px solid var(--cortex-dropdown-border)");
    });

    it("has border-radius of 8px", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.borderRadius).toBe("8px");
    });

    it("has box-shadow for elevation", () => {
      const { getByRole } = render(() => (
        <CortexDropdownMenu>
          <span>Item</span>
        </CortexDropdownMenu>
      ));
      const menu = getByRole("menu") as HTMLElement;
      expect(menu.style.boxShadow).toContain("rgba(0,0,0,0.3)");
    });
  });
});
