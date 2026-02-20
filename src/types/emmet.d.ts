/**
 * Type declarations for the emmet package.
 * 
 * The emmet package has its own types but there's an issue with package.json "exports"
 * resolution in TypeScript. This declaration file provides the types needed for our usage.
 */
declare module "emmet" {
  export interface ExpandOptions {
    /** Type of abbreviation: 'markup' for HTML/XML or 'stylesheet' for CSS */
    type?: "markup" | "stylesheet";
    /** Options for the output */
    options?: {
      /** Indent string (default: "\t") */
      "output.indent"?: string;
      /** Newline character (default: "\n") */
      "output.newline"?: string;
      /** Base indent for output */
      "output.baseIndent"?: string;
      /** Comment markup output */
      "output.comment"?: boolean;
      /** Put fields (tab stops) inside output */
      "output.field"?: boolean;
      /** Format output for single line */
      "output.inlineBreak"?: number;
      /** Compact boolean attributes in HTML */
      "output.compactBoolean"?: boolean;
      /** Attribute quoting style */
      "output.attributeQuotes"?: "single" | "double";
      /** Use short notation for self-closing tags */
      "output.selfClosingStyle"?: "html" | "xml" | "xhtml";
      /** Format for number output in CSS */
      "stylesheet.between"?: string;
      /** Format for short hex colors in CSS */
      "stylesheet.shortHex"?: boolean;
    };
    /** Custom variables for snippets */
    variables?: Record<string, string>;
    /** Custom snippets */
    snippets?: Record<string, string>;
    /** Maximum output length (safeguard) */
    maxRepeat?: number;
  }

  /**
   * Expand an Emmet abbreviation into its full output.
   * @param abbreviation The abbreviation to expand
   * @param options Optional expansion options
   * @returns The expanded output string
   */
  export function expand(abbreviation: string, options?: ExpandOptions): string;
}
