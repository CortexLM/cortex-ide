import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Select } from "../Select";
import type { SelectOption } from "../Select";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const defaultOptions: SelectOption[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("Select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders a button trigger", () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
    });

    it("displays placeholder when no value selected", () => {
      const { getByText } = render(() => (
        <Select options={defaultOptions} placeholder="Choose..." />
      ));
      expect(getByText("Choose...")).toBeTruthy();
    });

    it("displays default placeholder when none specified", () => {
      const { getByText } = render(() => <Select options={defaultOptions} />);
      expect(getByText("Select...")).toBeTruthy();
    });

    it("displays selected option label", () => {
      const { getByText } = render(() => (
        <Select options={defaultOptions} value="b" />
      ));
      expect(getByText("Beta")).toBeTruthy();
    });

    it("renders dropdown arrow icon", () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  describe("opening and closing", () => {
    it("opens dropdown on click", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("closes dropdown on second click", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      await fireEvent.click(button);
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("renders all options in dropdown", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const options = document.querySelectorAll("[role='option']");
      expect(options.length).toBe(3);
    });

    it("sets aria-haspopup on trigger", () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      expect(button.getAttribute("aria-haspopup")).toBe("listbox");
    });

    it("sets aria-expanded on trigger", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      expect(button.getAttribute("aria-expanded")).toBe("false");
      await fireEvent.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
    });
  });

  describe("selection", () => {
    it("calls onChange when option is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <Select options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const options = document.querySelectorAll("[role='option']");
      await fireEvent.click(options[1]);
      expect(handleChange).toHaveBeenCalledWith("b");
    });

    it("closes dropdown after selection", async () => {
      const { container } = render(() => (
        <Select options={defaultOptions} onChange={vi.fn()} />
      ));
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const options = document.querySelectorAll("[role='option']");
      await fireEvent.click(options[0]);
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("marks selected option with aria-selected", async () => {
      const { container } = render(() => (
        <Select options={defaultOptions} value="b" />
      ));
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const options = document.querySelectorAll("[role='option']");
      expect(options[1].getAttribute("aria-selected")).toBe("true");
      expect(options[0].getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("keyboard navigation", () => {
    it("closes on Escape key", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "Escape" });
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("opens on Enter key", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.keyDown(button, { key: "Enter" });
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("opens on Space key", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.keyDown(button, { key: " " });
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("opens on ArrowDown key", async () => {
      const { container } = render(() => <Select options={defaultOptions} />);
      const button = container.querySelector("button")!;
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });
  });

  describe("disabled state", () => {
    it("disables the trigger button", () => {
      const { container } = render(() => (
        <Select options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { container } = render(() => (
        <Select options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.opacity).toBe("0.5");
    });

    it("does not open dropdown when disabled", async () => {
      const { container } = render(() => (
        <Select options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const listbox = document.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("does not call onChange for disabled options", async () => {
      const handleChange = vi.fn();
      const options: SelectOption[] = [
        { value: "a", label: "A" },
        { value: "b", label: "B", disabled: true },
      ];
      const { container } = render(() => (
        <Select options={options} onChange={handleChange} />
      ));
      const button = container.querySelector("button")!;
      await fireEvent.click(button);
      const optionElements = document.querySelectorAll("[role='option']");
      await fireEvent.click(optionElements[1]);
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("applies error border when error is true", () => {
      const { container } = render(() => (
        <Select options={defaultOptions} error />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.border).toContain("state-error");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop on trigger", () => {
      const { container } = render(() => (
        <Select options={defaultOptions} style={{ "min-width": "200px" }} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.minWidth).toBe("200px");
    });
  });
});
