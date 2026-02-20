/**
 * =============================================================================
 * TEMPLATE GALLERY - Pre-built Workflow Templates
 * =============================================================================
 * 
 * A gallery dialog for browsing and selecting pre-built workflow templates.
 * Allows users to quickly start with common patterns and configurations.
 * 
 * Features:
 * - Grid of template cards with icon, name, description, category, complexity
 * - Search and filter functionality
 * - Categories: Code Quality, Security, Documentation, Testing, DevOps, Custom
 * - Preview mode with read-only canvas view
 * - Use template button to create new workflow
 * - Featured/popular templates section
 * - User's saved templates section
 * - Import from URL option
 * 
 * =============================================================================
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  JSX,
} from "solid-js";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { Tabs, TabList, Tab, TabPanel } from "../../ui/Tabs";

// =============================================================================
// TYPES
// =============================================================================

export type TemplateCategory =
  | "code-quality"
  | "security"
  | "documentation"
  | "testing"
  | "devops"
  | "custom";

export type TemplateComplexity = "simple" | "intermediate" | "advanced";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  complexity: TemplateComplexity;
  icon: string;
  author?: string;
  downloads?: number;
  isFeatured?: boolean;
  isUserSaved?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  previewNodes?: number;
  previewConnections?: number;
}

export interface TemplateGalleryProps {
  /** Whether the gallery dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Available templates */
  templates?: WorkflowTemplate[];
  /** Callback when a template is selected */
  onSelectTemplate?: (templateId: string) => void;
  /** Callback when preview is requested */
  onPreviewTemplate?: (templateId: string) => void;
  /** Callback to import from URL */
  onImportFromUrl?: (url: string) => void;
  /** Currently previewing template */
  previewingTemplateId?: string;
  /** Loading state */
  loading?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; color: string }> = {
  "code-quality": { label: "Code Quality", color: "var(--cortex-success)" },
  security: { label: "Security", color: "var(--cortex-error)" },
  documentation: { label: "Documentation", color: "var(--cortex-info)" },
  testing: { label: "Testing", color: "var(--cortex-warning)" },
  devops: { label: "DevOps", color: "var(--cortex-info)" },
  custom: { label: "Custom", color: "var(--cortex-text-secondary)" },
};

const COMPLEXITY_CONFIG: Record<TemplateComplexity, { label: string; variant: "success" | "warning" | "error" }> = {
  simple: { label: "Simple", variant: "success" },
  intermediate: { label: "Intermediate", variant: "warning" },
  advanced: { label: "Advanced", variant: "error" },
};

const CATEGORY_ICONS: Record<TemplateCategory, JSX.Element> = {
  "code-quality": (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2L3 6v8l7 4 7-4V6l-7-4zm0 1.5L15.5 7v6L10 16.5 4.5 13V7L10 3.5z" />
      <path d="M7.5 10l2 2 3-3-.7-.7-2.3 2.3-1.3-1.3-.7.7z" />
    </svg>
  ),
  security: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2L4 5v5c0 4.4 2.6 8.3 6 10 3.4-1.7 6-5.6 6-10V5l-6-3zm0 1.5l5 2.5v4.5c0 3.6-2.1 6.8-5 8.3-2.9-1.5-5-4.7-5-8.3V6l5-2.5z" />
    </svg>
  ),
  documentation: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 3h12v14H4V3zm1 1v12h10V4H5zm2 2h6v1H7V6zm0 2h6v1H7V8zm0 2h4v1H7v-1z" />
    </svg>
  ),
  testing: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 2v5H4l6 11V9h4L8 2zm1 3.5L12 12h-2v3.5L7 10h2V5.5z" />
    </svg>
  ),
  devops: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z" />
      <path d="M13 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm-3-1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
    </svg>
  ),
  custom: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M16 11.5l-2-2 2-2 1.5 1.5a1 1 0 0 1 0 1.5L16 11.5zM4 11.5l2-2-2-2L2.5 9a1 1 0 0 0 0 1.5L4 11.5z" />
      <path d="M10 4l2 2-2 2-2-2 2-2zm0 10l2-2-2-2-2 2 2 2z" />
    </svg>
  ),
};

// =============================================================================
// TEMPLATE CARD COMPONENT
// =============================================================================

interface TemplateCardProps {
  template: WorkflowTemplate;
  isSelected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
}

function TemplateCard(props: TemplateCardProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const categoryConfig = () => CATEGORY_CONFIG[props.template.category];
  const complexityConfig = () => COMPLEXITY_CONFIG[props.template.complexity];

  const cardStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "flex-direction": "column",
    background: props.isSelected
      ? "var(--jb-surface-active)"
      : isHovered()
        ? "var(--jb-surface-hover)"
        : "var(--jb-surface-panel)",
    border: props.isSelected
      ? "1px solid var(--jb-border-focus)"
      : "1px solid var(--jb-border-default)",
    "border-radius": "var(--jb-radius-lg)",
    padding: "12px",
    cursor: "pointer",
    transition: "all var(--cortex-transition-fast)",
  });

  const iconContainerStyle = (): JSX.CSSProperties => ({
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "40px",
    height: "40px",
    "border-radius": "var(--jb-radius-md)",
    background: `${categoryConfig().color}20`,
    color: categoryConfig().color,
    "margin-bottom": "10px",
    "flex-shrink": "0",
  });

  const nameStyle: JSX.CSSProperties = {
    "font-size": "13px",
    "font-weight": "600",
    color: "var(--jb-text-body-color)",
    "margin-bottom": "4px",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "white-space": "nowrap",
  };

  const descriptionStyle: JSX.CSSProperties = {
    "font-size": "11px",
    color: "var(--jb-text-muted-color)",
    "line-height": "1.4",
    "margin-bottom": "10px",
    display: "-webkit-box",
    "-webkit-line-clamp": "2",
    "-webkit-box-orient": "vertical",
    overflow: "hidden",
    flex: "1",
  };

  const metaRowStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    gap: "8px",
    "margin-bottom": "10px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "6px",
    "margin-top": "auto",
  };

  return (
    <div
      style={cardStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.onSelect}
    >
      <div style={{ display: "flex", "align-items": "flex-start", gap: "10px" }}>
        <div style={iconContainerStyle()}>
          {CATEGORY_ICONS[props.template.category]}
        </div>
        <div style={{ flex: "1", "min-width": "0" }}>
          <div style={nameStyle}>{props.template.name}</div>
          <div style={metaRowStyle}>
            <Badge
              variant="default"
              size="sm"
              style={{ background: `${categoryConfig().color}20`, color: categoryConfig().color }}
            >
              {categoryConfig().label}
            </Badge>
            <Badge variant={complexityConfig().variant} size="sm">
              {complexityConfig().label}
            </Badge>
          </div>
        </div>
      </div>

      <div style={descriptionStyle}>{props.template.description}</div>

      <Show when={props.template.isFeatured || props.template.downloads}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "10px", color: "var(--jb-text-muted-color)", "margin-bottom": "8px" }}>
          <Show when={props.template.isFeatured}>
            <span style={{ display: "flex", "align-items": "center", gap: "3px", color: "var(--cortex-warning)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 0l1.5 3 3.5.5-2.5 2.5.5 3.5L5 7.5 2 9.5l.5-3.5L0 3.5 3.5 3 5 0z" />
              </svg>
              Featured
            </span>
          </Show>
          <Show when={props.template.downloads}>
            <span style={{ display: "flex", "align-items": "center", gap: "3px" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 0v6M2 4l3 3 3-3M1 8v1h8V8" />
              </svg>
              {props.template.downloads?.toLocaleString()}
            </span>
          </Show>
        </div>
      </Show>

      <div style={actionsStyle}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            props.onPreview?.();
          }}
        >
          Preview
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            props.onSelect?.();
          }}
        >
          Use Template
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// CATEGORY FILTER COMPONENT
// =============================================================================

interface CategoryFilterProps {
  categories: TemplateCategory[];
  selectedCategories: TemplateCategory[];
  onToggleCategory: (category: TemplateCategory) => void;
}

function CategoryFilter(props: CategoryFilterProps) {
  const filterStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-wrap": "wrap",
    gap: "6px",
    "margin-bottom": "12px",
  };

  return (
    <div style={filterStyle}>
      <For each={props.categories}>
        {(category) => {
          const config = CATEGORY_CONFIG[category];
          const isSelected = () => props.selectedCategories.includes(category);
          
          return (
            <button
              type="button"
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "4px",
                padding: "4px 10px",
                "border-radius": "var(--jb-radius-full)",
                border: isSelected() ? `1px solid ${config.color}` : "1px solid var(--jb-border-default)",
                background: isSelected() ? `${config.color}15` : "transparent",
                color: isSelected() ? config.color : "var(--jb-text-muted-color)",
                "font-size": "11px",
                "font-weight": "500",
                cursor: "pointer",
                transition: "all var(--cortex-transition-fast)",
              }}
              onClick={() => props.onToggleCategory(category)}
            >
              {config.label}
            </button>
          );
        }}
      </For>
    </div>
  );
}

// =============================================================================
// IMPORT FROM URL SECTION
// =============================================================================

interface ImportFromUrlProps {
  onImport: (url: string) => void;
}

function ImportFromUrl(props: ImportFromUrlProps) {
  const [url, setUrl] = createSignal("");
  const [error, setError] = createSignal("");

  const handleImport = () => {
    const urlValue = url().trim();
    if (!urlValue) {
      setError("Please enter a URL");
      return;
    }
    try {
      new URL(urlValue);
      setError("");
      props.onImport(urlValue);
      setUrl("");
    } catch {
      setError("Please enter a valid URL");
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "8px",
    padding: "12px",
    background: "var(--jb-canvas)",
    "border-radius": "var(--jb-radius-md)",
    "margin-bottom": "16px",
  };

  return (
    <div style={containerStyle}>
      <div style={{ flex: "1" }}>
        <Input
          placeholder="Enter template URL..."
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          error={error()}
          icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1a6 6 0 1 0 0 12A6 6 0 0 0 7 1zM6 3h2v1H6V3zm0 2h2v6H6V5z" />
            </svg>
          }
        />
      </div>
      <Button variant="secondary" onClick={handleImport}>
        Import
      </Button>
    </div>
  );
}

// =============================================================================
// TEMPLATE GALLERY COMPONENT
// =============================================================================

export function TemplateGallery(props: TemplateGalleryProps) {
  const templates = () => props.templates || [];

  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategories, setSelectedCategories] = createSignal<TemplateCategory[]>([]);
  const [activeTab, setActiveTab] = createSignal("all");

  // All unique categories from templates
  const allCategories = createMemo(() => {
    const cats = new Set<TemplateCategory>();
    templates().forEach((t) => cats.add(t.category));
    return Array.from(cats);
  });

  // Filter templates
  const filteredTemplates = createMemo(() => {
    let result = templates();
    const query = searchQuery().toLowerCase().trim();
    const cats = selectedCategories();

    // Filter by tab
    if (activeTab() === "featured") {
      result = result.filter((t) => t.isFeatured);
    } else if (activeTab() === "saved") {
      result = result.filter((t) => t.isUserSaved);
    }

    // Filter by search
    if (query) {
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Filter by categories
    if (cats.length > 0) {
      result = result.filter((t) => cats.includes(t.category));
    }

    return result;
  });

  // Featured templates
  const featuredTemplates = createMemo(() => templates().filter((t) => t.isFeatured));

  // User saved templates
  const savedTemplates = createMemo(() => templates().filter((t) => t.isUserSaved));

  const toggleCategory = (category: TemplateCategory) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category]
    );
  };

  const handleSelectTemplate = (templateId: string) => {
    props.onSelectTemplate?.(templateId);
    props.onClose();
  };

  // Styles
  const searchContainerStyle: JSX.CSSProperties = {
    "margin-bottom": "12px",
  };

  const gridStyle: JSX.CSSProperties = {
    display: "grid",
    "grid-template-columns": "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "12px",
    "max-height": "400px",
    overflow: "auto",
    padding: "2px",
  };

  const modalContentStyle: JSX.CSSProperties = {
    "min-height": "500px",
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="Template Gallery"
      size="lg"
      style={{ width: "900px", "max-width": "95vw" }}
    >
      <div style={modalContentStyle}>
        {/* Import from URL */}
        <ImportFromUrl onImport={(url) => props.onImportFromUrl?.(url)} />

        {/* Tabs */}
        <Tabs activeTab={activeTab()} onChange={setActiveTab}>
          <TabList>
            <Tab id="all">All Templates</Tab>
            <Tab id="featured">
              Featured
              <Show when={featuredTemplates().length > 0}>
                <Badge variant="warning" size="sm" style={{ "margin-left": "6px" }}>
                  {featuredTemplates().length}
                </Badge>
              </Show>
            </Tab>
            <Tab id="saved">
              My Templates
              <Show when={savedTemplates().length > 0}>
                <Badge variant="accent" size="sm" style={{ "margin-left": "6px" }}>
                  {savedTemplates().length}
                </Badge>
              </Show>
            </Tab>
          </TabList>

          <TabPanel id="all" style={{ padding: "16px 0" }}>
            {/* Search */}
            <div style={searchContainerStyle}>
              <Input
                placeholder="Search templates..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                icon={
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <path d="M6 1a5 5 0 1 0 3.5 8.5l3 3 .7-.7-3-3A5 5 0 0 0 6 1zm0 1a4 4 0 1 1 0 8 4 4 0 0 1 0-8z" />
                  </svg>
                }
              />
            </div>

            {/* Category Filter */}
            <CategoryFilter
              categories={allCategories()}
              selectedCategories={selectedCategories()}
              onToggleCategory={toggleCategory}
            />

            {/* Templates Grid */}
            <Show
              when={!props.loading}
              fallback={
                <div style={{ display: "flex", "justify-content": "center", padding: "40px" }}>
                  <div style={{ color: "var(--jb-text-muted-color)" }}>Loading templates...</div>
                </div>
              }
            >
              <Show
                when={filteredTemplates().length > 0}
                fallback={
                  <EmptyState
                    icon={
                      <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                        <path d="M16 4L6 10v12l10 6 10-6V10L16 4zm0 2l8 4.8v9.6L16 26l-8-4.8v-9.6L16 6z" />
                      </svg>
                    }
                    title="No Templates Found"
                    description="Try adjusting your search or filters"
                  />
                }
              >
                <div style={gridStyle}>
                  <For each={filteredTemplates()}>
                    {(template) => (
                      <TemplateCard
                        template={template}
                        isSelected={props.previewingTemplateId === template.id}
                        onSelect={() => handleSelectTemplate(template.id)}
                        onPreview={() => props.onPreviewTemplate?.(template.id)}
                      />
                    )}
                  </For>
                </div>
              </Show>
            </Show>
          </TabPanel>

          <TabPanel id="featured" style={{ padding: "16px 0" }}>
            <Show
              when={featuredTemplates().length > 0}
              fallback={
                <EmptyState
                  icon={
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                      <path d="M16 2l4 8 9 1.5-6.5 6.5 1.5 9-8-4.5-8 4.5 1.5-9L3 11.5 12 10l4-8z" />
                    </svg>
                  }
                  title="No Featured Templates"
                  description="Featured templates will appear here"
                />
              }
            >
              <div style={gridStyle}>
                <For each={featuredTemplates()}>
                  {(template) => (
                    <TemplateCard
                      template={template}
                      isSelected={props.previewingTemplateId === template.id}
                      onSelect={() => handleSelectTemplate(template.id)}
                      onPreview={() => props.onPreviewTemplate?.(template.id)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </TabPanel>

          <TabPanel id="saved" style={{ padding: "16px 0" }}>
            <Show
              when={savedTemplates().length > 0}
              fallback={
                <EmptyState
                  icon={
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                      <path d="M24 4H8a2 2 0 0 0-2 2v20l10-5 10 5V6a2 2 0 0 0-2-2zm0 19l-8-4-8 4V6h16v17z" />
                    </svg>
                  }
                  title="No Saved Templates"
                  description="Save your workflows as templates to access them here"
                  action={
                    <Button variant="secondary" size="sm">
                      Create Template
                    </Button>
                  }
                />
              }
            >
              <div style={gridStyle}>
                <For each={savedTemplates()}>
                  {(template) => (
                    <TemplateCard
                      template={template}
                      isSelected={props.previewingTemplateId === template.id}
                      onSelect={() => handleSelectTemplate(template.id)}
                      onPreview={() => props.onPreviewTemplate?.(template.id)}
                    />
                  )}
                </For>
              </div>
            </Show>
          </TabPanel>
        </Tabs>
      </div>
    </Modal>
  );
}

export default TemplateGallery;

