/**
 * Test Utilities - SolidJS testing helpers for Cortex IDE
 * 
 * Provides utilities for rendering and testing SolidJS components:
 * - render: Render component with optional providers
 * - cleanup: Clean up rendered components
 * - fireEvent: Simulate DOM events
 * - screen: Query helpers for finding elements
 * - createTestContext: Create mock context providers
 */

import { JSX, createSignal, ParentProps } from "solid-js";
import { render as solidRender } from "solid-js/web";
import { vi } from "vitest";

// Re-export setup utilities
export { 
  createMockMonaco, 
  createMockMonacoEditor,
  waitFor,
  nextTick,
  delay,
  createKeyboardEvent,
  createMouseEvent,
} from "./setup";

// ============================================================================
// Types
// ============================================================================

interface RenderOptions {
  /** Container element to render into */
  container?: HTMLElement;
  /** Base element for queries */
  baseElement?: HTMLElement;
  /** Wrapper component for providers */
  wrapper?: (props: ParentProps) => JSX.Element;
}

interface RenderResult {
  /** The container element */
  container: HTMLElement;
  /** The base element for queries */
  baseElement: HTMLElement;
  /** Unmount the component */
  unmount: () => void;
  /** Re-render with new component */
  rerender: (component: () => JSX.Element) => void;
  /** Debug helper - logs the DOM */
  debug: () => void;
  /** Query helpers */
  getByTestId: (id: string) => HTMLElement;
  queryByTestId: (id: string) => HTMLElement | null;
  getAllByTestId: (id: string) => HTMLElement[];
  getByText: (text: string | RegExp) => HTMLElement;
  queryByText: (text: string | RegExp) => HTMLElement | null;
  getAllByText: (text: string | RegExp) => HTMLElement[];
  getByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement;
  queryByRole: (role: string, options?: { name?: string | RegExp }) => HTMLElement | null;
  getByLabelText: (text: string | RegExp) => HTMLElement;
  queryByLabelText: (text: string | RegExp) => HTMLElement | null;
  getByPlaceholderText: (text: string | RegExp) => HTMLElement;
  queryByPlaceholderText: (text: string | RegExp) => HTMLElement | null;
}

// ============================================================================
// Cleanup Registry
// ============================================================================

const cleanupFns: Set<() => void> = new Set();

/**
 * Clean up all rendered components
 */
export function cleanup(): void {
  cleanupFns.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  });
  cleanupFns.clear();
}

// ============================================================================
// Query Helpers
// ============================================================================

function createQueryHelpers(container: HTMLElement) {
  const getByTestId = (id: string): HTMLElement => {
    const el = container.querySelector(`[data-testid="${id}"]`);
    if (!el) throw new Error(`Unable to find element with data-testid="${id}"`);
    return el as HTMLElement;
  };

  const queryByTestId = (id: string): HTMLElement | null => {
    return container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  };

  const getAllByTestId = (id: string): HTMLElement[] => {
    return Array.from(container.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
  };

  const matchText = (el: Element, text: string | RegExp): boolean => {
    const content = el.textContent || "";
    if (typeof text === "string") {
      return content.includes(text);
    }
    return text.test(content);
  };

  const getByText = (text: string | RegExp): HTMLElement => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node instanceof HTMLElement && matchText(node, text)) {
        return node;
      }
    }
    throw new Error(`Unable to find element with text: ${text}`);
  };

  const queryByText = (text: string | RegExp): HTMLElement | null => {
    try {
      return getByText(text);
    } catch {
      return null;
    }
  };

  const getAllByText = (text: string | RegExp): HTMLElement[] => {
    const results: HTMLElement[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node instanceof HTMLElement && matchText(node, text)) {
        results.push(node);
      }
    }
    return results;
  };

  const getByRole = (role: string, options?: { name?: string | RegExp }): HTMLElement => {
    const selector = `[role="${role}"]`;
    const elements = container.querySelectorAll(selector);
    
    // Also check implicit roles (button, input, etc.)
    const implicitRoleMap: Record<string, string[]> = {
      button: ["button", "input[type='button']", "input[type='submit']"],
      textbox: ["input[type='text']", "input:not([type])", "textarea"],
      checkbox: ["input[type='checkbox']"],
      radio: ["input[type='radio']"],
      link: ["a[href]"],
      heading: ["h1", "h2", "h3", "h4", "h5", "h6"],
      list: ["ul", "ol"],
      listitem: ["li"],
      img: ["img"],
    };

    const allElements: HTMLElement[] = [...Array.from(elements)] as HTMLElement[];
    
    if (implicitRoleMap[role]) {
      implicitRoleMap[role].forEach((sel) => {
        container.querySelectorAll(sel).forEach((el) => {
          if (!allElements.includes(el as HTMLElement)) {
            allElements.push(el as HTMLElement);
          }
        });
      });
    }

    for (const el of allElements) {
      if (options?.name) {
        const name = el.getAttribute("aria-label") || el.textContent || "";
        if (typeof options.name === "string") {
          if (name.includes(options.name)) return el;
        } else if (options.name.test(name)) {
          return el;
        }
      } else {
        return el;
      }
    }

    throw new Error(`Unable to find element with role="${role}"${options?.name ? ` and name="${options.name}"` : ""}`);
  };

  const queryByRole = (role: string, options?: { name?: string | RegExp }): HTMLElement | null => {
    try {
      return getByRole(role, options);
    } catch {
      return null;
    }
  };

  const getByLabelText = (text: string | RegExp): HTMLElement => {
    const labels = container.querySelectorAll("label");
    for (const label of labels) {
      if (matchText(label, text)) {
        const forId = label.getAttribute("for");
        if (forId) {
          const input = container.querySelector(`#${forId}`);
          if (input) return input as HTMLElement;
        }
        // Check for nested input
        const nestedInput = label.querySelector("input, textarea, select");
        if (nestedInput) return nestedInput as HTMLElement;
      }
    }
    
    // Check aria-label
    const ariaLabelElements = container.querySelectorAll("[aria-label]");
    for (const el of ariaLabelElements) {
      const ariaLabel = el.getAttribute("aria-label") || "";
      if (typeof text === "string" ? ariaLabel.includes(text) : text.test(ariaLabel)) {
        return el as HTMLElement;
      }
    }

    throw new Error(`Unable to find element with label text: ${text}`);
  };

  const queryByLabelText = (text: string | RegExp): HTMLElement | null => {
    try {
      return getByLabelText(text);
    } catch {
      return null;
    }
  };

  const getByPlaceholderText = (text: string | RegExp): HTMLElement => {
    const elements = container.querySelectorAll("[placeholder]");
    for (const el of elements) {
      const placeholder = el.getAttribute("placeholder") || "";
      if (typeof text === "string" ? placeholder.includes(text) : text.test(placeholder)) {
        return el as HTMLElement;
      }
    }
    throw new Error(`Unable to find element with placeholder text: ${text}`);
  };

  const queryByPlaceholderText = (text: string | RegExp): HTMLElement | null => {
    try {
      return getByPlaceholderText(text);
    } catch {
      return null;
    }
  };

  return {
    getByTestId,
    queryByTestId,
    getAllByTestId,
    getByText,
    queryByText,
    getAllByText,
    getByRole,
    queryByRole,
    getByLabelText,
    queryByLabelText,
    getByPlaceholderText,
    queryByPlaceholderText,
  };
}

// ============================================================================
// Render Function
// ============================================================================

/**
 * Render a SolidJS component for testing
 */
export function render(
  component: () => JSX.Element,
  options: RenderOptions = {}
): RenderResult {
  const {
    container = document.body.appendChild(document.createElement("div")),
    baseElement = document.body,
    wrapper,
  } = options;

  let dispose: () => void;

  const wrappedComponent = wrapper
    ? () => wrapper({ children: component() })
    : component;

  dispose = solidRender(wrappedComponent, container);

  const unmount = () => {
    dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  cleanupFns.add(unmount);

  const rerender = (newComponent: () => JSX.Element) => {
    dispose();
    container.innerHTML = "";
    const wrapped = wrapper
      ? () => wrapper({ children: newComponent() })
      : newComponent;
    dispose = solidRender(wrapped, container);
  };

  const debug = () => {
    console.log(container.innerHTML);
  };

  return {
    container,
    baseElement,
    unmount,
    rerender,
    debug,
    ...createQueryHelpers(container),
  };
}

// ============================================================================
// Fire Event Helpers
// ============================================================================

export const fireEvent = {
  click: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...options }));
  },
  
  dblClick: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, ...options }));
  },
  
  mouseDown: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, ...options }));
  },
  
  mouseUp: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, ...options }));
  },
  
  mouseEnter: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true, cancelable: true, ...options }));
  },
  
  mouseLeave: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true, cancelable: true, ...options }));
  },
  
  mouseMove: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, cancelable: true, ...options }));
  },
  
  focus: (element: Element) => {
    element.dispatchEvent(new FocusEvent("focus", { bubbles: true, cancelable: true }));
    if (element instanceof HTMLElement) element.focus();
  },
  
  blur: (element: Element) => {
    element.dispatchEvent(new FocusEvent("blur", { bubbles: true, cancelable: true }));
    if (element instanceof HTMLElement) element.blur();
  },
  
  keyDown: (element: Element, options?: KeyboardEventInit) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...options }));
  },
  
  keyUp: (element: Element, options?: KeyboardEventInit) => {
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...options }));
  },
  
  keyPress: (element: Element, options?: KeyboardEventInit) => {
    element.dispatchEvent(new KeyboardEvent("keypress", { bubbles: true, cancelable: true, ...options }));
  },
  
  input: (element: Element, options?: InputEventInit) => {
    element.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, ...options }));
  },
  
  change: (element: Element) => {
    element.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
  },
  
  submit: (element: Element) => {
    element.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  },
  
  scroll: (element: Element) => {
    element.dispatchEvent(new Event("scroll", { bubbles: true, cancelable: true }));
  },
  
  resize: (element: Element) => {
    element.dispatchEvent(new Event("resize", { bubbles: true, cancelable: true }));
  },
  
  dragStart: (element: Element, options?: DragEventInit) => {
    element.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, ...options }));
  },
  
  dragEnd: (element: Element, options?: DragEventInit) => {
    element.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true, ...options }));
  },
  
  drop: (element: Element, options?: DragEventInit) => {
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, ...options }));
  },
  
  paste: (element: Element, data?: string) => {
    const clipboardData = new DataTransfer();
    if (data) clipboardData.setData("text/plain", data);
    element.dispatchEvent(new ClipboardEvent("paste", { 
      bubbles: true, 
      cancelable: true, 
      clipboardData 
    }));
  },
  
  copy: (element: Element) => {
    element.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true }));
  },
  
  cut: (element: Element) => {
    element.dispatchEvent(new ClipboardEvent("cut", { bubbles: true, cancelable: true }));
  },
  
  contextMenu: (element: Element, options?: MouseEventInit) => {
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, ...options }));
  },
  
  wheel: (element: Element, options?: WheelEventInit) => {
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...options }));
  },
  
  touchStart: (element: Element, options?: TouchEventInit) => {
    element.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, ...options }));
  },
  
  touchEnd: (element: Element, options?: TouchEventInit) => {
    element.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, ...options }));
  },
  
  touchMove: (element: Element, options?: TouchEventInit) => {
    element.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, ...options }));
  },
};

// ============================================================================
// Screen Object (Global Query Helpers)
// ============================================================================

export const screen = {
  ...createQueryHelpers(document.body),
  debug: () => console.log(document.body.innerHTML),
};

// ============================================================================
// User Event Helpers
// ============================================================================

/**
 * Type text into an input element
 */
export async function type(element: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
  element.focus();
  
  for (const char of text) {
    // Simulate keydown
    element.dispatchEvent(new KeyboardEvent("keydown", { 
      key: char, 
      code: `Key${char.toUpperCase()}`,
      bubbles: true 
    }));
    
    // Update value
    element.value += char;
    
    // Simulate input event
    element.dispatchEvent(new InputEvent("input", { 
      data: char, 
      inputType: "insertText",
      bubbles: true 
    }));
    
    // Simulate keyup
    element.dispatchEvent(new KeyboardEvent("keyup", { 
      key: char, 
      code: `Key${char.toUpperCase()}`,
      bubbles: true 
    }));
    
    // Small delay for realistic typing
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Clear an input element
 */
export function clear(element: HTMLInputElement | HTMLTextAreaElement): void {
  element.focus();
  element.value = "";
  element.dispatchEvent(new InputEvent("input", { 
    inputType: "deleteContentBackward",
    bubbles: true 
  }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Select an option from a select element
 */
export function selectOption(element: HTMLSelectElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

// ============================================================================
// Mock Context Providers
// ============================================================================

/**
 * Create a mock theme context
 */
export function createMockThemeContext() {
  const [theme, setTheme] = createSignal<"light" | "dark">("dark");
  
  return {
    theme,
    setTheme,
    isDark: () => theme() === "dark",
    toggleTheme: () => setTheme(theme() === "dark" ? "light" : "dark"),
  };
}

/**
 * Create a mock debug context
 */
export function createMockDebugContext() {
  const [isDebugging, setIsDebugging] = createSignal(false);
  const [isPaused, setIsPaused] = createSignal(false);
  const [breakpoints, setBreakpoints] = createSignal<any[]>([]);
  const [variables, setVariables] = createSignal<any[]>([]);
  const [callStack, setCallStack] = createSignal<any[]>([]);
  
  return {
    isDebugging,
    setIsDebugging,
    isPaused,
    setIsPaused,
    breakpoints,
    setBreakpoints,
    variables,
    setVariables,
    callStack,
    setCallStack,
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    continue: vi.fn(),
    stepOver: vi.fn(),
    stepInto: vi.fn(),
    stepOut: vi.fn(),
    evaluate: vi.fn().mockResolvedValue({ result: "test", variablesReference: 0 }),
    addBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    toggleBreakpoint: vi.fn(),
  };
}

/**
 * Create a mock search context
 */
export function createMockSearchContext() {
  const [query, setQuery] = createSignal("");
  const [results, setResults] = createSignal<any[]>([]);
  const [isSearching, setIsSearching] = createSignal(false);
  const [currentMatch, setCurrentMatch] = createSignal(0);
  
  return {
    query,
    setQuery,
    results,
    setResults,
    isSearching,
    setIsSearching,
    currentMatch,
    setCurrentMatch,
    totalMatches: () => results().length,
    search: vi.fn(),
    replace: vi.fn(),
    replaceAll: vi.fn(),
    clear: vi.fn(),
    nextMatch: vi.fn(),
    prevMatch: vi.fn(),
  };
}

/**
 * Create a mock terminal context
 */
export function createMockTerminalContext() {
  const [terminals, setTerminals] = createSignal<any[]>([]);
  const [activeTerminal, setActiveTerminal] = createSignal<string | null>(null);
  
  return {
    terminals,
    setTerminals,
    activeTerminal,
    setActiveTerminal,
    createTerminal: vi.fn().mockReturnValue("terminal-1"),
    closeTerminal: vi.fn(),
    sendInput: vi.fn(),
    clear: vi.fn(),
  };
}

// ============================================================================
// Test Wrapper Components
// ============================================================================

/**
 * Create a test wrapper with common providers
 */
export function createTestWrapper(_options: {
  theme?: ReturnType<typeof createMockThemeContext>;
  debug?: ReturnType<typeof createMockDebugContext>;
  search?: ReturnType<typeof createMockSearchContext>;
  terminal?: ReturnType<typeof createMockTerminalContext>;
} = {}) {
  return function TestWrapper(props: ParentProps) {
    return <>{props.children}</>;
  };
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Check if an element is visible
 */
export function isVisible(element: HTMLElement): boolean {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    element.offsetParent !== null
  );
}

/**
 * Check if an element has focus
 */
export function hasFocus(element: HTMLElement): boolean {
  return document.activeElement === element;
}

/**
 * Check if an element contains text
 */
export function containsText(element: HTMLElement, text: string): boolean {
  return (element.textContent || "").includes(text);
}

/**
 * Get the value of an input element
 */
export function getValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
  return element.value;
}
