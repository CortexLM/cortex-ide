import { Component, JSX, createMemo } from "solid-js";
import { CortexDropdown, type CortexDropdownOption } from "../primitives";

export interface OutputChannelSelectorProps {
  channels: string[];
  value: string | null;
  onChange: (channel: string) => void;
  style?: JSX.CSSProperties;
}

export const OutputChannelSelector: Component<OutputChannelSelectorProps> = (props) => {
  const options = createMemo((): CortexDropdownOption[] =>
    props.channels.map((name) => ({
      value: name,
      label: name,
    }))
  );

  const selectorStyle = (): JSX.CSSProperties => ({
    "min-width": "140px",
    ...props.style,
  });

  return (
    <CortexDropdown
      options={options()}
      value={props.value ?? ""}
      placeholder="Select channel..."
      onChange={props.onChange}
      style={selectorStyle()}
    />
  );
};

export default OutputChannelSelector;
