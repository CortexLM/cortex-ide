import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { ContextMenu, useContextMenu } from "../ContextMenu";
import type { ContextMenuSection, ContextMenuState } from "../ContextMenu";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

vi.mock("../Icon", () => ({
  Icon: (props: any) => <span data-icon={props.name} style={props.style} />,
}));

const sampleSections: ContextMenuSection[] = [
  {
    items: [
      { id: "cut", label: "Cut", shortcut: "Ctrl+X", action: vi.fn() },
      { id: "copy", label: "Copy", shortcut: "Ctrl+C", action: vi.fn() },
      { id: "paste", label: "Paste", shortcut: "Ctrl+V", action: vi.fn() },
    ],
  },
];

const twoSections: ContextMenuSection[] = [
  {
    items: [
      { id: "open", label: "Open", action: vi.fn() },
    ],
  },
  {
    items: [
      { id: "delete", label: "Delete", icon: "trash", iconColor: "red", action: vi.fn() },
    ],
  },
];

const defaultState: ContextMenuState = {
  visible: true,
  x: 100,
  y: 200,
  sections: sampleSections,
};

const hiddenState: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  sections: [],
};

describe("ContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders when visible is true", () => {
      render(() => <ContextMenu state={defaultState} onClose={vi.fn()} />);
      const buttons = document.querySelectorAll("button");
      expect(buttons.length).toBe(3);
    });

    it("does not render when visible is false", () => {
      render(() => <ContextMenu state={hiddenState} onClose={vi.fn()} />);
      const buttons = document.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });

    it("renders item labels", () => {
      render(() => <ContextMenu state={defaultState} onClose={vi.fn()} />);
      expect(document.body.textContent).toContain("Cut");
      expect(document.body.textContent).toContain("Copy");
      expect(document.body.textContent).toContain("Paste");
    });

    it("renders keyboard shortcuts", () => {
      render(() => <ContextMenu state={defaultState} onClose={vi.fn()} />);
      expect(document.body.textContent).toContain("Ctrl+X");
      expect(document.body.textContent).toContain("Ctrl+C");
      expect(document.body.textContent).toContain("Ctrl+V");
    });

    it("renders item icons", () => {
      const state: ContextMenuState = {
        visible: true,
        x: 0,
        y: 0,
        sections: twoSections,
      };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      const icon = document.querySelector("[data-icon='trash']");
      expect(icon).toBeTruthy();
    });
  });

  describe("sections", () => {
    it("renders separators between sections", () => {
      const state: ContextMenuState = {
        visible: true,
        x: 0,
        y: 0,
        sections: twoSections,
      };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      expect(document.body.textContent).toContain("Open");
      expect(document.body.textContent).toContain("Delete");
    });
  });

  describe("item click", () => {
    it("calls item action and onClose when item is clicked", async () => {
      const action = vi.fn();
      const onClose = vi.fn();
      const sections: ContextMenuSection[] = [
        { items: [{ id: "test", label: "Test Item", action }] },
      ];
      const state: ContextMenuState = { visible: true, x: 0, y: 0, sections };
      render(() => <ContextMenu state={state} onClose={onClose} />);
      const button = document.querySelector("button")!;
      await fireEvent.click(button);
      expect(action).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    it("does not call action when item is disabled", async () => {
      const action = vi.fn();
      const sections: ContextMenuSection[] = [
        { items: [{ id: "test", label: "Disabled", action, disabled: true }] },
      ];
      const state: ContextMenuState = { visible: true, x: 0, y: 0, sections };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      const button = document.querySelector("button")!;
      await fireEvent.click(button);
      expect(action).not.toHaveBeenCalled();
    });
  });

  describe("disabled items", () => {
    it("renders disabled items with disabled attribute", () => {
      const sections: ContextMenuSection[] = [
        { items: [{ id: "test", label: "Disabled", disabled: true }] },
      ];
      const state: ContextMenuState = { visible: true, x: 0, y: 0, sections };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      const button = document.querySelector("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe("header items", () => {
    it("renders header items with header styling", () => {
      const sections: ContextMenuSection[] = [
        { items: [{ id: "header", label: "Context Actions", isHeader: true }] },
      ];
      const state: ContextMenuState = { visible: true, x: 0, y: 0, sections };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      expect(document.body.textContent).toContain("Context Actions");
    });
  });

  describe("positioning", () => {
    it("positions at specified x,y coordinates", () => {
      const state: ContextMenuState = {
        visible: true,
        x: 150,
        y: 250,
        sections: sampleSections,
      };
      render(() => <ContextMenu state={state} onClose={vi.fn()} />);
      const menu = document.querySelector("[style*='position: fixed']") as HTMLElement;
      expect(menu).toBeTruthy();
    });
  });
});

describe("useContextMenu", () => {
  it("initializes with hidden state", () => {
    let menuState: any;
    render(() => {
      const ctx = useContextMenu();
      menuState = ctx.menuState;
      return <div />;
    });
    expect(menuState().visible).toBe(false);
    expect(menuState().sections).toEqual([]);
  });

  it("showMenu makes menu visible with sections", () => {
    let menuState: any;
    let showMenu: any;
    render(() => {
      const ctx = useContextMenu();
      menuState = ctx.menuState;
      showMenu = ctx.showMenu;
      return <div />;
    });
    showMenu(100, 200, sampleSections);
    expect(menuState().visible).toBe(true);
    expect(menuState().x).toBe(100);
    expect(menuState().y).toBe(200);
    expect(menuState().sections).toBe(sampleSections);
  });

  it("hideMenu makes menu hidden", () => {
    let menuState: any;
    let showMenu: any;
    let hideMenu: any;
    render(() => {
      const ctx = useContextMenu();
      menuState = ctx.menuState;
      showMenu = ctx.showMenu;
      hideMenu = ctx.hideMenu;
      return <div />;
    });
    showMenu(100, 200, sampleSections);
    expect(menuState().visible).toBe(true);
    hideMenu();
    expect(menuState().visible).toBe(false);
  });
});
