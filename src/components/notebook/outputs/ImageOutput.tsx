import { Show, createMemo, createSignal } from "solid-js";
import { Icon } from "@/components/ui/Icon";

export interface ImageOutputProps {
  mimeType: string;
  data: string;
}

export function ImageOutput(props: ImageOutputProps) {
  const [zoomed, setZoomed] = createSignal(false);

  const src = createMemo(() => {
    if (props.data.startsWith("data:")) {
      return props.data;
    }
    return `data:${props.mimeType};base64,${props.data}`;
  });

  return (
    <>
      <div class="relative group" style={{ "margin-top": "8px" }}>
        <img
          src={src()}
          alt="Cell output"
          onClick={() => setZoomed(true)}
          class="cursor-zoom-in"
          style={{
            "max-width": "100%",
            height: "auto",
            "border-radius": "var(--cortex-radius-sm)",
          }}
        />
        <button
          onClick={() => setZoomed(true)}
          class="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-weak)",
          }}
          title="Zoom image"
        >
          <Icon name="magnifying-glass-plus" class="w-3.5 h-3.5" style={{ color: "var(--text-weak)" }} />
        </button>
      </div>

      <Show when={zoomed()}>
        <div
          class="fixed inset-0 z-[200] flex items-center justify-center cursor-zoom-out"
          style={{ background: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setZoomed(false)}
        >
          <button
            onClick={() => setZoomed(false)}
            class="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: "var(--surface-raised)" }}
          >
            <Icon name="xmark" class="w-5 h-5" style={{ color: "var(--text-base)" }} />
          </button>
          <img
            src={src()}
            alt="Cell output (zoomed)"
            style={{
              "max-width": "90vw",
              "max-height": "90vh",
              "object-fit": "contain",
              "border-radius": "var(--cortex-radius-sm)",
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </Show>
    </>
  );
}
