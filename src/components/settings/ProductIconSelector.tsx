import { createSignal, createMemo, For, Show } from "solid-js";
import {
  useProductIconTheme,
  type ProductIconTheme,
} from "@/context/ProductIconThemeContext";
import { Card, Text, Button, Badge } from "@/components/ui";
import { SectionHeader, FormGroup } from "./FormComponents";

interface ThemeCardProps {
  theme: ProductIconTheme;
  isSelected: boolean;
  onSelect: () => void;
}

const PREVIEW_ICON_IDS = [
  "activity-bar-explorer",
  "activity-bar-search",
  "activity-bar-scm",
  "activity-bar-debug",
  "action-close",
  "action-add",
  "statusbar-error",
  "statusbar-check",
] as const;

function ThemeCard(props: ThemeCardProps) {
  const { getProductIcon } = useProductIconTheme();

  const previewIcons = createMemo(() =>
    PREVIEW_ICON_IDS.map((id) => ({ id, icon: getProductIcon(id) }))
  );

  return (
    <Card
      variant="outlined"
      padding="md"
      hoverable
      onClick={props.onSelect}
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "12px",
        cursor: "pointer",
        "text-align": "left",
        width: "100%",
        border: props.isSelected
          ? "2px solid var(--jb-border-focus)"
          : "1px solid var(--jb-border-default)",
        background: props.isSelected
          ? "color-mix(in srgb, var(--jb-border-focus) 10%, var(--jb-panel))"
          : "var(--jb-panel)",
      }}
    >
      <div style={{ display: "flex", "justify-content": "space-between", "align-items": "flex-start", gap: "12px" }}>
        <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
          <Text weight="semibold" size="sm" style={{ color: "var(--jb-text-body-color)" }}>
            {props.theme.label}
          </Text>
          <Text variant="muted" size="xs">{props.theme.description}</Text>
        </div>
        <Show when={props.isSelected}>
          <Badge variant="accent" size="sm">Active</Badge>
        </Show>
      </div>
      <div style={{ display: "flex", gap: "12px", padding: "8px 0" }}>
        <For each={previewIcons()}>
          {(entry) => (
            <span
              style={{
                "font-size": "20px",
                color: props.isSelected ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
                "line-height": "1",
                "font-family": entry.icon.fontFamily || props.theme.fontFamily,
              }}
            >
              {entry.icon.fontCharacter}
            </span>
          )}
        </For>
      </div>
    </Card>
  );
}

function IconPreviewSection() {
  const { productIconTheme, getProductIcon } = useProductIconTheme();
  const theme = productIconTheme;

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      <SectionHeader title="Live Preview" description="See how icons appear in different contexts" />

      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <Text variant="header" size="xs">Activity Bar</Text>
        <Card variant="outlined" padding="sm" style={{ display: "flex", "flex-direction": "column", gap: "4px", width: "fit-content" }}>
          <For each={[
            "activity-bar-explorer",
            "activity-bar-search",
            "activity-bar-scm",
            "activity-bar-debug",
            "activity-bar-extensions",
          ] as const}>
            {(iconId, index) => {
              const icon = () => getProductIcon(iconId);
              return (
                <div style={{ display: "flex", "align-items": "center", "justify-content": "center", width: "40px", height: "40px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
                  <span style={{
                    "font-size": "22px",
                    color: index() === 0 ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
                    "font-family": icon().fontFamily || theme().fontFamily,
                  }}>
                    {icon().fontCharacter}
                  </span>
                </div>
              );
            }}
          </For>
        </Card>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <Text variant="header" size="xs">Status Bar</Text>
        <Card variant="outlined" padding="sm" style={{ display: "flex", "align-items": "center", gap: "16px" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <span style={{ "font-size": "15px", color: "var(--cortex-error)", "font-family": theme().fontFamily }}>
              {getProductIcon("statusbar-error").fontCharacter}
            </span>
            <Text size="sm">2</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <span style={{ "font-size": "15px", color: "var(--cortex-warning)", "font-family": theme().fontFamily }}>
              {getProductIcon("statusbar-warning").fontCharacter}
            </span>
            <Text size="sm">5</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <span style={{ "font-size": "15px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("statusbar-git-branch").fontCharacter}
            </span>
            <Text size="sm">main</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
            <span style={{ "font-size": "15px", color: "var(--jb-border-focus)", "font-family": theme().fontFamily }}>
              {getProductIcon("statusbar-sync").fontCharacter}
            </span>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <Text variant="header" size="xs">Actions</Text>
        <div style={{ display: "flex", gap: "4px" }}>
          <For each={[
            "action-add",
            "action-remove",
            "action-edit",
            "action-save",
            "action-close",
            "action-refresh",
            "action-search",
            "action-more",
          ] as const}>
            {(iconId) => {
              const icon = () => getProductIcon(iconId);
              return (
                <Button variant="ghost" size="sm" style={{ padding: "0 8px" }}>
                  <span style={{ "font-size": "16px", "font-family": icon().fontFamily || theme().fontFamily }}>
                    {icon().fontCharacter}
                  </span>
                </Button>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

export function ProductIconSelector() {
  const { productIconThemeId, setProductIconTheme, productIconThemes } = useProductIconTheme();
  const [showPreview, setShowPreview] = createSignal(true);
  const themes = createMemo(() => productIconThemes());

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SectionHeader
        title="Product Icon Theme"
        description="Choose how icons appear in the activity bar, status bar, and throughout the interface"
      />

      <FormGroup title="Available Themes">
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <For each={themes()}>
            {(theme) => (
              <ThemeCard
                theme={theme}
                isSelected={productIconThemeId() === theme.id}
                onSelect={() => setProductIconTheme(theme.id)}
              />
            )}
          </For>
        </div>
      </FormGroup>

      <FormGroup>
        <div style={{ display: "flex", "align-items": "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview())}
            icon={
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transform: showPreview() ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            }
          >
            {showPreview() ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>
        <Show when={showPreview()}>
          <div style={{ "margin-top": "8px" }}>
            <IconPreviewSection />
          </div>
        </Show>
      </FormGroup>
    </div>
  );
}
