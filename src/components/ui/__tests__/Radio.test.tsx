import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Radio, RadioGroup } from "../Radio";
import type { RadioOption } from "../Radio";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

const defaultOptions: RadioOption[] = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("RadioGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with role radiogroup", () => {
      const { getByRole } = render(() => (
        <RadioGroup options={defaultOptions} />
      ));
      expect(getByRole("radiogroup")).toBeTruthy();
    });

    it("renders all radio options", () => {
      const { getAllByRole } = render(() => (
        <RadioGroup options={defaultOptions} />
      ));
      expect(getAllByRole("radio").length).toBe(3);
    });

    it("renders option labels", () => {
      const { getByText } = render(() => (
        <RadioGroup options={defaultOptions} />
      ));
      expect(getByText("Option A")).toBeTruthy();
      expect(getByText("Option B")).toBeTruthy();
      expect(getByText("Option C")).toBeTruthy();
    });

    it("renders option descriptions", () => {
      const options: RadioOption[] = [
        { value: "a", label: "A", description: "First option" },
      ];
      const { getByText } = render(() => <RadioGroup options={options} />);
      expect(getByText("First option")).toBeTruthy();
    });
  });

  describe("selection", () => {
    it("marks selected option with aria-checked true", () => {
      const { getAllByRole } = render(() => (
        <RadioGroup options={defaultOptions} value="b" />
      ));
      const radios = getAllByRole("radio");
      expect(radios[0].getAttribute("aria-checked")).toBe("false");
      expect(radios[1].getAttribute("aria-checked")).toBe("true");
      expect(radios[2].getAttribute("aria-checked")).toBe("false");
    });

    it("no option selected when value is undefined", () => {
      const { getAllByRole } = render(() => (
        <RadioGroup options={defaultOptions} />
      ));
      const radios = getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio.getAttribute("aria-checked")).toBe("false");
      });
    });
  });

  describe("onChange handler", () => {
    it("calls onChange with option value on click", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <RadioGroup options={defaultOptions} onChange={handleChange} />
      ));
      await fireEvent.click(getByText("Option B"));
      expect(handleChange).toHaveBeenCalledWith("b");
    });

    it("calls onChange on Space key", async () => {
      const handleChange = vi.fn();
      const { getAllByRole } = render(() => (
        <RadioGroup options={defaultOptions} onChange={handleChange} />
      ));
      await fireEvent.keyDown(getAllByRole("radio")[1], { key: " " });
      expect(handleChange).toHaveBeenCalledWith("b");
    });

    it("calls onChange on Enter key", async () => {
      const handleChange = vi.fn();
      const { getAllByRole } = render(() => (
        <RadioGroup options={defaultOptions} onChange={handleChange} />
      ));
      await fireEvent.keyDown(getAllByRole("radio")[0], { key: "Enter" });
      expect(handleChange).toHaveBeenCalledWith("a");
    });
  });

  describe("disabled state", () => {
    it("does not call onChange when group is disabled", async () => {
      const handleChange = vi.fn();
      const { getByText } = render(() => (
        <RadioGroup options={defaultOptions} disabled onChange={handleChange} />
      ));
      await fireEvent.click(getByText("Option A"));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("does not call onChange when individual option is disabled", async () => {
      const handleChange = vi.fn();
      const options: RadioOption[] = [
        { value: "a", label: "A" },
        { value: "b", label: "B", disabled: true },
      ];
      const { getByText } = render(() => (
        <RadioGroup options={options} onChange={handleChange} />
      ));
      await fireEvent.click(getByText("B"));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it("sets aria-disabled on disabled radio items", () => {
      const options: RadioOption[] = [
        { value: "a", label: "A", disabled: true },
      ];
      const { getByRole } = render(() => <RadioGroup options={options} />);
      expect(getByRole("radio").getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("direction", () => {
    it("defaults to vertical layout", () => {
      const { getByRole } = render(() => (
        <RadioGroup options={defaultOptions} />
      ));
      const group = getByRole("radiogroup") as HTMLElement;
      expect(group.style.flexDirection).toBe("column");
    });

    it("applies horizontal layout", () => {
      const { getByRole } = render(() => (
        <RadioGroup options={defaultOptions} direction="horizontal" />
      ));
      const group = getByRole("radiogroup") as HTMLElement;
      expect(group.style.flexDirection).toBe("row");
    });
  });

  describe("custom styles", () => {
    it("merges custom style prop", () => {
      const { getByRole } = render(() => (
        <RadioGroup options={defaultOptions} style={{ "margin-top": "8px" }} />
      ));
      const group = getByRole("radiogroup") as HTMLElement;
      expect(group.style.marginTop).toBe("8px");
    });
  });
});

describe("Radio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders with role radio", () => {
      const { getByRole } = render(() => <Radio />);
      expect(getByRole("radio")).toBeTruthy();
    });

    it("renders label text", () => {
      const { getByText } = render(() => <Radio label="My radio" />);
      expect(getByText("My radio")).toBeTruthy();
    });

    it("renders description text", () => {
      const { getByText } = render(() => (
        <Radio label="Label" description="Description text" />
      ));
      expect(getByText("Description text")).toBeTruthy();
    });
  });

  describe("checked state", () => {
    it("shows as selected when checked", () => {
      const { getByRole } = render(() => <Radio checked={true} />);
      expect(getByRole("radio").getAttribute("aria-checked")).toBe("true");
    });

    it("shows as unselected when not checked", () => {
      const { getByRole } = render(() => <Radio checked={false} />);
      expect(getByRole("radio").getAttribute("aria-checked")).toBe("false");
    });
  });

  describe("onChange handler", () => {
    it("calls onChange when clicked", async () => {
      const handleChange = vi.fn();
      const { getByRole } = render(() => (
        <Radio checked={false} onChange={handleChange} />
      ));
      await fireEvent.click(getByRole("radio").parentElement!);
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe("disabled state", () => {
    it("sets aria-disabled when disabled", () => {
      const { getByRole } = render(() => <Radio disabled />);
      expect(getByRole("radio").getAttribute("aria-disabled")).toBe("true");
    });
  });
});
