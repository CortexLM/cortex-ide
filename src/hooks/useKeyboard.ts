import { onMount, onCleanup } from "solid-js";

type KeyboardHandler = (event: KeyboardEvent) => void;

interface KeyboardOptions {
  onNewSession?: () => void;
  onCommandPalette?: () => void;
  onToggleSidebar?: () => void;
  onEscape?: () => void;
  onFocusPrompt?: () => void;
}

export function useKeyboard(options: KeyboardOptions) {
  const handleKeyDown = (event: KeyboardEvent) => {
    const { key, ctrlKey, metaKey } = event;
    const mod = ctrlKey || metaKey;

    if (mod && key === "n") {
      event.preventDefault();
      options.onNewSession?.();
    }

    if (mod && key === "k") {
      event.preventDefault();
      options.onCommandPalette?.();
    }

    if (mod && key === "b") {
      event.preventDefault();
      options.onToggleSidebar?.();
    }

    if (key === "Escape") {
      options.onEscape?.();
    }

    if (key === "/" && !isInputFocused()) {
      event.preventDefault();
      options.onFocusPrompt?.();
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}

function isInputFocused(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  
  const tagName = active.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || 
         (active as HTMLElement).isContentEditable;
}

export function createKeyboardShortcut(
  key: string,
  callback: KeyboardHandler,
  options: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  const handleKeyDown = (event: KeyboardEvent) => {
    const ctrlMatch = options.ctrl ? event.ctrlKey : !event.ctrlKey;
    const metaMatch = options.meta ? event.metaKey : !event.metaKey;
    const shiftMatch = options.shift ? event.shiftKey : !event.shiftKey;
    const altMatch = options.alt ? event.altKey : !event.altKey;

    if (
      event.key.toLowerCase() === key.toLowerCase() &&
      ctrlMatch &&
      metaMatch &&
      shiftMatch &&
      altMatch
    ) {
      event.preventDefault();
      callback(event);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}
