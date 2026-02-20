import { JSX, Show, For, createSignal, createEffect } from "solid-js";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Input";
import { useTasks, type TaskInputPickOption } from "@/context/TasksContext";

function normalizeOption(opt: string | TaskInputPickOption): TaskInputPickOption {
  if (typeof opt === "string") {
    return { label: opt, value: opt };
  }
  return opt;
}

export function TaskInputDialog() {
  const tasks = useTasks();
  const [value, setValue] = createSignal("");
  const [hoveredIndex, setHoveredIndex] = createSignal(-1);
  const [commandOptions, _setCommandOptions] = createSignal<TaskInputPickOption[]>([]);
  const [commandLoading, setCommandLoading] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;

  const prompt = () => tasks.state.currentInputPrompt;
  const input = () => prompt()?.input;
  const isOpen = () => tasks.state.showInputPrompt;
  const isPromptString = () => input()?.type === "promptString";
  const isPickString = () => input()?.type === "pickString";
  const isCommand = () => input()?.type === "command";

  createEffect(() => {
    const currentInput = input();
    if (isOpen() && currentInput) {
      setValue(currentInput.default ?? "");
      setHoveredIndex(-1);
      setTimeout(() => inputRef?.focus(), 10);
      if (currentInput.type === "command" && currentInput.command) {
        loadCommandOptions(currentInput.command);
      }
    }
  });

  const handleCancel = () => {
    tasks.resolveInputPrompt(null);
  };

  const handleSubmit = () => {
    if (isPromptString()) {
      tasks.resolveInputPrompt(value());
    }
  };

  const handlePickOption = (opt: TaskInputPickOption) => {
    tasks.resolveInputPrompt(opt.value);
  };

  const loadCommandOptions = async (command: string) => {
    setCommandLoading(true);
    try {
      window.dispatchEvent(
        new CustomEvent("tasks:resolve-command-input", {
          detail: { command },
        })
      );
    } catch {
      console.debug("Failed to resolve command input");
    } finally {
      setCommandLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && isPromptString()) {
      e.preventDefault();
      handleSubmit();
    }

    if (isPickString()) {
      const options = normalizedOptions();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHoveredIndex((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHoveredIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = hoveredIndex();
        if (idx >= 0 && idx < options.length) {
          handlePickOption(options[idx]);
        }
      }
    }

    if (isCommand()) {
      const options = commandOptions();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHoveredIndex((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHoveredIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = hoveredIndex();
        if (idx >= 0 && idx < options.length) {
          handlePickOption(options[idx]);
        }
      }
    }
  };

  const normalizedOptions = (): TaskInputPickOption[] => {
    const opts = input()?.options;
    if (!opts) return [];
    return opts.map(normalizeOption);
  };

  const dialogTitle = () => {
    const taskLabel = prompt()?.taskLabel;
    const desc = input()?.description;
    if (taskLabel && desc) return `${taskLabel}: ${desc}`;
    return taskLabel ?? desc ?? "Input Required";
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--cortex-text-secondary)",
    "margin-bottom": "12px",
  };

  const optionListStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "2px",
    "max-height": "280px",
    "overflow-y": "auto",
  };

  const optionBaseStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    padding: "8px 12px",
    "border-radius": "var(--cortex-radius-md)",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    "text-align": "left",
    transition: "background var(--cortex-transition-fast)",
  };

  const optionLabelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    color: "var(--cortex-text-primary)",
  };

  const optionDescStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--cortex-text-inactive)",
    "margin-top": "2px",
  };

  const footerButtonBase: JSX.CSSProperties = {
    padding: "6px 16px",
    "border-radius": "var(--cortex-radius-md)",
    "font-size": "13px",
    cursor: "pointer",
    border: "none",
    transition: "background var(--cortex-transition-fast)",
  };

  const cancelButtonStyle: JSX.CSSProperties = {
    ...footerButtonBase,
    background: "transparent",
    color: "var(--cortex-text-secondary)",
  };

  const submitButtonStyle: JSX.CSSProperties = {
    ...footerButtonBase,
    background: "var(--cortex-accent-primary)",
    color: "var(--cortex-text-on-accent)",
  };

  const footer = () => (
    <Show when={isPromptString()}>
      <div style={{ display: "flex", gap: "8px", "justify-content": "flex-end" }}>
        <button
          style={cancelButtonStyle}
          onClick={handleCancel}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cortex-bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          Cancel
        </button>
        <button
          style={submitButtonStyle}
          onClick={handleSubmit}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--cortex-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--cortex-accent-primary)")}
        >
          OK
        </button>
      </div>
    </Show>
  );

  return (
    <Modal
      open={isOpen()}
      onClose={handleCancel}
      title={dialogTitle()}
      size="sm"
      closeOnEscape={true}
      closeOnOverlay={true}
      footer={footer()}
    >
      <div onKeyDown={handleKeyDown}>
        <Show when={isPromptString()}>
          <Show when={input()?.description}>
            <p style={descriptionStyle}>{input()!.description}</p>
          </Show>
          <Input
            ref={inputRef}
            type={input()?.password ? "password" : "text"}
            value={value()}
            onInput={(e) => setValue(e.currentTarget.value)}
            placeholder={input()?.description ?? "Enter value..."}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </Show>

        <Show when={isPickString()}>
          <Show when={input()?.description}>
            <p style={descriptionStyle}>{input()!.description}</p>
          </Show>
          <div style={optionListStyle}>
            <For each={normalizedOptions()}>
              {(opt, index) => {
                const isDefault = () => opt.value === input()?.default;
                const isHovered = () => hoveredIndex() === index();

                return (
                  <button
                    style={{
                      ...optionBaseStyle,
                      background: isHovered()
                        ? "var(--cortex-bg-hover)"
                        : "transparent",
                    }}
                    onMouseEnter={() => setHoveredIndex(index())}
                    onMouseLeave={() => setHoveredIndex(-1)}
                    onClick={() => handlePickOption(opt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handlePickOption(opt);
                      }
                    }}
                  >
                    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                      <span style={optionLabelStyle}>{opt.label}</span>
                      <Show when={isDefault()}>
                        <span
                          style={{
                            "font-size": "10px",
                            padding: "1px 6px",
                            "border-radius": "var(--cortex-radius-sm)",
                            background: "var(--cortex-accent-primary)20",
                            color: "var(--cortex-accent-primary)",
                          }}
                        >
                          default
                        </span>
                      </Show>
                      <Show when={isHovered()}>
                        <Icon
                          name="chevron-right"
                          class="w-3 h-3"
                          style={{ color: "var(--cortex-text-inactive)", "margin-left": "auto" }}
                        />
                      </Show>
                    </div>
                    <Show when={opt.description}>
                      <span style={optionDescStyle}>{opt.description}</span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </Show>

        <Show when={isCommand()}>
          <Show when={input()?.description}>
            <p style={descriptionStyle}>{input()!.description}</p>
          </Show>
          <Show
            when={!commandLoading()}
            fallback={
              <div style={{ padding: "16px", "text-align": "center", color: "var(--cortex-text-muted)" }}>
                Loading options...
              </div>
            }
          >
            <div style={optionListStyle}>
              <For each={commandOptions()}>
                {(opt, index) => {
                  const isHovered = () => hoveredIndex() === index();
                  return (
                    <button
                      style={{
                        ...optionBaseStyle,
                        background: isHovered() ? "var(--cortex-bg-hover)" : "transparent",
                      }}
                      onMouseEnter={() => setHoveredIndex(index())}
                      onMouseLeave={() => setHoveredIndex(-1)}
                      onClick={() => handlePickOption(opt)}
                    >
                      <span style={optionLabelStyle}>{opt.label}</span>
                      <Show when={opt.description}>
                        <span style={optionDescStyle}>{opt.description}</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </Show>
      </div>
    </Modal>
  );
}
