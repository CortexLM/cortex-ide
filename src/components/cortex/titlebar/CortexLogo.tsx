import { Component } from "solid-js";

export const CortexLogo: Component<{ size?: number }> = (props) => {
  const size = props.size || 40;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.5293 13.416L26.9454 13.4167L32.0016 22.1533H27.5855L22.5293 13.416Z" fill="var(--cortex-accent-primary)"/>
      <path d="M19.2225 17.5391L21.4295 13.7241L26.4863 22.4613L24.2786 26.2764L19.2225 17.5391Z" fill="var(--cortex-accent-primary)"/>
      <path d="M19.2225 27.3857L21.4316 23.5707L23.6386 27.3843L21.4309 31.1993L19.2225 27.3857Z" fill="var(--cortex-accent-primary)"/>
      <path d="M26.6635 31.997L31.7203 23.2598H27.3049L22.248 31.997H26.6635Z" fill="var(--cortex-accent-primary)"/>
      <path d="M8.00781 17.8477H12.4218L17.4787 26.5849L13.0626 26.5842L8.00781 17.8477Z" fill="var(--cortex-accent-primary)"/>
      <path d="M13.5195 17.5403L15.7272 13.7246L20.7834 22.4619L18.575 26.2769L13.5195 17.5403Z" fill="var(--cortex-accent-primary)"/>
      <path d="M16.3691 12.6178L18.5768 8.80273L20.7853 12.6164L18.5776 16.4314L16.3691 12.6178Z" fill="var(--cortex-accent-primary)"/>
      <path d="M13.3426 8.00195L8.28711 16.7399L12.7011 16.7385L17.758 8.00195H13.3426Z" fill="var(--cortex-accent-primary)"/>
    </svg>
  );
};
