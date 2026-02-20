import { JSX, createSignal, Show } from "solid-js";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

interface SharedSessionHeaderProps {
  title: string;
  createdAt: string;
  expiresAt?: string;
  onCopyLink?: () => void;
  onReport?: () => void;
}

/**
 * Format date to readable string
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format relative time from now
 */
function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs < 0) return "expired";
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  
  const diffMins = Math.floor(diffMs / (1000 * 60));
  return `in ${diffMins} minute${diffMins > 1 ? "s" : ""}`;
}

export function SharedSessionHeader(props: SharedSessionHeaderProps) {
  const [copied, setCopied] = createSignal(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      props.onCopyLink?.();
    } catch (e) {
      console.error("Failed to copy link:", e);
    }
  };

  const headerStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    padding: "16px 20px",
    "border-bottom": "1px solid var(--border-default)",
    background: "var(--surface-base)",
  };

  const titleContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "4px",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "18px",
    "font-weight": "600",
    color: "var(--text-title)",
    margin: "0",
  };

  const subtitleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--text-muted)",
    display: "flex",
    "align-items": "center",
    gap: "8px",
  };

  const actionsStyle: JSX.CSSProperties = {
    display: "flex",
    gap: "8px",
  };

  return (
    <header style={headerStyle}>
      <div style={titleContainerStyle}>
        <h1 style={titleStyle}>{props.title || "Shared Session"}</h1>
        <p style={subtitleStyle}>
          <span>Shared on {formatDate(props.createdAt)}</span>
          <Show when={props.expiresAt}>
            <span style={{ color: "var(--text-weaker)" }}>•</span>
            <span>Expires {formatRelative(props.expiresAt!)}</span>
          </Show>
        </p>
      </div>
      <div style={actionsStyle}>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          icon={<Icon name={copied() ? "check" : "link"} size={14} />}
        >
          {copied() ? "Copied!" : "Copy Link"}
        </Button>
        <Show when={props.onReport}>
          <Button
            variant="ghost"
            size="sm"
            onClick={props.onReport}
            icon={<Icon name="flag" size={14} />}
          >
            Report
          </Button>
        </Show>
      </div>
    </header>
  );
}
