import { SafeHTML } from "@/components/ui/SafeHTML";

export interface HtmlOutputProps {
  content: string;
}

export function HtmlOutput(props: HtmlOutputProps) {
  return (
    <SafeHTML
      html={props.content}
      class="notebook-html-output prose prose-invert max-w-none"
      style={{
        "max-width": "100%",
        overflow: "auto",
      }}
    />
  );
}
