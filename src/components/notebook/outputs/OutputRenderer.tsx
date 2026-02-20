import type {
  CellOutput,
  StreamOutput,
  ExecuteResultOutput,
  DisplayDataOutput,
  ErrorOutput as ErrorOutputType,
} from "@/context/NotebookContext";
import { TextOutput } from "./TextOutput";
import { AnsiOutput } from "./AnsiOutput";
import { HtmlOutput } from "./HtmlOutput";
import { ImageOutput } from "./ImageOutput";
import { ErrorOutput } from "./ErrorOutput";
import { JsonOutput } from "./JsonOutput";
import { WidgetOutput } from "./WidgetOutput";
import { SafeHTML } from "@/components/ui/SafeHTML";
import { Markdown } from "@/components/Markdown";

function hasAnsiCodes(text: string): boolean {
  return /\x1b\[/.test(text);
}

function resolveDataField(value: string | string[] | undefined): string {
  if (!value) return "";
  return Array.isArray(value) ? value.join("") : value;
}

export interface OutputRendererProps {
  output: CellOutput;
}

export function OutputRenderer(props: OutputRendererProps) {
  const getOutputContent = () => {
    const output = props.output;

    if (output.output_type === "error") {
      const err = output as ErrorOutputType;
      return (
        <ErrorOutput
          name={err.ename}
          message={err.evalue}
          traceback={err.traceback}
        />
      );
    }

    if (output.output_type === "stream") {
      const stream = output as StreamOutput;
      if (hasAnsiCodes(stream.text)) {
        return <AnsiOutput content={stream.text} />;
      }
      return <TextOutput content={stream.text} isError={stream.name === "stderr"} />;
    }

    if (output.output_type === "execute_result" || output.output_type === "display_data") {
      const rich = output as ExecuteResultOutput | DisplayDataOutput;
      const data = rich.data;

      if (data["text/html"]) return <HtmlOutput content={resolveDataField(data["text/html"])} />;
      if (data["image/svg+xml"]) {
        return (
          <SafeHTML
            html={resolveDataField(data["image/svg+xml"])}
            class="notebook-svg-output"
            style={{ "max-width": "100%", overflow: "auto" }}
          />
        );
      }
      if (data["image/png"]) return <ImageOutput mimeType="image/png" data={resolveDataField(data["image/png"])} />;
      if (data["image/jpeg"]) return <ImageOutput mimeType="image/jpeg" data={resolveDataField(data["image/jpeg"])} />;
      if (data["image/gif"]) return <ImageOutput mimeType="image/gif" data={resolveDataField(data["image/gif"])} />;
      if (data["application/json"]) return <JsonOutput data={data["application/json"]} />;
      if (data["application/vnd.jupyter.widget-view+json"]) {
        const widgetData = typeof data["application/vnd.jupyter.widget-view+json"] === "string"
          ? JSON.parse(data["application/vnd.jupyter.widget-view+json"]) as Record<string, unknown>
          : data["application/vnd.jupyter.widget-view+json"] as unknown as Record<string, unknown>;
        return <WidgetOutput data={widgetData} />;
      }
      if (data["text/latex"]) {
        return (
          <pre
            class="font-mono text-code-sm"
            style={{ color: "var(--text-base)", margin: "4px 0" }}
          >
            {resolveDataField(data["text/latex"])}
          </pre>
        );
      }
      if (data["text/markdown"]) return <Markdown content={resolveDataField(data["text/markdown"])} />;
      if (data["text/plain"]) {
        const text = resolveDataField(data["text/plain"]);
        if (hasAnsiCodes(text)) {
          return <AnsiOutput content={text} />;
        }
        return <TextOutput content={text} />;
      }
    }

    return null;
  };

  return <>{getOutputContent()}</>;
}
