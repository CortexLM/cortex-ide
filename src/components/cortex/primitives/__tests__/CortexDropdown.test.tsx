import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { CortexDropdown } from "../CortexDropdown";
import type { CortexDropdownOption } from "../CortexDropdown";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../CortexIcon", () => ({
  CortexIcon: (props: { name: string; size: number }) => (
    <span data-testid="cortex-icon" data-name={props.name} data-size={props.size} />
  ),
}));

const defaultOptions: CortexDropdownOption[] = [
  { value: "opt1", label: "Option 1" },
  { value: "opt2", label: "Option 2" },
  { value: "opt3", label: "Option 3" },
];

describe("CortexDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders trigger button", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button");
      expect(button).toBeTruthy();
    });

    it("renders with default placeholder", () => {
      const { getByText } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      expect(getByText("Select...")).toBeTruthy();
    });

    it("renders with custom placeholder", () => {
      const { getByText } = render(() => (
        <CortexDropdown options={defaultOptions} placeholder="Choose one..." />
      ));
      expect(getByText("Choose one...")).toBeTruthy();
    });

    it("renders selected option label", () => {
      const { getByText } = render(() => (
        <CortexDropdown options={defaultOptions} value="opt2" />
      ));
      expect(getByText("Option 2")).toBeTruthy();
    });

    it("has aria-haspopup attribute", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button");
      expect(button?.getAttribute("aria-haspopup")).toBe("listbox");
    });

    it("has aria-expanded false initially", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button");
      expect(button?.getAttribute("aria-expanded")).toBe("false");
    });
  });

  describe("opening and closing", () => {
    it("opens dropdown on click", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("sets aria-expanded to true when open", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      expect(button.getAttribute("aria-expanded")).toBe("true");
    });

    it("shows options when open", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const options = document.body.querySelectorAll("[role='option']");
      expect(options.length).toBe(3);
    });

    it("closes dropdown on second click", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.click(button);
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });
  });

  describe("selecting options", () => {
    it("calls onChange when option is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const options = document.body.querySelectorAll("[role='option']");
      await fireEvent.click(options[1]);
      expect(handleChange).toHaveBeenCalledWith("opt2");
    });

    it("closes dropdown after selecting an option", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={vi.fn()} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const options = document.body.querySelectorAll("[role='option']");
      await fireEvent.click(options[0]);
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("does not select disabled option", async () => {
      const handleChange = vi.fn();
      const options: CortexDropdownOption[] = [
        { value: "a", label: "A" },
        { value: "b", label: "B", disabled: true },
      ];
      const { container } = render(() => (
        <CortexDropdown options={options} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const optionElements = document.body.querySelectorAll("[role='option']");
      await fireEvent.click(optionElements[1]);
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("marks selected option with aria-selected", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} value="opt1" />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const options = document.body.querySelectorAll("[role='option']");
      expect(options[0].getAttribute("aria-selected")).toBe("true");
      expect(options[1].getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("disabled state", () => {
    it("applies disabled attribute to trigger", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("applies reduced opacity when disabled", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.opacity).toBe("0.5");
    });

    it("applies not-allowed cursor when disabled", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.cursor).toBe("not-allowed");
    });

    it("does not open when disabled", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} disabled />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });
  });

  describe("searchable mode", () => {
    it("renders search input when searchable is true", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} searchable />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const searchInput = document.body.querySelector("input[type='text']");
      expect(searchInput).toBeTruthy();
    });

    it("filters options based on search text", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} searchable />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const searchInput = document.body.querySelector("input[type='text']") as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: "Option 1" } });
      const options = document.body.querySelectorAll("[role='option']");
      expect(options.length).toBe(1);
      expect(options[0].textContent).toContain("Option 1");
    });

    it("shows no options message when search has no matches", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} searchable />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const searchInput = document.body.querySelector("input[type='text']") as HTMLInputElement;
      await fireEvent.input(searchInput, { target: { value: "xyz" } });
      const options = document.body.querySelectorAll("[role='option']");
      expect(options.length).toBe(0);
      const noOptions = document.body.querySelector("[role='listbox']");
      expect(noOptions?.textContent).toContain("No options found");
    });

    it("has search placeholder", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} searchable />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const searchInput = document.body.querySelector("input[type='text']") as HTMLInputElement;
      expect(searchInput.placeholder).toBe("Search...");
    });
  });

  describe("clearable mode", () => {
    it("shows clear icon when clearable and value is set", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} value="opt1" clearable />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const clearIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "x"
      );
      expect(clearIcon).toBeTruthy();
    });

    it("does not show clear icon when no value is set", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} clearable />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const clearIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "x"
      );
      expect(clearIcon).toBeFalsy();
    });

    it("calls onChange with empty string when clear is clicked", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown
          options={defaultOptions}
          value="opt1"
          clearable
          onChange={handleChange}
        />
      ));
      const icons = container.querySelectorAll("[data-testid='cortex-icon']");
      const clearIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "x"
      );
      const clearButton = clearIcon?.closest("span");
      await fireEvent.click(clearButton!);
      expect(handleChange).toHaveBeenCalledWith("");
    });
  });

  describe("keyboard navigation", () => {
    it("opens dropdown on ArrowDown key", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("opens dropdown on Enter key", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.keyDown(button, { key: "Enter" });
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeTruthy();
    });

    it("closes dropdown on Escape key", async () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "Escape" });
      const listbox = document.body.querySelector("[role='listbox']");
      expect(listbox).toBeFalsy();
    });

    it("selects highlighted option on Enter key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("opt2");
    });

    it("navigates down with ArrowDown", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("opt3");
    });

    it("navigates up with ArrowUp", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "ArrowUp" });
      await fireEvent.keyDown(button, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("opt2");
    });

    it("jumps to first option on Home key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "ArrowDown" });
      await fireEvent.keyDown(button, { key: "Home" });
      await fireEvent.keyDown(button, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("opt1");
    });

    it("jumps to last option on End key", async () => {
      const handleChange = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onChange={handleChange} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.keyDown(button, { key: "End" });
      await fireEvent.keyDown(button, { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("opt3");
    });
  });

  describe("option with description", () => {
    it("renders option description text", async () => {
      const options: CortexDropdownOption[] = [
        { value: "a", label: "Alpha", description: "First letter" },
        { value: "b", label: "Beta" },
      ];
      const { container } = render(() => (
        <CortexDropdown options={options} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const optionElements = document.body.querySelectorAll("[role='option']");
      expect(optionElements[0].textContent).toContain("First letter");
    });
  });

  describe("option with icon", () => {
    it("renders option icon", async () => {
      const options: CortexDropdownOption[] = [
        { value: "a", label: "Alpha", icon: "star" },
      ];
      const { container } = render(() => (
        <CortexDropdown options={options} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      const icons = document.body.querySelectorAll("[data-testid='cortex-icon']");
      const starIcon = Array.from(icons).find(
        (icon) => icon.getAttribute("data-name") === "star"
      );
      expect(starIcon).toBeTruthy();
    });
  });

  describe("fullWidth", () => {
    it("applies full width when fullWidth is true", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} fullWidth />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.width).toBe("100%");
    });

    it("applies auto width when fullWidth is not set", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.width).toBe("auto");
    });
  });

  describe("callbacks", () => {
    it("calls onOpen when dropdown opens", async () => {
      const handleOpen = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onOpen={handleOpen} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      expect(handleOpen).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when dropdown closes", async () => {
      const handleClose = vi.fn();
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} onClose={handleClose} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      await fireEvent.click(button);
      await fireEvent.click(button);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("custom class and style", () => {
    it("applies custom class to trigger", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} class="custom-dropdown" />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.classList.contains("custom-dropdown")).toBe(true);
    });

    it("merges custom style with base styles", () => {
      const { container } = render(() => (
        <CortexDropdown options={defaultOptions} style={{ "margin-top": "10px" }} />
      ));
      const button = container.querySelector("button") as HTMLElement;
      expect(button.style.marginTop).toBe("10px");
    });
  });
});
