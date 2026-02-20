/**
 * TestDecorations.tsx
 * 
 * Monaco editor gutter icons for test files.
 * - Green checkmark for passing tests
 * - Red X for failing tests
 * - Yellow dot for skipped tests
 * - Play button to run individual test
 * - Click handlers to run tests
 */

import { createEffect, createSignal, onCleanup } from "solid-js";
import * as monaco from "monaco-editor";
import { useTesting, TestItem, TestStatus } from "@/context/TestingContext";
import { loadStylesheet } from "@/utils/lazyStyles";
loadStylesheet("testing");

export interface TestDecorationsProps {
  editor: monaco.editor.IStandaloneCodeEditor;
  filePath: string;
}

// Test decoration class names
const TEST_CLASSES = {
  passed: "test-decoration-passed",
  failed: "test-decoration-failed",
  skipped: "test-decoration-skipped",
  running: "test-decoration-running",
  pending: "test-decoration-pending",
  runButton: "test-decoration-run",
} as const;

// Status colors
const STATUS_COLORS = {
  passed: "var(--cortex-success)",
  failed: "var(--cortex-error)",
  skipped: "var(--cortex-warning)",
  running: "var(--cortex-info)",
  pending: "var(--cortex-text-inactive)",
} as const;

/**
 * Parses test file content to find test locations
 * Supports: describe, it, test, beforeEach, afterEach, etc.
 */
function parseTestLocations(content: string): Array<{
  name: string;
  line: number;
  type: "suite" | "test" | "hook";
}> {
  const locations: Array<{ name: string; line: number; type: "suite" | "test" | "hook" }> = [];
  const lines = content.split("\n");
  
  // Regex patterns for different test frameworks
  const patterns = [
    // JavaScript/TypeScript (Jest, Vitest, Mocha)
    { regex: /^\s*(describe|context)\s*\(\s*['"`](.+?)['"`]/, type: "suite" as const },
    { regex: /^\s*(it|test|specify)\s*\(\s*['"`](.+?)['"`]/, type: "test" as const },
    { regex: /^\s*(beforeAll|afterAll|beforeEach|afterEach|before|after)\s*\(/, type: "hook" as const },
    // Python (pytest)
    { regex: /^\s*def\s+(test_\w+)\s*\(/, type: "test" as const },
    { regex: /^\s*class\s+(Test\w+)\s*[:(]/, type: "suite" as const },
    // Rust
    { regex: /^\s*#\[test\]/, type: "test" as const, lookahead: true },
    { regex: /^\s*fn\s+(\w+)\s*\(/, type: "test" as const },
    // Go
    { regex: /^\s*func\s+(Test\w+)\s*\(/, type: "test" as const },
  ];
  
  let pendingTestAttribute = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Handle Rust #[test] attribute
    if (line.match(/^\s*#\[test\]/)) {
      pendingTestAttribute = true;
      continue;
    }
    
    // Check if this is a function following a #[test] attribute
    if (pendingTestAttribute) {
      const fnMatch = line.match(/^\s*fn\s+(\w+)\s*\(/);
      if (fnMatch) {
        locations.push({
          name: fnMatch[1],
          line: lineNum,
          type: "test",
        });
      }
      pendingTestAttribute = false;
      continue;
    }
    
    // Check all other patterns
    for (const pattern of patterns) {
      if (pattern.lookahead) continue; // Skip lookahead patterns in normal loop
      
      const match = line.match(pattern.regex);
      if (match) {
        locations.push({
          name: match[2] || match[1],
          line: lineNum,
          type: pattern.type,
        });
        break;
      }
    }
  }
  
  return locations;
}

/**
 * Injects test decoration CSS styles
 */
function injectTestDecorationStyles(): void {
  const styleId = "test-decoration-styles";
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    /* Test gutter decorations */
    .${TEST_CLASSES.passed}::before {
      content: "\\2713";
      color: ${STATUS_COLORS.passed};
      font-size: 12px;
      font-weight: bold;
    }
    .${TEST_CLASSES.failed}::before {
      content: "\\2717";
      color: ${STATUS_COLORS.failed};
      font-size: 12px;
      font-weight: bold;
    }
    .${TEST_CLASSES.skipped}::before {
      content: "\\25CB";
      color: ${STATUS_COLORS.skipped};
      font-size: 12px;
    }
    .${TEST_CLASSES.running}::before {
      content: "\\25CF";
      color: ${STATUS_COLORS.running};
      font-size: 12px;
      animation: test-running-pulse 1s ease-in-out infinite;
    }
    .${TEST_CLASSES.pending}::before {
      content: "\\25CB";
      color: ${STATUS_COLORS.pending};
      font-size: 12px;
    }
    .${TEST_CLASSES.runButton} {
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }
    .${TEST_CLASSES.runButton}::before {
      content: "\\25B6";
      color: ${STATUS_COLORS.pending};
      font-size: 10px;
    }
    .${TEST_CLASSES.runButton}:hover::before {
      color: ${STATUS_COLORS.passed};
    }
    
    /* Show run button on hover */
    .monaco-editor .margin-view-overlays .line-numbers:hover + .glyph-margin .${TEST_CLASSES.runButton},
    .monaco-editor .margin-view-overlays .glyph-margin:hover .${TEST_CLASSES.runButton} {
      opacity: 1;
    }
    
    @keyframes test-running-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    /* Test line highlight on hover */
    .test-line-highlight {
      background-color: rgba(255, 255, 255, 0.05);
    }
  `;
  document.head.appendChild(style);
}

/**
 * Get the test status for a given test name
 */
function getTestStatusFromContext(
  tests: TestItem[],
  testName: string,
  filePath: string
): TestStatus | null {
  const normalizedPath = filePath.replace(/\\/g, "/");
  
  const findTest = (items: TestItem[]): TestItem | null => {
    for (const item of items) {
      const itemPath = item.filePath.replace(/\\/g, "/");
      
      // Check if this test matches
      if (
        (itemPath === normalizedPath || itemPath.endsWith(normalizedPath.split("/").pop() || "")) &&
        (item.name === testName || item.fullName.includes(testName))
      ) {
        return item;
      }
      
      // Recursively check children
      if (item.children.length > 0) {
        const found = findTest(item.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  const test = findTest(tests);
  return test?.status || null;
}

export function TestDecorations(props: TestDecorationsProps) {
  const testing = useTesting();
  let decorationIds: string[] = [];
  
  // Inject styles on mount
  injectTestDecorationStyles();
  
  // Track parsed test locations from file content
  const [testLocations, setTestLocations] = createSignal<Array<{
    name: string;
    line: number;
    type: "suite" | "test" | "hook";
  }>>([]);
  
  // Parse test locations when file content changes
  createEffect(() => {
    const model = props.editor.getModel();
    if (!model) return;
    
    const content = model.getValue();
    const locations = parseTestLocations(content);
    setTestLocations(locations);
  });
  
  // Apply decorations when test status changes
  createEffect(() => {
    const model = props.editor.getModel();
    if (!model) {
      decorationIds = props.editor.deltaDecorations(decorationIds, []);
      return;
    }
    
    const locations = testLocations();
    const tests = testing.state.tests;
    
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];
    
    for (const location of locations) {
      if (location.type !== "test" && location.type !== "suite") continue;
      
      // Get the status for this test
      const status = getTestStatusFromContext(tests, location.name, props.filePath);
      
      // Determine glyph class based on status
      let glyphClass: string = TEST_CLASSES.pending;
      if (status) {
        switch (status) {
          case "passed":
            glyphClass = TEST_CLASSES.passed;
            break;
          case "failed":
          case "error":
            glyphClass = TEST_CLASSES.failed;
            break;
          case "skipped":
            glyphClass = TEST_CLASSES.skipped;
            break;
          case "running":
            glyphClass = TEST_CLASSES.running;
            break;
        }
      }
      
      // Build hover message
      let hoverMessage = `**${location.type === "suite" ? "Test Suite" : "Test"}:** ${location.name}`;
      if (status) {
        hoverMessage += `\n\n**Status:** ${status}`;
      }
      hoverMessage += "\n\n*Click to run this test*";
      
      newDecorations.push({
        range: new monaco.Range(location.line, 1, location.line, 1),
        options: {
          glyphMarginClassName: glyphClass,
          glyphMarginHoverMessage: {
            value: hoverMessage,
            isTrusted: true,
          },
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }
    
    decorationIds = props.editor.deltaDecorations(decorationIds, newDecorations);
  });
  
  // Handle glyph margin clicks to run tests
  createEffect(() => {
    const handleMouseDown = (e: monaco.editor.IEditorMouseEvent) => {
      if (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        return;
      }
      
      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber) return;
      
      // Find the test at this line
      const locations = testLocations();
      const location = locations.find((l) => l.line === lineNumber);
      
      if (location && (location.type === "test" || location.type === "suite")) {
        // Find the corresponding test in context and run it
        const test = testing.state.tests.find((t) => {
          const testPath = t.filePath.replace(/\\/g, "/");
          const filePath = props.filePath.replace(/\\/g, "/");
          return (
            (testPath === filePath || testPath.endsWith(filePath.split("/").pop() || "")) &&
            (t.name === location.name || t.fullName.includes(location.name))
          );
        });
        
        if (test) {
          testing.runTest(test.id);
        } else {
          // If test not discovered yet, try to run by file
          testing.runTestFile(props.filePath);
        }
      }
    };
    
    const disposable = props.editor.onMouseDown(handleMouseDown);
    
    onCleanup(() => {
      disposable.dispose();
    });
  });
  
  // Listen for model content changes to re-parse test locations
  createEffect(() => {
    const model = props.editor.getModel();
    if (!model) return;
    
    const disposable = model.onDidChangeContent(() => {
      const content = model.getValue();
      const locations = parseTestLocations(content);
      setTestLocations(locations);
    });
    
    onCleanup(() => {
      disposable.dispose();
    });
  });
  
  // Cleanup on unmount
  onCleanup(() => {
    if (props.editor && decorationIds.length > 0) {
      props.editor.deltaDecorations(decorationIds, []);
    }
  });
  
  return null;
}

/**
 * Hook to integrate test decorations with any Monaco editor
 */
export function useTestDecorations(
  editor: () => monaco.editor.IStandaloneCodeEditor | null,
  filePath: () => string | null
) {
  const testing = useTesting();
  let decorationIds: string[] = [];
  
  // Inject styles
  injectTestDecorationStyles();
  
  createEffect(() => {
    const ed = editor();
    const path = filePath();
    
    if (!ed || !path) {
      if (ed && decorationIds.length > 0) {
        decorationIds = ed.deltaDecorations(decorationIds, []);
      }
      return;
    }
    
    const model = ed.getModel();
    if (!model) return;
    
    // Parse test locations
    const content = model.getValue();
    const locations = parseTestLocations(content);
    
    // Build decorations
    const newDecorations: monaco.editor.IModelDeltaDecoration[] = locations
      .filter((loc) => loc.type === "test" || loc.type === "suite")
      .map((location) => {
        const status = getTestStatusFromContext(testing.state.tests, location.name, path);
        
        let glyphClass: string = TEST_CLASSES.pending;
        if (status) {
          switch (status) {
            case "passed":
              glyphClass = TEST_CLASSES.passed;
              break;
            case "failed":
            case "error":
              glyphClass = TEST_CLASSES.failed;
              break;
            case "skipped":
              glyphClass = TEST_CLASSES.skipped;
              break;
            case "running":
              glyphClass = TEST_CLASSES.running;
              break;
          }
        }
        
        return {
          range: new monaco.Range(location.line, 1, location.line, 1),
          options: {
            glyphMarginClassName: glyphClass,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        };
      });
    
    decorationIds = ed.deltaDecorations(decorationIds, newDecorations);
  });
  
  onCleanup(() => {
    const ed = editor();
    if (ed && decorationIds.length > 0) {
      ed.deltaDecorations(decorationIds, []);
    }
  });
}

export default TestDecorations;

