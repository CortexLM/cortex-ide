import { For, Show, createMemo, JSX } from "solid-js";
import { parseAnsi, type AnsiSegment, type AnsiStyle, hasAnsiCodes } from "@/utils/ansiParser";

/**
 * Represents a detected link in the output text.
 */
interface DetectedLink {
  type: "file" | "url";
  text: string;
  href: string;
  line?: number;
  column?: number;
}

/**
 * A segment of text that may be plain text or a link.
 */
interface TextSegment {
  type: "text" | "link";
  text: string;
  link?: DetectedLink;
}

/**
 * Props for the LinkifiedOutput component.
 */
interface LinkifiedOutputProps {
  /** The raw output text to process */
  text: string;
  /** Base color for the text (can be overridden by ANSI codes) */
  color?: string;
  /** Callback when a file link is clicked */
  onFileClick?: (path: string, line?: number, column?: number) => void;
  /** Callback when a URL is clicked */
  onUrlClick?: (url: string) => void;
}

/**
 * Regex patterns for link detection.
 */
const PATTERNS = {
  // URL pattern (http/https)
  url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
  
  // File path with optional line:column
  // Matches patterns like:
  // - /path/to/file.ts:10:5
  // - /path/to/file.ts:10
  // - C:\path\to\file.ts:10:5
  // - ./relative/file.ts:10
  // - file.ts:10:5
  filePath: /(?:(?:[A-Za-z]:)?(?:\/|\\)?(?:\.{1,2}\/)?)?(?:[\w.-]+[/\\])*[\w.-]+\.[a-zA-Z0-9]+(?::(\d+)(?::(\d+))?)?/g,
  
  // Stack trace patterns (language-specific)
  // JavaScript/Node.js: at functionName (/path/file.js:10:5)
  jsStackTrace: /at\s+(?:[\w.<>]+\s+)?\(?((?:[A-Za-z]:)?(?:\/|\\)?(?:[\w.-]+[/\\])*[\w.-]+\.[a-zA-Z0-9]+):(\d+):(\d+)\)?/g,
  
  // Python: File "/path/file.py", line 10, in function
  pythonStackTrace: /File\s+"((?:[A-Za-z]:)?(?:\/|\\)?(?:[\w.-]+[/\\])*[\w.-]+\.py)",\s+line\s+(\d+)/g,
  
  // Rust: at src/main.rs:10:5
  rustStackTrace: /at\s+((?:[\w.-]+[/\\])*[\w.-]+\.rs):(\d+):(\d+)/g,
  
  // Go: /path/file.go:10
  goStackTrace: /((?:[A-Za-z]:)?(?:\/|\\)?(?:[\w.-]+[/\\])*[\w.-]+\.go):(\d+)/g,
};

/**
 * Detects links in text and returns segments.
 */
function detectLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const links: Array<{ start: number; end: number; link: DetectedLink }> = [];

  // Detect URLs
  const urlMatches = text.matchAll(PATTERNS.url);
  for (const match of urlMatches) {
    if (match.index !== undefined) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        link: {
          type: "url",
          text: match[0],
          href: match[0],
        },
      });
    }
  }

  // Detect JavaScript stack traces
  const jsMatches = text.matchAll(PATTERNS.jsStackTrace);
  for (const match of jsMatches) {
    if (match.index !== undefined) {
      const path = match[1];
      const line = parseInt(match[2], 10);
      const column = match[3] ? parseInt(match[3], 10) : undefined;
      
      // Find the start of the path in the match
      const pathStart = match[0].indexOf(path);
      const pathEnd = pathStart + path.length + (match[2] ? `:${match[2]}`.length : 0) + (match[3] ? `:${match[3]}`.length : 0);
      
      links.push({
        start: match.index + pathStart,
        end: match.index + pathEnd,
        link: {
          type: "file",
          text: match[0].slice(pathStart, pathEnd),
          href: path,
          line,
          column,
        },
      });
    }
  }

  // Detect Python stack traces
  const pyMatches = text.matchAll(PATTERNS.pythonStackTrace);
  for (const match of pyMatches) {
    if (match.index !== undefined) {
      const path = match[1];
      const line = parseInt(match[2], 10);
      
      // Find the path within quotes
      const pathStart = match[0].indexOf('"') + 1;
      const pathEnd = match[0].indexOf('"', pathStart);
      
      links.push({
        start: match.index + pathStart,
        end: match.index + pathEnd,
        link: {
          type: "file",
          text: path,
          href: path,
          line,
        },
      });
    }
  }

  // Detect Rust stack traces
  const rustMatches = text.matchAll(PATTERNS.rustStackTrace);
  for (const match of rustMatches) {
    if (match.index !== undefined) {
      const path = match[1];
      const line = parseInt(match[2], 10);
      const column = match[3] ? parseInt(match[3], 10) : undefined;
      
      const pathStart = match[0].indexOf(path);
      const fullMatch = `${path}:${match[2]}${match[3] ? `:${match[3]}` : ""}`;
      
      links.push({
        start: match.index + pathStart,
        end: match.index + pathStart + fullMatch.length,
        link: {
          type: "file",
          text: fullMatch,
          href: path,
          line,
          column,
        },
      });
    }
  }

  // Detect Go stack traces
  const goMatches = text.matchAll(PATTERNS.goStackTrace);
  for (const match of goMatches) {
    if (match.index !== undefined) {
      const path = match[1];
      const line = parseInt(match[2], 10);
      
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        link: {
          type: "file",
          text: match[0],
          href: path,
          line,
        },
      });
    }
  }

  // Detect generic file paths with line numbers
  const fileMatches = text.matchAll(PATTERNS.filePath);
  for (const match of fileMatches) {
    if (match.index !== undefined) {
      // Skip if this overlaps with an already detected link
      const overlaps = links.some(
        (l) => match.index! < l.end && match.index! + match[0].length > l.start
      );
      if (overlaps) continue;

      // Parse line and column from the match groups
      const fullMatch = match[0];
      const parts = fullMatch.split(":");
      let path = fullMatch;
      let line: number | undefined;
      let column: number | undefined;

      // Handle Windows paths (C:\...)
      if (parts.length > 1 && parts[0].length === 1 && /[A-Za-z]/.test(parts[0])) {
        // Windows path with drive letter
        if (parts.length >= 3) {
          path = `${parts[0]}:${parts[1]}`;
          if (parts[2] && /^\d+$/.test(parts[2])) {
            line = parseInt(parts[2], 10);
            if (parts[3] && /^\d+$/.test(parts[3])) {
              column = parseInt(parts[3], 10);
            }
          }
        }
      } else {
        // Unix path or relative path
        const lastColon = fullMatch.lastIndexOf(":");
        const secondLastColon = fullMatch.lastIndexOf(":", lastColon - 1);
        
        if (lastColon > 0) {
          const afterLastColon = fullMatch.slice(lastColon + 1);
          if (/^\d+$/.test(afterLastColon)) {
            column = parseInt(afterLastColon, 10);
            
            if (secondLastColon > 0) {
              const betweenColons = fullMatch.slice(secondLastColon + 1, lastColon);
              if (/^\d+$/.test(betweenColons)) {
                line = parseInt(betweenColons, 10);
                path = fullMatch.slice(0, secondLastColon);
              } else {
                line = column;
                column = undefined;
                path = fullMatch.slice(0, lastColon);
              }
            } else {
              line = column;
              column = undefined;
              path = fullMatch.slice(0, lastColon);
            }
          }
        }
      }

      // Only add if it looks like a real file path
      const hasExtension = /\.[a-zA-Z0-9]+/.test(path);
      if (hasExtension) {
        links.push({
          start: match.index,
          end: match.index + match[0].length,
          link: {
            type: "file",
            text: fullMatch,
            href: path,
            line,
            column,
          },
        });
      }
    }
  }

  // Sort links by start position
  links.sort((a, b) => a.start - b.start);

  // Remove overlapping links (keep the first one)
  const filteredLinks: typeof links = [];
  for (const link of links) {
    const overlaps = filteredLinks.some(
      (l) => link.start < l.end && link.end > l.start
    );
    if (!overlaps) {
      filteredLinks.push(link);
    }
  }

  // Build segments
  let lastEnd = 0;
  for (const { start, end, link } of filteredLinks) {
    // Add text before the link
    if (start > lastEnd) {
      segments.push({
        type: "text",
        text: text.slice(lastEnd, start),
      });
    }

    // Add the link
    segments.push({
      type: "link",
      text: link.text,
      link,
    });

    lastEnd = end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({
      type: "text",
      text: text.slice(lastEnd),
    });
  }

  // If no segments, return the original text
  if (segments.length === 0) {
    segments.push({
      type: "text",
      text,
    });
  }

  return segments;
}

/**
 * Converts AnsiStyle to CSS style object.
 */
function ansiStyleToCSS(style: AnsiStyle, baseColor?: string): JSX.CSSProperties {
  const css: JSX.CSSProperties = {};

  if (style.color) {
    css.color = style.color;
  } else if (baseColor) {
    css.color = baseColor;
  }

  if (style.backgroundColor) {
    css["background-color"] = style.backgroundColor;
  }

  if (style.bold) {
    css["font-weight"] = "bold";
  }

  if (style.italic) {
    css["font-style"] = "italic";
  }

  if (style.underline) {
    css["text-decoration"] = "underline";
  }

  return css;
}

/**
 * Renders a link element.
 */
function LinkElement(props: {
  link: DetectedLink;
  onFileClick?: (path: string, line?: number, column?: number) => void;
  onUrlClick?: (url: string) => void;
  style?: JSX.CSSProperties;
}) {
  const handleClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (props.link.type === "file" && props.onFileClick) {
      props.onFileClick(props.link.href, props.link.line, props.link.column);
    } else if (props.link.type === "url" && props.onUrlClick) {
      props.onUrlClick(props.link.href);
    }
  };

  return (
    <span
      class="cursor-pointer hover:underline"
      style={{
        ...props.style,
        color: props.link.type === "url" ? "var(--cortex-info)" : "var(--cortex-info)",
      }}
      onClick={handleClick}
      title={
        props.link.type === "file"
          ? `Open ${props.link.href}${props.link.line ? `:${props.link.line}` : ""}${props.link.column ? `:${props.link.column}` : ""}`
          : `Open ${props.link.href}`
      }
    >
      {props.link.text}
    </span>
  );
}

/**
 * LinkifiedOutput component - renders debug output with ANSI color support
 * and clickable links for file paths and URLs.
 */
export function LinkifiedOutput(props: LinkifiedOutputProps) {
  // Process the text: first parse ANSI, then detect links in each segment
  const processedSegments = createMemo(() => {
    const result: Array<{
      type: "text" | "link";
      text: string;
      style: AnsiStyle;
      link?: DetectedLink;
    }> = [];

    // Check if text has ANSI codes
    const ansiSegments: AnsiSegment[] = hasAnsiCodes(props.text)
      ? parseAnsi(props.text)
      : [{ text: props.text, style: {} }];

    // For each ANSI segment, detect links
    for (const ansiSegment of ansiSegments) {
      const linkSegments = detectLinks(ansiSegment.text);

      for (const linkSegment of linkSegments) {
        result.push({
          type: linkSegment.type,
          text: linkSegment.text,
          style: ansiSegment.style,
          link: linkSegment.link,
        });
      }
    }

    return result;
  });

  return (
    <span>
      <For each={processedSegments()}>
        {(segment) => (
          <Show
            when={segment.type === "link" && segment.link}
            fallback={
              <span style={ansiStyleToCSS(segment.style, props.color)}>
                {segment.text}
              </span>
            }
          >
            <LinkElement
              link={segment.link!}
              onFileClick={props.onFileClick}
              onUrlClick={props.onUrlClick}
              style={ansiStyleToCSS(segment.style, props.color)}
            />
          </Show>
        )}
      </For>
    </span>
  );
}

export default LinkifiedOutput;

