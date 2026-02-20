import { Component, JSX, createSignal, onMount, onCleanup } from "solid-js";

export interface ScreenReaderAnnouncerProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export const ScreenReaderAnnouncer: Component<ScreenReaderAnnouncerProps> = (props) => {
  const [message, setMessage] = createSignal("");
  const [politeness, setPoliteness] = createSignal<"polite" | "assertive">("polite");
  let regionRef: HTMLDivElement | undefined;

  onMount(() => {
    const handleAnnouncement = (e: CustomEvent<{ message: string; politeness?: "polite" | "assertive" }>) => {
      if (e.detail?.message) {
        setPoliteness(e.detail.politeness || "polite");
        setMessage("");
        requestAnimationFrame(() => {
          setMessage(e.detail.message);
        });
      }
    };

    window.addEventListener("accessibility:announcement", handleAnnouncement as EventListener);

    onCleanup(() => {
      window.removeEventListener("accessibility:announcement", handleAnnouncement as EventListener);
    });
  });

  const containerStyle: JSX.CSSProperties = {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    "white-space": "nowrap",
    border: "0",
    ...props.style,
  };

  return (
    <div
      ref={regionRef}
      class={props.class}
      style={containerStyle}
      role="status"
      aria-live={politeness()}
      aria-atomic="true"
    >
      {message()}
    </div>
  );
};

export default ScreenReaderAnnouncer;
