import { Component, JSX } from "solid-js";
import { OutputChannel as BaseOutputChannel } from "@/components/output/OutputChannel";

export interface CortexOutputChannelProps {
  channelName: string;
  lockScroll?: boolean;
  filterText?: string;
  style?: JSX.CSSProperties;
}

export const CortexOutputChannel: Component<CortexOutputChannelProps> = (props) => {
  const containerStyle = (): JSX.CSSProperties => ({
    flex: "1",
    display: "flex",
    "flex-direction": "column",
    overflow: "hidden",
    background: "var(--cortex-bg-primary)",
    "border-radius": "var(--cortex-radius-sm, 4px)",
    ...props.style,
  });

  return (
    <div style={containerStyle()}>
      <BaseOutputChannel
        channelName={props.channelName}
        lockScroll={props.lockScroll}
        filterText={props.filterText}
      />
    </div>
  );
};

export default CortexOutputChannel;
