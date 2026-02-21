import { Component } from "solid-js";
import { MacWindowControls } from "./MacWindowControls";
import { WindowsLinuxWindowControls } from "./WindowsLinuxWindowControls";
import { detectPlatform } from "./platformDetect";

export interface WindowControlsProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export const WindowControls: Component<WindowControlsProps> = (props) => {
  const os = detectPlatform();

  if (os === "macos") {
    return (
      <MacWindowControls
        onMinimize={props.onMinimize}
        onMaximize={props.onMaximize}
        onClose={props.onClose}
      />
    );
  }

  return (
    <WindowsLinuxWindowControls
      onMinimize={props.onMinimize}
      onMaximize={props.onMaximize}
      onClose={props.onClose}
    />
  );
};
