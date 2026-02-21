import { Component } from "solid-js";

export const CortexLogo: Component<{ size?: number }> = (props) => {
  const size = () => props.size || 40;
  return (
    <div
      style={{
        width: `${size()}px`,
        height: `${size()}px`,
        "border-radius": "12px",
        background: "linear-gradient(137deg, rgba(77,86,255,1) 0%, rgba(105,71,147,1) 95%)",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "flex-shrink": "0",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5293 5.416L18.9454 5.4167L24.0016 14.1533H19.5855L14.5293 5.416Z" fill="#FCFCFC"/>
        <path d="M11.2225 9.5391L13.4295 5.7241L18.4863 14.4613L16.2786 18.2764L11.2225 9.5391Z" fill="#FCFCFC"/>
        <path d="M11.2225 19.3857L13.4316 15.5707L15.6386 19.3843L13.4309 23.1993L11.2225 19.3857Z" fill="#FCFCFC"/>
        <path d="M18.6635 23.997L23.7203 15.2598H19.3049L14.248 23.997H18.6635Z" fill="#FCFCFC"/>
        <path d="M0.00781 9.8477H4.42181L9.47868 18.5849L5.06262 18.5842L0.00781 9.8477Z" fill="#FCFCFC"/>
        <path d="M5.51953 9.5403L7.72722 5.7246L12.7834 14.4619L10.575 18.2769L5.51953 9.5403Z" fill="#FCFCFC"/>
        <path d="M8.36914 4.6178L10.5768 0.802734L12.7853 4.6164L10.5776 8.4314L8.36914 4.6178Z" fill="#FCFCFC"/>
        <path d="M5.34258 0.00195L0.287109 8.7399L4.70114 8.7385L9.75797 0.00195H5.34258Z" fill="#FCFCFC"/>
      </svg>
    </div>
  );
};
