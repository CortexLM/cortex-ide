import { JSX, createSignal } from "solid-js";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";

interface PasswordPromptProps {
  onSubmit: (password: string) => void;
  error?: string;
  loading?: boolean;
}

export function PasswordPrompt(props: PasswordPromptProps) {
  const [password, setPassword] = createSignal("");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (password().trim()) {
      props.onSubmit(password());
    }
  };

  const containerStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    "align-items": "center",
    "justify-content": "center",
    "min-height": "100vh",
    padding: "20px",
    background: "var(--surface-base)",
  };

  const cardStyle: JSX.CSSProperties = {
    width: "100%",
    "max-width": "400px",
    "text-align": "center",
  };

  const iconContainerStyle: JSX.CSSProperties = {
    display: "flex",
    "align-items": "center",
    "justify-content": "center",
    width: "64px",
    height: "64px",
    margin: "0 auto 16px",
    background: "var(--surface-hover)",
    "border-radius": "var(--cortex-radius-full)",
    color: "var(--text-muted)",
  };

  const titleStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "18px",
    "font-weight": "600",
    color: "var(--text-title)",
    margin: "0 0 8px",
  };

  const descStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "14px",
    color: "var(--text-muted)",
    margin: "0 0 24px",
  };

  const formStyle: JSX.CSSProperties = {
    display: "flex",
    "flex-direction": "column",
    gap: "16px",
  };

  const errorStyle: JSX.CSSProperties = {
    "font-family": "var(--jb-font-ui)",
    "font-size": "13px",
    color: "var(--state-error)",
    "margin-top": "8px",
  };

  return (
    <div style={containerStyle}>
      <Card variant="elevated" padding="lg" style={cardStyle}>
        <div style={iconContainerStyle}>
          <Icon name="lock" size={28} />
        </div>
        <h1 style={titleStyle}>Protected Session</h1>
        <p style={descStyle}>
          This shared session is password protected. Enter the password to view.
        </p>
        <form onSubmit={handleSubmit} style={formStyle}>
          <Input
            type="password"
            placeholder="Enter password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            disabled={props.loading}
            error={props.error}
          />
          {props.error && <p style={errorStyle}>{props.error}</p>}
          <Button
            type="submit"
            variant="primary"
            disabled={!password().trim() || props.loading}
            loading={props.loading}
          >
            Unlock Session
          </Button>
        </form>
      </Card>
    </div>
  );
}

