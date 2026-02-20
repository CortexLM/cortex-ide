function stripAnsiCodes(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export interface TextOutputProps {
  content: string;
  isError?: boolean;
}

export function TextOutput(props: TextOutputProps) {
  return (
    <pre
      class="font-mono text-code-sm whitespace-pre-wrap break-words"
      style={{
        color: props.isError ? "var(--error)" : "var(--text-base)",
        margin: 0,
        padding: "4px 0",
        "line-height": "1.5",
      }}
    >
      {stripAnsiCodes(props.content)}
    </pre>
  );
}
