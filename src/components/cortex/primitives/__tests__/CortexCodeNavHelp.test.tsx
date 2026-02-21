import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexCodeNavHelp } from "../CortexCodeNavHelp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number; color?: string }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

describe("CortexCodeNavHelp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders as a button element", () => {
      const { getByRole } = render(() => <CortexCodeNavHelp />);
      const button = getByRole("button");
      expect(button).toBeTruthy();
    });

    it("has type button", () => {
      const { getByRole } = render(() => <CortexCodeNavHelp />);
      const button = getByRole("button") as HTMLButtonElement;
      expect(button.type).toBe("button");
    });

    it("has 26px height", () => {
      const { getByRole } = render(() => <CortexCodeNavHelp />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.height).toBe("26px");
    });

    it("has transparent background", () => {
      const { getByRole } = render(() => <CortexCodeNavHelp />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.background).toBe("transparent");
    });
  });

  describe("label", () => {
    it("renders default label 'Code Navigation Help'", () => {
      const { getByText } = render(() => <CortexCodeNavHelp />);
      expect(getByText("Code Navigation Help")).toBeTruthy();
    });

    it("renders custom label when provided", () => {
      const { getByText } = render(() => (
        <CortexCodeNavHelp label="Go Back" />
      ));
      expect(getByText("Go Back")).toBeTruthy();
    });
  });

  describe("icon", () => {
    it("renders chevron-left icon", () => {
      const { container } = render(() => <CortexCodeNavHelp />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute("data-name")).toBe("chevron-left");
    });

    it("renders icon with size 16", () => {
      const { container } = render(() => <CortexCodeNavHelp />);
      const icon = container.querySelector("[data-testid='cortex-icon']");
      expect(icon?.getAttribute("data-size")).toBe("16");
    });
  });

  describe("onClick handler", () => {
    it("calls onClick when clicked", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexCodeNavHelp onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes event to onClick handler", async () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexCodeNavHelp onClick={handleClick} />
      ));
      const button = getByRole("button");
      await fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledWith(expect.any(MouseEvent));
    });
  });

  describe("cursor", () => {
    it("has pointer cursor when onClick is provided", () => {
      const handleClick = vi.fn();
      const { getByRole } = render(() => (
        <CortexCodeNavHelp onClick={handleClick} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("pointer");
    });

    it("has default cursor when onClick is not provided", () => {
      const { getByRole } = render(() => <CortexCodeNavHelp />);
      const button = getByRole("button") as HTMLElement;
      expect(button.style.cursor).toBe("default");
    });
  });

  describe("custom class and style", () => {
    it("applies custom class", () => {
      const { getByRole } = render(() => (
        <CortexCodeNavHelp class="custom-nav-help" />
      ));
      const button = getByRole("button");
      expect(button.classList.contains("custom-nav-help")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { getByRole } = render(() => (
        <CortexCodeNavHelp style={{ "margin-top": "10px" }} />
      ));
      const button = getByRole("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
