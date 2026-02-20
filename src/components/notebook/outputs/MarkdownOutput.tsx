import { Markdown } from "@/components/Markdown";

export interface MarkdownOutputProps {
  content: string;
}

export function MarkdownOutput(props: MarkdownOutputProps) {
  return (
    <div
      class="notebook-markdown-output"
      style={{ padding: "4px 0" }}
    >
      <Markdown content={props.content} />
    </div>
  );
}
