import { JSX, Show, For } from "solid-js";
import { Icon } from "@/components/ui/Icon";

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination(props: PaginationProps) {
  const totalPages = () => Math.ceil(props.total / props.pageSize);
  const currentPage = () => props.page;

  // Generate page numbers to show
  const pageNumbers = () => {
    const total = totalPages();
    const current = currentPage();
    const pages: (number | "...")[] = [];

    if (total <= 7) {
      // Show all pages if 7 or less
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 3) {
        pages.push("...");
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push("...");
      }

      // Always show last page
      pages.push(total);
    }

    return pages;
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "space-between",
    padding: "16px 0",
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
  };

  const infoStyle: JSX.CSSProperties = {
    color: "var(--text-muted)",
  };

  const controlsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  const pageButtonStyle = (isActive: boolean, isDisabled: boolean): JSX.CSSProperties => ({
    "min-width": "32px",
    height: "32px",
    padding: "0 8px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    background: isActive ? "var(--accent-primary)" : "transparent",
    color: isActive ? "var(--cortex-text-primary)" : isDisabled ? "var(--text-weaker)" : "var(--text-primary)",
    border: isActive ? "none" : "1px solid var(--border-default)",
    "border-radius": "var(--jb-radius-sm)",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? "0.5" : "1",
    transition: "background 150ms ease, border-color 150ms ease",
    "font-size": "13px",
  });

  const ellipsisStyle: JSX.CSSProperties = {
    "min-width": "32px",
    height: "32px",
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    color: "var(--text-weaker)",
  };

  // Calculate range being shown
  const startItem = () => (props.page - 1) * props.pageSize + 1;
  const endItem = () => Math.min(props.page * props.pageSize, props.total);

  return (
    <Show when={props.total > 0}>
      <div style={containerStyle}>
        <div style={infoStyle}>
          Showing {startItem()}-{endItem()} of {props.total} sessions
        </div>

        <div style={controlsStyle}>
          {/* Previous button */}
          <button
            style={pageButtonStyle(false, currentPage() === 1)}
            onClick={() => props.onPageChange(currentPage() - 1)}
            disabled={currentPage() === 1}
            aria-label="Previous page"
          >
            <Icon name="chevron-left" size={14} />
          </button>

          {/* Page numbers */}
          <For each={pageNumbers()}>
            {(page) => (
              <Show
                when={page !== "..."}
                fallback={<span style={ellipsisStyle}>...</span>}
              >
                <button
                  style={pageButtonStyle(page === currentPage(), false)}
                  onClick={() => props.onPageChange(page as number)}
                  onMouseEnter={(e) => {
                    if (page !== currentPage()) {
                      e.currentTarget.style.background = "var(--surface-hover)";
                      e.currentTarget.style.borderColor = "var(--border-hover)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage()) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "var(--border-default)";
                    }
                  }}
                >
                  {page}
                </button>
              </Show>
            )}
          </For>

          {/* Next button */}
          <button
            style={pageButtonStyle(false, currentPage() === totalPages())}
            onClick={() => props.onPageChange(currentPage() + 1)}
            disabled={currentPage() === totalPages()}
            aria-label="Next page"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>
    </Show>
  );
}

