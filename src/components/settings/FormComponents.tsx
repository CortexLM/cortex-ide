import { JSX, Show, splitProps, createSignal } from "solid-js";
import { 
  Input as UIInput, 
  Text, 
  Card, 
  Button as UIButton, 
  Toggle as UIToggle,
  Checkbox as UICheckbox,
} from "@/components/ui";
import { tokens } from '@/design-system/tokens';

// ============================================================================
// FORM INPUT COMPONENT
// Clean input with 36-40px height, subtle border, accent focus
// Re-exports UI Input component with additional form field styling
// ============================================================================

interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
  icon?: JSX.Element;
  suffix?: JSX.Element;
}

export function Input(props: InputProps) {
  const [local, inputProps] = splitProps(props, [
    "label",
    "description",
    "error",
    "icon",
    "suffix",
    "class",
  ]);

  return (
    <UIInput
      {...inputProps}
      label={local.label}
      hint={local.description}
      error={local.error}
      icon={local.icon}
      iconRight={local.suffix}
      style={typeof inputProps.style === "object" ? inputProps.style : undefined}
    />
  );
}

// ============================================================================
// PASSWORD INPUT COMPONENT
// Input with show/hide toggle
// ============================================================================

interface PasswordInputProps extends Omit<InputProps, "type" | "suffix"> {
  showPassword?: boolean;
  onToggleShow?: () => void;
}

export function PasswordInput(props: PasswordInputProps) {
  const [local, inputProps] = splitProps(props, ["showPassword", "onToggleShow"]);
  const [internalShow, setInternalShow] = createSignal(false);

  const isVisible = () => local.showPassword ?? internalShow();
  const handleToggle = () => {
    if (local.onToggleShow) {
      local.onToggleShow();
    } else {
      setInternalShow(!internalShow());
    }
  };

  return (
    <Input
      {...inputProps}
      type={isVisible() ? "text" : "password"}
      suffix={
        <button
          type="button"
          onClick={handleToggle}
          class="form-password-toggle"
          tabIndex={-1}
        >
          <Show
            when={isVisible()}
            fallback={
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            }
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Show>
        </button>
      }
    />
  );
}

// ============================================================================
// TOGGLE SWITCH COMPONENT
// 36x20px with smooth animation - uses UI Toggle component
// ============================================================================

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  class?: string;
}

export function Toggle(props: ToggleProps) {
  return (
    <UIToggle
      checked={props.checked}
      onChange={props.onChange}
      label={props.label}
      description={props.description}
      disabled={props.disabled}
      style={props.class ? {} : undefined}
    />
  );
}

// ============================================================================
// SELECT DROPDOWN COMPONENT
// Matches input style with proper arrow icon
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  class?: string;
}

export function Select(props: SelectProps) {
  return (
    <div class="form-field">
      <Show when={props.label}>
        <label class="form-label">{props.label}</label>
      </Show>
      <div class="form-select-wrapper">
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
          disabled={props.disabled}
          class={`form-select ${props.error ? "form-select-error" : ""} ${
            props.class || ""
          }`}
        >
          <Show when={props.placeholder}>
            <option value="" disabled>
              {props.placeholder}
            </option>
          </Show>
          {props.options.map((opt) => (
            <option value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span class="form-select-arrow">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
      <Show when={props.error}>
        <span class="form-error">{props.error}</span>
      </Show>
      <Show when={props.description && !props.error}>
        <span class="form-description">{props.description}</span>
      </Show>
    </div>
  );
}

// ============================================================================
// CHECKBOX COMPONENT
// VS Code spec: 18x18px, 3px border-radius, 9px margin-right
// Uses design tokens from UI system
// ============================================================================

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  class?: string;
}

export function Checkbox(props: CheckboxProps) {
  return (
    <UICheckbox
      checked={props.checked}
      onChange={props.onChange}
      label={props.label}
      description={props.description}
      disabled={props.disabled}
    />
  );
}

// ============================================================================
// RADIO GROUP COMPONENT
// Clean radio button selection
// ============================================================================

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupProps {
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  name: string;
  label?: string;
  disabled?: boolean;
  class?: string;
}

export function RadioGroup(props: RadioGroupProps) {
  return (
    <div class={`form-field ${props.class || ""}`}>
      <Show when={props.label}>
        <span class="form-label">{props.label}</span>
      </Show>
      <div class="form-radio-group" role="radiogroup">
        {props.options.map((opt) => (
          <label
            class={`form-radio-option ${props.value === opt.value ? "form-radio-option-selected" : ""}`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={props.value === opt.value}
              disabled={props.disabled}
              onClick={() => !props.disabled && props.onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!props.disabled) props.onChange(opt.value);
                }
              }}
              class={`form-radio ${props.value === opt.value ? "form-radio-checked" : ""}`}
            >
              <span class="form-radio-dot" />
            </button>
            <div class="form-radio-text">
              <span class="form-radio-label">{opt.label}</span>
              <Show when={opt.description}>
                <span class="form-description">{opt.description}</span>
              </Show>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// BUTTON COMPONENTS
// Primary, Secondary, Danger variants - uses UI Button component
// ============================================================================

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: JSX.Element;
}

export function Button(props: ButtonProps) {
  const [local, buttonProps] = splitProps(props, [
    "variant",
    "size",
    "loading",
    "icon",
    "class",
    "children",
  ]);

  return (
    <UIButton
      {...buttonProps}
      variant={local.variant}
      size={local.size}
      loading={local.loading}
      icon={local.icon}
    >
      {local.children}
    </UIButton>
  );
}

// ============================================================================
// SECTION HEADER COMPONENT
// VS Code spec: Group titles use 26px/22px/18px hierarchy
// Level 1: 18px, Level 2: 15px, Level 3: 13px - all font-weight: 600
// Uses UI Text component for typography
// ============================================================================

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: JSX.Element;
  action?: JSX.Element;
  class?: string;
  /** Title hierarchy level: 1 = 18px, 2 = 15px, 3 = 13px (default) */
  level?: 1 | 2 | 3;
}

export function SectionHeader(props: SectionHeaderProps) {
  // Default to level 3 (13px) for most section headers
  const level = () => props.level || 3;
  
  // Level 1 header (18px)
  const h1Style: JSX.CSSProperties = {
    "font-size": "18px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "16px",
    "margin-top": "24px",
  };

  // Level 2 header (15px)
  const h2Style: JSX.CSSProperties = {
    "font-size": "15px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "12px",
    "margin-top": "20px",
  };

  // Level 3 header (13px)
  const h3Style: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "8px",
    "margin-top": "16px",
  };
  
  // Get style based on level
  const getHeaderStyle = (): JSX.CSSProperties => {
    switch (level()) {
      case 1: return h1Style;
      case 2: return h2Style;
      case 3: 
      default: return h3Style;
    }
  };

  return (
    <div style={{ 
      display: "flex", 
      "justify-content": "space-between", 
      "align-items": "flex-start",
      "margin-bottom": "16px",
    }}>
      <div style={{ display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
        <div style={{ 
          display: "flex", 
          "align-items": "center", 
          gap: tokens.spacing.md,
          "line-height": "1.3",
          ...getHeaderStyle(),
        }}>
          <Show when={props.icon}>
            <span style={{ display: "flex", color: "var(--cortex-text-inactive)" }}>{props.icon}</span>
          </Show>
          <Text as="h3" weight="semibold" style={{ 
            margin: 0, 
            "font-size": "inherit", 
            "font-weight": "inherit",
            color: "inherit",
          }}>
            {props.title}
          </Text>
        </div>
        <Show when={props.description}>
          <Text variant="muted" size="sm" style={{ margin: 0, color: "var(--cortex-text-inactive)" }}>
            {props.description}
          </Text>
        </Show>
      </div>
      <Show when={props.action}>
        <div>{props.action}</div>
      </Show>
    </div>
  );
}

// ============================================================================
// FORM GROUP COMPONENT
// Subtle border/background container - uses UI Card component
// ============================================================================

interface FormGroupProps {
  title?: string;
  description?: string;
  children: JSX.Element;
  class?: string;
  label?: string;
}

export function FormGroup(props: FormGroupProps) {
  const formGroupStyle: JSX.CSSProperties = {
    "margin-bottom": "20px",
  };

  const labelStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "500",
    color: "var(--cortex-text-primary)",
    "margin-bottom": "6px",
    display: "block",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "12px",
    color: "var(--cortex-text-inactive)",
    "margin-top": "4px",
    "line-height": "1.4",
  };

  return (
    <Card variant="outlined" padding="md" style={formGroupStyle}>
      <Show when={props.title || props.label}>
        <div style={{ "margin-bottom": tokens.spacing.lg }}>
          <span style={labelStyle}>
            {props.title || props.label}
          </span>
          <Show when={props.description}>
            <span style={descriptionStyle}>
              {props.description}
            </span>
          </Show>
        </div>
      </Show>
      <div>{props.children}</div>
    </Card>
  );
}

// ============================================================================
// FORM ACTIONS COMPONENT
// Right-aligned button container for save/cancel
// ============================================================================

interface FormActionsProps {
  children: JSX.Element;
  class?: string;
}

export function FormActions(props: FormActionsProps) {
  return <div class={`form-actions ${props.class || ""}`}>{props.children}</div>;
}

// ============================================================================
// OPTION CARD COMPONENT
// Selectable card with checkbox/radio styling - uses UI Card and Text components
// ============================================================================

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  icon?: JSX.Element;
  disabled?: boolean;
  class?: string;
}

export function OptionCard(props: OptionCardProps) {
  const optionCardStyle: JSX.CSSProperties = {
    background: "var(--cortex-bg-hover)",
    border: "1px solid rgba(107, 114, 142, 0.3)",
    "border-radius": "var(--cortex-radius-md)",
    padding: "16px",
    cursor: props.disabled ? "not-allowed" : "pointer",
    transition: "border-color 150ms ease, background 150ms ease",
    display: "flex",
    "align-items": "flex-start",
    gap: tokens.spacing.lg,
    opacity: props.disabled ? "0.5" : "1",
  };

  const selectedCardStyle: JSX.CSSProperties = {
    ...optionCardStyle,
    background: "var(--cortex-bg-primary)",
    border: "1px solid var(--cortex-text-inactive)",
  };

  return (
    <div
      onClick={() => !props.disabled && props.onSelect()}
      style={props.selected ? selectedCardStyle : optionCardStyle}
      onMouseEnter={(e) => {
        if (!props.disabled && !props.selected) {
          e.currentTarget.style.borderColor = "rgba(107, 114, 142, 0.5)";
        }
      }}
      onMouseLeave={(e) => {
        if (!props.disabled && !props.selected) {
          e.currentTarget.style.borderColor = "rgba(107, 114, 142, 0.3)";
        }
      }}
    >
      <div
        style={{
          display: "flex",
          width: "20px",
          height: "20px",
          "align-items": "center",
          "justify-content": "center",
          "border-radius": "var(--cortex-radius-full)",
          border: props.selected ? "1px solid var(--cortex-text-inactive)" : "1px solid rgba(107, 114, 142, 0.4)",
          background: props.selected ? "var(--cortex-text-inactive)" : "transparent",
          "flex-shrink": "0",
        }}
      >
        <Show when={props.selected}>
          <svg style={{ width: tokens.spacing.lg, height: tokens.spacing.lg }} fill="none" viewBox="0 0 24 24" stroke="#fff" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </Show>
      </div>
      <div style={{ flex: "1", display: "flex", "flex-direction": "column", gap: tokens.spacing.sm }}>
        <div style={{ display: "flex", "align-items": "center", gap: tokens.spacing.md }}>
          <Show when={props.icon}>
            <span style={{ display: "flex", color: "var(--cortex-text-inactive)" }}>{props.icon}</span>
          </Show>
          <Text weight="medium" size="sm" style={{ color: "var(--cortex-text-primary)" }}>
            {props.title}
          </Text>
        </div>
        <Show when={props.description}>
          <Text variant="muted" size="xs" style={{ color: "var(--cortex-text-inactive)" }}>
            {props.description}
          </Text>
        </Show>
      </div>
    </div>
  );
}

// ============================================================================
// KEYBOARD SHORTCUT DISPLAY COMPONENT
// Uses design tokens for consistent styling
// ============================================================================

interface KbdProps {
  children: string;
  class?: string;
}

export function Kbd(props: KbdProps) {
  const kbdStyle: JSX.CSSProperties = {
    display: "inline-flex",
    "align-items": "center",
    "justify-content": "center",
    "min-width": "24px",
    height: "22px",
    background: "var(--cortex-bg-primary)",
    border: "1px solid rgba(107, 114, 142, 0.4)",
    "border-radius": "var(--cortex-radius-sm)",
    padding: "2px 6px",
    "font-family": "var(--jb-font-code)",
    "font-size": "11px",
    "font-weight": "500",
    color: "var(--cortex-text-primary)",
  };

  return (
    <kbd style={kbdStyle}>
      {props.children}
    </kbd>
  );
}

// ============================================================================
// INFO BOX COMPONENT
// For displaying helpful information or warnings - uses UI Card and Text
// ============================================================================

interface InfoBoxProps {
  variant?: "info" | "warning" | "error" | "success";
  title?: string;
  children: JSX.Element;
  class?: string;
}

export function InfoBox(props: InfoBoxProps) {
  const variant = () => props.variant || "info";
  
  const infoBoxStyles: Record<string, { background: string; "border-left": string; color: string }> = {
    info: {
      background: "rgba(124, 133, 168, 0.15)",
      "border-left": "3px solid var(--cortex-text-inactive)",
      color: "var(--cortex-text-inactive)",
    },
    warning: {
      background: "rgba(245, 158, 11, 0.15)",
      "border-left": "3px solid var(--cortex-warning)",
      color: "var(--cortex-warning)",
    },
    error: {
      background: "rgba(239, 68, 68, 0.15)",
      "border-left": "3px solid var(--cortex-error)",
      color: "var(--cortex-error)",
    },
    success: {
      background: "rgba(34, 197, 94, 0.15)",
      "border-left": "3px solid var(--cortex-success)",
      color: "var(--cortex-success)",
    },
  };
  
  const styles = () => infoBoxStyles[variant()];
  
  return (
    <Card 
      variant="outlined" 
      padding="md"
      style={{
        background: styles().background,
        "border-left": styles()["border-left"],
        border: "none",
        "border-radius": "var(--cortex-radius-sm)",
      }}
    >
      <Show when={props.title}>
        <Text weight="semibold" size="sm" style={{ 
          color: styles().color,
          "margin-bottom": tokens.spacing.md,
        }}>
          {props.title}
        </Text>
      </Show>
      <div style={{ color: "var(--cortex-text-primary)" }}>{props.children}</div>
    </Card>
  );
}


