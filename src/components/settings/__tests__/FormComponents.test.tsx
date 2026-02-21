import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@solidjs/testing-library";

vi.mock("@/components/ui", () => ({
  Input: (props: any) => (
    <div data-testid="ui-input">
      {props.label && <label>{props.label}</label>}
      {props.hint && <span data-testid="hint">{props.hint}</span>}
      {props.error && <span data-testid="error">{props.error}</span>}
      <input type={props.type} value={props.value} placeholder={props.placeholder} disabled={props.disabled} />
      {props.iconRight}
    </div>
  ),
  Text: (props: any) => <span data-testid="ui-text">{props.children}</span>,
  Card: (props: any) => <div data-testid="ui-card">{props.children}</div>,
  Button: (props: any) => <button data-testid="ui-button" {...props}>{props.children}</button>,
  Toggle: (props: any) => (
    <button
      data-testid="ui-toggle"
      role="switch"
      aria-checked={props.checked}
      onClick={() => props.onChange(!props.checked)}
      disabled={props.disabled}
    >
      {props.label}
    </button>
  ),
  Checkbox: (props: any) => (
    <label data-testid="ui-checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={() => props.onChange(!props.checked)}
        disabled={props.disabled}
      />
      {props.label}
    </label>
  ),
}));

vi.mock("@/design-system/tokens", () => ({
  tokens: {
    colors: {
      text: { primary: "#fff", muted: "#888", secondary: "#aaa", inactive: "#666" },
      surface: { input: "#1e1e1e", panel: "#252526", card: "#2d2d2d", active: "#37373d", canvas: "#1e1e1e", modal: "#1e1e1e" },
      border: { default: "#3c3c3c", focus: "#007acc" },
      accent: { primary: "#007acc" },
      semantic: { primary: "#007acc", error: "#f44747" },
      interactive: { hover: "#2a2d2e" },
    },
    spacing: { sm: "4px", md: "8px", lg: "12px" },
    radius: { sm: "4px", md: "6px", full: "9999px" },
  },
}));

import {
  SectionHeader,
  FormGroup,
  Select,
  RadioGroup,
  Checkbox,
  Toggle,
  Button,
  Kbd,
  InfoBox,
  OptionCard,
  PasswordInput,
  FormActions,
} from "../FormComponents";

afterEach(() => {
  cleanup();
});

describe("SectionHeader", () => {
  it("renders title text", () => {
    const { getByText } = render(() => <SectionHeader title="Editor Settings" />);
    expect(getByText("Editor Settings")).toBeTruthy();
  });

  it("renders description when provided", () => {
    const { getByText } = render(() => (
      <SectionHeader title="Font" description="Configure font settings" />
    ));
    expect(getByText("Configure font settings")).toBeTruthy();
  });

  it("renders icon when provided", () => {
    const { container } = render(() => (
      <SectionHeader title="Test" icon={<span data-testid="icon">★</span>} />
    ));
    expect(container.querySelector("[data-testid='icon']")).toBeTruthy();
  });

  it("renders action slot when provided", () => {
    const { getByText } = render(() => (
      <SectionHeader title="Test" action={<button>Reset</button>} />
    ));
    expect(getByText("Reset")).toBeTruthy();
  });
});

describe("FormGroup", () => {
  it("renders children content", () => {
    const { getByText } = render(() => (
      <FormGroup><span>Child content</span></FormGroup>
    ));
    expect(getByText("Child content")).toBeTruthy();
  });

  it("renders title when provided", () => {
    const { getByText } = render(() => (
      <FormGroup title="Group Title"><span>content</span></FormGroup>
    ));
    expect(getByText("Group Title")).toBeTruthy();
  });

  it("renders label as alternative to title", () => {
    const { getByText } = render(() => (
      <FormGroup label="Group Label"><span>content</span></FormGroup>
    ));
    expect(getByText("Group Label")).toBeTruthy();
  });

  it("renders description when provided with title", () => {
    const { getByText } = render(() => (
      <FormGroup title="Title" description="Some description"><span>content</span></FormGroup>
    ));
    expect(getByText("Some description")).toBeTruthy();
  });

  it("wraps content in a Card component", () => {
    const { container } = render(() => (
      <FormGroup><span>content</span></FormGroup>
    ));
    expect(container.querySelector("[data-testid='ui-card']")).toBeTruthy();
  });
});

describe("Select", () => {
  const options = [
    { value: "a", label: "Option A" },
    { value: "b", label: "Option B" },
    { value: "c", label: "Option C" },
  ];

  it("renders all options", () => {
    const { getByText } = render(() => (
      <Select value="a" onChange={() => {}} options={options} />
    ));
    expect(getByText("Option A")).toBeTruthy();
    expect(getByText("Option B")).toBeTruthy();
    expect(getByText("Option C")).toBeTruthy();
  });

  it("selects the current value", () => {
    const { container } = render(() => (
      <Select value="b" onChange={() => {}} options={options} />
    ));
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("b");
  });

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <Select value="a" onChange={onChange} options={options} />
    ));
    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "c" } });
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("renders placeholder option when provided", () => {
    const { getByText } = render(() => (
      <Select value="" onChange={() => {}} options={options} placeholder="Choose..." />
    ));
    expect(getByText("Choose...")).toBeTruthy();
  });

  it("renders label when provided", () => {
    const { getByText } = render(() => (
      <Select value="a" onChange={() => {}} options={options} label="Pick one" />
    ));
    expect(getByText("Pick one")).toBeTruthy();
  });

  it("renders error message when provided", () => {
    const { getByText } = render(() => (
      <Select value="a" onChange={() => {}} options={options} error="Required" />
    ));
    expect(getByText("Required")).toBeTruthy();
  });

  it("renders description when provided and no error", () => {
    const { getByText } = render(() => (
      <Select value="a" onChange={() => {}} options={options} description="Help text" />
    ));
    expect(getByText("Help text")).toBeTruthy();
  });

  it("applies disabled attribute", () => {
    const { container } = render(() => (
      <Select value="a" onChange={() => {}} options={options} disabled />
    ));
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});

describe("RadioGroup", () => {
  const options = [
    { value: "opt1", label: "Option 1" },
    { value: "opt2", label: "Option 2", description: "Second option" },
  ];

  it("renders all radio options", () => {
    const { getByText } = render(() => (
      <RadioGroup value="opt1" onChange={() => {}} options={options} name="test" />
    ));
    expect(getByText("Option 1")).toBeTruthy();
    expect(getByText("Option 2")).toBeTruthy();
  });

  it("renders option descriptions", () => {
    const { getByText } = render(() => (
      <RadioGroup value="opt1" onChange={() => {}} options={options} name="test" />
    ));
    expect(getByText("Second option")).toBeTruthy();
  });

  it("marks selected option with aria-checked", () => {
    const { container } = render(() => (
      <RadioGroup value="opt1" onChange={() => {}} options={options} name="test" />
    ));
    const radios = container.querySelectorAll("[role='radio']");
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
    expect(radios[1].getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange on click", () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <RadioGroup value="opt1" onChange={onChange} options={options} name="test" />
    ));
    const radios = container.querySelectorAll("[role='radio']");
    fireEvent.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith("opt2");
  });

  it("renders label when provided", () => {
    const { getByText } = render(() => (
      <RadioGroup value="opt1" onChange={() => {}} options={options} name="test" label="Choose" />
    ));
    expect(getByText("Choose")).toBeTruthy();
  });
});

describe("Checkbox", () => {
  it("renders with label", () => {
    const { container } = render(() => (
      <Checkbox checked={false} onChange={() => {}} label="Enable feature" />
    ));
    expect(container.textContent).toContain("Enable feature");
  });

  it("reflects checked state", () => {
    const { container } = render(() => (
      <Checkbox checked={true} onChange={() => {}} />
    ));
    const input = container.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(input.checked).toBe(true);
  });
});

describe("Toggle", () => {
  it("renders toggle switch", () => {
    const { container } = render(() => (
      <Toggle checked={false} onChange={() => {}} />
    ));
    expect(container.querySelector("[role='switch']")).toBeTruthy();
  });

  it("reflects checked state via aria-checked", () => {
    const { container } = render(() => (
      <Toggle checked={true} onChange={() => {}} />
    ));
    const toggle = container.querySelector("[role='switch']");
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
  });

  it("calls onChange when clicked", () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <Toggle checked={false} onChange={onChange} />
    ));
    const toggle = container.querySelector("[role='switch']") as HTMLElement;
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Button", () => {
  it("renders button with children", () => {
    const { getByText } = render(() => <Button>Save</Button>);
    expect(getByText("Save")).toBeTruthy();
  });

  it("calls onClick handler", () => {
    const onClick = vi.fn();
    const { getByText } = render(() => <Button onClick={onClick}>Click me</Button>);
    fireEvent.click(getByText("Click me"));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("Kbd", () => {
  it("renders keyboard shortcut text", () => {
    const { container } = render(() => <Kbd>Ctrl+S</Kbd>);
    const kbd = container.querySelector("kbd");
    expect(kbd).toBeTruthy();
    expect(kbd?.textContent).toBe("Ctrl+S");
  });

  it("renders with monospace font styling", () => {
    const { container } = render(() => <Kbd>Esc</Kbd>);
    const kbd = container.querySelector("kbd");
    expect(kbd?.style.fontFamily).toContain("code");
  });
});

describe("InfoBox", () => {
  it("renders children content", () => {
    const { getByText } = render(() => (
      <InfoBox><span>Important info</span></InfoBox>
    ));
    expect(getByText("Important info")).toBeTruthy();
  });

  it("renders title when provided", () => {
    const { getByText } = render(() => (
      <InfoBox title="Warning"><span>content</span></InfoBox>
    ));
    expect(getByText("Warning")).toBeTruthy();
  });

  it("defaults to info variant", () => {
    const { container } = render(() => (
      <InfoBox><span>info</span></InfoBox>
    ));
    expect(container.querySelector("[data-testid='ui-card']")).toBeTruthy();
  });
});

describe("OptionCard", () => {
  it("renders title", () => {
    const { getByText } = render(() => (
      <OptionCard selected={false} onSelect={() => {}} title="Option A" />
    ));
    expect(getByText("Option A")).toBeTruthy();
  });

  it("renders description when provided", () => {
    const { getByText } = render(() => (
      <OptionCard selected={false} onSelect={() => {}} title="A" description="Description text" />
    ));
    expect(getByText("Description text")).toBeTruthy();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const { getByText } = render(() => (
      <OptionCard selected={false} onSelect={onSelect} title="Click me" />
    ));
    fireEvent.click(getByText("Click me"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("does not call onSelect when disabled", () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <OptionCard selected={false} onSelect={onSelect} title="Disabled" disabled />
    ));
    const card = container.firstElementChild as HTMLElement;
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows check icon when selected", () => {
    const { container } = render(() => (
      <OptionCard selected={true} onSelect={() => {}} title="Selected" />
    ));
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});

describe("FormActions", () => {
  it("renders children", () => {
    const { getByText } = render(() => (
      <FormActions><button>Save</button></FormActions>
    ));
    expect(getByText("Save")).toBeTruthy();
  });
});

describe("PasswordInput", () => {
  it("renders as password type by default", () => {
    const { container } = render(() => <PasswordInput />);
    const input = container.querySelector("input");
    expect(input?.type).toBe("password");
  });

  it("toggles to text type when show button clicked", () => {
    const { container } = render(() => <PasswordInput />);
    const toggleBtn = container.querySelector("button.form-password-toggle") as HTMLElement;
    expect(toggleBtn).toBeTruthy();
    fireEvent.click(toggleBtn);
    const input = container.querySelector("input");
    expect(input?.type).toBe("text");
  });
});
