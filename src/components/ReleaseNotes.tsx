import { Show, For, createMemo } from "solid-js";
import { Icon } from "./ui/Icon";
import { useAutoUpdate } from "@/context/AutoUpdateContext";
import { Markdown } from "./Markdown";
import { Button, IconButton } from "./ui";

/**
 * Release notes section categories with icons and styling
 */
interface ReleaseSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  keywords: string[];
}

const RELEASE_SECTIONS: ReleaseSection[] = [
  {
    id: "breaking",
    title: "Breaking Changes",
    icon: "triangle-exclamation",
    color: "var(--cortex-error)",
    bgColor: "rgba(248, 113, 113, 0.1)",
    borderColor: "rgba(248, 113, 113, 0.3)",
    keywords: ["breaking", "breaking change", "breaking changes", "⚠️", "BREAKING"],
  },
  {
    id: "features",
    title: "New Features",
    icon: "gift",
    color: "var(--cortex-success)",
    bgColor: "rgba(74, 222, 128, 0.1)",
    borderColor: "rgba(74, 222, 128, 0.3)",
    keywords: ["feature", "features", "new", "added", "✨", "🎉", "feat"],
  },
  {
    id: "improvements",
    title: "Improvements",
    icon: "bolt",
    color: "var(--cortex-info)",
    bgColor: "rgba(96, 165, 250, 0.1)",
    borderColor: "rgba(96, 165, 250, 0.3)",
    keywords: ["improve", "improvement", "improvements", "enhanced", "enhancement", "perf", "performance", "⚡"],
  },
  {
    id: "fixes",
    title: "Bug Fixes",
    icon: "circle-exclamation",
    color: "var(--cortex-warning)",
    bgColor: "rgba(251, 191, 36, 0.1)",
    borderColor: "rgba(251, 191, 36, 0.3)",
    keywords: ["fix", "fixes", "fixed", "bug", "bugs", "bugfix", "🐛", "🔧"],
  },
  {
    id: "docs",
    title: "Documentation",
    icon: "book-open",
    color: "var(--cortex-info)",
    bgColor: "rgba(167, 139, 250, 0.1)",
    borderColor: "rgba(167, 139, 250, 0.3)",
    keywords: ["doc", "docs", "documentation", "readme", "📚", "📖"],
  },
  {
    id: "other",
    title: "Other Changes",
    icon: "screwdriver-wrench",
    color: "var(--cortex-text-inactive)",
    bgColor: "rgba(148, 163, 184, 0.1)",
    borderColor: "rgba(148, 163, 184, 0.3)",
    keywords: [],
  },
];

/**
 * Parsed release notes section
 */
interface ParsedSection {
  section: ReleaseSection;
  content: string;
  items: string[];
}

/**
 * Parse raw release notes markdown into categorized sections
 */
function parseReleaseNotes(markdown: string): ParsedSection[] {
  if (!markdown || markdown.trim().length === 0) {
    return [];
  }

  const lines = markdown.split("\n");
  const sections: Map<string, string[]> = new Map();
  let currentSection = "other";

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Check if line is a header that matches a section
    const isHeader = trimmedLine.startsWith("#") || trimmedLine.startsWith("**");
    if (isHeader) {
      const headerText = trimmedLine.replace(/^#+\s*/, "").replace(/^\*\*|\*\*$/g, "").toLowerCase();
      
      for (const section of RELEASE_SECTIONS) {
        if (section.keywords.some(keyword => headerText.includes(keyword.toLowerCase()))) {
          currentSection = section.id;
          break;
        }
      }
      continue;
    }

    // Check if line is a list item or content
    const isListItem = trimmedLine.startsWith("-") || trimmedLine.startsWith("*") || trimmedLine.match(/^\d+\./);
    if (isListItem || (!isHeader && trimmedLine.length > 0)) {
      // Detect section from content if not already categorized
      let detectedSection = currentSection;
      for (const section of RELEASE_SECTIONS) {
        if (section.id === "other") continue;
        if (section.keywords.some(keyword => trimmedLine.toLowerCase().includes(keyword.toLowerCase()))) {
          detectedSection = section.id;
          break;
        }
      }

      const existing = sections.get(detectedSection) || [];
      // Clean up list markers
      const cleanedLine = trimmedLine.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "");
      if (cleanedLine.length > 0) {
        existing.push(cleanedLine);
        sections.set(detectedSection, existing);
      }
    }
  }

  // Convert to ParsedSection array, only include non-empty sections
  const result: ParsedSection[] = [];
  for (const section of RELEASE_SECTIONS) {
    const items = sections.get(section.id);
    if (items && items.length > 0) {
      result.push({
        section,
        content: items.map(item => `- ${item}`).join("\n"),
        items,
      });
    }
  }

  return result;
}

/**
 * Format a date string to a readable format
 */
function formatReleaseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}



/**
 * ReleaseNotesSection - Individual section component
 */
function ReleaseNotesSection(props: { section: ParsedSection }) {
  return (
    <div 
      class="rounded-lg overflow-hidden mb-4"
      style={{
        background: props.section.section.bgColor,
        border: `1px solid ${props.section.section.borderColor}`,
      }}
    >
      <div 
        class="flex items-center gap-2 px-4 py-2"
        style={{ "border-bottom": `1px solid ${props.section.section.borderColor}` }}
      >
        <Icon 
          name={props.section.section.icon}
          class="w-4 h-4" 
          style={{ color: props.section.section.color }}
        />
        <span 
          class="text-sm font-semibold"
          style={{ color: props.section.section.color }}
        >
          {props.section.section.title}
        </span>
        <span 
          class="text-xs px-1.5 py-0.5 rounded-full ml-auto"
          style={{
            background: props.section.section.borderColor,
            color: props.section.section.color,
          }}
        >
          {props.section.items.length}
        </span>
      </div>
      <div class="px-4 py-3">
        <ul class="space-y-1.5">
          <For each={props.section.items}>
            {(item) => (
              <li class="flex items-start gap-2 text-sm text-gray-300">
                <span 
                  class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                  style={{ background: props.section.section.color }}
                />
                <Markdown content={item} />
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  );
}

/**
 * ReleaseNotes - Modal dialog for displaying release notes
 */
export function ReleaseNotes() {
  const update = useAutoUpdate();
  
  const parsedSections = createMemo(() => {
    const notes = update.releaseNotes;
    if (!notes) return [];
    return parseReleaseNotes(notes);
  });
  
  const hasContent = createMemo(() => {
    return parsedSections().length > 0 || (update.releaseNotes && update.releaseNotes.trim().length > 0);
  });
  
  const formattedDate = createMemo(() => {
    return formatReleaseDate(update.releaseNotesDate);
  });
  
  const handleClose = () => {
    update.hideReleaseNotes();
  };
  
  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };
  
  const handleViewOnGitHub = () => {
    const version = update.releaseNotesVersion;
    if (version) {
      // Open GitHub releases page for this version
      const releaseUrl = `https://github.com/cortex-dev/cortex/releases/tag/v${version}`;
      window.open(releaseUrl, "_blank");
    }
  };

  return (
    <Show when={update.showingReleaseNotes}>
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.6)", "backdrop-filter": "blur(4px)" }}
        onClick={handleBackdropClick}
      >
        <div 
          class="w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            background: "var(--background-secondary, var(--cortex-bg-primary))",
            border: "1px solid var(--border, #333)",
          }}
        >
          {/* Header */}
          <div 
            class="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ "border-bottom": "1px solid var(--border, #333)" }}
          >
            <div class="flex items-center gap-3">
              <div 
                class="flex items-center justify-center w-10 h-10 rounded-full"
                style={{ 
                  background: "linear-gradient(135deg, var(--cortex-info) 0%, var(--cortex-info) 100%)",
                  "box-shadow": "0 4px 12px rgba(79, 70, 229, 0.3)",
                }}
              >
                <Icon name="star" class="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white flex items-center gap-2">
                  Release Notes
                  <Show when={update.releaseNotesVersion}>
                    <span 
                      class="text-sm font-mono px-2 py-0.5 rounded"
                      style={{ background: "rgba(79, 70, 229, 0.2)", color: "var(--cortex-info)" }}
                    >
                      v{update.releaseNotesVersion}
                    </span>
                  </Show>
                </h2>
                <Show when={formattedDate()}>
                  <p class="text-sm text-gray-400">{formattedDate()}</p>
                </Show>
              </div>
            </div>
            <IconButton
              icon={<Icon name="xmark" class="w-5 h-5" />}
              title="Close"
              variant="ghost"
              size="md"
              onClick={handleClose}
            />
          </div>

          {/* Content */}
          <div 
            class="flex-1 overflow-y-auto px-6 py-4"
            style={{ "min-height": "200px" }}
          >
            <Show 
              when={hasContent()} 
              fallback={
                <div class="flex flex-col items-center justify-center py-12 text-center">
                  <Icon name="file-lines" class="w-12 h-12 text-gray-600 mb-4" />
                  <p class="text-gray-400 mb-2">No release notes available</p>
                  <p class="text-sm text-gray-500">
                    Release notes for this version have not been published yet.
                  </p>
                </div>
              }
            >
              {/* Categorized sections */}
              <Show 
                when={parsedSections().length > 0}
                fallback={
                  <div class="prose prose-invert max-w-none">
                    <Markdown content={update.releaseNotes || ""} />
                  </div>
                }
              >
                <For each={parsedSections()}>
                  {(section) => <ReleaseNotesSection section={section} />}
                </For>
              </Show>
            </Show>
          </div>

          {/* Footer */}
          <div 
            class="flex items-center justify-between px-6 py-4 flex-shrink-0"
            style={{ "border-top": "1px solid var(--border, #333)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="arrow-up-right-from-square" class="w-4 h-4" />}
              onClick={handleViewOnGitHub}
            >
              View on GitHub
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleClose}
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}

/**
 * ReleaseNotesButton - Button to show release notes (for menus/commands)
 */
export function ReleaseNotesButton(props: { onClose?: () => void }) {
  const update = useAutoUpdate();
  
  const handleClick = () => {
    props.onClose?.();
    update.showReleaseNotes();
  };
  
  return (
    <button
      onClick={handleClick}
      class="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
      style={{
        color: "var(--cortex-text-primary)",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#333";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon name="file-lines" class="w-3.5 h-3.5" />
      <span>Show Release Notes</span>
    </button>
  );
}

export default ReleaseNotes;

