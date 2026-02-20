import { Show } from "solid-js";

interface TerminalBlockProps {
  content: string;
  status?: 'success' | 'error' | 'running' | 'completed';
  isCommand?: boolean;
}

export function TerminalBlock(props: TerminalBlockProps) {
  const isError = () => props.status === 'error';
  
  return (
    <div 
      class="font-mono text-[11px] p-2 rounded border my-1 overflow-x-auto whitespace-pre-wrap break-all select-text leading-relaxed"
      style={{
        background: isError() ? "rgba(248, 113, 113, 0.05)" : "var(--cortex-bg-secondary)",
        "border-color": isError() ? "rgba(248, 113, 113, 0.2)" : "#222",
        color: isError() ? "var(--cortex-error)" : "var(--cortex-text-secondary)"
      }}
    >
      <Show when={props.isCommand}>
        <span class="text-[var(--cortex-success)] mr-2 opacity-70">$</span>
      </Show>
      {props.content}
    </div>
  );
}

