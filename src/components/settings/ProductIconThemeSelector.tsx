import { createSignal, createMemo, For, Show } from "solid-js";
import {
  useProductIconTheme,
  ProductIconTheme,
  ProductIconCategory,
  PRODUCT_ICON_CATEGORIES,
  PRODUCT_ICON_CATEGORY_LABELS,
} from "@/context/ProductIconThemeContext";
import { Card, Text, Button, Badge, Select } from "@/components/ui";
import { SectionHeader, FormGroup } from "./FormComponents";

// ============================================================================
// Types
// ============================================================================

interface ThemeCardProps {
  theme: ProductIconTheme;
  isSelected: boolean;
  onSelect: () => void;
}

type PreviewCategory = ProductIconCategory | "all";

// ============================================================================
// Theme Card Component
// ============================================================================

function ThemeCard(props: ThemeCardProps) {
  const { getProductIcon } = useProductIconTheme();

  const previewIcons = createMemo(() => [
    getProductIcon("activity-bar-explorer"),
    getProductIcon("activity-bar-search"),
    getProductIcon("activity-bar-scm"),
    getProductIcon("activity-bar-debug"),
    getProductIcon("action-close"),
    getProductIcon("action-add"),
    getProductIcon("statusbar-error"),
    getProductIcon("statusbar-check"),
  ]);

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
        border: props.isSelected ? "2px solid var(--jb-border-focus)" : "1px solid var(--jb-border-default)",
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
          <Text variant="muted" size="xs">
            {props.theme.description}
          </Text>
        </div>
        <Show when={props.isSelected}>
          <Badge variant="accent" size="sm">Active</Badge>
        </Show>
      </div>
      <div style={{ display: "flex", gap: "12px", padding: "8px 0" }}>
        <For each={previewIcons()}>
          {(icon) => (
            <span
              style={{ 
                "font-size": "20px",
                color: props.isSelected ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
                "line-height": "1",
                "font-family": icon.fontFamily || props.theme.fontFamily 
              }}
            >
              {icon.fontCharacter}
            </span>
          )}
        </For>
      </div>
    </Card>
  );
}

// ============================================================================
// Icon Preview Grid Component
// ============================================================================

function IconPreviewGrid(props: { category: PreviewCategory }) {
  const { productIconTheme, getProductIconsByCategory } = useProductIconTheme();

  const iconsToShow = createMemo(() => {
    if (props.category === "all") {
      return PRODUCT_ICON_CATEGORIES.flatMap((cat) =>
        getProductIconsByCategory(cat).slice(0, 4).map((item) => ({
          ...item,
          category: cat,
        }))
      );
    }
    
    return getProductIconsByCategory(props.category).map((item) => ({
      ...item,
      category: props.category,
    }));
  });

  const theme = productIconTheme;

  return (
    <div style={{
      display: "grid",
      "grid-template-columns": "repeat(auto-fill, minmax(100px, 1fr))",
      gap: "8px",
    }}>
      <For each={iconsToShow()}>
        {(item) => (
          <Card
            variant="outlined"
            padding="sm"
            style={{
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "6px",
            }}
          >
            <span
              style={{ 
                "font-size": "24px",
                color: "var(--jb-text-body-color)",
                "font-family": item.icon.fontFamily || theme().fontFamily 
              }}
            >
              {item.icon.fontCharacter}
            </span>
            <Text variant="muted" size="xs" style={{ "text-align": "center", "word-break": "break-word" }}>
              {item.id.replace(/^(activity-bar-|view-|action-|statusbar-|breadcrumb-|editor-|debug-|scm-|notification-|widget-)/, "")}
            </Text>
          </Card>
        )}
      </For>
    </div>
  );
}

// ============================================================================
// Category Preview Section
// ============================================================================

function CategoryPreview() {
  const [selectedCategory, setSelectedCategory] = createSignal<PreviewCategory>("activityBar");

  const categoryOptions = createMemo(() => [
    { value: "all", label: "All Categories" },
    ...PRODUCT_ICON_CATEGORIES.map((cat) => ({
      value: cat,
      label: PRODUCT_ICON_CATEGORY_LABELS[cat],
    })),
  ]);

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px", "margin-top": "8px" }}>
      <div style={{ "max-width": "200px" }}>
        <Text variant="muted" size="xs" style={{ "margin-bottom": "4px" }}>Preview Category</Text>
        <Select
          value={selectedCategory()}
          onChange={(value) => setSelectedCategory(value as PreviewCategory)}
          options={categoryOptions()}
        />
      </div>
      <IconPreviewGrid category={selectedCategory()} />
    </div>
  );
}

// ============================================================================
// Live Preview Panel
// ============================================================================

function LivePreviewPanel() {
  const { productIconTheme, getProductIcon } = useProductIconTheme();

  const theme = productIconTheme;

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "16px" }}>
      <SectionHeader 
        title="Live Preview" 
        description="See how icons appear in different contexts" 
      />
      
      {/* Activity Bar Preview */}
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
                <div style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "40px",
                  height: "40px",
                  "border-radius": "var(--jb-radius-sm)",
                  cursor: "pointer",
                }}>
                  <span
                    style={{ 
                      "font-size": "22px",
                      color: index() === 0 ? "var(--jb-text-body-color)" : "var(--jb-text-muted-color)",
                      "font-family": icon().fontFamily || theme().fontFamily 
                    }}
                  >
                    {icon().fontCharacter}
                  </span>
                </div>
              );
            }}
          </For>
        </Card>
      </div>

      {/* Status Bar Preview */}
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

      {/* Action Icons Preview */}
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

      {/* View Icons Preview */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        <Text variant="header" size="xs">File Tree</Text>
        <Card variant="outlined" padding="sm" style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 8px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
            <span style={{ "font-size": "16px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("view-folder-open").fontCharacter}
            </span>
            <Text size="sm">src</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 8px", "padding-left": "24px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
            <span style={{ "font-size": "16px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("view-file-code").fontCharacter}
            </span>
            <Text size="sm">App.tsx</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 8px", "padding-left": "24px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
            <span style={{ "font-size": "16px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("view-file-code").fontCharacter}
            </span>
            <Text size="sm">index.tsx</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 8px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
            <span style={{ "font-size": "16px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("view-folder").fontCharacter}
            </span>
            <Text size="sm">public</Text>
          </div>
          <div style={{ display: "flex", "align-items": "center", gap: "8px", padding: "4px 8px", "border-radius": "var(--jb-radius-sm)", cursor: "pointer" }}>
            <span style={{ "font-size": "16px", color: "var(--jb-text-muted-color)", "font-family": theme().fontFamily }}>
              {getProductIcon("view-file-text").fontCharacter}
            </span>
            <Text size="sm">README.md</Text>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Main ProductIconThemeSelector Component
// ============================================================================

export function ProductIconThemeSelector() {
  const {
    productIconThemeId,
    setProductIconTheme,
    productIconThemes,
  } = useProductIconTheme();

  const [showAllIcons, setShowAllIcons] = createSignal(false);

  const builtInThemes = createMemo(() =>
    productIconThemes().filter((t) =>
      ["default-codicons", "minimal", "fluent"].includes(t.id)
    )
  );

  const customThemes = createMemo(() =>
    productIconThemes().filter(
      (t) => !["default-codicons", "minimal", "fluent"].includes(t.id)
    )
  );

  return (
    <div style={{ display: "flex", "flex-direction": "column", gap: "24px" }}>
      <SectionHeader
        title="Product Icon Theme"
        description="Choose how icons appear throughout the interface"
      />

      {/* Theme Selection */}
      <FormGroup title="Available Themes">
        <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
          <For each={builtInThemes()}>
            {(theme) => (
              <ThemeCard
                theme={theme}
                isSelected={productIconThemeId() === theme.id}
                onSelect={() => setProductIconTheme(theme.id)}
              />
            )}
          </For>
        </div>
        
        <Show when={customThemes().length > 0}>
          <div style={{ "margin-top": "16px", "padding-top": "16px", "border-top": "1px solid var(--jb-border-default)" }}>
            <Text variant="header" size="xs" style={{ "margin-bottom": "12px" }}>Custom Themes</Text>
            <div style={{ display: "flex", "flex-direction": "column", gap: "12px" }}>
              <For each={customThemes()}>
                {(theme) => (
                  <ThemeCard
                    theme={theme}
                    isSelected={productIconThemeId() === theme.id}
                    onSelect={() => setProductIconTheme(theme.id)}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </FormGroup>

      {/* Live Preview */}
      <FormGroup>
        <LivePreviewPanel />
      </FormGroup>

      {/* Category Preview (Expandable) */}
      <FormGroup>
        <div style={{ display: "flex", "align-items": "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllIcons(!showAllIcons())}
            icon={
              <svg
                style={{
                  width: "16px",
                  height: "16px",
                  transform: showAllIcons() ? "rotate(90deg)" : "rotate(0deg)",
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
            {showAllIcons() ? "Hide All Icons" : "Browse All Icons"}
          </Button>
        </div>
        
        <Show when={showAllIcons()}>
          <CategoryPreview />
        </Show>
      </FormGroup>

      {/* Embedded Styles */}
      <style>{`
        .product-icon-theme-selector {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .product-icon-theme-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .product-icon-theme-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--color-background-secondary);
          border: 2px solid var(--color-border);
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          width: 100%;
        }

        .product-icon-theme-card:hover {
          border-color: var(--color-border-active);
          background: var(--color-background-tertiary);
        }

        .product-icon-theme-card-selected {
          border-color: var(--color-primary);
          background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background-secondary));
        }

        .product-icon-theme-card-selected:hover {
          border-color: var(--color-primary-hover);
        }

        .product-icon-theme-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .product-icon-theme-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .product-icon-theme-card-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-foreground);
        }

        .product-icon-theme-card-description {
          font-size: 0.8125rem;
          color: var(--color-foreground-muted);
        }

        .product-icon-theme-card-badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          background: var(--color-primary);
          color: white;
          border-radius: var(--cortex-radius-full);
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .product-icon-theme-card-preview {
          display: flex;
          gap: 0.75rem;
          padding: 0.5rem 0;
        }

        .product-icon-theme-card-icon {
          font-size: 1.25rem;
          color: var(--color-foreground-muted);
          line-height: 1;
        }

        .product-icon-theme-card-selected .product-icon-theme-card-icon {
          color: var(--color-foreground);
        }

        .product-icon-theme-custom-section {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        .product-icon-theme-custom-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-foreground-muted);
          margin-bottom: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* Live Preview */
        .product-icon-live-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .product-icon-preview-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .product-icon-preview-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-foreground-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .product-icon-preview-activity-bar {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0.5rem;
          background: var(--color-background-tertiary);
          border-radius: 0.375rem;
          width: fit-content;
        }

        .product-icon-preview-activity-item {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0.375rem;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .product-icon-preview-activity-item:hover {
          background: var(--color-background-secondary);
        }

        .product-icon-preview-activity-icon {
          font-size: 1.375rem;
          color: var(--color-foreground-muted);
        }

        .product-icon-preview-activity-item:first-child .product-icon-preview-activity-icon {
          color: var(--color-foreground);
        }

        .product-icon-preview-status-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.375rem 0.75rem;
          background: var(--color-background-tertiary);
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          color: var(--color-foreground-muted);
        }

        .product-icon-preview-status-item {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .product-icon-preview-status-icon {
          font-size: 0.9375rem;
        }

        .product-icon-preview-status-error {
          color: var(--color-error);
        }

        .product-icon-preview-status-warning {
          color: var(--color-warning);
        }

        .product-icon-preview-status-sync {
          color: var(--color-info);
        }

        .product-icon-preview-actions {
          display: flex;
          gap: 0.25rem;
        }

        .product-icon-preview-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.75rem;
          height: 1.75rem;
          font-size: 1rem;
          color: var(--color-foreground-muted);
          background: transparent;
          border: none;
          border-radius: 0.25rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .product-icon-preview-action-btn:hover {
          background: var(--color-background-tertiary);
          color: var(--color-foreground);
        }

        .product-icon-preview-tree {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          padding: 0.5rem;
          background: var(--color-background-tertiary);
          border-radius: 0.375rem;
          font-size: 0.8125rem;
        }

        .product-icon-preview-tree-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          color: var(--color-foreground);
          cursor: pointer;
        }

        .product-icon-preview-tree-item:hover {
          background: var(--color-background-secondary);
        }

        .product-icon-preview-tree-nested {
          padding-left: 1.5rem;
        }

        .product-icon-preview-tree-icon {
          font-size: 1rem;
          color: var(--color-foreground-muted);
        }

        /* Category Preview */
        .product-icon-category-preview {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 0.5rem;
        }

        .product-icon-category-header {
          max-width: 200px;
        }

        .product-icon-preview-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 0.5rem;
        }

        .product-icon-preview-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          padding: 0.75rem 0.5rem;
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
        }

        .product-icon-preview-char {
          font-size: 1.5rem;
          color: var(--color-foreground);
        }

        .product-icon-preview-name {
          font-size: 0.6875rem;
          color: var(--color-foreground-muted);
          text-align: center;
          word-break: break-word;
        }

        /* Expand Section */
        .product-icon-expand-section {
          display: flex;
          align-items: center;
        }

        .product-icon-expand-arrow {
          width: 1rem;
          height: 1rem;
          margin-right: 0.375rem;
          transition: transform 0.15s ease;
        }

        .product-icon-expand-arrow-open {
          transform: rotate(90deg);
        }
      `}</style>
    </div>
  );
}

