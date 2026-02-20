import { Component, JSX, createSignal, createMemo, For, Show } from "solid-js";
import { CortexButton, CortexIcon } from "../primitives";

export interface VulnerableDepsViewProps {
  class?: string;
  style?: JSX.CSSProperties;
}

interface VulnerabilityEntry {
  id: string;
  packageName: string;
  installedVersion: string;
  patchedVersion: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  advisoryUrl?: string;
}

type VulnSeverity = VulnerabilityEntry["severity"];

const VULN_COLORS: Record<VulnSeverity, string> = {
  critical: "var(--cortex-error)",
  high: "var(--cortex-warning)",
  medium: "var(--cortex-warning)",
  low: "var(--cortex-info)",
};

const VULN_LABELS: Record<VulnSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_ORDER: VulnSeverity[] = ["critical", "high", "medium", "low"];

const MOCK_VULNERABILITIES: VulnerabilityEntry[] = [
  {
    id: "vuln-1",
    packageName: "lodash",
    installedVersion: "4.17.20",
    patchedVersion: "4.17.21",
    severity: "critical",
    title: "Prototype Pollution",
    description: "Lodash versions prior to 4.17.21 are vulnerable to Regular Expression Denial of Service (ReDoS) via the toNumber, trim, and trimEnd functions.",
    advisoryUrl: "https://github.com/advisories/GHSA-jf85-cpcp-j695",
  },
  {
    id: "vuln-2",
    packageName: "axios",
    installedVersion: "0.21.1",
    patchedVersion: "0.21.2",
    severity: "high",
    title: "Server-Side Request Forgery",
    description: "Axios before 0.21.2 allows attackers to perform SSRF via a crafted URL with unexpected characters.",
    advisoryUrl: "https://github.com/advisories/GHSA-4w2v-q235-vp99",
  },
  {
    id: "vuln-3",
    packageName: "minimist",
    installedVersion: "1.2.5",
    patchedVersion: "1.2.6",
    severity: "medium",
    title: "Prototype Pollution",
    description: "Minimist before 1.2.6 is vulnerable to Prototype Pollution via the main function.",
    advisoryUrl: "https://github.com/advisories/GHSA-xvch-5gv4-984h",
  },
  {
    id: "vuln-4",
    packageName: "debug",
    installedVersion: "2.6.8",
    patchedVersion: "2.6.9",
    severity: "low",
    title: "Regular Expression Denial of Service",
    description: "The debug module is vulnerable to ReDoS when untrusted user input is passed into the o formatter.",
    advisoryUrl: "https://github.com/advisories/GHSA-gxpj-cx7g-858c",
  },
];

const sectionHeaderStyle: JSX.CSSProperties = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  padding: "8px 12px",
  "border-bottom": "1px solid var(--cortex-border-default)",
  "flex-shrink": "0",
};

export const VulnerableDepsView: Component<VulnerableDepsViewProps> = (props) => {
  const [entries, setEntries] = createSignal<VulnerabilityEntry[]>(MOCK_VULNERABILITIES);

  const counts = createMemo(() => {
    const result: Record<VulnSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const entry of entries()) {
      result[entry.severity]++;
    }
    return result;
  });

  const totalCount = createMemo(() => entries().length);

  const handleUpdate = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div
      class={props.class}
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        background: "var(--cortex-bg-secondary)",
        color: "var(--cortex-text-primary)",
        "font-family": "var(--cortex-font-sans)",
        "font-size": "13px",
        overflow: "hidden",
        ...props.style,
      }}
    >
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
          <CortexIcon name="shield" size={16} color="var(--cortex-text-muted)" />
          <span style={{ "font-weight": "600", "font-size": "13px" }}>Vulnerable Dependencies</span>
          <Show when={totalCount() > 0}>
            <span
              style={{
                "font-size": "11px",
                padding: "1px 6px",
                "border-radius": "var(--cortex-radius-sm)",
                background: "var(--cortex-error)",
                color: "var(--cortex-text-primary)",
                "font-weight": "600",
              }}
            >
              {totalCount()}
            </span>
          </Show>
        </div>
      </div>

      <Show when={totalCount() > 0}>
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "12px",
            padding: "6px 12px",
            "border-bottom": "1px solid var(--cortex-border-default)",
            "flex-shrink": "0",
          }}
        >
          <For each={SEVERITY_ORDER}>
            {(sev) => (
              <Show when={counts()[sev] > 0}>
                <div style={{ display: "flex", "align-items": "center", gap: "4px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      "border-radius": "50%",
                      background: VULN_COLORS[sev],
                      "flex-shrink": "0",
                    }}
                  />
                  <span style={{ "font-size": "11px", color: "var(--cortex-text-muted)" }}>
                    {VULN_LABELS[sev]}
                  </span>
                  <span
                    style={{
                      "font-size": "11px",
                      "font-weight": "600",
                      color: VULN_COLORS[sev],
                    }}
                  >
                    {counts()[sev]}
                  </span>
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>

      <div style={{ flex: "1", overflow: "auto" }} role="list" aria-label="Vulnerability list">
        <Show
          when={totalCount() > 0}
          fallback={
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                "justify-content": "center",
                height: "100%",
                gap: "12px",
                color: "var(--cortex-text-muted)",
              }}
            >
              <CortexIcon name="shield-check" size={32} color="var(--cortex-success)" />
              <span style={{ "font-size": "13px" }}>No vulnerabilities detected</span>
            </div>
          }
        >
          <For each={entries()}>
            {(entry) => (
              <VulnerabilityRow entry={entry} onUpdate={handleUpdate} />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

interface VulnerabilityRowProps {
  entry: VulnerabilityEntry;
  onUpdate: (id: string) => void;
}

const VulnerabilityRow: Component<VulnerabilityRowProps> = (props) => {
  const color = () => VULN_COLORS[props.entry.severity];

  return (
    <div
      role="listitem"
      style={{
        padding: "10px 12px",
        "border-bottom": "1px solid var(--cortex-border-default)",
        "border-left": `3px solid ${color()}`,
      }}
    >
      <div style={{ display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "6px" }}>
        <span
          style={{
            display: "inline-block",
            padding: "1px 6px",
            "border-radius": "var(--cortex-radius-sm)",
            background: color(),
            color: "var(--cortex-text-primary)",
            "font-size": "10px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.3px",
          }}
        >
          {VULN_LABELS[props.entry.severity]}
        </span>
        <span style={{ "font-weight": "600", "font-size": "13px" }}>
          {props.entry.packageName}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "font-size": "11px",
          "font-family": "var(--cortex-font-mono)",
          color: "var(--cortex-text-muted)",
          "margin-bottom": "4px",
        }}
      >
        <span>{props.entry.installedVersion}</span>
        <CortexIcon name="arrow-right" size={10} color="var(--cortex-text-muted)" />
        <span style={{ color: "var(--cortex-success)" }}>{props.entry.patchedVersion}</span>
      </div>

      <div style={{ "font-size": "12px", "font-weight": "500", "margin-bottom": "2px" }}>
        {props.entry.title}
      </div>
      <div
        style={{
          "font-size": "11px",
          color: "var(--cortex-text-muted)",
          "line-height": "1.4",
          "margin-bottom": "8px",
        }}
      >
        {props.entry.description}
      </div>

      <CortexButton
        variant="primary"
        size="xs"
        icon="arrow-up-right-from-square"
        onClick={() => props.onUpdate(props.entry.id)}
        style={{ "font-size": "11px" }}
      >
        Update
      </CortexButton>
    </div>
  );
};

export default VulnerableDepsView;
