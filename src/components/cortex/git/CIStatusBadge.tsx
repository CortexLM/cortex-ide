import { Component, Show, Switch, Match } from "solid-js";

interface CIStatusBadgeProps {
  status: string;
  conclusion?: string;
  name: string;
  url?: string;
}

const SuccessIcon: Component = () => (
  <svg class="w-3.5 h-3.5 text-green-400" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
  </svg>
);

const FailureIcon: Component = () => (
  <svg class="w-3.5 h-3.5 text-red-400" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
  </svg>
);

const SpinnerIcon: Component = () => (
  <svg class="w-3.5 h-3.5 text-yellow-400 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="8" cy="8" r="6" stroke-dasharray="28" stroke-dashoffset="8" stroke-linecap="round" />
  </svg>
);

const QueuedIcon: Component = () => (
  <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z" />
    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
  </svg>
);

const NeutralIcon: Component = () => (
  <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8z" />
  </svg>
);

const resolvedStatus = (status: string, conclusion?: string): string => {
  if (conclusion === "success") return "success";
  if (conclusion === "failure") return "failure";
  if (conclusion === "neutral" || conclusion === "cancelled") return "neutral";
  return status;
};

export const CIStatusBadge: Component<CIStatusBadgeProps> = (props) => {
  const effective = () => resolvedStatus(props.status, props.conclusion);

  const handleClick = () => {
    if (props.url) {
      window.open(props.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!props.url}
      class={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
        props.url ? "hover:bg-white/10 cursor-pointer" : "cursor-default"
      }`}
      title={props.name}
    >
      <Switch fallback={<NeutralIcon />}>
        <Match when={effective() === "success"}>
          <SuccessIcon />
        </Match>
        <Match when={effective() === "failure"}>
          <FailureIcon />
        </Match>
        <Match when={effective() === "in_progress"}>
          <SpinnerIcon />
        </Match>
        <Match when={effective() === "queued"}>
          <QueuedIcon />
        </Match>
      </Switch>
      <span class="text-white/70 truncate max-w-[160px]">{props.name}</span>
      <Show when={props.url}>
        <svg class="w-3 h-3 text-white/30 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z" />
          <path d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z" />
        </svg>
      </Show>
    </button>
  );
};

export default CIStatusBadge;
