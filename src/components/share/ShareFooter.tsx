import { JSX, Show } from "solid-js";
import { Icon } from "@/components/ui/Icon";

interface ShareFooterProps {
  sessionId: string;
  viewCount: number;
  messageCount?: number;
}

export function ShareFooter(props: ShareFooterProps) {
  const footerStyle: JSX.CSSProperties = {
    display: "flex",
    "justify-content": "space-between",
    "align-items": "center",
    padding: "12px 20px",
    "border-top": "1px solid var(--border-default)",
    background: "var(--surface-base)",
    "font-family": "var(--jb-font-ui)",
    "font-size": "12px",
    color: "var(--text-muted)",
  };

  const statsStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "16px",
  };

  const statItemStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "4px",
  };

  const brandStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    color: "var(--text-weaker)",
  };

  const linkStyle: JSX.CSSProperties = {
    color: "var(--accent-primary)",
    "text-decoration": "none",
  };

  return (
    <footer style={footerStyle}>
      <div style={statsStyle}>
        <div style={statItemStyle}>
          <Icon name="eye" size={14} />
          <span>{props.viewCount} view{props.viewCount !== 1 ? "s" : ""}</span>
        </div>
        <Show when={props.messageCount !== undefined}>
          <div style={statItemStyle}>
            <Icon name="message" size={14} />
            <span>{props.messageCount} message{props.messageCount !== 1 ? "s" : ""}</span>
          </div>
        </Show>
      </div>
      <div style={brandStyle}>
        <span>Powered by</span>
        <a href="https://cortex.dev" target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Cortex
        </a>
      </div>
    </footer>
  );
}
